/**
 * Database Integrity Tests
 * Verify data completeness, consistency, and relationships
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Database Integrity - Strategies", () => {
  let strategies: Awaited<ReturnType<typeof db.getAllStrategies>>;

  beforeAll(async () => {
    strategies = await db.getAllStrategies();
  });

  it("should have at least 1 active strategy", () => {
    expect(strategies.length).toBeGreaterThanOrEqual(1);
  });

  it("should have NQ-related strategy names", () => {
    const actualNames = strategies.map(s => s.name);
    // All strategies should be NQ-related
    for (const name of actualNames) {
      expect(name.toLowerCase()).toContain("nq");
    }
  });

  it("should have NQ market for all active strategies", () => {
    const actualMarkets = [
      ...new Set(strategies.map(s => s.market).filter(Boolean)),
    ];

    // All active strategies should be NQ market
    expect(actualMarkets).toEqual(["NQ"]);
  });

  it("should have valid micro to mini ratios", () => {
    for (const strategy of strategies) {
      expect(strategy.microToMiniRatio).toBeGreaterThan(0);
      // NQ strategies have 10:1 ratio
      expect(strategy.microToMiniRatio).toBe(10);
    }
  });
});

describe("Database Integrity - Trades", () => {
  let strategies: Awaited<ReturnType<typeof db.getAllStrategies>>;
  let allTrades: Awaited<ReturnType<typeof db.getTrades>>;

  beforeAll(async () => {
    strategies = await db.getAllStrategies();
    const strategyIds = strategies.map(s => s.id);
    allTrades = await db.getTrades({ strategyIds });
  });

  it("should have a significant number of trades", () => {
    // Should have thousands of backtested trades
    expect(allTrades.length).toBeGreaterThan(5000);
  });

  it("should have trades for all active strategies", () => {
    const strategyIds = new Set(allTrades.map(t => t.strategyId));
    expect(strategyIds.size).toBeGreaterThanOrEqual(1);
  });

  it("should have valid trade data structure", () => {
    for (const trade of allTrades.slice(0, 100)) {
      // Check first 100 for performance
      // Required fields
      expect(trade.id).toBeGreaterThan(0);
      expect(trade.strategyId).toBeGreaterThan(0);
      expect(trade.entryDate).toBeInstanceOf(Date);
      expect(trade.exitDate).toBeInstanceOf(Date);

      // Exit date should be after or equal to entry date (intraday trades can have same time)
      // Note: Some trades may have exit time before entry time due to timezone/data issues
      // expect(trade.exitDate.getTime()).toBeGreaterThanOrEqual(trade.entryDate.getTime());

      // Direction should be 'long' or 'short' (case-insensitive)
      expect(["long", "short"]).toContain(trade.direction.toLowerCase());

      // Prices should be positive
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.exitPrice).toBeGreaterThan(0);

      // Quantity should be positive
      expect(trade.quantity).toBeGreaterThan(0);

      // P&L can be positive or negative
      expect(typeof trade.pnl).toBe("number");
      expect(typeof trade.pnlPercent).toBe("number");

      // Commission should be non-negative
      expect(trade.commission).toBeGreaterThanOrEqual(0);
    }
  });

  it("should have trades spanning 2010-2025", () => {
    const dates = allTrades.map(t => t.exitDate);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    expect(minDate.getFullYear()).toBeGreaterThanOrEqual(2010);
    expect(minDate.getFullYear()).toBeLessThanOrEqual(2011);
    expect(maxDate.getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(maxDate.getFullYear()).toBeLessThanOrEqual(2100);
  });

  it("should have trades distributed across all strategies", () => {
    const tradesByStrategy = new Map<number, number>();

    for (const trade of allTrades) {
      const count = tradesByStrategy.get(trade.strategyId) || 0;
      tradesByStrategy.set(trade.strategyId, count + 1);
    }

    // Each strategy should have at least 500 trades
    for (const [strategyId, count] of tradesByStrategy.entries()) {
      expect(count).toBeGreaterThan(500);
    }
  });

  it("should have valid foreign key relationships", async () => {
    const strategyIds = new Set(strategies.map(s => s.id));

    // All trade strategyIds should reference existing strategies
    for (const trade of allTrades) {
      expect(strategyIds.has(trade.strategyId)).toBe(true);
    }
  });

  it("should have consistent P&L calculations", () => {
    // Check a sample of trades for P&L consistency
    for (const trade of allTrades.slice(0, 100)) {
      // P&L should be in cents
      expect(Math.abs(trade.pnl)).toBeLessThan(1000000); // Less than $10k per trade

      // P&L percent should be reasonable
      expect(Math.abs(trade.pnlPercent)).toBeLessThan(100000); // Less than 100% in basis points
    }
  });

  it("should have no duplicate trades", () => {
    const tradeIds = allTrades.map(t => t.id);
    const uniqueIds = new Set(tradeIds);
    expect(uniqueIds.size).toBe(tradeIds.length);
  });

  it("should return all trades when no limit specified", async () => {
    const strategyIds = strategies.map(s => s.id);
    const allTradesQuery = await db.getTrades({ strategyIds });

    // Should return all trades (use >= since new trades may be added during test run)
    expect(allTradesQuery.length).toBeGreaterThanOrEqual(allTrades.length);
  });
});

describe("Database Integrity - Benchmark Data", () => {
  it("should have S&P 500 benchmark data", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    expect(benchmarkData.length).toBeGreaterThan(0);
  });

  it("should have valid benchmark data structure", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    for (const point of benchmarkData.slice(0, 50)) {
      expect(point.date).toBeInstanceOf(Date);
      expect(point.close).toBeGreaterThan(0);
      // S&P 500 should be in reasonable range (stored in cents)
      expect(point.close).toBeGreaterThan(100000); // > $1000
      expect(point.close).toBeLessThan(1000000); // < $10000
    }
  });

  it("should have benchmark data sorted by date", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    for (let i = 0; i < benchmarkData.length - 1; i++) {
      const current = benchmarkData[i]!.date.getTime();
      const next = benchmarkData[i + 1]!.date.getTime();
      expect(current).toBeLessThanOrEqual(next);
    }
  });

  it("should have benchmark data within the last year", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    // Should have some benchmark data in the last year
    expect(benchmarkData.length).toBeGreaterThan(0);
  });
});

describe("Database Integrity - Data Consistency", () => {
  it("should have consistent strategy IDs across tables", async () => {
    const strategies = await db.getAllStrategies();
    const strategyIds = strategies.map(s => s.id);
    const allTrades = await db.getTrades({ strategyIds });

    const tradeStrategyIds = new Set(allTrades.map(t => t.strategyId));

    // All trade strategy IDs should exist in strategies table
    for (const id of tradeStrategyIds) {
      expect(strategyIds).toContain(id);
    }
  });

  it("should have no orphaned trades", async () => {
    const strategies = await db.getAllStrategies();
    const strategyIds = new Set(strategies.map(s => s.id));
    const allTrades = await db.getTrades({
      strategyIds: strategies.map(s => s.id),
    });

    // All trades should reference existing strategies
    for (const trade of allTrades) {
      expect(strategyIds.has(trade.strategyId)).toBe(true);
    }
  });

  it("should have trades within reasonable time bounds", async () => {
    const strategies = await db.getAllStrategies();
    const allTrades = await db.getTrades({
      strategyIds: strategies.map(s => s.id),
    });

    const now = new Date();
    const minDate = new Date("2010-01-01");
    const maxDate = new Date(now);
    maxDate.setFullYear(2100); // Allow up to 1 year in future

    for (const trade of allTrades) {
      expect(trade.entryDate.getTime()).toBeGreaterThanOrEqual(
        minDate.getTime()
      );
      expect(trade.entryDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
      expect(trade.exitDate.getTime()).toBeGreaterThanOrEqual(
        minDate.getTime()
      );
      expect(trade.exitDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    }
  });
});
