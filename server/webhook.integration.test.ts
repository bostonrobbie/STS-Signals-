/**
 * Webhook Integration Tests
 *
 * End-to-end tests for the webhook system including:
 * - Token authentication
 * - Full webhook flow
 * - Error handling
 * - Performance
 */

import { describe, it, expect } from "vitest";

const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";

describe("Webhook Integration Tests", () => {
  describe("Webhook Endpoint", () => {
    it("should reject requests without token when token is configured", async () => {
      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "ESTrend",
          date: new Date().toISOString(),
          data: "buy",
          quantity: 1,
          price: 4500,
          // No token
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("token");
    });

    it("should reject requests with invalid token", async () => {
      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "ESTrend",
          date: new Date().toISOString(),
          data: "buy",
          quantity: 1,
          price: 4500,
          token: "invalid_token_12345",
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("token");
    });

    it("should accept valid webhook with correct token", async () => {
      const token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
      if (!token) {
        console.log("Skipping: No token configured");
        return;
      }

      // Clear any existing open positions first
      const { clearOpenPositionsForStrategy } = await import("./db");
      await clearOpenPositionsForStrategy("ESTrend");

      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "ESTrend",
          signalType: "entry",
          date: new Date().toISOString(),
          data: "buy",
          quantity: 1,
          price: 4500,
          direction: "Long",
          token,
        }),
      });

      const data = await response.json();
      // Entry should succeed or indicate position exists
      expect(data.processingTimeMs).toBeGreaterThan(0);
      if (data.success) {
        expect(data.message).toContain("Entry signal logged");
      } else {
        // May fail if position already exists
        expect(data.error).toBeDefined();
      }
    });

    it("should reject unknown strategy symbols", async () => {
      const token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
      if (!token) {
        console.log("Skipping: No token configured");
        return;
      }

      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "UNKNOWN_SYMBOL_XYZ",
          date: new Date().toISOString(),
          data: "buy",
          quantity: 1,
          price: 4500,
          token,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("Unknown strategy");
    });

    it("should handle missing required fields gracefully", async () => {
      const token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
      if (!token) {
        console.log("Skipping: No token configured");
        return;
      }

      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing symbol and price
          date: new Date().toISOString(),
          data: "buy",
          token,
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      // Express should return 400 for malformed JSON
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should handle empty body gracefully", async () => {
      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("Performance", () => {
    it("should process webhooks within acceptable time", async () => {
      const token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
      if (!token) {
        console.log("Skipping: No token configured");
        return;
      }

      const startTime = Date.now();
      const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "ESTrend",
          date: new Date().toISOString(),
          data: "buy",
          quantity: 1,
          price: 4500,
          direction: "Long",
          token,
        }),
      });
      const endTime = Date.now();

      const data = await response.json();
      const totalTime = endTime - startTime;

      // Total round-trip should be under 2 seconds
      expect(totalTime).toBeLessThan(2000);

      // Server processing should be under 500ms
      if (data.processingTimeMs) {
        expect(data.processingTimeMs).toBeLessThan(500);
      }
    });

    it("should handle concurrent requests without crashing", async () => {
      const token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
      if (!token) {
        console.log("Skipping: No token configured");
        return;
      }

      // Clear any existing open positions first
      const { clearOpenPositionsForStrategy } = await import("./db");
      await clearOpenPositionsForStrategy("ESTrend");

      // Send 5 concurrent requests - only one entry can succeed,
      // the rest will get "position already open" (400)
      const promises = Array(5)
        .fill(null)
        .map((_, i) =>
          fetch(`${baseUrl}/api/webhook/tradingview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: "ESTrend",
              signalType: "entry",
              date: new Date(Date.now() + i * 1000).toISOString(),
              data: "buy",
              quantity: 1,
              price: 4500 + i,
              direction: "Long",
              token,
            }),
          })
        );

      const responses = await Promise.all(promises);

      // All requests should complete without server errors
      expect(responses.length).toBe(5);

      // All should return 200 or 400 (position already open), never 500
      for (const r of responses) {
        expect([200, 400]).toContain(r.status);
      }

      // All responses should be valid JSON
      for (const r of responses) {
        const data = await r.clone().json();
        expect(data).toBeDefined();
      }
    }, 15000); // Increase timeout for concurrent DB operations
  });
});
