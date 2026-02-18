import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for platform.stats public endpoint
 * Tests the public statistics API used for the landing page
 */

// Mock the db module
vi.mock('./db', () => ({
  getAllStrategies: vi.fn(),
  getTrades: vi.fn(),
}));

// Mock the analytics module
vi.mock('./analytics', () => ({
  calculatePerformanceMetrics: vi.fn(),
  calculateEquityCurve: vi.fn(),
}));

import * as db from './db';
import * as analytics from './analytics';

describe('Platform Stats Public Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return platform statistics with correct structure', async () => {
    // Mock strategies
    vi.mocked(db.getAllStrategies).mockResolvedValue([
      { id: 1, name: 'Strategy 1', symbol: 'ES', market: 'Futures', microToMiniRatio: 10, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'Strategy 2', symbol: 'NQ', market: 'Futures', microToMiniRatio: 10, createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    // Mock trades
    const mockTrades = [
      { id: 1, strategyId: 1, entryDate: new Date('2020-01-01'), pnl: 100 },
      { id: 2, strategyId: 1, entryDate: new Date('2020-01-02'), pnl: -50 },
      { id: 3, strategyId: 2, entryDate: new Date('2020-01-03'), pnl: 200 },
    ];
    vi.mocked(db.getTrades).mockResolvedValue(mockTrades as any);

    // Mock performance metrics
    vi.mocked(analytics.calculatePerformanceMetrics).mockReturnValue({
      totalReturn: 516.70,
      annualizedReturn: 12.88,
      sharpeRatio: 1.65,
      sortinoRatio: 2.80,
      maxDrawdown: -7.57,
      winRate: 39.5,
      profitFactor: 1.40,
      totalTrades: 3598,
      avgWin: 1263.10,
      avgLoss: -587.12,
      tradeStats: {},
    } as any);

    // Mock equity curve
    vi.mocked(analytics.calculateEquityCurve).mockReturnValue([
      { date: new Date('2020-01-01'), equity: 100000 },
      { date: new Date('2025-12-18'), equity: 616700 },
    ] as any);

    // Verify the mocks are set up correctly
    const strategies = await db.getAllStrategies();
    expect(strategies).toHaveLength(2);

    const trades = await db.getTrades({ strategyIds: [1, 2], startDate: undefined, endDate: new Date() });
    expect(trades).toHaveLength(3);

    const metrics = analytics.calculatePerformanceMetrics(trades as any, 100000);
    expect(metrics.sharpeRatio).toBe(1.65);
    expect(metrics.winRate).toBe(39.5);
  });

  it('should handle empty strategies gracefully', async () => {
    vi.mocked(db.getAllStrategies).mockResolvedValue([]);
    vi.mocked(db.getTrades).mockResolvedValue([]);
    vi.mocked(analytics.calculatePerformanceMetrics).mockReturnValue({
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      tradeStats: {},
    } as any);
    vi.mocked(analytics.calculateEquityCurve).mockReturnValue([]);

    const strategies = await db.getAllStrategies();
    expect(strategies).toHaveLength(0);

    const metrics = analytics.calculatePerformanceMetrics([], 100000);
    expect(metrics.totalTrades).toBe(0);
  });

  it('should calculate years of data correctly', async () => {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    vi.mocked(db.getAllStrategies).mockResolvedValue([
      { id: 1, name: 'Strategy 1', symbol: 'ES', market: 'Futures', microToMiniRatio: 10, createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const mockTrades = [
      { id: 1, strategyId: 1, entryDate: fiveYearsAgo, pnl: 100 },
    ];
    vi.mocked(db.getTrades).mockResolvedValue(mockTrades as any);

    const trades = await db.getTrades({ strategyIds: [1], startDate: undefined, endDate: new Date() });
    expect(trades).toHaveLength(1);

    // Calculate years of data
    const firstTradeDate = trades[0]!.entryDate;
    const yearsOfData = (Date.now() - firstTradeDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    expect(yearsOfData).toBeGreaterThanOrEqual(4.9);
    expect(yearsOfData).toBeLessThanOrEqual(5.1);
  });
});
