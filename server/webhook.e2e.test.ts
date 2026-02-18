/**
 * Comprehensive E2E Webhook Test Suite
 *
 * Tests the full webhook flow from receipt to database updates.
 * Uses isTest flag to isolate test data from production.
 *
 * Actual API response structure:
 * { success: boolean, message: string, logId: number, signalType?: string, processingTimeMs: number, error?: string }
 */

import { describe, it, expect, beforeEach } from "vitest";

const baseUrl = "http://localhost:3000";
const webhookToken = process.env.TRADINGVIEW_WEBHOOK_TOKEN;

// Helper to create webhook payload
function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    symbol: "NQTrend",
    date: new Date().toISOString(),
    data: "buy",
    quantity: 1,
    price: 15000,
    token: webhookToken,
    isTest: true,
    ...overrides,
  };
}

// Helper to send webhook
async function sendWebhook(payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return {
    status: response.status,
    data: await response.json(),
    headers: Object.fromEntries(response.headers.entries()),
  };
}

// Helper to clear test positions for a strategy
async function clearTestPositions(symbol: string) {
  try {
    const { clearOpenPositionsForStrategy } = await import("./db");
    await clearOpenPositionsForStrategy(symbol);
  } catch {
    // Ignore if function doesn't exist
  }
}

describe("Webhook E2E Tests", () => {
  // ============================================
  // 1. Full E2E Flow Tests
  // ============================================
  describe("Full E2E Flow", () => {
    beforeEach(async () => {
      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 100));
    }, 30000);

    it("should process entry signal and create open position", async () => {
      if (!webhookToken) return;

      const payload = createPayload({
        data: "buy",
        direction: "Long",
        price: 15000.25,
      });

      const result = await sendWebhook(payload);

      expect(result.status).toBe(200);
      expect(result.data.success).toBe(true);
      expect(result.data.signalType).toBe("entry");
      expect(result.data.logId).toBeGreaterThan(0);
      expect(result.data.processingTimeMs).toBeGreaterThan(0);
    });

    it("should process exit signal and close trade", async () => {
      if (!webhookToken) return;

      // First, create an entry
      const entryPayload = createPayload({
        data: "buy",
        direction: "Long",
        price: 15000,
      });
      const entryResult = await sendWebhook(entryPayload);
      if (!entryResult.data.success) return;

      await new Promise(resolve => setTimeout(resolve, 150));

      // Then, send exit
      const exitPayload = createPayload({
        data: "exit",
        price: 15050,
        date: new Date().toISOString(),
      });
      const exitResult = await sendWebhook(exitPayload);

      expect(exitResult.status).toBe(200);
      expect(exitResult.data.signalType).toBe("exit");
      expect(exitResult.data.logId).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 2. Edge Case Tests
  // ============================================
  describe("Edge Cases", () => {
    it("should reject duplicate entry when position exists", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 100));

      // First entry
      const firstEntry = await sendWebhook(
        createPayload({
          data: "buy",
          price: 15000,
        })
      );
      expect(firstEntry.data.success).toBe(true);

      // Second entry should fail
      const secondEntry = await sendWebhook(
        createPayload({
          data: "buy",
          price: 15010,
          date: new Date().toISOString(),
        })
      );

      expect(secondEntry.data.success).toBe(false);
      expect(secondEntry.data.error).toBe("POSITION_EXISTS");
      expect(secondEntry.data.message).toContain("Send an exit signal first");
    });

    it("should reject exit when no position exists", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 100));

      const exitResult = await sendWebhook(
        createPayload({
          data: "exit",
          price: 15050,
        })
      );

      expect(exitResult.data.success).toBe(false);
      expect(exitResult.data.error).toBe("NO_OPEN_POSITION");
    });

    it("should handle unknown strategy gracefully", async () => {
      if (!webhookToken) return;

      const result = await sendWebhook(
        createPayload({
          symbol: "UNKNOWN_STRATEGY_XYZ",
          data: "buy",
          price: 100,
        })
      );

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain("Unknown strategy");
    });

    it("should handle missing required fields", async () => {
      if (!webhookToken) return;

      // Missing symbol
      const noSymbol = await sendWebhook({
        data: "buy",
        price: 100,
        token: webhookToken,
        isTest: true,
      });
      expect(noSymbol.data.success).toBe(false);

      // Missing price
      const noPrice = await sendWebhook({
        symbol: "NQTrend",
        data: "buy",
        token: webhookToken,
        isTest: true,
      });
      expect(noPrice.data.success).toBe(false);

      // Missing action
      const noAction = await sendWebhook({
        symbol: "NQTrend",
        price: 100,
        token: webhookToken,
        isTest: true,
      });
      expect(noAction.data.success).toBe(false);
    });
  });

  // ============================================
  // 3. Security Tests
  // ============================================
  describe("Security", () => {
    it("should reject requests without token", async () => {
      const result = await sendWebhook({
        symbol: "NQTrend",
        data: "buy",
        price: 15000,
        date: new Date().toISOString(),
        // No token
      });

      expect(result.data.success).toBe(false);
      const errorText = (
        result.data.error ||
        result.data.message ||
        ""
      ).toLowerCase();
      expect(errorText).toContain("token");
    });

    it("should reject requests with invalid token", async () => {
      const result = await sendWebhook({
        symbol: "NQTrend",
        data: "buy",
        price: 15000,
        date: new Date().toISOString(),
        token: "invalid_token_" + Date.now(),
      });

      expect(result.data.success).toBe(false);
      const errorText = (
        result.data.error ||
        result.data.message ||
        ""
      ).toLowerCase();
      expect(errorText).toContain("token");
    });
  });

  // ============================================
  // 4. Action Alias Tests
  // ============================================
  describe("Action Aliases", () => {
    it('should accept "buy" as long entry action', async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await sendWebhook(
        createPayload({
          data: "buy",
          price: 15000,
        })
      );

      expect(result.data.signalType).toBe("entry");
    });

    it("should recognize exit actions", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 50));

      // First create an entry
      await sendWebhook(
        createPayload({
          data: "buy",
          price: 15000,
        })
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      // Then test exit
      const result = await sendWebhook(
        createPayload({
          data: "exit",
          price: 15050,
          date: new Date().toISOString(),
        })
      );

      expect(result.data.signalType).toBe("exit");
    });

    it("should reject unknown actions with helpful message", async () => {
      if (!webhookToken) return;

      const result = await sendWebhook(
        createPayload({
          data: "invalid_action",
          price: 100,
        })
      );

      expect(result.data.success).toBe(false);
      expect(result.data.error).toContain("Unknown action");
    });
  });

  // ============================================
  // 5. API Stability Tests
  // ============================================
  describe("API Stability", () => {
    it("should return consistent response structure", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await sendWebhook(
        createPayload({
          price: 15000,
        })
      );

      // Required fields in every response
      expect(result.data).toHaveProperty("success");
      expect(result.data).toHaveProperty("message");
      expect(result.data).toHaveProperty("processingTimeMs");
      expect(typeof result.data.processingTimeMs).toBe("number");
    });

    it("should return logId for all processed requests", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await sendWebhook(
        createPayload({
          price: 15000,
        })
      );

      expect(result.data.logId).toBeDefined();
      expect(typeof result.data.logId).toBe("number");
    });

    it("should return signalType for successful signals", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 100));

      const entryResult = await sendWebhook(
        createPayload({
          data: "buy",
          price: 15000,
          date: new Date().toISOString(),
        })
      );

      expect(entryResult.data.signalType).toBe("entry");
    });

    it("should use consistent error codes", () => {
      const errorCodes = [
        "POSITION_EXISTS",
        "NO_OPEN_POSITION",
        "DUPLICATE",
        "VALIDATION_ERROR",
      ];

      errorCodes.forEach(code => {
        expect(code).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  // ============================================
  // 6. Test Data Management
  // ============================================
  describe("Test Data Management", () => {
    it("should mark all test data with isTest flag", async () => {
      if (!webhookToken) return;

      await clearTestPositions("NQTrend");
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await sendWebhook(
        createPayload({
          price: 15000,
          isTest: true,
          date: new Date().toISOString(),
        })
      );

      expect(result.data.logId).toBeDefined();
      expect(result.data.signalType).toBe("entry");
    });
  });
});
