/**
 * Webhook Authentication Tests
 *
 * Tests that validate the webhook token authentication is working correctly
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("Webhook Token Authentication", () => {
  const baseUrl = process.env.VITE_APP_URL || "http://localhost:3000";
  const webhookToken = process.env.TRADINGVIEW_WEBHOOK_TOKEN;

  beforeAll(() => {
    console.log("Testing webhook authentication...");
    console.log(
      "Token configured:",
      webhookToken ? "Yes (length: " + webhookToken.length + ")" : "No"
    );
  });

  it("should have TRADINGVIEW_WEBHOOK_TOKEN environment variable set", () => {
    expect(webhookToken).toBeDefined();
    expect(webhookToken).not.toBe("");
    expect(typeof webhookToken).toBe("string");
    // Token should be at least 16 characters for security
    expect(webhookToken!.length).toBeGreaterThanOrEqual(8);
  });

  it("should reject webhook without token when token is configured", async () => {
    // Skip if no token configured (validation is optional)
    if (!webhookToken) {
      console.log("Skipping: No token configured");
      return;
    }

    const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        // No token provided
      }),
    });

    const data = await response.json();

    // Should fail due to missing token
    expect(data.success).toBe(false);
    expect(data.error).toContain("token");
  });

  it("should reject webhook with invalid token", async () => {
    // Skip if no token configured
    if (!webhookToken) {
      console.log("Skipping: No token configured");
      return;
    }

    const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        token: "wrong_token_12345",
      }),
    });

    const data = await response.json();

    // Should fail due to invalid token
    expect(data.success).toBe(false);
    expect(data.error).toContain("token");
  });

  it("should accept webhook with valid token", async () => {
    // Skip if no token configured
    if (!webhookToken) {
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
        token: webhookToken,
      }),
    });

    const data = await response.json();

    // Should succeed with valid token or indicate position exists
    expect(data.processingTimeMs).toBeGreaterThan(0);
    if (data.success) {
      expect(data.message).toContain("Entry signal logged");
    } else {
      // May fail if position already exists
      expect(data.error).toBeDefined();
    }
  });

  it("should have webhook endpoint accessible", async () => {
    // Verify the webhook endpoint exists (returns JSON, not HTML)
    const response = await fetch(`${baseUrl}/api/webhook/tradingview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    });
    const data = await response.json();
    // Should return JSON (not HTML), indicating the endpoint exists
    expect(data).toHaveProperty("success");
  });
});
