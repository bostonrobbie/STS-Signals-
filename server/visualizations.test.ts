import { describe, it, expect } from "vitest";
import {
  calculateUnderwaterCurve,
  calculateDayOfWeekBreakdown,
  type EquityPoint,
  type Trade,
} from "./analytics";

describe("Underwater Curve Calculations", () => {
  it("should calculate underwater curve correctly with simple drawdown", () => {
    const equity: EquityPoint[] = [
      { date: new Date("2024-01-01"), equity: 100000, drawdown: 0 },
      { date: new Date("2024-01-02"), equity: 105000, drawdown: 0 },
      { date: new Date("2024-01-03"), equity: 102000, drawdown: 0 },
      { date: new Date("2024-01-04"), equity: 107000, drawdown: 0 },
      { date: new Date("2024-01-05"), equity: 104000, drawdown: 0 },
    ];

    const underwater = calculateUnderwaterCurve(equity);

    expect(underwater).toHaveLength(5);

    // Day 1: At peak
    expect(underwater[0]!.drawdownPercent).toBe(0);
    expect(underwater[0]!.daysUnderwater).toBe(0);

    // Day 2: New peak
    expect(underwater[1]!.drawdownPercent).toBe(0);
    expect(underwater[1]!.daysUnderwater).toBe(0);

    // Day 3: Below peak. peakPnL=5000, currentPnL=2000, drawdown=(5000-2000)/100000=-3%
    expect(underwater[2]!.drawdownPercent).toBeCloseTo(-3, 2);
    expect(underwater[2]!.daysUnderwater).toBe(1);

    // Day 4: New peak
    expect(underwater[3]!.drawdownPercent).toBe(0);
    expect(underwater[3]!.daysUnderwater).toBe(0);

    // Day 5: Below peak. peakPnL=7000, currentPnL=4000, drawdown=(7000-4000)/100000=-3%
    expect(underwater[4]!.drawdownPercent).toBeCloseTo(-3, 2);
    expect(underwater[4]!.daysUnderwater).toBe(1);
  });

  it("should handle prolonged drawdown correctly", () => {
    const equity: EquityPoint[] = [
      { date: new Date("2024-01-01"), equity: 100000, drawdown: 0 },
      { date: new Date("2024-01-02"), equity: 95000, drawdown: 0 },
      { date: new Date("2024-01-03"), equity: 90000, drawdown: 0 },
      { date: new Date("2024-01-04"), equity: 92000, drawdown: 0 },
    ];

    const underwater = calculateUnderwaterCurve(equity);

    expect(underwater[0]!.drawdownPercent).toBe(0);
    expect(underwater[0]!.daysUnderwater).toBe(0);

    expect(underwater[1]!.drawdownPercent).toBe(-5);
    expect(underwater[1]!.daysUnderwater).toBe(1);

    expect(underwater[2]!.drawdownPercent).toBe(-10);
    expect(underwater[2]!.daysUnderwater).toBe(2);

    expect(underwater[3]!.drawdownPercent).toBe(-8);
    expect(underwater[3]!.daysUnderwater).toBe(3);
  });

  it("should handle empty equity curve", () => {
    const underwater = calculateUnderwaterCurve([]);
    expect(underwater).toEqual([]);
  });
});

describe("Day-of-Week Breakdown Calculations", () => {
  it("should calculate day-of-week metrics correctly", () => {
    // Create trades for specific days (using UTC to avoid timezone issues)
    const trades: Trade[] = [
      // Monday (day 1) - 2 winning trades
      {
        id: 1,
        strategyId: 1,
        symbol: "ES",
        side: "long",
        quantity: 1,
        entryPrice: 400000,
        exitPrice: 405000,
        entryDate: new Date("2024-01-01T10:00:00Z"), // Monday
        exitDate: new Date("2024-01-01T15:00:00Z"),
        pnl: 5000, // $50 profit (in cents)
        pnlPercent: 125,
        createdAt: new Date(),
      },
      {
        id: 2,
        strategyId: 1,
        symbol: "ES",
        side: "long",
        quantity: 1,
        entryPrice: 400000,
        exitPrice: 410000,
        entryDate: new Date("2024-01-08T10:00:00Z"), // Monday
        exitDate: new Date("2024-01-08T15:00:00Z"),
        pnl: 10000, // $100 profit
        pnlPercent: 250,
        createdAt: new Date(),
      },
      // Tuesday (day 2) - 1 losing trade
      {
        id: 3,
        strategyId: 1,
        symbol: "ES",
        side: "long",
        quantity: 1,
        entryPrice: 400000,
        exitPrice: 395000,
        entryDate: new Date("2024-01-02T10:00:00Z"), // Tuesday
        exitDate: new Date("2024-01-02T15:00:00Z"),
        pnl: -5000, // -$50 loss
        pnlPercent: -125,
        createdAt: new Date(),
      },
    ];

    const breakdown = calculateDayOfWeekBreakdown(trades);

    expect(breakdown).toHaveLength(7);

    // Monday (index 1)
    const monday = breakdown.find(d => d.dayNumber === 1);
    expect(monday).toBeDefined();
    expect(monday!.dayName).toBe("Monday");
    expect(monday!.trades).toBe(2);
    expect(monday!.totalPnL).toBe(150); // $50 + $100
    expect(monday!.avgPnL).toBe(75); // $150 / 2
    expect(monday!.winRate).toBe(100); // 2/2 = 100%
    expect(monday!.avgWin).toBe(75); // ($50 + $100) / 2
    expect(monday!.avgLoss).toBe(0); // No losses

    // Tuesday (index 2)
    const tuesday = breakdown.find(d => d.dayNumber === 2);
    expect(tuesday).toBeDefined();
    expect(tuesday!.dayName).toBe("Tuesday");
    expect(tuesday!.trades).toBe(1);
    expect(tuesday!.totalPnL).toBe(-50);
    expect(tuesday!.avgPnL).toBe(-50);
    expect(tuesday!.winRate).toBe(0); // 0/1 = 0%
    expect(tuesday!.avgWin).toBe(0); // No wins
    expect(tuesday!.avgLoss).toBe(50); // Absolute value

    // Other days should have 0 trades
    const sunday = breakdown.find(d => d.dayNumber === 0);
    expect(sunday!.trades).toBe(0);
    expect(sunday!.totalPnL).toBe(0);
  });

  it("should handle empty trades array", () => {
    const breakdown = calculateDayOfWeekBreakdown([]);

    expect(breakdown).toHaveLength(7);
    breakdown.forEach(day => {
      expect(day.trades).toBe(0);
      expect(day.totalPnL).toBe(0);
      expect(day.avgPnL).toBe(0);
      expect(day.winRate).toBe(0);
    });
  });

  it("should handle mixed win/loss days correctly", () => {
    const trades: Trade[] = [
      {
        id: 1,
        strategyId: 1,
        symbol: "ES",
        side: "long",
        quantity: 1,
        entryPrice: 400000,
        exitPrice: 410000,
        entryDate: new Date("2024-01-03T10:00:00Z"), // Wednesday
        exitDate: new Date("2024-01-03T15:00:00Z"),
        pnl: 10000, // $100 win
        pnlPercent: 250,
        createdAt: new Date(),
      },
      {
        id: 2,
        strategyId: 1,
        symbol: "ES",
        side: "long",
        quantity: 1,
        entryPrice: 400000,
        exitPrice: 395000,
        entryDate: new Date("2024-01-10T10:00:00Z"), // Wednesday
        exitDate: new Date("2024-01-10T15:00:00Z"),
        pnl: -5000, // -$50 loss
        pnlPercent: -125,
        createdAt: new Date(),
      },
    ];

    const breakdown = calculateDayOfWeekBreakdown(trades);
    const wednesday = breakdown.find(d => d.dayNumber === 3);

    expect(wednesday!.trades).toBe(2);
    expect(wednesday!.totalPnL).toBe(50); // $100 - $50
    expect(wednesday!.avgPnL).toBe(25); // $50 / 2
    expect(wednesday!.winRate).toBe(50); // 1/2 = 50%
    expect(wednesday!.avgWin).toBe(100);
    expect(wednesday!.avgLoss).toBe(50);
  });
});
