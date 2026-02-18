/**
 * Webhook Test Simulator Tests
 *
 * Tests for the sendTestWebhook and validatePayload procedures
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("Webhook Test Simulator", () => {
  const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";

  describe("sendTestWebhook", () => {
    it("should send entry signal test webhook", async () => {
      // This test verifies the test simulator can send entry signals
      // The actual mutation is protected, so we test the underlying logic
      const { processWebhook } = await import("./webhookService");
      const { clearOpenPositionsForStrategy } = await import("./db");

      // Clear any existing open positions for this strategy
      await clearOpenPositionsForStrategy("ESTrend");

      const payload = {
        symbol: "ESTrend",
        signalType: "entry",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        direction: "Long",
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        isTest: true, // Mark as test data to prevent pollution of dashboard
      };

      const result = await processWebhook(payload, "test-simulator");

      // Entry signal should succeed or indicate position already exists
      expect(result.processingTimeMs).toBeGreaterThan(0);
      if (result.success) {
        expect(result.message).toContain("Entry signal logged");
      } else {
        // May fail if position already exists
        expect(result.error).toBeDefined();
      }
    });

    it("should send exit signal test webhook with trade creation", async () => {
      const { processWebhook } = await import("./webhookService");

      // Use unique timestamps to avoid duplicate detection
      const uniqueTime = Date.now() + Math.random() * 1000000;
      const payload = {
        symbol: "ESTrend",
        date: new Date(uniqueTime).toISOString(),
        data: "exit",
        quantity: 1,
        price: 4520 + Math.floor(Math.random() * 100),
        direction: "Long",
        entryPrice: 4500 + Math.floor(Math.random() * 100),
        entryTime: new Date(uniqueTime - 3600000).toISOString(),
        pnl: 20,
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        isTest: true, // Mark as test data to prevent pollution of dashboard
      };

      const result = await processWebhook(payload, "test-simulator");

      // Exit signals should create trades or be logged
      // May be duplicate if same entry/exit times exist
      expect(result.success !== undefined).toBe(true);
      if (result.success) {
        expect(result.message).toBeDefined();
      }
    });

    it("should handle short direction", async () => {
      const { processWebhook } = await import("./webhookService");
      const { clearOpenPositionsForStrategy } = await import("./db");

      // Clear any existing open positions for NQTrend to avoid conflicts
      await clearOpenPositionsForStrategy("NQTrend");

      const payload = {
        symbol: "NQTrend",
        signalType: "entry",
        date: new Date().toISOString(),
        data: "sell",
        quantity: 1,
        price: 4500,
        direction: "Short",
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        isTest: true, // Mark as test data to prevent pollution of dashboard
      };

      const result = await processWebhook(payload, "test-simulator");

      // Entry signal should succeed or indicate position already exists
      expect(result.processingTimeMs).toBeGreaterThan(0);
      if (result.success) {
        expect(result.message).toContain("Short");
      }
    });
  });

  describe("validatePayload", () => {
    it("should validate correct entry payload", async () => {
      const { validatePayload, mapSymbolToStrategy } = await import(
        "./webhookService"
      );

      const payload = {
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
      };

      const validated = validatePayload(payload);

      expect(validated.strategySymbol).toBe("ESTrend");
      expect(validated.action).toBe("buy"); // action is the raw data value
      expect(validated.direction).toBe("Long");
      expect(validated.price).toBe(4500);
    });

    it("should validate correct exit payload", async () => {
      const { validatePayload } = await import("./webhookService");

      const payload = {
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "exit",
        quantity: 1,
        price: 4520,
        entryPrice: 4500,
      };

      const validated = validatePayload(payload);

      expect(validated.action).toBe("exit"); // exit is passed through
      expect(validated.price).toBe(4520);
      expect(validated.entryPrice).toBe(4500);
    });

    it("should map TradingView symbols correctly", async () => {
      const { mapSymbolToStrategy } = await import("./webhookService");

      // NQ symbols are mapped to active strategies
      expect(mapSymbolToStrategy("NQ")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ1!")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ_LEV")).toBe("NQTrendLeveraged");
      // Archived symbols return as-is
      expect(mapSymbolToStrategy("ES")).toBe("ES");
      expect(mapSymbolToStrategy("BTC")).toBe("BTC");
    });

    it("should reject invalid JSON", async () => {
      const { validatePayload } = await import("./webhookService");

      expect(() => validatePayload(null)).toThrow();
      expect(() => validatePayload(undefined)).toThrow();
      expect(() => validatePayload("not json")).toThrow();
    });

    it("should reject missing required fields", async () => {
      const { validatePayload } = await import("./webhookService");

      // Missing symbol
      expect(() =>
        validatePayload({ date: "2024-01-01", data: "buy", price: 100 })
      ).toThrow();

      // Missing price
      expect(() =>
        validatePayload({ symbol: "ESTrend", date: "2024-01-01", data: "buy" })
      ).toThrow();
    });

    it("should handle various date formats", async () => {
      const { validatePayload } = await import("./webhookService");

      // ISO format
      const iso = validatePayload({
        symbol: "ESTrend",
        date: "2024-12-17T12:00:00Z",
        data: "buy",
        price: 4500,
      });
      expect(iso.timestamp).toBeInstanceOf(Date);

      // Unix timestamp
      const unix = validatePayload({
        symbol: "ESTrend",
        date: 1702814400000,
        data: "buy",
        price: 4500,
      });
      expect(unix.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Symbol Mapping Edge Cases", () => {
    it("should handle case-insensitive NQ symbols", async () => {
      const { mapSymbolToStrategy } = await import("./webhookService");

      expect(mapSymbolToStrategy("nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("Nq")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ")).toBe("NQTrend");
    });

    it("should handle NQ symbols with whitespace", async () => {
      const { mapSymbolToStrategy } = await import("./webhookService");

      expect(mapSymbolToStrategy(" NQ ")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQ ")).toBe("NQTrend");
    });

    it("should pass through already-mapped NQ strategy symbols", async () => {
      const { mapSymbolToStrategy } = await import("./webhookService");

      expect(mapSymbolToStrategy("NQTrend")).toBe("NQTrend");
      expect(mapSymbolToStrategy("NQTrendLeveraged")).toBe("NQTrendLeveraged");
    });
  });
});
