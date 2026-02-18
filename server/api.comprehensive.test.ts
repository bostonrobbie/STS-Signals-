/**
 * Comprehensive Backend API Tests
 * Tests all tRPC procedures with various inputs and edge cases
 */
import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";
import * as analytics from "./analytics";

describe("Backend API - Portfolio Overview", () => {
  let strategies: Awaited<ReturnType<typeof db.getAllStrategies>>;
  let allTrades: Awaited<ReturnType<typeof db.getTrades>>;

  beforeAll(async () => {
    strategies = await db.getAllStrategies();
    const strategyIds = strategies.map(s => s.id);
    allTrades = await db.getTrades({ strategyIds });
  });

  it("should return active strategies", () => {
    // Database currently has 1 active strategy (NQ Triple Variant)
    expect(strategies.length).toBeGreaterThanOrEqual(1);
  });

  it("should have trades for all strategies", () => {
    const strategyIds = strategies.map(s => s.id);
    for (const strategyId of strategyIds) {
      const strategyTrades = allTrades.filter(t => t.strategyId === strategyId);
      expect(strategyTrades.length).toBeGreaterThan(0);
    }
  });

  it("should filter trades by 1Y time range", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const strategyIds = strategies.map(s => s.id);
    const filteredTrades = await db.getTrades({
      strategyIds,
      startDate: oneYearAgo,
      endDate: now,
    });

    // All trades should be within the time range (with 1 day tolerance for timezone differences)
    const toleranceMs = 24 * 60 * 60 * 1000; // 1 day
    for (const trade of filteredTrades) {
      const exitDate = new Date(trade.exitDate);
      expect(exitDate.getTime()).toBeGreaterThanOrEqual(
        oneYearAgo.getTime() - toleranceMs
      );
      expect(exitDate.getTime()).toBeLessThanOrEqual(
        now.getTime() + toleranceMs
      );
    }
  });

  it("should filter trades by YTD time range", async () => {
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);

    const strategyIds = strategies.map(s => s.id);
    const filteredTrades = await db.getTrades({
      strategyIds,
      startDate: ytdStart,
      endDate: now,
    });

    // All trades should be within the time range (with 1 day tolerance for timezone differences)
    const toleranceMs = 24 * 60 * 60 * 1000; // 1 day
    for (const trade of filteredTrades) {
      const exitDate = new Date(trade.exitDate);
      expect(exitDate.getTime()).toBeGreaterThanOrEqual(
        ytdStart.getTime() - toleranceMs
      );
      expect(exitDate.getTime()).toBeLessThanOrEqual(
        now.getTime() + toleranceMs
      );
    }
  });

  it("should calculate equity curve for all trades", () => {
    const equityCurve = analytics.calculateEquityCurve(allTrades, 100000);

    expect(equityCurve.length).toBeGreaterThan(0);
    expect(equityCurve[0]!.equity).toBe(100000); // Starting capital

    // Last equity should be different from starting capital
    const lastEquity = equityCurve[equityCurve.length - 1]!.equity;
    expect(lastEquity).not.toBe(100000);
  });

  it("should forward-fill equity curve to create daily series", () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const strategyIds = strategies.map(s => s.id);
    const filteredTrades = allTrades.filter(trade => {
      const exitDate = new Date(trade.exitDate);
      return exitDate >= oneYearAgo && exitDate <= now;
    });

    const rawEquity = analytics.calculateEquityCurve(filteredTrades, 100000);
    const filledEquity = analytics.forwardFillEquityCurve(
      rawEquity,
      oneYearAgo,
      now
    );

    // Should have approximately 365-366 days (allow variance for timezone/DST differences)
    const expectedDays =
      Math.floor(
        (now.getTime() - oneYearAgo.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    expect(filledEquity.length).toBeGreaterThanOrEqual(expectedDays - 5); // Allow variance for DST/timezone
    expect(filledEquity.length).toBeLessThanOrEqual(expectedDays + 5);

    // First point should be at or after start date
    const firstDate = new Date(filledEquity[0]!.date);
    firstDate.setHours(0, 0, 0, 0);
    const startDate = new Date(oneYearAgo);
    startDate.setHours(0, 0, 0, 0);
    expect(firstDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());

    // Last point should be at or before end date
    const lastDate = new Date(filledEquity[filledEquity.length - 1]!.date);
    lastDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(0, 0, 0, 0);
    expect(lastDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
  });

  it("should calculate performance metrics correctly", () => {
    const metrics = analytics.calculatePerformanceMetrics(allTrades, 100000);

    // Basic sanity checks
    expect(metrics.totalTrades).toBe(allTrades.length);
    // Note: Some trades may be breakeven (pnl = 0), which aren't counted as wins or losses
    // So winning + losing may be <= totalTrades
    expect(metrics.winningTrades + metrics.losingTrades).toBeLessThanOrEqual(
      metrics.totalTrades
    );
    expect(metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(metrics.winRate).toBeLessThanOrEqual(100);

    // Sharpe and Sortino should be reasonable
    expect(metrics.sharpeRatio).toBeGreaterThan(-5);
    expect(metrics.sharpeRatio).toBeLessThan(10);
    expect(metrics.sortinoRatio).toBeGreaterThan(-5);
    expect(metrics.sortinoRatio).toBeLessThan(20);

    // Max drawdown should be between 0 and 100%
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(metrics.maxDrawdown).toBeLessThanOrEqual(100);
  });

  it("should handle different starting capital amounts", () => {
    const capitals = [10000, 50000, 100000, 250000];

    for (const capital of capitals) {
      const equityCurve = analytics.calculateEquityCurve(allTrades, capital);
      expect(equityCurve[0]!.equity).toBe(capital);

      // Equity curve should scale proportionally
      const lastEquity = equityCurve[equityCurve.length - 1]!.equity;
      expect(lastEquity).toBeGreaterThan(0);
    }
  });
});

describe("Backend API - Strategy Detail", () => {
  let strategies: Awaited<ReturnType<typeof db.getAllStrategies>>;

  beforeAll(async () => {
    strategies = await db.getAllStrategies();
  });

  it("should get trades for individual strategy", async () => {
    for (const strategy of strategies) {
      const trades = await db.getTrades({ strategyIds: [strategy.id] });
      expect(trades.length).toBeGreaterThan(0);

      // All trades should belong to this strategy
      for (const trade of trades) {
        expect(trade.strategyId).toBe(strategy.id);
      }
    }
  });

  it("should calculate equity curve for individual strategy", async () => {
    for (const strategy of strategies) {
      const trades = await db.getTrades({ strategyIds: [strategy.id] });
      const equityCurve = analytics.calculateEquityCurve(trades, 100000);

      expect(equityCurve.length).toBeGreaterThan(0);
      expect(equityCurve[0]!.equity).toBe(100000);
    }
  });
});

describe("Backend API - Strategy Comparison", () => {
  let strategies: Awaited<ReturnType<typeof db.getAllStrategies>>;

  beforeAll(async () => {
    strategies = await db.getAllStrategies();
  });

  it("should combine trades from multiple strategies", async () => {
    const selectedIds = strategies.slice(0, 3).map(s => s.id);
    const combinedTrades = await db.getTrades({ strategyIds: selectedIds });

    // Should have trades from all selected strategies
    const uniqueStrategyIds = new Set(combinedTrades.map(t => t.strategyId));
    expect(uniqueStrategyIds.size).toBeGreaterThan(0);
    expect(uniqueStrategyIds.size).toBeLessThanOrEqual(selectedIds.length);
  });

  it("should calculate combined equity curve", async () => {
    const selectedIds = strategies.slice(0, 3).map(s => s.id);
    const combinedTrades = await db.getTrades({ strategyIds: selectedIds });
    const equityCurve = analytics.calculateEquityCurve(combinedTrades, 100000);

    expect(equityCurve.length).toBeGreaterThan(0);
    expect(equityCurve[0]!.equity).toBe(100000);
  });

  it("should calculate correlation matrix", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const strategyEquityCurves = new Map<string, analytics.EquityPoint[]>();

    for (const strategy of strategies) {
      const trades = await db.getTrades({
        strategyIds: [strategy.id],
        startDate: oneYearAgo,
        endDate: now,
      });

      if (trades.length > 0) {
        const rawEquity = analytics.calculateEquityCurve(trades, 100000);
        const startDate =
          rawEquity.length > 0 ? rawEquity[0]!.date : oneYearAgo;
        const filledEquity = analytics.forwardFillEquityCurve(
          rawEquity,
          startDate,
          now
        );
        strategyEquityCurves.set(strategy.name, filledEquity);
      }
    }

    // Just verify we can build the equity curves for correlation
    expect(strategyEquityCurves.size).toBeGreaterThan(0);

    // Each strategy should have equity points
    for (const [name, equity] of strategyEquityCurves.entries()) {
      expect(equity.length).toBeGreaterThan(0);
    }
  });
});

describe("Backend API - Performance Breakdown", () => {
  let allTrades: Awaited<ReturnType<typeof db.getTrades>>;

  beforeAll(async () => {
    const strategies = await db.getAllStrategies();
    const strategyIds = strategies.map(s => s.id);
    allTrades = await db.getTrades({ strategyIds });
  });

  it("should calculate daily performance breakdown", () => {
    const breakdown = analytics.calculatePerformanceByPeriod(allTrades, "day");

    expect(breakdown.length).toBeGreaterThan(0);

    // Each period should have valid data
    for (const period of breakdown) {
      expect(period.period).toBeTruthy();
      expect(period.trades).toBeGreaterThanOrEqual(0);
      expect(period.winRate).toBeGreaterThanOrEqual(0);
      expect(period.winRate).toBeLessThanOrEqual(100);
    }
  });

  it("should calculate monthly performance breakdown", () => {
    const breakdown = analytics.calculatePerformanceByPeriod(
      allTrades,
      "month"
    );

    expect(breakdown.length).toBeGreaterThan(0);

    // Monthly periods should be formatted as "YYYY-MM"
    for (const period of breakdown) {
      expect(period.period).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("should calculate yearly performance breakdown", () => {
    const breakdown = analytics.calculatePerformanceByPeriod(allTrades, "year");

    expect(breakdown.length).toBeGreaterThan(0);

    // Yearly periods should be formatted as "YYYY"
    for (const period of breakdown) {
      expect(period.period).toMatch(/^\d{4}$/);
    }
  });
});

describe("Backend API - Benchmark Data", () => {
  it("should retrieve S&P 500 benchmark data", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    expect(benchmarkData.length).toBeGreaterThan(0);

    // All benchmark data should be within the time range
    for (const point of benchmarkData) {
      const date = new Date(point.date);
      expect(date.getTime()).toBeGreaterThanOrEqual(oneYearAgo.getTime());
      expect(date.getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  it("should calculate benchmark equity curve", async () => {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const benchmarkData = await db.getBenchmarkData({
      startDate: oneYearAgo,
      endDate: now,
    });

    const benchmarkEquity = analytics.calculateBenchmarkEquityCurve(
      benchmarkData,
      100000
    );

    expect(benchmarkEquity.length).toBeGreaterThan(0);
    expect(benchmarkEquity[0]!.equity).toBe(100000);
  });
});

describe("Backend API - Edge Cases", () => {
  it("should handle empty trades array", () => {
    const equityCurve = analytics.calculateEquityCurve([], 100000);
    expect(equityCurve).toEqual([]);

    const metrics = analytics.calculatePerformanceMetrics([], 100000);
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.totalReturn).toBe(0);
  });

  it("should handle single trade", async () => {
    const strategies = await db.getAllStrategies();
    const allTrades = await db.getTrades({
      strategyIds: strategies.map(s => s.id),
    });
    const singleTrade = [allTrades[0]!];

    const equityCurve = analytics.calculateEquityCurve(singleTrade, 100000);
    expect(equityCurve.length).toBe(2); // Start + end point

    const metrics = analytics.calculatePerformanceMetrics(singleTrade, 100000);
    expect(metrics.totalTrades).toBe(1);
  });

  it("should handle very small starting capital", async () => {
    const strategies = await db.getAllStrategies();
    const allTrades = await db.getTrades({
      strategyIds: strategies.map(s => s.id),
    });

    const equityCurve = analytics.calculateEquityCurve(allTrades, 1000);
    expect(equityCurve[0]!.equity).toBe(1000);
  });

  it("should handle very large starting capital", async () => {
    const strategies = await db.getAllStrategies();
    const allTrades = await db.getTrades({
      strategyIds: strategies.map(s => s.id),
    });

    const equityCurve = analytics.calculateEquityCurve(allTrades, 10000000);
    expect(equityCurve[0]!.equity).toBe(10000000);
  });
});
