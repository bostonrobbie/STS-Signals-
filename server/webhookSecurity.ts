/**
 * Enterprise-Grade Webhook Security & Reliability Module
 * 
 * Provides:
 * - Rate limiting (per IP and global)
 * - Request validation and sanitization
 * - Replay attack prevention
 * - Circuit breaker pattern
 * - Idempotency support
 * - Structured logging with correlation IDs
 */

import crypto from 'crypto';

// ============================================
// Rate Limiting
// ============================================

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// In-memory rate limit store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 60,       // 60 requests per minute
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitStore(config.windowMs);
  }

  if (!entry || now - entry.windowStart >= config.windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    const resetAt = entry.windowStart + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: Math.ceil((resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.windowStart + config.windowMs,
  };
}

function cleanupRateLimitStore(windowMs: number): void {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.windowStart >= windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// ============================================
// Request Validation & Sanitization
// ============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB
const MAX_STRING_LENGTH = 1000;
const ALLOWED_FIELDS = [
  'symbol', 'strategy', 'date', 'timestamp', 'data', 'action',
  'quantity', 'price', 'token', 'direction', 'entryPrice',
  'entryTime', 'pnl', 'comment', 'multiple_accounts'
];

/**
 * Validate and sanitize webhook payload
 */
export function validateAndSanitize(payload: unknown): ValidationResult {
  const errors: string[] = [];

  // Check if payload is an object
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Payload must be a JSON object'] };
  }

  const raw = payload as Record<string, unknown>;

  // Check payload size
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    errors.push(`Payload size ${payloadSize} exceeds maximum ${MAX_PAYLOAD_SIZE} bytes`);
  }

  // Sanitize and validate each field
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    // Check for allowed fields
    if (!ALLOWED_FIELDS.includes(key)) {
      // Skip unknown fields but don't error
      continue;
    }

    // Sanitize strings
    if (typeof value === 'string') {
      if (value.length > MAX_STRING_LENGTH) {
        errors.push(`Field "${key}" exceeds maximum length of ${MAX_STRING_LENGTH}`);
        continue;
      }

      // Check for potential injection patterns
      const injectionPatterns = [
        /[<>]/,                    // HTML tags
        /javascript:/i,            // JavaScript protocol
        /on\w+\s*=/i,             // Event handlers
        /--/,                      // SQL comment
        /;\s*DROP/i,              // SQL injection
        /UNION\s+SELECT/i,        // SQL injection
        /'\s*OR\s+'1'\s*=\s*'1/i, // SQL injection
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(value)) {
          errors.push(`Field "${key}" contains potentially malicious content`);
          break;
        }
      }

      // Sanitize: trim and remove null bytes
      sanitized[key] = value.trim().replace(/\0/g, '');
    } else if (typeof value === 'number') {
      // Validate number ranges
      if (!Number.isFinite(value)) {
        errors.push(`Field "${key}" must be a finite number`);
        continue;
      }
      if (key === 'price' && (value < 0 || value > 1000000000)) {
        errors.push(`Field "${key}" is out of valid range (0-1,000,000,000)`);
        continue;
      }
      if (key === 'quantity' && (value < 0 || value > 10000)) {
        errors.push(`Field "${key}" is out of valid range (0-10,000)`);
        continue;
      }
      sanitized[key] = value;
    } else if (Array.isArray(value) && key === 'multiple_accounts') {
      // Validate multiple_accounts array
      if (value.length > 100) {
        errors.push('multiple_accounts array exceeds maximum of 100 entries');
        continue;
      }
      sanitized[key] = value;
    } else if (value !== null && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined,
  };
}

// ============================================
// Replay Attack Prevention
// ============================================

interface TimestampValidationResult {
  valid: boolean;
  error?: string;
  drift?: number;
}

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validate request timestamp to prevent replay attacks
 */
export function validateTimestamp(
  timestamp: string | number | Date,
  maxDriftMs: number = MAX_TIMESTAMP_DRIFT_MS
): TimestampValidationResult {
  let requestTime: number;

  if (timestamp instanceof Date) {
    requestTime = timestamp.getTime();
  } else if (typeof timestamp === 'number') {
    // Handle Unix seconds vs milliseconds
    requestTime = timestamp > 1e12 ? timestamp : timestamp * 1000;
  } else if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      return { valid: false, error: 'Invalid timestamp format' };
    }
    requestTime = parsed.getTime();
  } else {
    return { valid: false, error: 'Timestamp must be a string, number, or Date' };
  }

  const now = Date.now();
  const drift = Math.abs(now - requestTime);

  if (drift > maxDriftMs) {
    return {
      valid: false,
      error: `Timestamp drift of ${drift}ms exceeds maximum of ${maxDriftMs}ms`,
      drift,
    };
  }

  return { valid: true, drift };
}

// ============================================
// Idempotency Support
// ============================================

interface IdempotencyEntry {
  result: unknown;
  timestamp: number;
}

const idempotencyStore = new Map<string, IdempotencyEntry>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate idempotency key from payload
 */
export function generateIdempotencyKey(payload: Record<string, unknown>): string {
  const keyFields = ['symbol', 'date', 'data', 'price', 'direction'];
  const keyData = keyFields
    .map(f => `${f}:${payload[f] ?? ''}`)
    .join('|');
  
  return crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 32);
}

/**
 * Check if request was already processed (idempotency)
 */
export function checkIdempotency(key: string): IdempotencyEntry | null {
  const entry = idempotencyStore.get(key);
  
  if (!entry) {
    return null;
  }

  // Check if entry has expired
  if (Date.now() - entry.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key);
    return null;
  }

  return entry;
}

/**
 * Store idempotency result
 */
export function storeIdempotencyResult(key: string, result: unknown): void {
  idempotencyStore.set(key, {
    result,
    timestamp: Date.now(),
  });

  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    cleanupIdempotencyStore();
  }
}

function cleanupIdempotencyStore(): void {
  const now = Date.now();
  const entries = Array.from(idempotencyStore.entries());
  for (const [key, entry] of entries) {
    if (now - entry.timestamp > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key);
    }
  }
}

// ============================================
// Circuit Breaker
// ============================================

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  openedAt?: number;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Number of failures to open circuit
  resetTimeoutMs: number;    // Time to wait before trying again
  halfOpenRequests: number;  // Requests to allow in half-open state
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30 * 1000, // 30 seconds
  halfOpenRequests: 3,
};

/**
 * Check if circuit is open (should reject request)
 */
export function isCircuitOpen(
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
): boolean {
  const state = circuitBreakers.get(name);
  
  if (!state || state.state === 'closed') {
    return false;
  }

  if (state.state === 'open') {
    // Check if we should transition to half-open
    const timeSinceOpen = Date.now() - (state.openedAt || 0);
    if (timeSinceOpen >= config.resetTimeoutMs) {
      state.state = 'half-open';
      state.failures = 0;
      return false;
    }
    return true;
  }

  // Half-open: allow limited requests
  return false;
}

/**
 * Record a successful request
 */
export function recordSuccess(name: string): void {
  const state = circuitBreakers.get(name);
  
  if (state && state.state === 'half-open') {
    // Reset to closed on success in half-open state
    state.state = 'closed';
    state.failures = 0;
  }
}

/**
 * Record a failed request
 */
export function recordFailure(
  name: string,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG
): void {
  let state = circuitBreakers.get(name);
  
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: 'closed' };
    circuitBreakers.set(name, state);
  }

  state.failures++;
  state.lastFailure = Date.now();

  if (state.failures >= config.failureThreshold) {
    state.state = 'open';
    state.openedAt = Date.now();
  }
}

/**
 * Get circuit breaker status
 */
export function getCircuitStatus(name: string): CircuitBreakerState | null {
  return circuitBreakers.get(name) || null;
}

// ============================================
// Correlation ID & Structured Logging
// ============================================

/**
 * Generate a unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `wh_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

export interface WebhookLogEntry {
  correlationId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  data?: Record<string, unknown>;
  duration?: number;
  error?: string;
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  correlationId: string,
  level: 'info' | 'warn' | 'error',
  event: string,
  data?: Record<string, unknown>,
  error?: string
): WebhookLogEntry {
  return {
    correlationId,
    timestamp: new Date().toISOString(),
    level,
    event,
    data,
    error,
  };
}

/**
 * Log webhook event with structured format
 */
export function logWebhookEvent(entry: WebhookLogEntry): void {
  const logLine = JSON.stringify(entry);
  
  switch (entry.level) {
    case 'error':
      console.error(`[Webhook] ${logLine}`);
      break;
    case 'warn':
      console.warn(`[Webhook] ${logLine}`);
      break;
    default:
      console.log(`[Webhook] ${logLine}`);
  }
}

// ============================================
// HMAC Signature Verification
// ============================================

/**
 * Generate HMAC signature for payload
 */
export function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = generateSignature(payload, secret);
  
  // Use timing-safe comparison to prevent timing attacks
  if (signature.length !== expected.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ============================================
// IP Validation
// ============================================

// TradingView official IP addresses (from their documentation)
export const TRADINGVIEW_IPS = [
  '52.89.214.238',
  '34.212.75.30',
  '54.218.53.128',
  '52.32.178.7',
];

/**
 * Check if IP is from TradingView
 */
export function isTradingViewIP(ip: string): boolean {
  // Normalize IP (handle IPv6 mapped IPv4)
  const normalizedIp = ip.replace(/^::ffff:/, '');
  return TRADINGVIEW_IPS.includes(normalizedIp);
}

/**
 * Extract client IP from request headers
 */
export function extractClientIP(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
}): string {
  // Check X-Forwarded-For header (from proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Fall back to socket address
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// ============================================
// Export all for testing
// ============================================

export const __testing = {
  rateLimitStore,
  idempotencyStore,
  circuitBreakers,
  cleanupRateLimitStore,
  cleanupIdempotencyStore,
};
