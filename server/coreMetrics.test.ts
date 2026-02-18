/**
 * Golden Unit Tests for Core Metrics
 * 
 * These tests use hand-computed values to prove mathematical correctness.
 * Each test case has explicit equity values and expected results.
 */

import { describe, it, expect } from 'vitest';
import * as metrics from './core/metrics';

const EPSILON = 1e-10; // Tolerance for floating point comparisons

describe('Core Metrics - Golden Tests', () => {
  /**
   * Test Case A: Constant +1% daily returns for 3 days
   * 
   * Equity: [100, 101, 102.01, 103.0301]
   * Returns: [0.01, 0.01, 0.01]
   * 
   * Expected:
   * - Total Return: 3.0301%
   * - Daily Mean: 0.01 (1%)
   * - Daily Vol: 0 (constant returns)
   * - Sharpe: 0 (zero vol means undefined, we return 0)
   */
  describe('Test Case A: Constant +1% Returns', () => {
    const equityCurve = [
      { date: new Date('2024-01-01T12:00:00Z'), equity: 100 },
      { date: new Date('2024-01-02T12:00:00Z'), equity: 101 },
      { date: new Date('2024-01-03T12:00:00Z'), equity: 102.01 },
      { date: new Date('2024-01-04T12:00:00Z'), equity: 103.0301 },
    ];

    it('should calculate correct daily returns', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(0.01, 10);
      expect(returns[1]).toBeCloseTo(0.01, 10);
      expect(returns[2]).toBeCloseTo(0.01, 10);
    });

    it('should calculate correct total return', () => {
      const total = metrics.totalReturn(equityCurve);
      
      // (103.0301 / 100) - 1 = 0.030301
      expect(total).toBeCloseTo(0.030301, 10);
    });

    it('should calculate correct annualized return', () => {
      const annualized = metrics.annualizedReturn(equityCurve, 252);
      
      // (1 + 0.030301)^(252/3) - 1
      const expected = Math.pow(1.030301, 252 / 3) - 1;
      expect(annualized).toBeCloseTo(expected, 10);
    });

    it('should calculate correct daily mean and vol', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const { mean, vol } = metrics.dailyMeanAndVol(returns);
      
      expect(mean).toBeCloseTo(0.01, 10);
      expect(vol).toBeCloseTo(0, 10); // Constant returns = zero variance
    });

    it('should handle zero volatility in Sharpe calculation', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const sharpeRatio = metrics.sharpe(returns, 0, 252);
      
      // With zero vol, Sharpe should return 0 (avoid division by zero)
      expect(sharpeRatio).toBe(0);
    });
  });

  /**
   * Test Case B: Volatile returns with drawdown
   * 
   * Equity: [100, 110, 90, 95]
   * Returns: [+10%, -18.1818%, +5.5556%]
   * 
   * Expected:
   * - Total Return: -5%
   * - Max Drawdown: -18.1818% (from 110 to 90)
   */
  describe('Test Case B: Volatile Returns with Drawdown', () => {
    const equityCurve = [
      { date: new Date('2024-01-01T12:00:00Z'), equity: 100 },
      { date: new Date('2024-01-02T12:00:00Z'), equity: 110 },
      { date: new Date('2024-01-03T12:00:00Z'), equity: 90 },
      { date: new Date('2024-01-04T12:00:00Z'), equity: 95 },
    ];

    it('should calculate correct daily returns', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      
      expect(returns).toHaveLength(3);
      expect(returns[0]).toBeCloseTo(0.10, 10); // +10%
      expect(returns[1]).toBeCloseTo(-0.181818, 6); // -18.1818%
      expect(returns[2]).toBeCloseTo(0.055556, 6); // +5.5556%
    });

    it('should calculate correct total return', () => {
      const total = metrics.totalReturn(equityCurve);
      
      // (95 / 100) - 1 = -0.05
      expect(total).toBeCloseTo(-0.05, 10);
    });

    it('should calculate correct max drawdown', () => {
      const maxDD = metrics.maxDrawdown(equityCurve);
      
      // Peak at 110, trough at 90: (90/110) - 1 = -0.181818
      expect(maxDD).toBeCloseTo(-0.181818, 6);
    });

    it('should calculate correct Calmar ratio', () => {
      const calmarRatio = metrics.calmar(equityCurve, 252);
      
      const annReturn = metrics.annualizedReturn(equityCurve, 252);
      const maxDD = metrics.maxDrawdown(equityCurve);
      const expected = annReturn / Math.abs(maxDD);
      
      expect(calmarRatio).toBeCloseTo(expected, 10);
    });

    it('should calculate Sharpe ratio with non-zero volatility', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const sharpeRatio = metrics.sharpe(returns, 0, 252);
      
      // Should be a finite number
      expect(sharpeRatio).toBeTypeOf('number');
      expect(isFinite(sharpeRatio)).toBe(true);
      expect(isNaN(sharpeRatio)).toBe(false);
    });

    it('should calculate Sortino ratio', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const sortinoRatio = metrics.sortino(returns, 0, 252);
      
      // Should be a finite number
      expect(sortinoRatio).toBeTypeOf('number');
      expect(isFinite(sortinoRatio)).toBe(true);
      expect(isNaN(sortinoRatio)).toBe(false);
    });
  });

  /**
   * Test Case C: Mixed positive and negative returns
   * 
   * Returns: [0.01, 0.00, -0.01, 0.02]
   * 
   * Expected:
   * - Mean: 0.005
   * - Vol: non-zero
   * - Sharpe: calculable
   */
  describe('Test Case C: Mixed Returns for Sharpe/Sortino', () => {
    const equityCurve = [
      { date: new Date('2024-01-01T12:00:00Z'), equity: 100 },
      { date: new Date('2024-01-02T12:00:00Z'), equity: 101 },     // +1%
      { date: new Date('2024-01-03T12:00:00Z'), equity: 101 },     // 0%
      { date: new Date('2024-01-04T12:00:00Z'), equity: 99.99 },   // -1%
      { date: new Date('2024-01-05T12:00:00Z'), equity: 101.9898 }, // +2%
    ];

    it('should calculate correct returns', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      
      expect(returns).toHaveLength(4);
      expect(returns[0]).toBeCloseTo(0.01, 10);
      expect(returns[1]).toBeCloseTo(0.00, 10);
      expect(returns[2]).toBeCloseTo(-0.01, 10);
      expect(returns[3]).toBeCloseTo(0.02, 10);
    });

    it('should calculate correct mean', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const { mean } = metrics.dailyMeanAndVol(returns);
      
      // (0.01 + 0.00 - 0.01 + 0.02) / 4 = 0.005
      expect(mean).toBeCloseTo(0.005, 10);
    });

    it('should calculate non-zero volatility', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const { vol } = metrics.dailyMeanAndVol(returns);
      
      expect(vol).toBeGreaterThan(0);
      expect(isFinite(vol)).toBe(true);
    });

    it('should calculate valid Sharpe ratio', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const sharpeRatio = metrics.sharpe(returns, 0, 252);
      
      expect(isFinite(sharpeRatio)).toBe(true);
      expect(isNaN(sharpeRatio)).toBe(false);
    });

    it('should calculate valid Sortino ratio', () => {
      const returns = metrics.equityToDailyReturns(equityCurve);
      const sortinoRatio = metrics.sortino(returns, 0, 252);
      
      expect(isFinite(sortinoRatio)).toBe(true);
      expect(isNaN(sortinoRatio)).toBe(false);
      
      // Sortino should be >= Sharpe (less penalty for upside volatility)
      const sharpeRatio = metrics.sharpe(returns, 0, 252);
      expect(sortinoRatio).toBeGreaterThanOrEqual(sharpeRatio);
    });
  });

  /**
   * Edge Cases
   */
  describe('Edge Cases', () => {
    it('should handle empty equity curve', () => {
      const empty: metrics.EquityPoint[] = [];
      
      expect(metrics.totalReturn(empty)).toBe(0);
      expect(metrics.annualizedReturn(empty)).toBe(0);
      expect(metrics.maxDrawdown(empty)).toBe(0);
      expect(metrics.calmar(empty)).toBe(0);
      expect(metrics.equityToDailyReturns(empty)).toEqual([]);
    });

    it('should handle single point equity curve', () => {
      const single = [{ date: new Date(), equity: 100 }];
      
      expect(metrics.totalReturn(single)).toBe(0);
      expect(metrics.annualizedReturn(single)).toBe(0);
      expect(metrics.maxDrawdown(single)).toBe(0);
      expect(metrics.equityToDailyReturns(single)).toEqual([]);
    });

    it('should handle zero starting equity', () => {
      const zeroStart = [
        { date: new Date('2024-01-01T12:00:00Z'), equity: 0 },
        { date: new Date('2024-01-02T12:00:00Z'), equity: 100 },
      ];
      
      expect(metrics.totalReturn(zeroStart)).toBe(0);
      expect(metrics.equityToDailyReturns(zeroStart)).toEqual([0]);
    });

    it('should never return NaN for valid inputs', () => {
      const equityCurve = [
        { date: new Date('2024-01-01T12:00:00Z'), equity: 100 },
        { date: new Date('2024-01-02T12:00:00Z'), equity: 105 },
        { date: new Date('2024-01-03T12:00:00Z'), equity: 95 },
      ];
      
      const returns = metrics.equityToDailyReturns(equityCurve);
      
      expect(isNaN(metrics.totalReturn(equityCurve))).toBe(false);
      expect(isNaN(metrics.annualizedReturn(equityCurve))).toBe(false);
      expect(isNaN(metrics.maxDrawdown(equityCurve))).toBe(false);
      expect(isNaN(metrics.calmar(equityCurve))).toBe(false);
      expect(isNaN(metrics.sharpe(returns))).toBe(false);
      expect(isNaN(metrics.sortino(returns))).toBe(false);
    });

    it('should never return Infinity for typical inputs', () => {
      const equityCurve = [
        { date: new Date('2024-01-01T12:00:00Z'), equity: 100 },
        { date: new Date('2024-01-02T12:00:00Z'), equity: 105 },
        { date: new Date('2024-01-03T12:00:00Z'), equity: 95 },
      ];
      
      const returns = metrics.equityToDailyReturns(equityCurve);
      
      expect(isFinite(metrics.totalReturn(equityCurve))).toBe(true);
      expect(isFinite(metrics.annualizedReturn(equityCurve))).toBe(true);
      expect(isFinite(metrics.maxDrawdown(equityCurve))).toBe(true);
      expect(isFinite(metrics.calmar(equityCurve))).toBe(true);
      expect(isFinite(metrics.sharpe(returns))).toBe(true);
      expect(isFinite(metrics.sortino(returns))).toBe(true);
    });
  });
});


/**
 * Golden Tests for Weekday and Month Breakdowns
 * 
 * Simplified fixture with explicit weekday control
 */
describe('Breakdown Functions - Golden Tests', () => {
  describe('Weekday Breakdown', () => {
    // Create returns for specific weekdays using known dates
    // Jan 7, 2024 is Sunday (0)
    // Jan 8, 2024 is Monday (1)
    // etc.
    const returnsWithDates: metrics.ReturnWithDate[] = [
      { date: new Date('2024-01-07T12:00:00Z'), return: -0.02 }, // Sunday
      { date: new Date('2024-01-08T12:00:00Z'), return: 0.02 },  // Monday
      { date: new Date('2024-01-09T12:00:00Z'), return: 0.01 },  // Tuesday
      { date: new Date('2024-01-10T12:00:00Z'), return: -0.01 }, // Wednesday
      { date: new Date('2024-01-11T12:00:00Z'), return: 0.03 },  // Thursday
      { date: new Date('2024-01-12T12:00:00Z'), return: 0.01 },  // Friday
      { date: new Date('2024-01-13T12:00:00Z'), return: 0.02 },  // Saturday
      { date: new Date('2024-01-14T12:00:00Z'), return: 0.01 },  // Sunday
      { date: new Date('2024-01-15T12:00:00Z'), return: 0.01 },  // Monday
    ];

    it('should group returns by weekday', () => {
      const breakdown = metrics.breakdownByWeekday(returnsWithDates);
      
      // Should have entries for weekdays that have data
      expect(breakdown.length).toBeGreaterThan(0);
      expect(breakdown.length).toBeLessThanOrEqual(7);
    });

    it('should calculate correct averages', () => {
      const breakdown = metrics.breakdownByWeekday(returnsWithDates);
      
      // Find Sunday (should have -2% and +1%)
      const sunday = breakdown.find(b => b.weekday === 0);
      if (sunday) {
        // Avg: (-2% + 1%) / 2 = -0.5%
        expect(sunday.avgReturnPct).toBeCloseTo(-0.5, 2);
        expect(sunday.tradeCount).toBe(2);
      }
      
      // Find Monday (should have +2% and +1%)
      const monday = breakdown.find(b => b.weekday === 1);
      if (monday) {
        // Avg: (2% + 1%) / 2 = 1.5%
        expect(monday.avgReturnPct).toBeCloseTo(1.5, 2);
        expect(monday.tradeCount).toBe(2);
      }
    });

    it('should never return NaN or Infinity', () => {
      const breakdown = metrics.breakdownByWeekday(returnsWithDates);
      
      for (const day of breakdown) {
        expect(isNaN(day.avgReturnPct)).toBe(false);
        expect(isNaN(day.winRate)).toBe(false);
        expect(isNaN(day.cumReturnPct)).toBe(false);
        expect(isFinite(day.avgReturnPct)).toBe(true);
        expect(isFinite(day.winRate)).toBe(true);
        expect(isFinite(day.cumReturnPct)).toBe(true);
      }
    });
  });

  describe('Month Breakdown', () => {
    const returnsWithDates: metrics.ReturnWithDate[] = [
      // January 2024
      { date: new Date('2024-01-10T12:00:00Z'), return: 0.02 },
      { date: new Date('2024-01-11T12:00:00Z'), return: 0.01 },
      { date: new Date('2024-01-12T12:00:00Z'), return: -0.01 },
      
      // February 2024
      { date: new Date('2024-02-01T12:00:00Z'), return: 0.01 },
      { date: new Date('2024-02-02T12:00:00Z'), return: -0.01 },
      { date: new Date('2024-02-03T12:00:00Z'), return: 0.02 },
    ];

    it('should group returns by month', () => {
      const breakdown = metrics.breakdownByMonth(returnsWithDates);
      
      expect(breakdown.length).toBe(2);
      
      const months = breakdown.map(b => b.yearMonth);
      expect(months).toContain('2024-01');
      expect(months).toContain('2024-02');
    });

    it('should calculate geometric month returns', () => {
      const breakdown = metrics.breakdownByMonth(returnsWithDates);
      
      const jan = breakdown.find(b => b.yearMonth === '2024-01');
      expect(jan).toBeDefined();
      
      // Geometric: 1.02 * 1.01 * 0.99 - 1 = 1.019898 - 1 = 0.019898 = 1.9898%
      expect(jan!.monthReturnPct).toBeCloseTo(1.9898, 2);
    });

    it('should calculate average daily returns', () => {
      const breakdown = metrics.breakdownByMonth(returnsWithDates);
      
      const jan = breakdown.find(b => b.yearMonth === '2024-01');
      expect(jan).toBeDefined();
      
      // Avg: (2% + 1% - 1%) / 3 = 2% / 3 = 0.6667%
      expect(jan!.avgDailyReturnPct).toBeCloseTo(0.6667, 2);
    });

    it('should never return NaN or Infinity', () => {
      const breakdown = metrics.breakdownByMonth(returnsWithDates);
      
      for (const month of breakdown) {
        expect(isNaN(month.monthReturnPct)).toBe(false);
        expect(isNaN(month.avgDailyReturnPct)).toBe(false);
        expect(isNaN(month.winRate)).toBe(false);
        expect(isFinite(month.monthReturnPct)).toBe(true);
        expect(isFinite(month.avgDailyReturnPct)).toBe(true);
        expect(isFinite(month.winRate)).toBe(true);
      }
    });
  });

  describe('Breakdown Edge Cases', () => {
    it('should handle empty returns array', () => {
      const empty: metrics.ReturnWithDate[] = [];
      
      const weekdayBreakdown = metrics.breakdownByWeekday(empty);
      const monthBreakdown = metrics.breakdownByMonth(empty);
      
      expect(weekdayBreakdown).toEqual([]);
      expect(monthBreakdown).toEqual([]);
    });

    it('should handle single return', () => {
      const single: metrics.ReturnWithDate[] = [
        { date: new Date('2024-01-01T12:00:00Z'), return: 0.01 },
      ];
      
      const weekdayBreakdown = metrics.breakdownByWeekday(single);
      const monthBreakdown = metrics.breakdownByMonth(single);
      
      expect(weekdayBreakdown).toHaveLength(1);
      expect(monthBreakdown).toHaveLength(1);
    });
  });
});
