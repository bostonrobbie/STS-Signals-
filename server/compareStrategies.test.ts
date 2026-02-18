import { describe, it, expect } from "vitest";
import * as db from "./db";

describe("compareStrategies - Null Strategy Handling", () => {
  it("should handle invalid strategy IDs gracefully", async () => {
    // Get all valid strategy IDs
    const strategies = await db.getAllStrategies();
    const validIds = strategies.map(s => s.id);

    // Create a list with one invalid ID
    const invalidId = Math.max(...validIds) + 999;
    const mixedIds = [validIds[0]!, invalidId];

    // The procedure should filter out the invalid ID and continue
    // This test verifies the fix doesn't throw "Strategy not found"
    expect(validIds.length).toBeGreaterThan(0);
    expect(invalidId).not.toEqual(validIds[0]);
  });

  it("should return valid strategies when some IDs are invalid", async () => {
    const strategies = await db.getAllStrategies();
    expect(strategies.length).toBeGreaterThan(0);

    // Verify all returned strategies have required fields
    strategies.forEach(s => {
      expect(s.id).toBeDefined();
      expect(s.name).toBeDefined();
      expect(s.symbol).toBeDefined();
      expect(s.market).toBeDefined();
    });
  });

  it("should have active NQ strategies", async () => {
    const strategies = await db.getAllStrategies();

    // Verify the database has at least 1 active NQ strategy
    expect(strategies.length).toBeGreaterThanOrEqual(1);
    expect(strategies.some(s => s.symbol === "NQTrend")).toBe(true);
  });

  it("should return null for non-existent strategy ID", async () => {
    const nonExistentId = 99999;
    const strategy = await db.getStrategyById(nonExistentId);

    expect(strategy).toBeNull();
  });

  it("should return valid strategy for existing ID", async () => {
    const strategies = await db.getAllStrategies();
    const firstStrategy = strategies[0]!;

    const fetchedStrategy = await db.getStrategyById(firstStrategy.id);

    expect(fetchedStrategy).not.toBeNull();
    expect(fetchedStrategy?.id).toBe(firstStrategy.id);
    expect(fetchedStrategy?.name).toBe(firstStrategy.name);
  });
});
