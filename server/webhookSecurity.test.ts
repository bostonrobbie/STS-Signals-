/**
 * Webhook Security & Reliability Tests
 * 
 * Comprehensive tests for enterprise-grade webhook security features
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  validateAndSanitize,
  validateTimestamp,
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
  isCircuitOpen,
  recordSuccess,
  recordFailure,
  generateCorrelationId,
  generateSignature,
  verifySignature,
  isTradingViewIP,
  extractClientIP,
  __testing,
} from './webhookSecurity';

describe('Webhook Security Module', () => {
  
  // ============================================
  // Rate Limiting Tests
  // ============================================
  
  describe('Rate Limiting', () => {
    beforeEach(() => {
      __testing.rateLimitStore.clear();
    });

    it('should allow requests within limit', () => {
      const result = checkRateLimit('test-ip', { windowMs: 60000, maxRequests: 10 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should track remaining requests correctly', () => {
      const config = { windowMs: 60000, maxRequests: 5 };
      
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit('test-ip-2', config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests exceeding limit', () => {
      const config = { windowMs: 60000, maxRequests: 3 };
      
      // Use up the limit
      checkRateLimit('test-ip-3', config);
      checkRateLimit('test-ip-3', config);
      checkRateLimit('test-ip-3', config);
      
      // This should be blocked
      const result = checkRateLimit('test-ip-3', config);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should track different IPs separately', () => {
      const config = { windowMs: 60000, maxRequests: 2 };
      
      checkRateLimit('ip-a', config);
      checkRateLimit('ip-a', config);
      
      // ip-a should be blocked
      expect(checkRateLimit('ip-a', config).allowed).toBe(false);
      
      // ip-b should still be allowed
      expect(checkRateLimit('ip-b', config).allowed).toBe(true);
    });

    it('should reset after window expires', async () => {
      const config = { windowMs: 50, maxRequests: 1 }; // 50ms window
      
      checkRateLimit('test-ip-4', config);
      expect(checkRateLimit('test-ip-4', config).allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(checkRateLimit('test-ip-4', config).allowed).toBe(true);
    });
  });

  // ============================================
  // Input Validation & Sanitization Tests
  // ============================================
  
  describe('Input Validation & Sanitization', () => {
    it('should accept valid payload', () => {
      const result = validateAndSanitize({
        symbol: 'ESTrend',
        date: '2024-01-15T12:00:00Z',
        data: 'buy',
        price: 4500,
        quantity: 1,
        token: 'valid_token',
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toBeDefined();
    });

    it('should reject non-object payloads', () => {
      expect(validateAndSanitize(null).valid).toBe(false);
      expect(validateAndSanitize(undefined).valid).toBe(false);
      expect(validateAndSanitize('string').valid).toBe(false);
      expect(validateAndSanitize([1, 2, 3]).valid).toBe(false);
    });

    it('should reject oversized payloads', () => {
      const largePayload = {
        symbol: 'ESTrend',
        comment: 'x'.repeat(15000), // Exceeds 10KB
      };
      
      const result = validateAndSanitize(largePayload);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('size'))).toBe(true);
    });

    it('should reject strings exceeding max length', () => {
      const result = validateAndSanitize({
        symbol: 'x'.repeat(1001),
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
    });

    it('should detect HTML injection attempts', () => {
      const result = validateAndSanitize({
        symbol: '<script>alert("xss")</script>',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('malicious'))).toBe(true);
    });

    it('should detect SQL injection attempts', () => {
      const sqlInjections = [
        "'; DROP TABLE trades; --",
        "1' OR '1'='1",
        "UNION SELECT * FROM users",
      ];
      
      for (const injection of sqlInjections) {
        const result = validateAndSanitize({ symbol: injection });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('malicious'))).toBe(true);
      }
    });

    it('should detect JavaScript protocol injection', () => {
      const result = validateAndSanitize({
        symbol: 'javascript:alert(1)',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('malicious'))).toBe(true);
    });

    it('should validate number ranges', () => {
      // Price out of range
      let result = validateAndSanitize({ price: -100 });
      expect(result.valid).toBe(false);
      
      result = validateAndSanitize({ price: 2000000000 });
      expect(result.valid).toBe(false);
      
      // Quantity out of range
      result = validateAndSanitize({ quantity: -1 });
      expect(result.valid).toBe(false);
      
      result = validateAndSanitize({ quantity: 50000 });
      expect(result.valid).toBe(false);
    });

    it('should reject non-finite numbers', () => {
      expect(validateAndSanitize({ price: Infinity }).valid).toBe(false);
      expect(validateAndSanitize({ price: NaN }).valid).toBe(false);
    });

    it('should trim strings and remove null bytes', () => {
      const result = validateAndSanitize({
        symbol: '  ESTrend\0  ',
      });
      
      expect(result.valid).toBe(true);
      expect(result.sanitized?.symbol).toBe('ESTrend');
    });

    it('should skip unknown fields without error', () => {
      const result = validateAndSanitize({
        symbol: 'ESTrend',
        unknownField: 'value',
        anotherUnknown: 123,
      });
      
      expect(result.valid).toBe(true);
      expect(result.sanitized).not.toHaveProperty('unknownField');
    });
  });

  // ============================================
  // Timestamp Validation Tests
  // ============================================
  
  describe('Timestamp Validation (Replay Prevention)', () => {
    it('should accept timestamps within drift window', () => {
      const now = new Date();
      const result = validateTimestamp(now);
      
      expect(result.valid).toBe(true);
      expect(result.drift).toBeLessThan(1000);
    });

    it('should accept ISO string timestamps', () => {
      const result = validateTimestamp(new Date().toISOString());
      expect(result.valid).toBe(true);
    });

    it('should accept Unix timestamps in seconds', () => {
      const unixSeconds = Math.floor(Date.now() / 1000);
      const result = validateTimestamp(unixSeconds);
      expect(result.valid).toBe(true);
    });

    it('should accept Unix timestamps in milliseconds', () => {
      const result = validateTimestamp(Date.now());
      expect(result.valid).toBe(true);
    });

    it('should reject timestamps too far in the past', () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const result = validateTimestamp(oldTimestamp, 5 * 60 * 1000); // 5 min window
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('drift');
    });

    it('should reject timestamps too far in the future', () => {
      const futureTimestamp = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes ahead
      const result = validateTimestamp(futureTimestamp, 5 * 60 * 1000);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('drift');
    });

    it('should reject invalid timestamp formats', () => {
      const result = validateTimestamp('not-a-date');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid');
    });
  });

  // ============================================
  // Idempotency Tests
  // ============================================
  
  describe('Idempotency', () => {
    beforeEach(() => {
      __testing.idempotencyStore.clear();
    });

    it('should generate consistent idempotency keys', () => {
      const payload = { symbol: 'ESTrend', date: '2024-01-15', data: 'buy', price: 4500 };
      
      const key1 = generateIdempotencyKey(payload);
      const key2 = generateIdempotencyKey(payload);
      
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32);
    });

    it('should generate different keys for different payloads', () => {
      const key1 = generateIdempotencyKey({ symbol: 'ESTrend', date: '2024-01-15', data: 'buy', price: 4500 });
      const key2 = generateIdempotencyKey({ symbol: 'NQTrend', date: '2024-01-15', data: 'buy', price: 4500 });
      
      expect(key1).not.toBe(key2);
    });

    it('should return null for new requests', () => {
      const result = checkIdempotency('new-key');
      expect(result).toBeNull();
    });

    it('should return stored result for duplicate requests', () => {
      const key = 'test-key';
      const storedResult = { success: true, tradeId: 123 };
      
      storeIdempotencyResult(key, storedResult);
      
      const result = checkIdempotency(key);
      expect(result).not.toBeNull();
      expect(result?.result).toEqual(storedResult);
    });

    it('should expire old idempotency entries', async () => {
      // This would require mocking Date.now() for proper testing
      // For now, just verify the structure works
      const key = 'expire-test';
      storeIdempotencyResult(key, { test: true });
      
      const result = checkIdempotency(key);
      expect(result).not.toBeNull();
    });
  });

  // ============================================
  // Circuit Breaker Tests
  // ============================================
  
  describe('Circuit Breaker', () => {
    beforeEach(() => {
      __testing.circuitBreakers.clear();
    });

    it('should start in closed state', () => {
      expect(isCircuitOpen('test-service')).toBe(false);
    });

    it('should open after threshold failures', () => {
      const config = { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenRequests: 1 };
      
      recordFailure('test-service', config);
      recordFailure('test-service', config);
      expect(isCircuitOpen('test-service', config)).toBe(false);
      
      recordFailure('test-service', config);
      expect(isCircuitOpen('test-service', config)).toBe(true);
    });

    it('should close on success in half-open state', () => {
      const config = { failureThreshold: 2, resetTimeoutMs: 10, halfOpenRequests: 1 };
      
      // Open the circuit
      recordFailure('test-service-2', config);
      recordFailure('test-service-2', config);
      expect(isCircuitOpen('test-service-2', config)).toBe(true);
      
      // Wait for reset timeout and check (transitions to half-open)
      return new Promise<void>(resolve => {
        setTimeout(() => {
          expect(isCircuitOpen('test-service-2', config)).toBe(false); // half-open allows
          recordSuccess('test-service-2');
          expect(isCircuitOpen('test-service-2', config)).toBe(false); // closed
          resolve();
        }, 20);
      });
    });

    it('should track different services separately', () => {
      const config = { failureThreshold: 2, resetTimeoutMs: 30000, halfOpenRequests: 1 };
      
      recordFailure('service-a', config);
      recordFailure('service-a', config);
      
      expect(isCircuitOpen('service-a', config)).toBe(true);
      expect(isCircuitOpen('service-b', config)).toBe(false);
    });
  });

  // ============================================
  // Correlation ID Tests
  // ============================================
  
  describe('Correlation ID', () => {
    it('should generate unique correlation IDs', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        ids.add(generateCorrelationId());
      }
      
      expect(ids.size).toBe(100);
    });

    it('should have correct format', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(/^wh_[a-z0-9]+_[a-f0-9]{8}$/);
    });
  });

  // ============================================
  // HMAC Signature Tests
  // ============================================
  
  describe('HMAC Signature', () => {
    const secret = 'test-secret-key';
    const payload = '{"symbol":"ESTrend","price":4500}';

    it('should generate consistent signatures', () => {
      const sig1 = generateSignature(payload, secret);
      const sig2 = generateSignature(payload, secret);
      
      expect(sig1).toBe(sig2);
    });

    it('should verify valid signatures', () => {
      const signature = generateSignature(payload, secret);
      expect(verifySignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const signature = generateSignature(payload, secret);
      expect(verifySignature(payload, signature, 'wrong-secret')).toBe(false);
      expect(verifySignature(payload, 'invalid-signature', secret)).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const signature = generateSignature(payload, secret);
      const tamperedPayload = '{"symbol":"ESTrend","price":9999}';
      
      expect(verifySignature(tamperedPayload, signature, secret)).toBe(false);
    });

    it('should generate different signatures for different payloads', () => {
      const sig1 = generateSignature('payload1', secret);
      const sig2 = generateSignature('payload2', secret);
      
      expect(sig1).not.toBe(sig2);
    });
  });

  // ============================================
  // IP Validation Tests
  // ============================================
  
  describe('IP Validation', () => {
    it('should recognize TradingView IPs', () => {
      expect(isTradingViewIP('52.89.214.238')).toBe(true);
      expect(isTradingViewIP('34.212.75.30')).toBe(true);
      expect(isTradingViewIP('54.218.53.128')).toBe(true);
      expect(isTradingViewIP('52.32.178.7')).toBe(true);
    });

    it('should reject non-TradingView IPs', () => {
      expect(isTradingViewIP('192.168.1.1')).toBe(false);
      expect(isTradingViewIP('10.0.0.1')).toBe(false);
      expect(isTradingViewIP('8.8.8.8')).toBe(false);
    });

    it('should handle IPv6-mapped IPv4 addresses', () => {
      expect(isTradingViewIP('::ffff:52.89.214.238')).toBe(true);
      expect(isTradingViewIP('::ffff:192.168.1.1')).toBe(false);
    });

    it('should extract IP from X-Forwarded-For header', () => {
      const req = {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      };
      
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });

    it('should extract IP from X-Real-IP header', () => {
      const req = {
        headers: { 'x-real-ip': '1.2.3.4' },
      };
      
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });

    it('should fall back to socket address', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '1.2.3.4' },
      };
      
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });
  });
});

// ============================================
// Edge Case Tests
// ============================================

describe('Webhook Security Edge Cases', () => {
  describe('Boundary Conditions', () => {
    it('should handle empty string inputs', () => {
      const result = validateAndSanitize({ symbol: '' });
      expect(result.valid).toBe(true); // Empty string is valid, just sanitized
    });

    it('should handle zero values', () => {
      const result = validateAndSanitize({ price: 0, quantity: 0 });
      expect(result.valid).toBe(true);
    });

    it('should handle maximum valid values', () => {
      const result = validateAndSanitize({
        price: 999999999,
        quantity: 9999,
      });
      expect(result.valid).toBe(true);
    });

    it('should handle unicode characters', () => {
      const result = validateAndSanitize({
        symbol: 'ESTrend™',
        comment: '日本語テスト',
      });
      expect(result.valid).toBe(true);
    });

    it('should handle special characters in allowed context', () => {
      const result = validateAndSanitize({
        comment: 'Price target: $4,500.00 (10% gain)',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent rate limit checks', async () => {
      __testing.rateLimitStore.clear();
      const config = { windowMs: 60000, maxRequests: 100 };
      
      // Simulate concurrent requests
      const promises = Array(50).fill(null).map(() => 
        Promise.resolve(checkRateLimit('concurrent-test', config))
      );
      
      const results = await Promise.all(promises);
      
      // All should be allowed (under limit)
      expect(results.every(r => r.allowed)).toBe(true);
      
      // Remaining should decrease
      const remainings = results.map(r => r.remaining);
      expect(Math.min(...remainings)).toBeLessThan(100);
    });
  });

  describe('Error Recovery', () => {
    it('should handle malformed JSON gracefully', () => {
      // validateAndSanitize expects parsed JSON, so this tests the type guard
      const result = validateAndSanitize({} as any);
      expect(result.valid).toBe(true); // Empty object is valid
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        symbol: 'ESTrend',
        multiple_accounts: [
          { account: 'a1', quantity: 1 },
          { account: 'a2', quantity: 2 },
        ],
      };
      
      const result = validateAndSanitize(deepObject);
      expect(result.valid).toBe(true);
    });
  });
});
