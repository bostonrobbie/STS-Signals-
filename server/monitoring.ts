/**
 * Server-side Monitoring and Health Check Utility
 * 
 * Provides health checks, performance monitoring, and alerting
 * for production-ready server monitoring.
 */

import { getDb } from './db';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    uptime: CheckResult;
  };
  version: string;
}

export interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  latency?: number;
  details?: Record<string, unknown>;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
}

// In-memory metrics store
const metricsBuffer: PerformanceMetric[] = [];
const MAX_METRICS = 1000;

/**
 * Record a performance metric
 */
export function recordMetric(name: string, value: number, unit: string): void {
  metricsBuffer.push({
    name,
    value,
    unit,
    timestamp: new Date(),
  });
  
  // Trim buffer if too large
  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.splice(0, metricsBuffer.length - MAX_METRICS);
  }
}

/**
 * Get recent metrics
 */
export function getMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
  let metrics = [...metricsBuffer];
  
  if (name) {
    metrics = metrics.filter(m => m.name === name);
  }
  
  return metrics.slice(-limit);
}

/**
 * Check database health
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  
  try {
    // Simple query to check database connectivity
    const db = await getDb();
    if (!db) {
      throw new Error('Database not initialized');
    }
    await db.execute('SELECT 1');
    const latency = Date.now() - start;
    
    recordMetric('db_latency', latency, 'ms');
    
    if (latency > 1000) {
      return {
        status: 'warn',
        message: 'Database responding slowly',
        latency,
        details: { threshold: 1000 },
      };
    }
    
    return {
      status: 'pass',
      message: 'Database connected',
      latency,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latency: Date.now() - start,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const heapPercent = Math.round((used.heapUsed / used.heapTotal) * 100);
  
  recordMetric('heap_used', heapUsedMB, 'MB');
  recordMetric('heap_percent', heapPercent, '%');
  
  if (heapPercent > 90) {
    return {
      status: 'fail',
      message: 'Memory critically high',
      details: { heapUsedMB, heapTotalMB, heapPercent },
    };
  }
  
  if (heapPercent > 75) {
    return {
      status: 'warn',
      message: 'Memory usage elevated',
      details: { heapUsedMB, heapTotalMB, heapPercent },
    };
  }
  
  return {
    status: 'pass',
    message: 'Memory usage normal',
    details: { heapUsedMB, heapTotalMB, heapPercent },
  };
}

/**
 * Check server uptime
 */
function checkUptime(): CheckResult {
  const uptimeSeconds = process.uptime();
  const uptimeHours = Math.round(uptimeSeconds / 3600 * 100) / 100;
  
  recordMetric('uptime', uptimeSeconds, 's');
  
  return {
    status: 'pass',
    message: `Server uptime: ${uptimeHours} hours`,
    details: { uptimeSeconds, uptimeHours },
  };
}

/**
 * Run all health checks
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [database, memory, uptime] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkMemory()),
    Promise.resolve(checkUptime()),
  ]);
  
  const checks = { database, memory, uptime };
  
  // Determine overall status
  const statuses = Object.values(checks).map(c => c.status);
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (statuses.includes('fail')) {
    status = 'unhealthy';
  } else if (statuses.includes('warn')) {
    status = 'degraded';
  }
  
  return {
    status,
    timestamp: new Date(),
    checks,
    version: process.env.npm_package_version || '1.0.0',
  };
}

/**
 * Request timing middleware helper
 */
export function createTimingMiddleware() {
  return (req: { method: string; url: string }, res: { on: (event: string, cb: () => void) => void }, next: () => void) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      recordMetric('request_duration', duration, 'ms');
      
      // Log slow requests
      if (duration > 2000) {
        console.warn(`[SLOW REQUEST] ${req.method} ${req.url} took ${duration}ms`);
      }
    });
    
    next();
  };
}

/**
 * Rate limit tracking
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = rateLimitMap.get(identifier);
  
  if (!existing || existing.resetAt < now) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  
  existing.count++;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * Clean up old rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const entries = Array.from(rateLimitMap.entries());
  for (const [key, value] of entries) {
    if (value.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupRateLimits, 60000);

/**
 * Error tracking
 */
const errorCounts = new Map<string, { count: number; lastSeen: Date }>();

export function trackError(errorType: string): void {
  const existing = errorCounts.get(errorType);
  if (existing) {
    existing.count++;
    existing.lastSeen = new Date();
  } else {
    errorCounts.set(errorType, { count: 1, lastSeen: new Date() });
  }
}

export function getErrorStats(): Array<{ type: string; count: number; lastSeen: Date }> {
  return Array.from(errorCounts.entries()).map(([type, data]) => ({
    type,
    ...data,
  }));
}
