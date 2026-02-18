import { describe, it, expect } from "vitest";
import {
  calculateTradeStats,
  calculateStrategyCorrelationMatrix,
  calculateUnderwaterMetrics,
  type Trade,
  type EquityPoint,
} from "./analytics";

describe("Enhanced Analytics Features", () => {
  describe("calculateTradeStats", () => {
    it("should calculate comprehensive trade statistics", () => {
      const trades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date("2025-01-01T09:30:00"),
          exitDate: new Date("2025-01-01T10:00:00"),
          pnl: 50000, // $500 win
          contracts: 1,
        },
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date("2025-01-02T09:30:00"),
          exitDate: new Date("2025-01-02T11:00:00"),
          pnl: -30000, // $300 loss
          contracts: 1,
        },
        {
          id: 3,
          strategyId: 1,
          entryDate: new Date("2025-01-03T09:30:00"),
          exitDate: new Date("2025-01-03T09:45:00"),
          pnl: 20000, // $200 win
          contracts: 1,
        },
      ];

      const stats = calculateTradeStats(trades);

      expect(stats.totalTrades).toBe(3);
      expect(stats.winningTrades).toBe(2);
      expect(stats.losingTrades).toBe(1);
      expect(stats.winRate).toBeCloseTo(66.67, 1);
      expect(stats.bestTradePnL).toBe(500);
      expect(stats.worstTradePnL).toBe(-300);
      expect(stats.profitFactor).toBeCloseTo(2.33, 1);
      expect(stats.longestWinStreak).toBe(1);
      expect(stats.longestLossStreak).toBe(1);
    });

    it("should calculate expectancy correctly", () => {
      const trades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date(),
          exitDate: new Date(),
          pnl: 100000,
          contracts: 1,
        }, // $1000 win
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date(),
          exitDate: new Date(),
          pnl: 100000,
          contracts: 1,
        }, // $1000 win
        {
          id: 3,
          strategyId: 1,
          entryDate: new Date(),
          exitDate: new Date(),
          pnl: -50000,
          contracts: 1,
        }, // $500 loss
      ];

      const stats = calculateTradeStats(trades);

      // Win rate = 66.67%, Avg win = $1000, Avg loss = $500
      // Expectancy = (1000 * 0.6667) - (500 * 0.3333) = 666.7 - 166.65 = 500
      expect(stats.expectancyPnL).toBeCloseTo(500, 0);
      expect(stats.avgWin).toBe(1000);
      expect(stats.avgLoss).toBe(500);
    });

    it("should calculate holding time statistics", () => {
      const trades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date("2025-01-01T09:30:00"),
          exitDate: new Date("2025-01-01T10:00:00"), // 30 minutes
          pnl: 10000,
          contracts: 1,
        },
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date("2025-01-02T09:30:00"),
          exitDate: new Date("2025-01-02T10:30:00"), // 60 minutes
          pnl: 10000,
          contracts: 1,
        },
        {
          id: 3,
          strategyId: 1,
          entryDate: new Date("2025-01-03T09:30:00"),
          exitDate: new Date("2025-01-03T11:00:00"), // 90 minutes
          pnl: 10000,
          contracts: 1,
        },
      ];

      const stats = calculateTradeStats(trades);

      expect(stats.averageHoldingTimeMinutes).toBe(60); // (30 + 60 + 90) / 3
      expect(stats.medianHoldingTimeMinutes).toBe(60);
    });

    it("should track win and loss streaks", () => {
      const trades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date("2025-01-01"),
          exitDate: new Date("2025-01-01"),
          pnl: 10000,
          contracts: 1,
        }, // Win
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date("2025-01-02"),
          exitDate: new Date("2025-01-02"),
          pnl: 10000,
          contracts: 1,
        }, // Win
        {
          id: 3,
          strategyId: 1,
          entryDate: new Date("2025-01-03"),
          exitDate: new Date("2025-01-03"),
          pnl: 10000,
          contracts: 1,
        }, // Win
        {
          id: 4,
          strategyId: 1,
          entryDate: new Date("2025-01-04"),
          exitDate: new Date("2025-01-04"),
          pnl: -10000,
          contracts: 1,
        }, // Loss
        {
          id: 5,
          strategyId: 1,
          entryDate: new Date("2025-01-05"),
          exitDate: new Date("2025-01-05"),
          pnl: -10000,
          contracts: 1,
        }, // Loss
        {
          id: 6,
          strategyId: 1,
          entryDate: new Date("2025-01-06"),
          exitDate: new Date("2025-01-06"),
          pnl: 10000,
          contracts: 1,
        }, // Win
      ];

      const stats = calculateTradeStats(trades);

      expect(stats.longestWinStreak).toBe(3);
      expect(stats.longestLossStreak).toBe(2);
    });

    it("should handle empty trades array", () => {
      const stats = calculateTradeStats([]);

      expect(stats.totalTrades).toBe(0);
      expect(stats.winningTrades).toBe(0);
      expect(stats.losingTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.expectancyPnL).toBe(0);
    });
  });

  describe("calculateStrategyCorrelationMatrix", () => {
    it("should calculate correlation matrix with diagonal of 1.0", () => {
      const equityCurves = new Map<string, EquityPoint[]>();

      // Create strategies with opposite movements (more data points for accurate correlation)
      const strategyAPoints: EquityPoint[] = [];
      const strategyBPoints: EquityPoint[] = [];

      for (let i = 0; i < 10; i++) {
        strategyAPoints.push({
          date: new Date(2025, 0, i + 1),
          equity: 100000 + i * 1000, // Increasing
          drawdown: 0,
        });
        strategyBPoints.push({
          date: new Date(2025, 0, i + 1),
          equity: 100000 - i * 1000, // Decreasing
          drawdown: 0,
        });
      }

      equityCurves.set("Strategy A", strategyAPoints);
      equityCurves.set("Strategy B", strategyBPoints);

      const result = calculateStrategyCorrelationMatrix(equityCurves);

      expect(result.labels).toEqual(["Strategy A", "Strategy B"]);
      expect(result.matrix.length).toBe(2);
      expect(result.matrix[0]!.length).toBe(2);

      // Diagonal should be 1.0
      expect(result.matrix[0]![0]).toBe(1.0);
      expect(result.matrix[1]![1]).toBe(1.0);

      // Matrix should be symmetric
      expect(result.matrix[0]![1]).toBeCloseTo(result.matrix[1]![0]!, 5);

      // With constant returns, correlation should be very strong (close to ±1)
      expect(Math.abs(result.matrix[0]![1]!)).toBeGreaterThan(0.9);
    });

    it("should handle perfectly correlated strategies", () => {
      const equityCurves = new Map<string, EquityPoint[]>();

      equityCurves.set("Strategy A", [
        { date: new Date("2025-01-01"), equity: 100000, drawdown: 0 },
        { date: new Date("2025-01-02"), equity: 110000, drawdown: 0 },
        { date: new Date("2025-01-03"), equity: 120000, drawdown: 0 },
      ]);

      equityCurves.set("Strategy B", [
        { date: new Date("2025-01-01"), equity: 100000, drawdown: 0 },
        { date: new Date("2025-01-02"), equity: 110000, drawdown: 0 },
        { date: new Date("2025-01-03"), equity: 120000, drawdown: 0 },
      ]);

      const result = calculateStrategyCorrelationMatrix(equityCurves);

      // Identical movements should have correlation of 1.0
      expect(result.matrix[0]![1]).toBeCloseTo(1.0, 5);
    });

    it("should ensure all correlation values are between -1 and 1", () => {
      const equityCurves = new Map<string, EquityPoint[]>();

      for (let i = 0; i < 5; i++) {
        const curve: EquityPoint[] = [];
        for (let j = 0; j < 100; j++) {
          curve.push({
            date: new Date(2025, 0, j + 1),
            equity: 100000 + Math.random() * 10000 - 5000,
            drawdown: 0,
          });
        }
        equityCurves.set(`Strategy ${i}`, curve);
      }

      const result = calculateStrategyCorrelationMatrix(equityCurves);

      for (let i = 0; i < result.matrix.length; i++) {
        for (let j = 0; j < result.matrix[i]!.length; j++) {
          const corr = result.matrix[i]![j]!;
          expect(corr).toBeGreaterThanOrEqual(-1);
          expect(corr).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe("calculateUnderwaterMetrics", () => {
    it("should calculate underwater curve and statistics", () => {
      const equityCurve: EquityPoint[] = [
        { date: new Date("2025-01-01"), equity: 100000, drawdown: 0 },
        { date: new Date("2025-01-02"), equity: 110000, drawdown: 0 }, // New peak
        { date: new Date("2025-01-03"), equity: 105000, drawdown: 0 }, // -4.5% drawdown
        { date: new Date("2025-01-04"), equity: 100000, drawdown: 0 }, // -9.1% drawdown
        { date: new Date("2025-01-05"), equity: 110000, drawdown: 0 }, // Recovery to peak
        { date: new Date("2025-01-06"), equity: 110000, drawdown: 0 }, // At peak
      ];

      const metrics = calculateUnderwaterMetrics(equityCurve);

      expect(metrics.curve.length).toBe(6);
      expect(metrics.curve[0]!.drawdownPercent).toBe(0); // At peak
      expect(metrics.curve[1]!.drawdownPercent).toBe(0); // New peak
      expect(metrics.curve[2]!.drawdownPercent).toBeCloseTo(-5, 1); // Below peak: (10000-5000)/100000 = -5%
      expect(metrics.curve[4]!.drawdownPercent).toBe(0); // Recovered

      expect(metrics.longestDrawdownDays).toBeGreaterThan(0);
      expect(metrics.pctTimeInDrawdown).toBeGreaterThan(0);
    });

    it("should handle empty equity curve", () => {
      const metrics = calculateUnderwaterMetrics([]);

      expect(metrics.curve).toEqual([]);
      expect(metrics.longestDrawdownDays).toBe(0);
      expect(metrics.averageDrawdownDays).toBe(0);
      expect(metrics.pctTimeInDrawdown).toBe(0);
      expect(metrics.pctTimeBelowMinus10).toBe(0);
    });
  });

  // Note: calculateUnderwaterData was removed - now using calculatePortfolioUnderwater for portfolio-only metrics
});
