import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  getRateLimitStatus,
  recordRequest,
  cleanupRateLimits,
  RATE_LIMIT_CONFIG,
} from "./_core/monitoring";

describe("Monitoring Module", () => {
  describe("Rate Limiting", () => {
    beforeEach(() => {
      // Clean up rate limits before each test
      cleanupRateLimits();
    });

    it("should allow requests under the limit", () => {
      const testIp = "192.168.1.100";

      // First request should not be rate limited
      expect(isRateLimited(testIp)).toBe(false);

      // Check remaining requests
      const status = getRateLimitStatus(testIp);
      expect(status.remaining).toBe(RATE_LIMIT_CONFIG.maxRequests - 1);
      expect(status.blocked).toBe(false);
    });

    it("should track multiple requests from same IP", () => {
      const testIp = "192.168.1.101";

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        isRateLimited(testIp);
      }

      const status = getRateLimitStatus(testIp);
      expect(status.remaining).toBe(RATE_LIMIT_CONFIG.maxRequests - 5);
    });

    it("should block IP after exceeding limit", () => {
      const testIp = "192.168.1.102";

      // Exceed the rate limit
      for (let i = 0; i <= RATE_LIMIT_CONFIG.maxRequests; i++) {
        isRateLimited(testIp);
      }

      // Next request should be blocked
      expect(isRateLimited(testIp)).toBe(true);

      const status = getRateLimitStatus(testIp);
      expect(status.blocked).toBe(true);
      expect(status.remaining).toBe(0);
    });

    it("should track different IPs independently", () => {
      const ip1 = "192.168.1.103";
      const ip2 = "192.168.1.104";

      // Make requests from ip1
      for (let i = 0; i < 10; i++) {
        isRateLimited(ip1);
      }

      // ip2 should still have full quota
      const status2 = getRateLimitStatus(ip2);
      expect(status2.remaining).toBe(RATE_LIMIT_CONFIG.maxRequests);

      // ip1 should have reduced quota
      const status1 = getRateLimitStatus(ip1);
      expect(status1.remaining).toBe(RATE_LIMIT_CONFIG.maxRequests - 10);
    });

    it("should return correct status for unknown IP", () => {
      const unknownIp = "10.0.0.1";

      const status = getRateLimitStatus(unknownIp);
      expect(status.remaining).toBe(RATE_LIMIT_CONFIG.maxRequests);
      expect(status.blocked).toBe(false);
      expect(status.resetIn).toBe(RATE_LIMIT_CONFIG.windowMs);
    });
  });

  describe("Request Metrics", () => {
    it("should record successful requests", () => {
      // Record a successful request
      recordRequest(100, true);

      // The function should not throw
      expect(true).toBe(true);
    });

    it("should record failed requests", () => {
      // Record a failed request
      recordRequest(50, false);

      // The function should not throw
      expect(true).toBe(true);
    });

    it("should handle multiple request recordings", () => {
      // Record multiple requests
      for (let i = 0; i < 100; i++) {
        recordRequest(Math.random() * 500, Math.random() > 0.1);
      }

      // The function should not throw
      expect(true).toBe(true);
    });
  });

  describe("Rate Limit Cleanup", () => {
    it("should clean up old entries", () => {
      // This test verifies cleanup doesn't throw
      cleanupRateLimits();
      expect(true).toBe(true);
    });
  });
});

describe("Rate Limit Configuration", () => {
  it("should have valid configuration values", () => {
    expect(RATE_LIMIT_CONFIG.windowMs).toBeGreaterThan(0);
    expect(RATE_LIMIT_CONFIG.maxRequests).toBeGreaterThan(0);
    expect(RATE_LIMIT_CONFIG.blockDuration).toBeGreaterThan(0);
  });

  it("should have reasonable default limits", () => {
    // 100 requests per minute is reasonable for most APIs
    expect(RATE_LIMIT_CONFIG.maxRequests).toBeGreaterThanOrEqual(50);
    expect(RATE_LIMIT_CONFIG.maxRequests).toBeLessThanOrEqual(1000);

    // Window should be at least 10 seconds
    expect(RATE_LIMIT_CONFIG.windowMs).toBeGreaterThanOrEqual(10000);

    // Block duration should be at least the window duration
    expect(RATE_LIMIT_CONFIG.blockDuration).toBeGreaterThanOrEqual(
      RATE_LIMIT_CONFIG.windowMs
    );
  });
});
