/**
 * Webhook Monitoring Tests
 *
 * These tests serve as permanent monitoring checks that run with every test suite.
 * They verify critical webhook functionality is working correctly and alert
 * when any core functionality breaks.
 *
 * Run these tests frequently to catch regressions early.
 */

import { describe, it, expect } from "vitest";
import {
  validatePayload,
  mapSymbolToStrategy,
  WebhookValidationError,
} from "./webhookService";
import {
  checkRateLimit,
  isCircuitOpen,
  validateAndSanitize,
  checkIdempotency,
  storeIdempotencyResult,
  generateIdempotencyKey,
} from "./webhookSecurity";

// ============================================================================
// CRITICAL PATH TESTS - These MUST pass for the system to be operational
// ============================================================================

describe("🔴 CRITICAL: Webhook Core Functionality", () => {
  describe("Payload Validation", () => {
    it("CRITICAL: should accept valid entry signal", () => {
      const payload = {
        symbol: "NQ",
        data: "buy",
        date: new Date().toISOString(),
        quantity: 1,
        price: 5000,
        token: "test-token",
      };

      const result = validatePayload(payload);
      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.action).toBe("buy");
    });

    it("CRITICAL: should accept valid exit signal", () => {
      const payload = {
        symbol: "NQ",
        data: "exit",
        date: new Date().toISOString(),
        quantity: 1,
        price: 5050,
        token: "test-token",
      };

      const result = validatePayload(payload);
      expect(result.action).toBe("exit");
    });

    it("CRITICAL: should reject missing symbol", () => {
      const payload = {
        data: "buy",
        date: new Date().toISOString(),
        quantity: 1,
        price: 5000,
        token: "test-token",
      };

      expect(() => validatePayload(payload)).toThrow(WebhookValidationError);
    });

    it("CRITICAL: should reject missing data field", () => {
      const payload = {
        symbol: "NQ",
        date: new Date().toISOString(),
        quantity: 1,
        price: 5000,
        token: "test-token",
      };

      expect(() => validatePayload(payload)).toThrow(WebhookValidationError);
    });
  });

  describe("Symbol Mapping", () => {
    it("CRITICAL: should map NQ to NQTrend", () => {
      const strategy = mapSymbolToStrategy("NQ");
      expect(strategy).toBe("NQTrend");
    });

    it("CRITICAL: should map NQ_LEV to NQTrendLeveraged", () => {
      const strategy = mapSymbolToStrategy("NQ_LEV");
      expect(strategy).toBe("NQTrendLeveraged");
    });

    it("CRITICAL: should have NQ strategy mappings", () => {
      const requiredSymbols = ["NQ", "NQ_LEV"];
      requiredSymbols.forEach(symbol => {
        const mapped = mapSymbolToStrategy(symbol);
        expect(mapped).toBeDefined();
        expect(mapped.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Payload Parsing", () => {
    it("CRITICAL: should parse entry payload correctly", () => {
      const payload = {
        symbol: "NQ",
        data: "buy",
        date: "2024-12-17T10:00:00Z",
        quantity: 2,
        price: 5000.5,
        token: "test-token",
      };

      const parsed = validatePayload(payload);
      expect(parsed.strategySymbol).toBe("NQTrend");
      expect(parsed.direction).toBe("Long");
      expect(parsed.quantity).toBe(2);
    });

    it("CRITICAL: should parse exit payload correctly", () => {
      const payload = {
        symbol: "NQ",
        data: "exit",
        date: "2024-12-17T10:30:00Z",
        quantity: 1,
        price: 18000,
        token: "test-token",
      };

      const parsed = validatePayload(payload);
      expect(parsed.strategySymbol).toBe("NQTrend");
      expect(parsed.action).toBe("exit");
    });
  });
});

// ============================================================================
// SECURITY MONITORING TESTS
// ============================================================================

describe("🟡 SECURITY: Webhook Protection Systems", () => {
  describe("Rate Limiting", () => {
    it("SECURITY: rate limiter should be functional", () => {
      // First request should pass
      const result = checkRateLimit("test-ip-monitor-" + Date.now());
      expect(result.allowed).toBe(true);
    });

    it("SECURITY: should track remaining requests", () => {
      const result = checkRateLimit("test-ip-monitor-2-" + Date.now());
      expect(result.remaining).toBeDefined();
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe("Circuit Breaker", () => {
    it("SECURITY: circuit breaker should start closed", () => {
      const isOpen = isCircuitOpen("webhook-monitor-" + Date.now());
      expect(isOpen).toBe(false);
    });

    it("SECURITY: circuit breaker should allow requests when closed", () => {
      const isOpen = isCircuitOpen("webhook-monitor-2-" + Date.now());
      expect(isOpen).toBe(false); // Not open = can process
    });
  });

  describe("Input Sanitization", () => {
    it("SECURITY: should detect SQL injection attempts", () => {
      const malicious = {
        symbol: "ES'; DROP TABLE users; --",
        data: "buy",
        price: 5000,
        date: new Date().toISOString(),
      };
      const result = validateAndSanitize(malicious);
      // SQL injection should be detected - either invalid or sanitized differently
      expect(
        result.sanitized?.symbol !== malicious.symbol ||
          !result.valid ||
          result.errors.length > 0
      ).toBe(true);
    });

    it("SECURITY: should detect XSS attempts", () => {
      const malicious = {
        symbol: '<script>alert("xss")</script>',
        data: "buy",
        price: 5000,
        date: new Date().toISOString(),
      };
      const result = validateAndSanitize(malicious);
      // XSS should be detected - either invalid or sanitized differently
      expect(
        result.sanitized?.symbol !== malicious.symbol ||
          !result.valid ||
          result.errors.length > 0
      ).toBe(true);
    });

    it("SECURITY: should accept valid data", () => {
      const valid = {
        symbol: "ES",
        data: "buy",
        price: 5000,
        date: new Date().toISOString(),
        token: "valid-token-123",
      };
      const result = validateAndSanitize(valid);
      expect(result.valid).toBe(true);
    });
  });

  describe("Idempotency", () => {
    it("SECURITY: idempotency key generation should be functional", () => {
      const payload = { symbol: "ES", data: "buy", price: 5000 };
      const key = generateIdempotencyKey(payload);
      expect(key).toBeDefined();
      expect(key.length).toBeGreaterThan(0);
    });

    it("SECURITY: should detect duplicate requests", () => {
      const key = "test-key-monitor-" + Date.now();

      // First check - not duplicate
      const first = checkIdempotency(key);
      expect(first).toBeNull();

      // Mark as processed
      storeIdempotencyResult(key, { success: true });

      // Second check - should be duplicate
      const second = checkIdempotency(key);
      expect(second).not.toBeNull();
    });
  });
});

// ============================================================================
// INTEGRATION MONITORING TESTS
// ============================================================================

describe("🟢 INTEGRATION: System Health Checks", () => {
  describe("Strategy Symbol Map Integrity", () => {
    it("HEALTH: all core symbols should map correctly", () => {
      const coreSymbols = ["ES", "NQ", "CL", "GC", "YM", "BTC"];
      coreSymbols.forEach(symbol => {
        const mapped = mapSymbolToStrategy(symbol);
        expect(typeof mapped).toBe("string");
        expect(mapped.length).toBeGreaterThan(0);
      });
    });

    it("HEALTH: should have NQ symbol mappings", () => {
      // Only NQ strategies are active now
      const nqSymbols = ["NQ", "NQ_LEV", "NQTREND", "NQTRENDLEVERAGED"];
      const mappedCount = nqSymbols.filter(
        s => mapSymbolToStrategy(s) !== s
      ).length;
      expect(mappedCount).toBeGreaterThanOrEqual(2); // At least NQ and NQ_LEV
    });
  });

  describe("Payload Structure Validation", () => {
    it("HEALTH: should handle all expected field types", () => {
      const payload = {
        symbol: "NQ",
        data: "buy",
        date: new Date().toISOString(),
        quantity: 1,
        price: 5000.5,
        token: "test",
        multiple_accounts: "account1,account2",
      };

      const result = validatePayload(payload);
      expect(result.strategySymbol).toBe("NQTrend");
    });

    it("HEALTH: should handle numeric strings", () => {
      const payload = {
        symbol: "NQ",
        data: "buy",
        date: new Date().toISOString(),
        quantity: "2", // String instead of number
        price: "5000.50", // String instead of number
        token: "test",
      };

      const result = validatePayload(payload);
      expect(result.price).toBe(5000.5);
    });
  });

  describe("Error Handling", () => {
    it("HEALTH: should handle null payload gracefully", () => {
      expect(() => validatePayload(null as any)).toThrow(
        WebhookValidationError
      );
    });

    it("HEALTH: should handle undefined payload gracefully", () => {
      expect(() => validatePayload(undefined as any)).toThrow(
        WebhookValidationError
      );
    });

    it("HEALTH: should handle empty object gracefully", () => {
      expect(() => validatePayload({})).toThrow(WebhookValidationError);
    });
  });
});

// ============================================================================
// REGRESSION TESTS - Prevent previously fixed bugs from returning
// ============================================================================

describe("🔵 REGRESSION: Previously Fixed Issues", () => {
  it("REGRESSION: should handle lowercase data field values", () => {
    const payload = {
      symbol: "NQ",
      data: "BUY", // Uppercase
      date: new Date().toISOString(),
      quantity: 1,
      price: 5000,
      token: "test",
    };

    const result = validatePayload(payload);
    expect(result.action).toBe("buy");
  });

  it("REGRESSION: should handle mixed case symbols", () => {
    const payload = {
      symbol: "nq", // Lowercase
      data: "buy",
      date: new Date().toISOString(),
      quantity: 1,
      price: 5000,
      token: "test",
    };

    const result = validatePayload(payload);
    expect(result.strategySymbol).toBe("NQTrend");
  });

  it("REGRESSION: should handle whitespace in fields", () => {
    const payload = {
      symbol: " NQ ",
      data: " buy ",
      date: new Date().toISOString(),
      quantity: 1,
      price: 5000,
      token: "test",
    };

    const result = validatePayload(payload);
    expect(result.strategySymbol).toBe("NQTrend");
  });

  it("REGRESSION: should handle zero quantity (defaults to 1)", () => {
    const payload = {
      symbol: "NQTrend", // Updated to use active strategy
      data: "buy",
      date: new Date().toISOString(),
      quantity: 0,
      price: 5000,
      token: "test",
    };

    // Zero quantity defaults to 1 (minimum valid quantity)
    const result = validatePayload(payload);
    expect(result.quantity).toBe(1);
  });

  it("REGRESSION: should handle negative price", () => {
    const payload = {
      symbol: "ES",
      data: "buy",
      date: new Date().toISOString(),
      quantity: 1,
      price: -5000,
      token: "test",
    };

    // Negative price is technically valid (short positions can have negative P&L)
    const result = validatePayload(payload);
    expect(result.price).toBe(-5000);
  });
});
