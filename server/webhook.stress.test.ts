/**
 * Webhook Stress Tests & Edge Cases
 *
 * Tests for:
 * - Concurrent request handling
 * - Large payload handling
 * - Malformed input handling
 * - Boundary conditions
 * - Error recovery
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validatePayload,
  parseTimestamp,
  mapSymbolToStrategy,
  calculatePnL,
  WebhookValidationError,
} from "./webhookService";
import {
  checkRateLimit,
  validateAndSanitize,
  validateTimestamp,
  generateIdempotencyKey,
  __testing,
} from "./webhookSecurity";

describe("Webhook Stress Tests", () => {
  // ============================================
  // Concurrent Request Handling
  // ============================================

  describe("Concurrent Request Handling", () => {
    beforeEach(() => {
      __testing.rateLimitStore.clear();
    });

    it("should handle 100 concurrent rate limit checks", async () => {
      const config = { windowMs: 60000, maxRequests: 1000 };

      const promises = Array(100)
        .fill(null)
        .map((_, i) =>
          Promise.resolve(checkRateLimit(`stress-test-${i % 10}`, config))
        );

      const results = await Promise.all(promises);

      // All should complete without error
      expect(results).toHaveLength(100);
      expect(results.every(r => typeof r.allowed === "boolean")).toBe(true);
    });

    it("should correctly count requests across concurrent calls", async () => {
      const config = { windowMs: 60000, maxRequests: 50 };
      const ip = "concurrent-count-test";

      // Make 60 concurrent requests
      const promises = Array(60)
        .fill(null)
        .map(() => Promise.resolve(checkRateLimit(ip, config)));

      const results = await Promise.all(promises);

      // First 50 should be allowed, rest should be blocked
      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(50);
      expect(blocked).toBe(10);
    });

    it("should generate unique idempotency keys under concurrent load", () => {
      const keys = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const payload = {
          symbol: "ESTrend",
          date: `2024-01-${String((i % 31) + 1).padStart(2, "0")}`,
          data: i % 2 === 0 ? "buy" : "sell",
          price: 4500 + i,
        };
        keys.add(generateIdempotencyKey(payload));
      }

      // All keys should be unique
      expect(keys.size).toBe(1000);
    });
  });

  // ============================================
  // Large Payload Handling
  // ============================================

  describe("Large Payload Handling", () => {
    it("should reject payloads exceeding 10KB", () => {
      const largePayload = {
        symbol: "ESTrend",
        comment: "x".repeat(15000),
      };

      const result = validateAndSanitize(largePayload);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("size"))).toBe(true);
    });

    it("should handle payloads just under the limit", () => {
      const payload = {
        symbol: "ESTrend",
        date: "2024-01-15T12:00:00Z",
        data: "buy",
        price: 4500,
        comment: "a".repeat(900), // Under max string length
      };

      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(true);
    });

    it("should handle multiple_accounts with many entries", () => {
      const payload = {
        symbol: "ESTrend",
        multiple_accounts: Array(50)
          .fill(null)
          .map((_, i) => ({
            account: `account_${i}`,
            quantity: i + 1,
          })),
      };

      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(true);
    });

    it("should reject multiple_accounts exceeding 100 entries", () => {
      const payload = {
        symbol: "ESTrend",
        multiple_accounts: Array(150)
          .fill(null)
          .map((_, i) => ({
            account: `account_${i}`,
            quantity: 1,
          })),
      };

      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(false);
    });
  });

  // ============================================
  // Malformed Input Handling
  // ============================================

  describe("Malformed Input Handling", () => {
    it("should handle null values gracefully", () => {
      const payload = {
        symbol: null,
        date: null,
        data: null,
        price: null,
      };

      // Should not throw
      expect(() => validateAndSanitize(payload as any)).not.toThrow();
    });

    it("should handle undefined values gracefully", () => {
      const payload = {
        symbol: undefined,
        date: undefined,
      };

      expect(() => validateAndSanitize(payload as any)).not.toThrow();
    });

    it("should handle mixed type values", () => {
      const payload = {
        symbol: 123, // Should be string
        price: "4500", // String number
        quantity: "1", // String number
      };

      // Should not throw
      expect(() => validateAndSanitize(payload as any)).not.toThrow();
    });

    it("should handle deeply nested malicious objects", () => {
      const payload = {
        symbol: "ESTrend",
        nested: {
          deep: {
            value: "<script>alert(1)</script>",
          },
        },
      };

      // Should not throw and should skip unknown nested fields
      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(true);
    });

    it("should handle prototype pollution attempts", () => {
      const payload = {
        symbol: "ESTrend",
        __proto__: { admin: true },
        constructor: { prototype: { admin: true } },
      };

      const result = validateAndSanitize(payload);
      // Should not have prototype pollution
      expect(result.sanitized).not.toHaveProperty("__proto__");
      expect(result.sanitized).not.toHaveProperty("constructor");
    });

    it("should handle circular reference attempts", () => {
      // Can't actually create circular JSON, but test nested objects
      const payload: any = { symbol: "ESTrend" };
      payload.self = { ref: payload.symbol };

      const result = validateAndSanitize(payload);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================
  // Boundary Conditions
  // ============================================

  describe("Boundary Conditions", () => {
    describe("Price Boundaries", () => {
      it("should accept price of 0", () => {
        const result = validateAndSanitize({ price: 0 });
        expect(result.valid).toBe(true);
      });

      it("should accept maximum valid price", () => {
        const result = validateAndSanitize({ price: 999999999 });
        expect(result.valid).toBe(true);
      });

      it("should reject price just over maximum", () => {
        const result = validateAndSanitize({ price: 1000000001 });
        expect(result.valid).toBe(false);
      });

      it("should reject negative prices", () => {
        const result = validateAndSanitize({ price: -1 });
        expect(result.valid).toBe(false);
      });

      it("should handle very small decimal prices", () => {
        const result = validateAndSanitize({ price: 0.00001 });
        expect(result.valid).toBe(true);
      });
    });

    describe("Quantity Boundaries", () => {
      it("should accept quantity of 0", () => {
        const result = validateAndSanitize({ quantity: 0 });
        expect(result.valid).toBe(true);
      });

      it("should accept maximum valid quantity", () => {
        const result = validateAndSanitize({ quantity: 9999 });
        expect(result.valid).toBe(true);
      });

      it("should reject quantity just over maximum", () => {
        const result = validateAndSanitize({ quantity: 10001 });
        expect(result.valid).toBe(false);
      });

      it("should reject negative quantities", () => {
        const result = validateAndSanitize({ quantity: -1 });
        expect(result.valid).toBe(false);
      });
    });

    describe("String Length Boundaries", () => {
      it("should accept string at maximum length", () => {
        const result = validateAndSanitize({ symbol: "x".repeat(1000) });
        expect(result.valid).toBe(true);
      });

      it("should reject string just over maximum", () => {
        const result = validateAndSanitize({ symbol: "x".repeat(1001) });
        expect(result.valid).toBe(false);
      });

      it("should accept empty string", () => {
        const result = validateAndSanitize({ symbol: "" });
        expect(result.valid).toBe(true);
      });
    });

    describe("Timestamp Boundaries", () => {
      it("should accept timestamp exactly at drift boundary", () => {
        const maxDrift = 5 * 60 * 1000; // 5 minutes
        const boundaryTime = new Date(Date.now() - maxDrift + 1000); // Just inside

        const result = validateTimestamp(boundaryTime, maxDrift);
        expect(result.valid).toBe(true);
      });

      it("should reject timestamp just outside drift boundary", () => {
        const maxDrift = 5 * 60 * 1000;
        const outsideTime = new Date(Date.now() - maxDrift - 1000); // Just outside

        const result = validateTimestamp(outsideTime, maxDrift);
        expect(result.valid).toBe(false);
      });

      it("should handle Unix timestamp at epoch", () => {
        const result = validateTimestamp(0);
        expect(result.valid).toBe(false); // Way too old
      });

      it("should handle far future timestamps", () => {
        const farFuture = new Date("2099-12-31");
        const result = validateTimestamp(farFuture);
        expect(result.valid).toBe(false);
      });
    });
  });

  // ============================================
  // Error Recovery
  // ============================================

  describe("Error Recovery", () => {
    it("should recover from validation errors gracefully", () => {
      // First request fails validation
      const invalid = validateAndSanitize({ price: -1 });
      expect(invalid.valid).toBe(false);

      // Next request should work fine
      const valid = validateAndSanitize({ price: 4500, symbol: "ESTrend" });
      expect(valid.valid).toBe(true);
    });

    it("should not leak state between requests", () => {
      __testing.rateLimitStore.clear();

      // Request from IP A
      const resultA1 = checkRateLimit("ip-a", {
        windowMs: 60000,
        maxRequests: 2,
      });
      const resultA2 = checkRateLimit("ip-a", {
        windowMs: 60000,
        maxRequests: 2,
      });

      // Request from IP B should have fresh state
      const resultB = checkRateLimit("ip-b", {
        windowMs: 60000,
        maxRequests: 2,
      });

      expect(resultA1.remaining).toBe(1);
      expect(resultA2.remaining).toBe(0);
      expect(resultB.remaining).toBe(1); // Fresh state
    });
  });

  // ============================================
  // Special Character Handling
  // ============================================

  describe("Special Character Handling", () => {
    it("should handle unicode characters", () => {
      const result = validateAndSanitize({
        symbol: "ESTrend™",
        comment: "日本語テスト 🚀",
      });
      expect(result.valid).toBe(true);
    });

    it("should handle newlines and tabs", () => {
      const result = validateAndSanitize({
        symbol: "ESTrend",
        comment: "Line1\nLine2\tTabbed",
      });
      expect(result.valid).toBe(true);
    });

    it("should handle backslashes", () => {
      const result = validateAndSanitize({
        symbol: "ESTrend",
        comment: "Path\\to\\file",
      });
      expect(result.valid).toBe(true);
    });

    it("should handle quotes", () => {
      const result = validateAndSanitize({
        symbol: "ESTrend",
        comment: "He said \"hello\" and 'goodbye'",
      });
      expect(result.valid).toBe(true);
    });

    it("should strip null bytes", () => {
      const result = validateAndSanitize({
        symbol: "EST\0rend",
      });
      expect(result.valid).toBe(true);
      expect(result.sanitized?.symbol).toBe("ESTrend");
    });
  });
});

// ============================================
// Webhook Service Validation Tests
// ============================================

describe("Webhook Service Validation", () => {
  describe("Symbol Mapping", () => {
    it("should map NQ TradingView symbols to active strategies", () => {
      const mappings = [
        ["NQ", "NQTrend"],
        ["NQ1!", "NQTrend"],
        ["NQTREND", "NQTrend"],
        ["NQ_LEV", "NQTrendLeveraged"],
        ["NQ_LEVERAGED", "NQTrendLeveraged"],
        ["NQTRENDLEVERAGED", "NQTrendLeveraged"],
      ];

      for (const [input, expected] of mappings) {
        expect(mapSymbolToStrategy(input)).toBe(expected);
      }
    });

    it("should handle case insensitivity for NQ symbols", () => {
      expect(mapSymbolToStrategy("nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("Nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ")).toBe("NQTrend");
    });

    it("should return original for archived/unknown symbols", () => {
      // Archived strategies return original symbol
      expect(mapSymbolToStrategy("ES")).toBe("ES");
      expect(mapSymbolToStrategy("BTC")).toBe("BTC");
      expect(mapSymbolToStrategy("CL")).toBe("CL");
      expect(mapSymbolToStrategy("GC")).toBe("GC");
      expect(mapSymbolToStrategy("YM")).toBe("YM");
      // Unknown symbols return as-is
      expect(mapSymbolToStrategy("UNKNOWN")).toBe("UNKNOWN");
      expect(mapSymbolToStrategy("XYZ123")).toBe("XYZ123");
    });
  });

  describe("Timestamp Parsing", () => {
    it("should parse ISO format", () => {
      const date = parseTimestamp("2024-01-15T12:30:00Z");
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(15);
    });

    it("should parse TradingView space format", () => {
      const date = parseTimestamp("2024-01-15 12:30:00");
      expect(date.getUTCFullYear()).toBe(2024);
    });

    it("should parse TradingView dot format", () => {
      const date = parseTimestamp("2024.01.15 12:30:00");
      expect(date.getUTCFullYear()).toBe(2024);
    });

    it("should parse Unix seconds", () => {
      const date = parseTimestamp("1705320600"); // 2024-01-15 12:30:00 UTC
      expect(date.getUTCFullYear()).toBe(2024);
    });

    it("should throw for invalid formats", () => {
      expect(() => parseTimestamp("not-a-date")).toThrow(
        WebhookValidationError
      );
      expect(() => parseTimestamp("invalid")).toThrow(WebhookValidationError);
    });
  });

  describe("P&L Calculation", () => {
    it("should calculate long trade P&L correctly", () => {
      expect(calculatePnL("Long", 100, 110, 1)).toBe(10);
      expect(calculatePnL("Long", 100, 90, 1)).toBe(-10);
    });

    it("should calculate short trade P&L correctly", () => {
      expect(calculatePnL("Short", 100, 90, 1)).toBe(10);
      expect(calculatePnL("Short", 100, 110, 1)).toBe(-10);
    });

    it("should handle quantity multiplier", () => {
      expect(calculatePnL("Long", 100, 110, 5)).toBe(50);
      expect(calculatePnL("Short", 100, 90, 5)).toBe(50);
    });

    it("should handle zero quantity", () => {
      expect(calculatePnL("Long", 100, 110, 0)).toBe(0);
    });

    it("should handle equal entry and exit prices", () => {
      expect(calculatePnL("Long", 100, 100, 1)).toBe(0);
      expect(calculatePnL("Short", 100, 100, 1)).toBe(0);
    });
  });

  describe("Payload Validation", () => {
    it("should validate complete payload", () => {
      const payload = {
        symbol: "ESTrend",
        date: "2024-01-15T12:00:00Z",
        data: "buy",
        price: 4500,
        quantity: 1,
        token: "secret",
      };

      const result = validatePayload(payload);
      expect(result.strategySymbol).toBe("ESTrend");
      expect(result.action).toBe("buy");
      expect(result.direction).toBe("Long");
      expect(result.price).toBe(4500);
    });

    it("should normalize action values", () => {
      expect(
        validatePayload({ symbol: "ES", data: "buy", price: 100 }).action
      ).toBe("buy");
      expect(
        validatePayload({ symbol: "ES", data: "BUY", price: 100 }).action
      ).toBe("buy");
      expect(
        validatePayload({ symbol: "ES", data: "long", price: 100 }).action
      ).toBe("buy");
      expect(
        validatePayload({ symbol: "ES", data: "sell", price: 100 }).action
      ).toBe("sell");
      expect(
        validatePayload({ symbol: "ES", data: "short", price: 100 }).action
      ).toBe("sell");
      expect(
        validatePayload({ symbol: "ES", data: "exit", price: 100 }).action
      ).toBe("exit");
    });

    it("should throw for missing symbol", () => {
      expect(() => validatePayload({ data: "buy", price: 100 })).toThrow(
        WebhookValidationError
      );
    });

    it("should throw for missing action", () => {
      expect(() => validatePayload({ symbol: "ES", price: 100 })).toThrow(
        WebhookValidationError
      );
    });

    it("should throw for missing price", () => {
      expect(() => validatePayload({ symbol: "ES", data: "buy" })).toThrow(
        WebhookValidationError
      );
    });

    it("should throw for invalid action", () => {
      expect(() =>
        validatePayload({ symbol: "ES", data: "invalid", price: 100 })
      ).toThrow(WebhookValidationError);
    });

    it("should handle string prices", () => {
      const result = validatePayload({
        symbol: "ES",
        data: "buy",
        price: "4500.50",
      });
      expect(result.price).toBe(4500.5);
    });

    it("should default quantity to 1", () => {
      const result = validatePayload({ symbol: "ES", data: "buy", price: 100 });
      expect(result.quantity).toBe(1);
    });
  });
});
