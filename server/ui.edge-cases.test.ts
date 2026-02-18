/**
 * UI Edge Cases & Data Handling Tests
 * 
 * Tests for edge cases that could cause UI issues:
 * - Empty data states
 * - Large numbers formatting
 * - Date edge cases
 * - Currency formatting
 * - Percentage calculations
 */

import { describe, it, expect } from 'vitest';
import * as analytics from './analytics';
import type { Trade } from './analytics';

// Helper to create a trade
function createTrade(
  pnl: number,
  entryDate: Date,
  exitDate: Date,
  direction: 'Long' | 'Short' = 'Long'
): Trade {
  const entryPrice = 100;
  const exitPrice = direction === 'Long' 
    ? entryPrice + (pnl / 50) 
    : entryPrice - (pnl / 50);
  
  return {
    id: Math.random(),
    strategyId: 1,
    entryDate,
    exitDate,
    entryPrice,
    exitPrice,
    quantity: 1,
    pnl,
    direction,
    symbol: 'ES',
  };
}

describe('UI Edge Cases - Empty States', () => {
  it('should handle empty trade array gracefully', () => {
    const metrics = analytics.calculatePerformanceMetrics([], 100000);
    
    expect(metrics.totalTrades).toBe(0);
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
    expect(metrics.totalReturn).toBe(0);
  });

  it('should handle single trade gracefully', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1))
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.totalTrades).toBe(1);
    expect(metrics.winRate).toBe(100);
    expect(metrics.totalReturn).toBeGreaterThan(0);
  });

  it('should handle all losing trades', () => {
    const trades = [
      createTrade(-100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
      createTrade(-50, new Date(2024, 0, 2), new Date(2024, 0, 2)),
      createTrade(-75, new Date(2024, 0, 3), new Date(2024, 0, 3)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.winRate).toBe(0);
    expect(metrics.profitFactor).toBe(0);
    expect(metrics.totalReturn).toBeLessThan(0);
  });

  it('should handle all winning trades', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
      createTrade(50, new Date(2024, 0, 2), new Date(2024, 0, 2)),
      createTrade(75, new Date(2024, 0, 3), new Date(2024, 0, 3)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.winRate).toBe(100);
    expect(metrics.profitFactor).toBe(Infinity);
    expect(metrics.totalReturn).toBeGreaterThan(0);
  });
});

describe('UI Edge Cases - Large Numbers', () => {
  it('should handle very large PnL values', () => {
    const trades = [
      createTrade(1000000, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(Number.isFinite(metrics.totalReturn)).toBe(true);
    expect(Number.isFinite(metrics.avgWin)).toBe(true);
  });

  it('should handle very small PnL values', () => {
    const trades = [
      createTrade(0.01, new Date(2024, 0, 1), new Date(2024, 0, 1)),
      createTrade(-0.01, new Date(2024, 0, 2), new Date(2024, 0, 2)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(Number.isFinite(metrics.totalReturn)).toBe(true);
    expect(Number.isFinite(metrics.profitFactor)).toBe(true);
  });

  it('should handle zero PnL trades', () => {
    const trades = [
      createTrade(0, new Date(2024, 0, 1), new Date(2024, 0, 1)),
      createTrade(0, new Date(2024, 0, 2), new Date(2024, 0, 2)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.totalTrades).toBe(2);
    expect(Number.isFinite(metrics.totalReturn)).toBe(true);
  });
});

describe('UI Edge Cases - Date Handling', () => {
  it('should handle trades on same day', () => {
    const sameDay = new Date(2024, 0, 15);
    const trades = [
      createTrade(100, sameDay, sameDay),
      createTrade(50, sameDay, sameDay),
      createTrade(-25, sameDay, sameDay),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.totalTrades).toBe(3);
    expect(Number.isFinite(metrics.totalReturn)).toBe(true);
  });

  it('should handle trades spanning multiple years', () => {
    const trades = [
      createTrade(100, new Date(2020, 0, 1), new Date(2020, 0, 1)),
      createTrade(100, new Date(2021, 6, 15), new Date(2021, 6, 15)),
      createTrade(100, new Date(2022, 11, 31), new Date(2022, 11, 31)),
      createTrade(100, new Date(2023, 5, 1), new Date(2023, 5, 1)),
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.totalTrades).toBe(5);
    expect(Number.isFinite(metrics.annualizedReturn)).toBe(true);
  });

  it('should handle weekend/holiday dates', () => {
    // Saturday trade
    const trades = [
      createTrade(100, new Date(2024, 0, 6), new Date(2024, 0, 6)), // Saturday
      createTrade(100, new Date(2024, 0, 7), new Date(2024, 0, 7)), // Sunday
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.totalTrades).toBe(2);
  });
});

describe('UI Edge Cases - Percentage Calculations', () => {
  it('should not produce NaN for percentage calculations', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(Number.isNaN(metrics.winRate)).toBe(false);
    expect(Number.isNaN(metrics.totalReturn)).toBe(false);
    expect(Number.isNaN(metrics.annualizedReturn)).toBe(false);
    expect(Number.isNaN(metrics.maxDrawdown)).toBe(false);
  });

  it('should handle 100% win rate correctly', () => {
    const trades = Array(10).fill(null).map((_, i) => 
      createTrade(100, new Date(2024, 0, i + 1), new Date(2024, 0, i + 1))
    );
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.winRate).toBe(100);
    expect(metrics.winRate).toBeLessThanOrEqual(100);
  });

  it('should handle 0% win rate correctly', () => {
    const trades = Array(10).fill(null).map((_, i) => 
      createTrade(-100, new Date(2024, 0, i + 1), new Date(2024, 0, i + 1))
    );
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    expect(metrics.winRate).toBe(0);
    expect(metrics.winRate).toBeGreaterThanOrEqual(0);
  });
});

describe('UI Edge Cases - Ratio Calculations', () => {
  it('should handle Sharpe ratio edge cases', () => {
    // All same returns - zero volatility
    const trades = Array(10).fill(null).map((_, i) => 
      createTrade(100, new Date(2024, 0, i + 1), new Date(2024, 0, i + 1))
    );
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    // Sharpe should be finite or Infinity (not NaN)
    expect(Number.isNaN(metrics.sharpeRatio)).toBe(false);
  });

  it('should handle Sortino ratio with no downside', () => {
    const trades = Array(5).fill(null).map((_, i) => 
      createTrade(100, new Date(2024, 0, i + 1), new Date(2024, 0, i + 1))
    );
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    // Sortino should be finite or Infinity (not NaN)
    expect(Number.isNaN(metrics.sortinoRatio)).toBe(false);
  });

  it('should handle Calmar ratio with zero drawdown', () => {
    const trades = Array(5).fill(null).map((_, i) => 
      createTrade(100, new Date(2024, 0, i + 1), new Date(2024, 0, i + 1))
    );
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    // Calmar should be finite or Infinity (not NaN)
    expect(Number.isNaN(metrics.calmarRatio)).toBe(false);
  });
});

describe('UI Edge Cases - Equity Curve', () => {
  it('should generate valid equity curve points', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
      createTrade(-50, new Date(2024, 0, 2), new Date(2024, 0, 2)),
      createTrade(75, new Date(2024, 0, 3), new Date(2024, 0, 3)),
    ];
    
    const equityCurve = analytics.calculateEquityCurve(trades, 100000);
    
    expect(equityCurve.length).toBeGreaterThan(0);
    equityCurve.forEach(point => {
      expect(point.date).toBeInstanceOf(Date);
      expect(Number.isFinite(point.equity)).toBe(true);
      expect(point.equity).toBeGreaterThanOrEqual(0);
    });
  });

  it('should handle equity curve with large starting capital', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const equityCurve = analytics.calculateEquityCurve(trades, 10000000);
    
    expect(equityCurve.length).toBeGreaterThan(0);
    equityCurve.forEach(point => {
      expect(Number.isFinite(point.equity)).toBe(true);
    });
  });

  it('should handle equity curve with small starting capital', () => {
    const trades = [
      createTrade(10, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const equityCurve = analytics.calculateEquityCurve(trades, 100);
    
    expect(equityCurve.length).toBeGreaterThan(0);
    equityCurve.forEach(point => {
      expect(Number.isFinite(point.equity)).toBe(true);
    });
  });
});

describe('UI Edge Cases - Monthly Returns', () => {
  it('should handle months with no trades', () => {
    // Only January trades
    const trades = [
      createTrade(100, new Date(2024, 0, 15), new Date(2024, 0, 15)),
    ];
    
    const equityCurve = analytics.calculateEquityCurve(trades, 100000);
    const monthlyReturns = analytics.calculateMonthlyReturnsCalendar(equityCurve);
    
    expect(Array.isArray(monthlyReturns)).toBe(true);
    // Should have at least one entry
    expect(monthlyReturns.length).toBeGreaterThan(0);
  });

  it('should handle leap year February', () => {
    const trades = [
      createTrade(100, new Date(2024, 1, 29), new Date(2024, 1, 29)), // Feb 29, 2024
    ];
    
    const equityCurve = analytics.calculateEquityCurve(trades, 100000);
    const monthlyReturns = analytics.calculateMonthlyReturnsCalendar(equityCurve);
    
    expect(Array.isArray(monthlyReturns)).toBe(true);
  });
});

describe('Data Integrity - Number Formatting Safety', () => {
  it('should not produce scientific notation for display values', () => {
    const trades = [
      createTrade(100, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    // Check that totalReturn exists and can be formatted
    expect(metrics.totalReturn).toBeDefined();
    expect(Number.isFinite(metrics.totalReturn)).toBe(true);
    
    // Check that values can be formatted without scientific notation
    const returnStr = metrics.totalReturn.toFixed(2);
    expect(returnStr).not.toContain('e');
  });

  it('should handle currency-like precision', () => {
    const trades = [
      createTrade(123.456789, new Date(2024, 0, 1), new Date(2024, 0, 1)),
    ];
    
    const metrics = analytics.calculatePerformanceMetrics(trades, 100000);
    
    // Values should be precise enough for currency display
    expect(metrics.avgWin).toBeDefined();
    expect(Number.isFinite(metrics.avgWin)).toBe(true);
  });
});
