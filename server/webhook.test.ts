/**
 * TradingView Webhook Service Tests
 *
 * Comprehensive test suite for webhook processing, validation, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validatePayload,
  parseTimestamp,
  calculatePnL,
  mapSymbolToStrategy,
  NormalizedPayload,
  WebhookValidationError,
} from "./webhookService";

describe("Webhook Service", () => {
  describe("mapSymbolToStrategy", () => {
    it("should map NQ symbols to NQTrend", () => {
      expect(mapSymbolToStrategy("NQ")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ1!")).toBe("NQTrend");
      expect(mapSymbolToStrategy("nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQTREND")).toBe("NQTrend");
    });

    it("should map NQ_LEV symbols to NQTrendLeveraged", () => {
      expect(mapSymbolToStrategy("NQ_LEV")).toBe("NQTrendLeveraged");
      expect(mapSymbolToStrategy("NQ_LEVERAGED")).toBe("NQTrendLeveraged");
      expect(mapSymbolToStrategy("NQTRENDLEVERAGED")).toBe("NQTrendLeveraged");
    });

    it("should return original symbol for unmapped symbols (archived strategies)", () => {
      // These symbols are no longer mapped - they return as-is
      expect(mapSymbolToStrategy("ES")).toBe("ES");
      expect(mapSymbolToStrategy("BTC")).toBe("BTC");
      expect(mapSymbolToStrategy("CL")).toBe("CL");
      expect(mapSymbolToStrategy("GC")).toBe("GC");
      expect(mapSymbolToStrategy("YM")).toBe("YM");
    });

    it("should return original symbol if no mapping found", () => {
      expect(mapSymbolToStrategy("UNKNOWN")).toBe("UNKNOWN");
      expect(mapSymbolToStrategy("CustomStrategy")).toBe("CustomStrategy");
    });
  });

  describe("parseTimestamp", () => {
    it("should parse ISO format timestamps", () => {
      const date = parseTimestamp("2024-01-15T14:30:00Z");
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0); // January
      expect(date.getUTCDate()).toBe(15);
    });

    it("should parse TradingView space-separated format", () => {
      const date = parseTimestamp("2024-01-15 14:30:00");
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
    });

    it("should parse TradingView dot-separated format", () => {
      const date = parseTimestamp("2024.01.15 14:30:00");
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(15);
    });

    it("should parse Unix timestamp in seconds", () => {
      const date = parseTimestamp("1705329000"); // 2024-01-15 14:30:00 UTC
      expect(date.getUTCFullYear()).toBe(2024);
    });

    it("should throw error for invalid timestamp", () => {
      expect(() => parseTimestamp("invalid")).toThrow(WebhookValidationError);
      expect(() => parseTimestamp("")).toThrow(WebhookValidationError);
    });
  });

  describe("calculatePnL", () => {
    it("should calculate P&L for long trades correctly", () => {
      // Long: profit when exit > entry
      expect(calculatePnL("Long", 100, 110, 1)).toBe(10);
      expect(calculatePnL("Long", 100, 90, 1)).toBe(-10);
      expect(calculatePnL("Long", 100, 110, 2)).toBe(20);
    });

    it("should calculate P&L for short trades correctly", () => {
      // Short: profit when entry > exit
      expect(calculatePnL("Short", 110, 100, 1)).toBe(10);
      expect(calculatePnL("Short", 100, 110, 1)).toBe(-10);
      expect(calculatePnL("Short", 110, 100, 2)).toBe(20);
    });

    it("should handle zero P&L", () => {
      expect(calculatePnL("Long", 100, 100, 1)).toBe(0);
      expect(calculatePnL("Short", 100, 100, 1)).toBe(0);
    });
  });

  describe("validatePayload", () => {
    describe("TradingView format (symbol, date, data, price)", () => {
      it("should validate a valid buy signal", () => {
        const payload = {
          symbol: "NQ",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          quantity: 1,
          price: 4500.5,
        };

        const result = validatePayload(payload);
        expect(result.strategySymbol).toBe("NQTrend");
        expect(result.action).toBe("buy");
        expect(result.direction).toBe("Long");
        expect(result.price).toBe(4500.5);
        expect(result.quantity).toBe(1);
      });

      it("should validate a valid sell signal", () => {
        const payload = {
          symbol: "NQ",
          date: "2024-01-15T14:30:00Z",
          data: "sell",
          quantity: 2,
          price: 15000.25,
        };

        const result = validatePayload(payload);
        expect(result.strategySymbol).toBe("NQTrend");
        expect(result.action).toBe("sell");
        expect(result.direction).toBe("Short");
        expect(result.quantity).toBe(2);
      });

      it("should validate an exit signal", () => {
        const payload = {
          symbol: "NQ_LEV",
          date: "2024-01-15T14:30:00Z",
          data: "exit",
          quantity: 1,
          price: 42000,
          entryPrice: 40000,
          entryTime: "2024-01-14T10:00:00Z",
          pnl: 2000,
        };

        const result = validatePayload(payload);
        expect(result.strategySymbol).toBe("NQTrendLeveraged");
        expect(result.action).toBe("exit");
        expect(result.entryPrice).toBe(40000);
        expect(result.pnl).toBe(2000);
      });

      it("should handle string prices", () => {
        const payload = {
          symbol: "NQ",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          quantity: 1,
          price: "4500.50",
        };

        const result = validatePayload(payload);
        expect(result.price).toBe(4500.5);
      });

      it("should default quantity to 1", () => {
        const payload = {
          symbol: "NQ",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          price: 4500,
        };

        const result = validatePayload(payload);
        expect(result.quantity).toBe(1);
      });
    });

    describe("Alternative format (strategy, action, direction)", () => {
      it("should validate alternative format", () => {
        const payload = {
          strategy: "NQTrend",
          action: "entry_long",
          price: 4500,
          timestamp: "2024-01-15T14:30:00Z",
        };

        const result = validatePayload(payload);
        expect(result.strategySymbol).toBe("NQTrend");
        expect(result.direction).toBe("Long");
      });

      it("should handle explicit direction field", () => {
        const payload = {
          symbol: "NQ",
          data: "exit",
          price: 4500,
          date: "2024-01-15T14:30:00Z",
          direction: "short",
        };

        const result = validatePayload(payload);
        expect(result.direction).toBe("Short");
      });
    });

    describe("Error handling", () => {
      it("should throw error for null payload", () => {
        expect(() => validatePayload(null)).toThrow(WebhookValidationError);
      });

      it("should throw error for non-object payload", () => {
        expect(() => validatePayload("string")).toThrow(WebhookValidationError);
        expect(() => validatePayload(123)).toThrow(WebhookValidationError);
      });

      it("should throw error for missing symbol", () => {
        const payload = {
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          price: 4500,
        };
        expect(() => validatePayload(payload)).toThrow(
          'Missing or invalid "symbol" or "strategy" field'
        );
      });

      it("should throw error for missing action/data", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          price: 4500,
        };
        expect(() => validatePayload(payload)).toThrow(
          'Missing or invalid "data" or "action" field'
        );
      });

      it("should throw error for missing price", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
        };
        expect(() => validatePayload(payload)).toThrow('Missing "price" field');
      });

      it("should throw error for invalid price", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          price: "invalid",
        };
        expect(() => validatePayload(payload)).toThrow('Invalid "price" field');
      });

      it("should throw error for unknown action", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: "unknown_action",
          price: 4500,
        };
        expect(() => validatePayload(payload)).toThrow("Unknown action");
      });
    });

    describe("Token handling", () => {
      it("should extract token from payload", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          price: 4500,
          token: "secret123",
        };

        const result = validatePayload(payload);
        expect(result.token).toBe("secret123");
      });

      it("should handle missing token", () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: "buy",
          price: 4500,
        };

        const result = validatePayload(payload);
        expect(result.token).toBeUndefined();
      });
    });
  });

  describe("Action normalization", () => {
    const testCases = [
      { input: "buy", expectedAction: "buy", expectedDirection: "Long" },
      { input: "BUY", expectedAction: "buy", expectedDirection: "Long" },
      { input: "long", expectedAction: "buy", expectedDirection: "Long" },
      { input: "LONG", expectedAction: "buy", expectedDirection: "Long" },
      { input: "entry_long", expectedAction: "buy", expectedDirection: "Long" },
      { input: "sell", expectedAction: "sell", expectedDirection: "Short" },
      { input: "SELL", expectedAction: "sell", expectedDirection: "Short" },
      { input: "short", expectedAction: "sell", expectedDirection: "Short" },
      { input: "SHORT", expectedAction: "sell", expectedDirection: "Short" },
      {
        input: "entry_short",
        expectedAction: "sell",
        expectedDirection: "Short",
      },
      { input: "exit", expectedAction: "exit", expectedDirection: "Long" },
      { input: "EXIT", expectedAction: "exit", expectedDirection: "Long" },
      { input: "close", expectedAction: "exit", expectedDirection: "Long" },
      { input: "exit_long", expectedAction: "exit", expectedDirection: "Long" },
      {
        input: "exit_short",
        expectedAction: "exit",
        expectedDirection: "Short",
      },
    ];

    testCases.forEach(({ input, expectedAction, expectedDirection }) => {
      it(`should normalize "${input}" to action="${expectedAction}", direction="${expectedDirection}"`, () => {
        const payload = {
          symbol: "ES",
          date: "2024-01-15T14:30:00Z",
          data: input,
          price: 4500,
        };

        const result = validatePayload(payload);
        expect(result.action).toBe(expectedAction);
        expect(result.direction).toBe(expectedDirection);
      });
    });
  });

  describe("Real-world payload examples", () => {
    it("should handle TradingView webhook with placeholders resolved", () => {
      // This simulates what TradingView actually sends after resolving placeholders
      const payload = {
        symbol: "NQ",
        date: "2024-12-16 14:30:00",
        data: "buy",
        quantity: 1,
        price: "42150.50",
        token: "my_secret_token",
      };

      const result = validatePayload(payload);
      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.action).toBe("buy");
      expect(result.direction).toBe("Long");
      expect(result.price).toBe(42150.5);
    });

    it("should handle exit with P&L from strategy.order.profit", () => {
      const payload = {
        symbol: "NQ",
        date: "2024-12-16 15:00:00",
        data: "exit",
        quantity: 1,
        price: "4520.25",
        entryPrice: 4500.0,
        entryTime: "2024-12-16 14:30:00",
        pnl: 20.25,
        direction: "Long",
      };

      const result = validatePayload(payload);
      expect(result.action).toBe("exit");
      expect(result.entryPrice).toBe(4500);
      expect(result.pnl).toBe(20.25);
      expect(result.direction).toBe("Long");
    });

    it("should handle multiple_accounts field (ignored but not error)", () => {
      const payload = {
        symbol: "NQ",
        date: "2024-12-16 14:30:00",
        data: "buy",
        quantity: 1,
        price: 15000,
        multiple_accounts: [
          { account: "account1", quantity: 1 },
          { account: "account2", quantity: 2 },
        ],
      };

      // Should not throw - multiple_accounts is just ignored
      const result = validatePayload(payload);
      expect(result.strategySymbol).toBe("NQTrend");
    });
  });
});

describe("Webhook Integration", () => {
  describe("End-to-end payload processing", () => {
    it("should process a complete entry-exit cycle", () => {
      // Entry signal
      const entryPayload = {
        symbol: "ES",
        date: "2024-12-16T09:30:00Z",
        data: "buy",
        quantity: 1,
        price: 4500,
      };

      const entryResult = validatePayload(entryPayload);
      expect(entryResult.action).toBe("buy");
      expect(entryResult.direction).toBe("Long");
      expect(entryResult.price).toBe(4500);

      // Exit signal
      const exitPayload = {
        symbol: "ES",
        date: "2024-12-16T15:30:00Z",
        data: "exit",
        quantity: 1,
        price: 4520,
        entryPrice: 4500,
        entryTime: "2024-12-16T09:30:00Z",
        direction: "Long",
      };

      const exitResult = validatePayload(exitPayload);
      expect(exitResult.action).toBe("exit");
      expect(exitResult.entryPrice).toBe(4500);

      // Calculate P&L
      const pnl = calculatePnL(
        exitResult.direction,
        exitResult.entryPrice!,
        exitResult.price,
        exitResult.quantity
      );
      expect(pnl).toBe(20); // Long: 4520 - 4500 = 20
    });

    it("should process a short trade correctly", () => {
      // Entry signal (short)
      const entryPayload = {
        symbol: "NQ",
        date: "2024-12-16T09:30:00Z",
        data: "sell",
        quantity: 2,
        price: 15000,
      };

      const entryResult = validatePayload(entryPayload);
      expect(entryResult.action).toBe("sell");
      expect(entryResult.direction).toBe("Short");

      // Exit signal
      const exitPayload = {
        symbol: "NQ",
        date: "2024-12-16T15:30:00Z",
        data: "exit",
        quantity: 2,
        price: 14900,
        entryPrice: 15000,
        entryTime: "2024-12-16T09:30:00Z",
        direction: "Short",
      };

      const exitResult = validatePayload(exitPayload);

      // Calculate P&L
      const pnl = calculatePnL(
        exitResult.direction,
        exitResult.entryPrice!,
        exitResult.price,
        exitResult.quantity
      );
      expect(pnl).toBe(200); // Short: (15000 - 14900) * 2 = 200
    });
  });
});
