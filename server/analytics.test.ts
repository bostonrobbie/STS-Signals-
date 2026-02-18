import { describe, it, expect, beforeAll } from "vitest";
import * as analytics from "./analytics";
import { Trade } from "./analytics";

describe("Analytics Date Conversion", () => {
  let testTrades: Trade[];

  beforeAll(() => {
    // Create test trades with proper Date objects
    const baseDate = new Date("2011-01-18");
    testTrades = [
      {
        id: 1,
        strategyId: 1,
        entryDate: new Date(baseDate.getTime() + 0),
        exitDate: new Date(baseDate.getTime() + 3600000), // 1 hour later
        direction: "LONG",
        entryPrice: 100 * 100, // $100 in cents
        exitPrice: 105 * 100, // $105 in cents
        quantity: 1,
        pnl: 500 * 100, // $500 in cents
        pnlPercent: 500, // 5%
        commission: 10 * 100, // $10 in cents
      },
      {
        id: 2,
        strategyId: 1,
        entryDate: new Date(baseDate.getTime() + 7200000), // 2 hours later
        exitDate: new Date(baseDate.getTime() + 10800000), // 3 hours later
        direction: "SHORT",
        entryPrice: 105 * 100,
        exitPrice: 103 * 100,
        quantity: 1,
        pnl: 200 * 100, // $200 in cents
        pnlPercent: 190,
        commission: 10 * 100,
      },
      {
        id: 3,
        strategyId: 1,
        entryDate: new Date(baseDate.getTime() + 14400000), // 4 hours later
        exitDate: new Date(baseDate.getTime() + 18000000), // 5 hours later
        direction: "LONG",
        entryPrice: 103 * 100,
        exitPrice: 100 * 100,
        quantity: 1,
        pnl: -300 * 100, // -$300 in cents (loss)
        pnlPercent: -291,
        commission: 10 * 100,
      },
    ];
  });

  describe("calculateEquityCurve", () => {
    it("should calculate equity curve without errors", () => {
      const curve = analytics.calculateEquityCurve(testTrades, 100000);
      expect(curve).toBeDefined();
      expect(curve.length).toBeGreaterThan(0);
      expect(curve[0]).toHaveProperty("date");
      expect(curve[0]).toHaveProperty("equity");
    });

    it("should handle date objects correctly", () => {
      const curve = analytics.calculateEquityCurve(testTrades, 100000);
      // Verify that all dates in the curve are Date objects
      curve.forEach(point => {
        expect(point.date).toBeInstanceOf(Date);
      });
    });

    it("should calculate correct equity progression", () => {
      const curve = analytics.calculateEquityCurve(testTrades, 100000);
      const firstPoint = curve[0]!;
      const lastPoint = curve[curve.length - 1]!;

      // First equity should be starting capital
      expect(firstPoint.equity).toBe(100000);

      // Last equity should reflect all P&L (500 + 200 - 300 = 400)
      expect(lastPoint.equity).toBeCloseTo(100400, 0);
    });
  });

  describe("calculateLeveragedEquityCurve", () => {
    it("should calculate leveraged equity curve without errors", () => {
      const curve = analytics.calculateLeveragedEquityCurve(testTrades, 10000);
      expect(curve).toBeDefined();
      expect(curve.length).toBeGreaterThan(0);
    });

    it("should handle date objects correctly in leveraged mode", () => {
      const curve = analytics.calculateLeveragedEquityCurve(testTrades, 10000);
      curve.forEach(point => {
        expect(point.date).toBeInstanceOf(Date);
      });
    });
  });

  describe("calculateTradeStats", () => {
    it("should calculate trade statistics without errors", () => {
      const stats = analytics.calculateTradeStats(testTrades, 100000);
      expect(stats).toBeDefined();
      expect(stats.totalTrades).toBe(3);
      expect(stats.winningTrades).toBe(2);
      expect(stats.losingTrades).toBe(1);
    });

    it("should calculate win rate correctly", () => {
      const stats = analytics.calculateTradeStats(testTrades, 100000);
      // 2 winning trades out of 3 = 66.67%
      expect(stats.winRate).toBeCloseTo(66.67, 1);
    });

    it("should calculate holding times correctly", () => {
      const stats = analytics.calculateTradeStats(testTrades, 100000);
      // All trades are 1 hour = 60 minutes
      expect(stats.averageHoldingTimeMinutes).toBe(60);
      expect(stats.medianHoldingTimeMinutes).toBe(60);
    });

    it("should calculate profit factor correctly", () => {
      const stats = analytics.calculateTradeStats(testTrades, 100000);
      // Total wins: 500 + 200 = 700
      // Total losses: 300
      // Profit factor: 700 / 300 = 2.33
      expect(stats.profitFactor).toBeCloseTo(2.33, 1);
    });
  });

  describe("calculatePerformanceMetrics", () => {
    it("should calculate performance metrics without errors", () => {
      const metrics = analytics.calculatePerformanceMetrics(testTrades, 100000);
      expect(metrics).toBeDefined();
      expect(metrics.totalReturn).toBeDefined();
      expect(metrics.sharpeRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeDefined();
    });

    it("should calculate total return correctly", () => {
      const metrics = analytics.calculatePerformanceMetrics(testTrades, 100000);
      // Total P&L: 500 + 200 - 300 = 400
      // Total return: 400 / 100000 * 100 = 0.4%
      expect(metrics.totalReturn).toBeCloseTo(0.4, 2);
    });

    it("should handle empty trades array", () => {
      const metrics = analytics.calculatePerformanceMetrics([], 100000);
      expect(metrics).toBeDefined();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalReturn).toBe(0);
    });
  });

  describe("Date Type Verification", () => {
    it("should verify that trades have Date objects for dates", () => {
      testTrades.forEach(trade => {
        expect(trade.entryDate).toBeInstanceOf(Date);
        expect(trade.exitDate).toBeInstanceOf(Date);
      });
    });

    it("should verify that date calculations work correctly", () => {
      const trade = testTrades[0]!;
      const holdingTime =
        (trade.exitDate.getTime() - trade.entryDate.getTime()) / (1000 * 60);
      expect(holdingTime).toBe(60); // 1 hour in minutes
    });
  });
});
