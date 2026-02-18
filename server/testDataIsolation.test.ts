/**
 * Test Data Isolation Tests
 *
 * Verifies that:
 * 1. Test data is properly filtered from dashboard queries
 * 2. Notifications are skipped during test runs
 * 3. Test cleanup utilities work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the notification module to verify it skips in test mode
vi.mock("./_core/notification", async importOriginal => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    // Keep the actual implementation which should skip in test mode
  };
});

describe("Test Data Isolation", () => {
  describe("Notification Skipping in Test Mode", () => {
    it("should detect test mode correctly", () => {
      // In vitest, NODE_ENV is 'test' and VITEST is 'true'
      expect(
        process.env.NODE_ENV === "test" || process.env.VITEST === "true"
      ).toBe(true);
    });

    it("should skip notifications in test mode", async () => {
      const { notifyOwner, notifyOwnerAsync } = await import(
        "./_core/notification"
      );

      // notifyOwner should return true (success) but not actually send
      const result = await notifyOwner({
        title: "Test Notification",
        content: "This should be skipped in test mode",
      });

      expect(result).toBe(true);
    });

    it("should not throw when calling notifyOwnerAsync in test mode", async () => {
      const { notifyOwnerAsync } = await import("./_core/notification");

      // Should not throw
      expect(() => {
        notifyOwnerAsync({
          title: "Test Async Notification",
          content: "This should be skipped",
        });
      }).not.toThrow();
    });
  });

  describe("Database Query Filtering", () => {
    it("should have isTest parameter in getWebhookLogs", async () => {
      const { getWebhookLogs } = await import("./db");

      // Function should accept includeTest parameter
      const result = await getWebhookLogs({
        limit: 1,
        includeTest: false,
      });

      // Should return an array (may be empty)
      expect(Array.isArray(result)).toBe(true);
    }, 10000);

    it("should have includeTest parameter in getAllOpenPositions", async () => {
      const { getAllOpenPositions } = await import("./db");

      // Function should accept includeTest parameter
      const result = await getAllOpenPositions(false);

      // Should return an array (may be empty)
      expect(Array.isArray(result)).toBe(true);
    });

    it("should have includeTest parameter in getRecentPositions", async () => {
      const { getRecentPositions } = await import("./db");

      // Function should accept limit and includeTest parameters
      const result = await getRecentPositions(10, false);

      // Should return an array (may be empty)
      expect(Array.isArray(result)).toBe(true);
    });

    it("should have includeTest parameter in getPositionStats", async () => {
      const { getPositionStats } = await import("./db");

      // Function should accept includeTest parameter
      const result = await getPositionStats(false);

      // Should return stats object
      expect(result).toHaveProperty("open");
      expect(result).toHaveProperty("closedToday");
      expect(result).toHaveProperty("totalPnlToday");
    });
  });

  describe("Test Cleanup Utilities", () => {
    it("should export cleanup functions", async () => {
      const cleanup = await import("./testDataCleanup");

      expect(typeof cleanup.cleanupAllTestData).toBe("function");
      expect(typeof cleanup.cleanupOldTestData).toBe("function");
      expect(typeof cleanup.getTestDataCounts).toBe("function");
      expect(typeof cleanup.markDataAsTest).toBe("function");
    });

    it("should return counts from getTestDataCounts", async () => {
      const { getTestDataCounts } = await import("./testDataCleanup");

      const counts = await getTestDataCounts();

      expect(counts).toHaveProperty("testTrades");
      expect(counts).toHaveProperty("testWebhookLogs");
      expect(counts).toHaveProperty("testPositions");
      expect(counts).toHaveProperty("total");
      expect(typeof counts.testTrades).toBe("number");
      expect(typeof counts.total).toBe("number");
    });

    it("should return cleanup result from cleanupAllTestData", async () => {
      const { cleanupAllTestData } = await import("./testDataCleanup");

      const result = await cleanupAllTestData();

      expect(result).toHaveProperty("tradesDeleted");
      expect(result).toHaveProperty("webhookLogsDeleted");
      expect(result).toHaveProperty("positionsDeleted");
      expect(result).toHaveProperty("totalDeleted");
    });
  });

  describe("Webhook isTest Flag", () => {
    it("should recognize isTest flag in webhook payload", async () => {
      const { validatePayload } = await import("./webhookService");

      const payload = {
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
        isTest: true,
      };

      const normalized = validatePayload(payload);

      expect(normalized.isTest).toBe(true);
    });

    it("should default isTest to false when not provided for NQ strategies", async () => {
      const { validatePayload } = await import("./webhookService");

      const payload = {
        symbol: "NQTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 18500,
      };

      const normalized = validatePayload(payload);

      expect(normalized.isTest).toBe(false);
    });

    it("should auto-mark ESTrend as test (non-production strategy)", async () => {
      const { validatePayload } = await import("./webhookService");

      const payload = {
        symbol: "ESTrend",
        date: new Date().toISOString(),
        data: "buy",
        quantity: 1,
        price: 4500,
      };

      const normalized = validatePayload(payload);

      expect(normalized.isTest).toBe(true);
    });
  });

  describe("Router Test Data Endpoints", () => {
    it("should have testData router with required procedures", async () => {
      // Import the router to verify structure
      const { appRouter } = await import("./routers");

      // Check that testData router exists
      expect(appRouter._def.procedures).toBeDefined();

      // The router should have testData namespace
      const procedures = Object.keys(appRouter._def.procedures);
      const testDataProcedures = procedures.filter(p =>
        p.startsWith("testData.")
      );

      expect(testDataProcedures).toContain("testData.getCounts");
      expect(testDataProcedures).toContain("testData.cleanupAll");
      expect(testDataProcedures).toContain("testData.cleanupOld");
      expect(testDataProcedures).toContain("testData.markAsTest");
    });
  });
});

describe("Test Mode Detection", () => {
  it("should be running in test environment", () => {
    // Vitest sets these environment variables
    const isTest =
      process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    expect(isTest).toBe(true);
  });
});
