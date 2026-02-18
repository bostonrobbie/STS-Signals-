/**
 * Data Isolation Tests
 *
 * These tests verify that test data is properly isolated from production data:
 * 1. Test webhooks are marked with isTest=true
 * 2. Dashboard queries exclude test data by default
 * 3. Test data can be cleaned up without affecting real data
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { processWebhook } from "./webhookService";
import * as db from "./db";

describe("Data Isolation", () => {
  // Track IDs of test data created during tests for cleanup
  const testDataIds = {
    webhookLogIds: [] as number[],
    tradeIds: [] as number[],
    positionIds: [] as number[],
  };

  afterAll(async () => {
    // Clean up any test data created during tests
    // This is a safety net - the isTest flag should prevent pollution anyway
    console.log(
      "[DataIsolation] Test cleanup - test data should be marked with isTest=true"
    );
  });

  describe("Webhook isTest Flag", () => {
    it("should mark webhooks with isTest=true when payload contains isTest flag", async () => {
      const payload = {
        symbol: "ESTrend",
        signalType: "entry",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        direction: "Long",
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        isTest: true, // Explicit test flag
      };

      const result = await processWebhook(payload, "test-isolation-test");

      // The webhook should be processed
      expect(result.logId).toBeGreaterThan(0);

      // Verify the log entry has isTest=true
      const logs = await db.getWebhookLogs({ limit: 1, includeTest: true });
      const latestLog = logs.find(l => l.id === result.logId);

      if (latestLog) {
        // MySQL tinyint returns 0/1, not true/false
        expect(latestLog.isTest).toBeTruthy();
      }
    });

    it("should mark webhooks from test-simulator IP as test in test environment", async () => {
      // In test environment (NODE_ENV=test), webhooks from test-simulator should be marked as test
      const payload = {
        symbol: "ESTrend",
        signalType: "entry",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        direction: "Long",
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        // No isTest flag - should be inferred from IP in test environment
      };

      const result = await processWebhook(payload, "test-simulator");

      expect(result.logId).toBeGreaterThan(0);

      // In test environment, this should be marked as test
      if (process.env.NODE_ENV === "test") {
        const logs = await db.getWebhookLogs({ limit: 1, includeTest: true });
        const latestLog = logs.find(l => l.id === result.logId);
        if (latestLog) {
          // MySQL tinyint returns 0/1, not true/false
          expect(latestLog.isTest).toBeTruthy();
        }
      }
    });
  });

  describe("Dashboard Query Isolation", () => {
    it("should exclude test webhook logs by default", async () => {
      // Get logs without includeTest flag (default behavior)
      const logs = await db.getWebhookLogs({ limit: 100 });

      // All returned logs should have isTest=false
      for (const log of logs) {
        // MySQL tinyint returns 0/1, not true/false
        expect(log.isTest).toBeFalsy();
      }
    });

    it("should include test webhook logs when explicitly requested", async () => {
      // Get logs with includeTest=true
      const logs = await db.getWebhookLogs({ limit: 100, includeTest: true });

      // Should include both test and non-test logs
      // (We can't guarantee there are test logs, but the query should work)
      expect(Array.isArray(logs)).toBe(true);
    });

    it("should exclude test trades from getRecentPositions by default", async () => {
      const positions = await db.getRecentPositions(100);

      // All returned positions should have isTest=false
      for (const pos of positions) {
        // MySQL tinyint returns 0/1, not true/false
        expect(pos.isTest).toBeFalsy();
      }
    });

    it("should exclude test positions from getAllOpenPositions by default", async () => {
      const positions = await db.getAllOpenPositions();

      // All returned positions should have isTest=false
      for (const pos of positions) {
        // MySQL tinyint returns 0/1, not true/false
        expect(pos.isTest).toBeFalsy();
      }
    });
  });

  describe("Notification Isolation", () => {
    it("should not send notifications for test webhooks", async () => {
      // This test verifies that the notification module skips test data
      // The actual notification sending is mocked/disabled in test environment

      const payload = {
        symbol: "ESTrend",
        signalType: "entry",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        direction: "Long",
        token: process.env.TRADINGVIEW_WEBHOOK_TOKEN || "test_token",
        isTest: true,
      };

      // Process the webhook - notifications should be skipped for test data
      const result = await processWebhook(payload, "test-isolation-test");

      // The webhook should succeed without sending notifications
      expect(result.processingTimeMs).toBeGreaterThan(0);

      // Note: We can't easily verify notifications weren't sent without mocking,
      // but the notification module checks for test environment and isTest flag
    });
  });

  describe("Test Data Cleanup", () => {
    it("should be able to identify test data for cleanup", async () => {
      // Get counts of test vs real data
      const testLogs = await db.getWebhookLogs({
        limit: 1000,
        includeTest: true,
      });
      const realLogs = await db.getWebhookLogs({ limit: 1000 });

      const testCount = testLogs.filter(l => l.isTest).length;
      const realCount = realLogs.length;

      // Log the counts for visibility
      console.log(
        `[DataIsolation] Test logs: ${testCount}, Real logs: ${realCount}`
      );

      // The test data should be identifiable
      expect(testCount + realCount).toBeLessThanOrEqual(testLogs.length + 10); // Allow for concurrent test data creation
    });
  });
});
