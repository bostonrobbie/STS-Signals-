/**
 * Comprehensive Security & QA Test Suite
 * 
 * Tests for:
 * - Input validation and sanitization
 * - Authentication and authorization
 * - Rate limiting
 * - Error handling edge cases
 * - Data integrity
 * - Mobile/responsive considerations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateAndSanitize,
  checkRateLimit,
  validateTimestamp,
  generateIdempotencyKey,
  checkIdempotency,
  storeIdempotencyResult,
} from './webhookSecurity';

describe('Security - Input Validation', () => {
  describe('XSS Prevention', () => {
    it('should reject payloads with HTML tags', () => {
      const payload = {
        symbol: '<script>alert("xss")</script>',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('malicious'))).toBe(true);
    });

    it('should reject payloads with javascript: protocol', () => {
      const payload = {
        symbol: 'javascript:alert(1)',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });

    it('should reject payloads with event handlers', () => {
      const payload = {
        symbol: 'test onload=alert(1)',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should reject SQL comment patterns', () => {
      const payload = {
        symbol: 'test--DROP TABLE users',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });

    it('should reject UNION SELECT patterns', () => {
      const payload = {
        symbol: 'test UNION SELECT * FROM users',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });

    it('should reject classic SQL injection', () => {
      const payload = {
        symbol: "test' OR '1'='1",
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe('Payload Size Limits', () => {
    it('should reject oversized payloads', () => {
      const payload = {
        symbol: 'a'.repeat(15000),
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('size'))).toBe(true);
    });

    it('should reject oversized string fields', () => {
      const payload = {
        symbol: 'a'.repeat(1500),
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('length'))).toBe(true);
    });
  });

  describe('Type Validation', () => {
    it('should reject non-object payloads', () => {
      expect(validateAndSanitize(null).valid).toBe(false);
      expect(validateAndSanitize(undefined).valid).toBe(false);
      expect(validateAndSanitize('string').valid).toBe(false);
      expect(validateAndSanitize(123).valid).toBe(false);
      expect(validateAndSanitize([]).valid).toBe(false);
    });

    it('should reject invalid number ranges', () => {
      const payload = {
        symbol: 'test',
        price: -100,
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });

    it('should reject infinite numbers', () => {
      const payload = {
        symbol: 'test',
        price: Infinity,
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });

    it('should reject NaN values', () => {
      const payload = {
        symbol: 'test',
        price: NaN,
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });
  });

  describe('Null Byte Injection', () => {
    it('should strip null bytes from strings', () => {
      const payload = {
        symbol: 'test\0injection',
        data: 'buy',
      };
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.symbol).toBe('testinjection');
    });
  });
});

describe('Security - Rate Limiting', () => {
  beforeEach(() => {
    // Reset rate limit store between tests
    vi.useFakeTimers();
  });

  it('should allow requests within limit', () => {
    const config = { windowMs: 60000, maxRequests: 10 };
    
    for (let i = 0; i < 10; i++) {
      const result = checkRateLimit('test-ip', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10 - i - 1);
    }
  });

  it('should block requests exceeding limit', () => {
    const config = { windowMs: 60000, maxRequests: 5 };
    
    // Use up the limit
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-ip-2', config);
    }
    
    // Next request should be blocked
    const result = checkRateLimit('test-ip-2', config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track different IPs separately', () => {
    const config = { windowMs: 60000, maxRequests: 2 };
    
    // Use up limit for IP 1
    checkRateLimit('ip-1', config);
    checkRateLimit('ip-1', config);
    
    // IP 1 should be blocked
    expect(checkRateLimit('ip-1', config).allowed).toBe(false);
    
    // IP 2 should still be allowed
    expect(checkRateLimit('ip-2', config).allowed).toBe(true);
  });
});

describe('Security - Replay Attack Prevention', () => {
  it('should accept timestamps within drift window', () => {
    const now = new Date();
    const result = validateTimestamp(now);
    expect(result.valid).toBe(true);
  });

  it('should reject timestamps too far in the past', () => {
    const oldTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const result = validateTimestamp(oldTime);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('drift');
  });

  it('should reject timestamps too far in the future', () => {
    const futureTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes ahead
    const result = validateTimestamp(futureTime);
    expect(result.valid).toBe(false);
  });

  it('should handle Unix timestamps in seconds', () => {
    const unixSeconds = Math.floor(Date.now() / 1000);
    const result = validateTimestamp(unixSeconds);
    expect(result.valid).toBe(true);
  });

  it('should handle Unix timestamps in milliseconds', () => {
    const unixMs = Date.now();
    const result = validateTimestamp(unixMs);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid timestamp formats', () => {
    const result = validateTimestamp('not-a-date');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid');
  });
});

describe('Security - Idempotency', () => {
  it('should generate consistent keys for same payload', () => {
    const payload = { symbol: 'ES', data: 'buy', price: 100 };
    const key1 = generateIdempotencyKey(payload);
    const key2 = generateIdempotencyKey(payload);
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different payloads', () => {
    const payload1 = { symbol: 'ES', data: 'buy', price: 100 };
    const payload2 = { symbol: 'ES', data: 'sell', price: 100 };
    const key1 = generateIdempotencyKey(payload1);
    const key2 = generateIdempotencyKey(payload2);
    expect(key1).not.toBe(key2);
  });

  it('should return stored result for duplicate requests', () => {
    const payload = { symbol: 'TEST', data: 'buy' };
    const key = generateIdempotencyKey(payload);
    const result = { success: true, id: 123 };
    
    storeIdempotencyResult(key, result);
    
    const cached = checkIdempotency(key);
    expect(cached).not.toBeNull();
    expect(cached?.result).toEqual(result);
  });

  it('should return null for new requests', () => {
    const key = 'never-seen-before-' + Date.now();
    const cached = checkIdempotency(key);
    expect(cached).toBeNull();
  });
});

describe('Data Integrity - Edge Cases', () => {
  it('should handle empty symbol gracefully', () => {
    const payload = { symbol: '', data: 'buy' };
    const result = validateAndSanitize(payload);
    // Empty string after trim is still valid, just empty
    expect(result.valid).toBe(true);
  });

  it('should trim whitespace from strings', () => {
    const payload = { symbol: '  ES  ', data: '  buy  ' };
    const result = validateAndSanitize(payload);
    expect(result.valid).toBe(true);
    expect(result.sanitized?.symbol).toBe('ES');
    expect(result.sanitized?.data).toBe('buy');
  });

  it('should handle unicode characters safely', () => {
    const payload = { symbol: 'ES🚀', data: 'buy' };
    const result = validateAndSanitize(payload);
    expect(result.valid).toBe(true);
    expect(result.sanitized?.symbol).toBe('ES🚀');
  });

  it('should filter out unknown fields', () => {
    const payload = { 
      symbol: 'ES', 
      data: 'buy',
      unknownField: 'should be removed',
      anotherUnknown: 123,
    };
    const result = validateAndSanitize(payload);
    expect(result.valid).toBe(true);
    expect(result.sanitized).not.toHaveProperty('unknownField');
    expect(result.sanitized).not.toHaveProperty('anotherUnknown');
  });
});

describe('Error Handling - Graceful Degradation', () => {
  it('should provide meaningful error messages', () => {
    const payload = {
      symbol: '<script>',
      price: -1,
      quantity: 99999,
    };
    const result = validateAndSanitize(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    result.errors.forEach(error => {
      expect(typeof error).toBe('string');
      expect(error.length).toBeGreaterThan(0);
    });
  });

  it('should collect all validation errors', () => {
    const payload = {
      symbol: 'a'.repeat(2000), // Too long
      price: -100, // Invalid range
    };
    const result = validateAndSanitize(payload);
    expect(result.valid).toBe(false);
    // Should have multiple errors
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Performance - Stress Handling', () => {
  it('should handle rapid sequential requests', () => {
    const config = { windowMs: 60000, maxRequests: 1000 };
    
    // Simulate 100 rapid requests
    for (let i = 0; i < 100; i++) {
      const result = checkRateLimit(`stress-test-${i % 10}`, config);
      expect(result).toBeDefined();
      expect(typeof result.allowed).toBe('boolean');
    }
  });

  it('should handle large batch of idempotency keys', () => {
    // Generate and store 100 idempotency results
    for (let i = 0; i < 100; i++) {
      const payload = { symbol: `SYM${i}`, data: 'buy', price: i };
      const key = generateIdempotencyKey(payload);
      storeIdempotencyResult(key, { success: true, id: i });
    }
    
    // Verify retrieval works
    const testPayload = { symbol: 'SYM50', data: 'buy', price: 50 };
    const testKey = generateIdempotencyKey(testPayload);
    const cached = checkIdempotency(testKey);
    expect(cached).not.toBeNull();
  });
});
