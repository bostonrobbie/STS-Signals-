import { describe, it, expect } from 'vitest';
import {
  calculateUnderwaterMetrics,
  calculatePortfolioUnderwater,
  generatePortfolioSummary,
  type EquityPoint,
  type PerformanceMetrics,
  type TradeStats,
  type UnderwaterMetrics,
} from './analytics';

describe('Underwater Metrics (Portfolio-Only)', () => {
  it('should calculate portfolio-only underwater metrics', () => {
    const equity: EquityPoint[] = [
      { date: new Date('2024-01-01'), equity: 100000 },
      { date: new Date('2024-01-02'), equity: 95000 },  // -5% drawdown
      { date: new Date('2024-01-03'), equity: 90000 },  // -10% drawdown
      { date: new Date('2024-01-04'), equity: 85000 },  // -15% drawdown
      { date: new Date('2024-01-05'), equity: 100000 }, // Recovery to peak
      { date: new Date('2024-01-06'), equity: 105000 }, // New peak
    ];

    const underwater = calculatePortfolioUnderwater(equity);

    expect(underwater.curve).toHaveLength(6);
    expect(underwater.maxDrawdownPct).toBe(-15); // Max drawdown
    expect(underwater.longestDrawdownDays).toBe(3); // 3 days underwater (days 2-4)
    expect(underwater.pctTimeInDrawdown).toBeCloseTo(50, 1); // 3/6 days
  });

  it('should calculate pctTimeBelowMinus10 correctly', () => {
    const equity: EquityPoint[] = [
      { date: new Date('2024-01-01'), equity: 100000 },
      { date: new Date('2024-01-02'), equity: 95000 },  // -5%
      { date: new Date('2024-01-03'), equity: 88000 },  // -12% (below -10%)
      { date: new Date('2024-01-04'), equity: 85000 },  // -15% (below -10%)
      { date: new Date('2024-01-05'), equity: 100000 }, // Recovery
    ];

    const underwater = calculateUnderwaterMetrics(equity);

    expect(underwater.pctTimeBelowMinus10).toBeCloseTo(40, 1); // 2/5 days
  });

  it('should handle equity curve with no drawdown', () => {
    const equity: EquityPoint[] = [
      { date: new Date('2024-01-01'), equity: 100000 },
      { date: new Date('2024-01-02'), equity: 105000 },
      { date: new Date('2024-01-03'), equity: 110000 },
    ];

    const underwater = calculateUnderwaterMetrics(equity);

    expect(underwater.maxDrawdownPct).toBe(0);
    expect(underwater.longestDrawdownDays).toBe(0);
    expect(underwater.averageDrawdownDays).toBe(0);
    expect(underwater.pctTimeInDrawdown).toBe(0);
    expect(underwater.pctTimeBelowMinus10).toBe(0);
  });

  it('should calculate average drawdown duration across multiple periods', () => {
    const equity: EquityPoint[] = [
      { date: new Date('2024-01-01'), equity: 100000 },
      { date: new Date('2024-01-02'), equity: 95000 },  // DD period 1: 2 days
      { date: new Date('2024-01-03'), equity: 90000 },
      { date: new Date('2024-01-04'), equity: 100000 }, // Recovery
      { date: new Date('2024-01-05'), equity: 95000 },  // DD period 2: 3 days
      { date: new Date('2024-01-06'), equity: 90000 },
      { date: new Date('2024-01-07'), equity: 92000 },
      { date: new Date('2024-01-08'), equity: 100000 }, // Recovery
    ];

    const underwater = calculateUnderwaterMetrics(equity);

    // Average of 2 periods: (2 + 3) / 2 = 2.5, rounded to 3
    expect(underwater.averageDrawdownDays).toBe(3);
  });
});

describe('Portfolio Summary Generation', () => {
  const mockMetrics: PerformanceMetrics = {
    totalReturn: 101.75,
    annualizedReturn: 129.09,
    sharpeRatio: 0.99,
    sortinoRatio: 1.83,
    maxDrawdown: 33.85,
    calmarRatio: 3.81,
    totalTrades: 689,
    winningTrades: 273,
    losingTrades: 416,
    winRate: 39.6,
    profitFactor: 1.24,
    avgWin: 1928.01,
    avgLoss: 1020.66,
    tradeStats: {
      totalTrades: 689,
      winningTrades: 273,
      losingTrades: 416,
      winRate: 39.6,
      profitFactor: 1.24,
      avgWin: 1928.01,
      avgLoss: 1020.66,
      medianTradePnL: -304.0,
      bestTradePnL: 24646.0,
      worstTradePnL: -7035.0,
      expectancyPnL: 147.68,
      expectancyPct: null,
      averageHoldingTimeMinutes: 5445,
      medianHoldingTimeMinutes: 4355,
      longestWinStreak: 6,
      longestLossStreak: 12,
    } as TradeStats,
  };

  const mockUnderwater: UnderwaterMetrics = {
    curve: [],
    maxDrawdownPct: -32.5,
    longestDrawdownDays: 126,
    averageDrawdownDays: 35,
    pctTimeInDrawdown: 94.5,
    pctTimeBelowMinus10: 39.1,
  };

  it('should generate summary for positive returns', () => {
    const startDate = new Date('2024-12-01');
    const endDate = new Date('2025-12-01');

    const summary = generatePortfolioSummary(mockMetrics, mockUnderwater, startDate, endDate);

    expect(summary).toContain('1.0 years');
    expect(summary).toContain('gained 101.8%');
    expect(summary).toContain('129.1% annualized');
    expect(summary).toContain('maximum drawdown of 32.5%');
    expect(summary).toContain('95% of the time below its peak');
    expect(summary).toContain('39% of days experiencing drawdowns exceeding -10%');
    expect(summary).toContain('Trading 689 times');
    expect(summary).toContain('39.6% win rate');
    expect(summary).toContain('profit factor of 1.24');
    expect(summary).toContain('expectancy of $148 per trade');
  });

  it('should generate summary for negative returns', () => {
    const negativeMetrics: PerformanceMetrics = {
      ...mockMetrics,
      totalReturn: -25.5,
      annualizedReturn: -30.2,
    };

    const startDate = new Date('2024-12-01');
    const endDate = new Date('2025-06-01');

    const summary = generatePortfolioSummary(negativeMetrics, mockUnderwater, startDate, endDate);

    expect(summary).toContain('lost 25.5%');
  });

  it('should omit annualized return for periods under 1 year', () => {
    const startDate = new Date('2025-06-01');
    const endDate = new Date('2025-12-01');

    const summary = generatePortfolioSummary(mockMetrics, mockUnderwater, startDate, endDate);

    expect(summary).not.toContain('annualized');
  });

  it('should adjust language based on pctTimeInDrawdown thresholds', () => {
    const lowDrawdownUnderwater: UnderwaterMetrics = {
      ...mockUnderwater,
      pctTimeInDrawdown: 60,
    };

    const startDate = new Date('2024-12-01');
    const endDate = new Date('2025-12-01');

    const summary = generatePortfolioSummary(mockMetrics, lowDrawdownUnderwater, startDate, endDate);

    expect(summary).toContain('spending 60% of days in drawdown');
  });

  it('should handle metrics without tradeStats', () => {
    const metricsWithoutTrades: PerformanceMetrics = {
      ...mockMetrics,
      tradeStats: undefined,
    };

    const startDate = new Date('2024-12-01');
    const endDate = new Date('2025-12-01');

    const summary = generatePortfolioSummary(metricsWithoutTrades, mockUnderwater, startDate, endDate);

    expect(summary).not.toContain('Trading');
    expect(summary).not.toContain('win rate');
  });
});
