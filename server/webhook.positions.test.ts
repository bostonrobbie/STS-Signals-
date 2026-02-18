/**
 * Tests for Enhanced Webhook Position Tracking
 *
 * Tests the entry/exit signal handling with persistent position tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validatePayload,
  parseTimestamp,
  calculatePnL,
  mapSymbolToStrategy,
} from "./webhookService";

describe("Enhanced Webhook Position Tracking", () => {
  describe("Signal Type Detection", () => {
    it("should detect entry signal from explicit signalType field", () => {
      const payload = {
        symbol: "ESTrend",
        signalType: "entry",
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("entry");
      expect(result.action).toBe("buy");
    });

    it("should detect exit signal from explicit signalType field", () => {
      const payload = {
        symbol: "ESTrend",
        signalType: "exit",
        data: "sell",
        price: 4520,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("exit");
    });

    it("should detect exit signal from position=flat", () => {
      const payload = {
        symbol: "ESTrend",
        position: "flat",
        data: "exit",
        price: 4520,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("exit");
      expect(result.marketPosition).toBe("flat");
    });

    it("should detect entry signal from buy action", () => {
      const payload = {
        symbol: "ESTrend",
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("entry");
      expect(result.action).toBe("buy");
      expect(result.direction).toBe("Long");
    });

    it("should detect entry signal from sell action (short)", () => {
      const payload = {
        symbol: "ESTrend",
        data: "sell",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("entry");
      expect(result.action).toBe("sell");
      expect(result.direction).toBe("Short");
    });

    it("should detect exit signal from exit action", () => {
      const payload = {
        symbol: "ESTrend",
        data: "exit",
        price: 4520,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("exit");
      expect(result.action).toBe("exit");
    });

    it("should detect exit signal from close action", () => {
      const payload = {
        symbol: "ESTrend",
        data: "close",
        price: 4520,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.signalType).toBe("exit");
    });
  });

  describe("Market Position Detection", () => {
    it("should detect long position from position field", () => {
      const payload = {
        symbol: "ESTrend",
        position: "long",
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.marketPosition).toBe("long");
    });

    it("should detect short position from position field", () => {
      const payload = {
        symbol: "ESTrend",
        position: "short",
        data: "sell",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.marketPosition).toBe("short");
    });

    it("should detect flat position from position field", () => {
      const payload = {
        symbol: "ESTrend",
        position: "flat",
        data: "exit",
        price: 4520,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.marketPosition).toBe("flat");
    });

    it("should infer long position from buy action", () => {
      const payload = {
        symbol: "ESTrend",
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.marketPosition).toBe("long");
    });

    it("should infer short position from sell action", () => {
      const payload = {
        symbol: "ESTrend",
        data: "sell",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.marketPosition).toBe("short");
    });
  });

  describe("Symbol Mapping", () => {
    it("should map NQ to NQTrend", () => {
      expect(mapSymbolToStrategy("NQ")).toBe("NQTrend");
    });

    it("should map NQ1! to NQTrend", () => {
      expect(mapSymbolToStrategy("NQ1!")).toBe("NQTrend");
    });

    it("should map NQ_LEV to NQTrendLeveraged", () => {
      expect(mapSymbolToStrategy("NQ_LEV")).toBe("NQTrendLeveraged");
    });

    it("should handle case insensitivity for NQ", () => {
      expect(mapSymbolToStrategy("nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("Nq")).toBe("NQTrend");
    });

    it("should return original symbol for archived/unknown symbols", () => {
      expect(mapSymbolToStrategy("ES")).toBe("ES");
      expect(mapSymbolToStrategy("BTC")).toBe("BTC");
      expect(mapSymbolToStrategy("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("P&L Calculation", () => {
    it("should calculate positive P&L for long trade", () => {
      const pnl = calculatePnL("Long", 4500, 4520, 1);
      expect(pnl).toBe(20);
    });

    it("should calculate negative P&L for long trade", () => {
      const pnl = calculatePnL("Long", 4500, 4480, 1);
      expect(pnl).toBe(-20);
    });

    it("should calculate positive P&L for short trade", () => {
      const pnl = calculatePnL("Short", 4500, 4480, 1);
      expect(pnl).toBe(20);
    });

    it("should calculate negative P&L for short trade", () => {
      const pnl = calculatePnL("Short", 4500, 4520, 1);
      expect(pnl).toBe(-20);
    });

    it("should scale P&L by quantity", () => {
      const pnl = calculatePnL("Long", 4500, 4520, 3);
      expect(pnl).toBe(60);
    });
  });

  describe("Timestamp Parsing", () => {
    it("should parse ISO format", () => {
      const date = parseTimestamp("2024-12-20T10:30:00.000Z");
      expect(date).toBeInstanceOf(Date);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(11); // December is 11
      expect(date.getUTCDate()).toBe(20);
    });

    it("should parse TradingView format with space", () => {
      const date = parseTimestamp("2024-12-20 10:30:00");
      expect(date).toBeInstanceOf(Date);
    });

    it("should parse TradingView format with dots", () => {
      const date = parseTimestamp("2024.12.20 10:30:00");
      expect(date).toBeInstanceOf(Date);
    });

    it("should throw on invalid format", () => {
      expect(() => parseTimestamp("invalid")).toThrow();
    });
  });

  describe("Payload Validation", () => {
    it("should validate complete entry payload", () => {
      const payload = {
        symbol: "NQTrend",
        signalType: "entry",
        data: "buy",
        position: "long",
        quantity: 2,
        price: 4500.5,
        date: new Date().toISOString(),
        token: "test_token",
      };

      const result = validatePayload(payload);

      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.signalType).toBe("entry");
      expect(result.action).toBe("buy");
      expect(result.direction).toBe("Long");
      expect(result.quantity).toBe(2);
      expect(result.price).toBe(4500.5);
      expect(result.token).toBe("test_token");
    });

    it("should validate complete exit payload", () => {
      const payload = {
        symbol: "NQTrend",
        signalType: "exit",
        data: "exit",
        position: "flat",
        quantity: 2,
        price: 4520.75,
        date: new Date().toISOString(),
        entryPrice: 4500.5,
        pnl: 40.5,
      };

      const result = validatePayload(payload);

      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.signalType).toBe("exit");
      expect(result.action).toBe("exit");
      expect(result.marketPosition).toBe("flat");
      expect(result.price).toBe(4520.75);
      expect(result.entryPrice).toBe(4500.5);
      expect(result.pnl).toBe(40.5);
    });

    it("should reject payload without symbol", () => {
      const payload = {
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      expect(() => validatePayload(payload)).toThrow(
        'Missing or invalid "symbol"'
      );
    });

    it("should reject payload without action/data", () => {
      const payload = {
        symbol: "ESTrend",
        price: 4500,
        date: new Date().toISOString(),
      };

      expect(() => validatePayload(payload)).toThrow(
        'Missing or invalid "data"'
      );
    });

    it("should reject payload without price", () => {
      const payload = {
        symbol: "ESTrend",
        data: "buy",
        date: new Date().toISOString(),
      };

      expect(() => validatePayload(payload)).toThrow('Missing "price"');
    });

    it("should apply quantity multiplier", () => {
      const payload = {
        symbol: "ESTrend",
        data: "buy",
        price: 4500,
        quantity: 2,
        quantityMultiplier: 3,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.quantity).toBe(6); // 2 * 3
    });

    it("should default quantity to 1", () => {
      const payload = {
        symbol: "ESTrend",
        data: "buy",
        price: 4500,
        date: new Date().toISOString(),
      };

      const result = validatePayload(payload);
      expect(result.quantity).toBe(1);
    });

    it("should use current time if date not provided", () => {
      const before = new Date();

      const payload = {
        symbol: "ESTrend",
        data: "buy",
        price: 4500,
      };

      const result = validatePayload(payload);
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("TradingView Webhook Format Compatibility", () => {
    it("should handle standard TradingView entry webhook", () => {
      // Simulates: {{strategy.order.action}} = "buy"
      const payload = {
        symbol: "NQ",
        date: "2024-12-20T10:30:00.000Z",
        data: "buy",
        quantity: 1,
        price: "4500.25",
        token: "secret",
      };

      const result = validatePayload(payload);

      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.action).toBe("buy");
      expect(result.direction).toBe("Long");
      expect(result.price).toBe(4500.25);
      expect(result.signalType).toBe("entry");
    });

    it("should handle TradingView exit webhook with market_position=flat", () => {
      // Simulates: {{strategy.market_position}} = "flat"
      const payload = {
        symbol: "NQ",
        date: "2024-12-20T11:30:00.000Z",
        data: "sell",
        position: "flat",
        quantity: 1,
        price: "4520.50",
        token: "secret",
      };

      const result = validatePayload(payload);

      expect(result.strategySymbol).toBe("NQTrend");
      expect(result.signalType).toBe("exit");
      expect(result.marketPosition).toBe("flat");
      expect(result.price).toBe(4520.5);
    });

    it("should handle enhanced webhook with explicit signalType", () => {
      const payload = {
        symbol: "NQTrend",
        signalType: "entry",
        date: "2024-12-20T10:30:00.000Z",
        data: "buy",
        direction: "long",
        quantity: 2,
        price: 4500.25,
        token: "secret",
      };

      const result = validatePayload(payload);

      expect(result.signalType).toBe("entry");
      expect(result.direction).toBe("Long");
      expect(result.quantity).toBe(2);
    });
  });
});
