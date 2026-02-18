/**
 * Performance Breakdown Tests
 * 
 * Tests for time period breakdown calculations (daily, weekly, monthly, quarterly, yearly)
 */

import { describe, it, expect } from 'vitest';
import * as breakdown from './analytics';
import type { Trade } from '../drizzle/schema';

describe('Performance Breakdown', () => {
  // Sample trades for testing
  const sampleTrades: Trade[] = [
    {
      id: 1,
      strategyId: 1,
      entryDate: new Date('2024-01-15T10:00:00Z'),
      exitDate: new Date('2024-01-15T14:00:00Z'),
      direction: 'long',
      entryPrice: 480000,
      exitPrice: 485000,
      quantity: 1,
      pnl: 50000,
      pnlPercent: 10417,
      commission: 1000,
      createdAt: new Date(),
    },
    {
      id: 2,
      strategyId: 1,
      entryDate: new Date('2024-01-16T10:00:00Z'),
      exitDate: new Date('2024-01-16T14:00:00Z'),
      direction: 'short',
      entryPrice: 485000,
      exitPrice: 490000,
      quantity: 1,
      pnl: -50000,
      pnlPercent: -10309,
      commission: 1000,
      createdAt: new Date(),
    },
    {
      id: 3,
      strategyId: 1,
      entryDate: new Date('2024-02-10T10:00:00Z'),
      exitDate: new Date('2024-02-10T14:00:00Z'),
      direction: 'long',
      entryPrice: 490000,
      exitPrice: 500000,
      quantity: 1,
      pnl: 100000,
      pnlPercent: 20408,
      commission: 1000,
      createdAt: new Date(),
    },
    {
      id: 4,
      strategyId: 1,
      entryDate: new Date('2024-03-05T10:00:00Z'),
      exitDate: new Date('2024-03-05T14:00:00Z'),
      direction: 'long',
      entryPrice: 500000,
      exitPrice: 510000,
      quantity: 1,
      pnl: 100000,
      pnlPercent: 20000,
      commission: 1000,
      createdAt: new Date(),
    },
    {
      id: 5,
      strategyId: 1,
      entryDate: new Date('2024-04-20T10:00:00Z'),
      exitDate: new Date('2024-04-20T14:00:00Z'),
      direction: 'short',
      entryPrice: 510000,
      exitPrice: 505000,
      quantity: 1,
      pnl: 50000,
      pnlPercent: 9804,
      commission: 1000,
      createdAt: new Date(),
    },
  ];

  describe('calculatePerformanceBreakdown', () => {
    it('should calculate breakdown for all time periods', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      expect(result).toHaveProperty('daily');
      expect(result).toHaveProperty('weekly');
      expect(result).toHaveProperty('monthly');
      expect(result).toHaveProperty('quarterly');
      expect(result).toHaveProperty('yearly');

      expect(Array.isArray(result.daily)).toBe(true);
      expect(Array.isArray(result.weekly)).toBe(true);
      expect(Array.isArray(result.monthly)).toBe(true);
      expect(Array.isArray(result.quarterly)).toBe(true);
      expect(Array.isArray(result.yearly)).toBe(true);
    });

    it('should calculate monthly breakdown correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      // Should have data for January, February, March, and April 2024
      expect(result.monthly.length).toBeGreaterThanOrEqual(4);

      // Find January 2024 data
      const jan2024 = result.monthly.find(m => m.period === '2024-01');
      expect(jan2024).toBeDefined();
      expect(jan2024!.trades).toBe(2); // 2 trades in January
      expect(jan2024!.winningTrades).toBe(1);
      expect(jan2024!.losingTrades).toBe(1);
      expect(jan2024!.totalPnL).toBe(0); // +500 and -500
      expect(jan2024!.winRate).toBe(50); // 1 out of 2

      // Find February 2024 data
      const feb2024 = result.monthly.find(m => m.period === '2024-02');
      expect(feb2024).toBeDefined();
      expect(feb2024!.trades).toBe(1);
      expect(feb2024!.totalPnL).toBe(1000);
      expect(feb2024!.winRate).toBe(100); // 1 out of 1
    });

    it('should calculate quarterly breakdown correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      // Should have data for Q1 and Q2 2024
      expect(result.quarterly.length).toBeGreaterThanOrEqual(2);

      // Find Q1 2024 data (Jan, Feb, Mar)
      const q1_2024 = result.quarterly.find(q => q.period === '2024-Q1');
      expect(q1_2024).toBeDefined();
      expect(q1_2024!.trades).toBe(4); // 2 in Jan + 1 in Feb + 1 in Mar
      expect(q1_2024!.totalPnL).toBe(2000); // 0 + 1000 + 1000

      // Find Q2 2024 data (Apr, May, Jun)
      const q2_2024 = result.quarterly.find(q => q.period === '2024-Q2');
      expect(q2_2024).toBeDefined();
      expect(q2_2024!.trades).toBe(1); // 1 in Apr
      expect(q2_2024!.totalPnL).toBe(500);
    });

    it('should calculate yearly breakdown correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      // Should have data for 2024
      expect(result.yearly.length).toBeGreaterThanOrEqual(1);

      const year2024 = result.yearly.find(y => y.period === '2024');
      expect(year2024).toBeDefined();
      expect(year2024!.trades).toBe(5); // All 5 trades
      expect(year2024!.totalPnL).toBe(2500); // Sum of all P&L
      expect(year2024!.winningTrades).toBe(4);
      expect(year2024!.losingTrades).toBe(1);
      expect(year2024!.winRate).toBe(80); // 4 out of 5
    });

    it('should calculate profit factor correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      const year2024 = result.yearly.find(y => y.period === '2024');
      expect(year2024).toBeDefined();

      // Total wins: 500 + 1000 + 1000 + 500 = 3000
      // Total losses: 500
      // Profit Factor: 3000 / 500 = 6.0
      expect(year2024!.profitFactor).toBeCloseTo(6.0, 1);
    });

    it('should calculate average win and loss correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      const year2024 = result.yearly.find(y => y.period === '2024');
      expect(year2024).toBeDefined();

      // Average win: (500 + 1000 + 1000 + 500) / 4 = 750
      expect(year2024!.avgWin).toBeCloseTo(750, 0);

      // Average loss: 500 / 1 = 500
      expect(year2024!.avgLoss).toBeCloseTo(500, 0);
    });

    it('should calculate return percentage correctly', () => {
      const startingCapital = 100000;
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, startingCapital);

      const year2024 = result.yearly.find(y => y.period === '2024');
      expect(year2024).toBeDefined();

      // Total P&L: 2500
      // Return: (2500 / 100000) * 100 = 2.5%
      expect(year2024!.returnPercent).toBeCloseTo(2.5, 1);
    });

    it('should handle empty trades array', () => {
      const result = breakdown.calculatePerformanceBreakdown([], 100000);

      expect(result.daily).toHaveLength(0);
      expect(result.weekly).toHaveLength(0);
      expect(result.monthly).toHaveLength(0);
      expect(result.quarterly).toHaveLength(0);
      expect(result.yearly).toHaveLength(0);
    });

    it('should handle periods with only losing trades', () => {
      const losingTrades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date('2024-01-15T10:00:00Z'),
          exitDate: new Date('2024-01-15T14:00:00Z'),
          direction: 'long',
          entryPrice: 480000,
          exitPrice: 470000,
          quantity: 1,
          pnl: -100000,
          pnlPercent: -20833,
          commission: 1000,
          createdAt: new Date(),
        },
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date('2024-01-16T10:00:00Z'),
          exitDate: new Date('2024-01-16T14:00:00Z'),
          direction: 'short',
          entryPrice: 470000,
          exitPrice: 480000,
          quantity: 1,
          pnl: -100000,
          pnlPercent: -21277,
          commission: 1000,
          createdAt: new Date(),
        },
      ];

      const result = breakdown.calculatePerformanceBreakdown(losingTrades, 100000);
      const jan2024 = result.monthly.find(m => m.period === '2024-01');

      expect(jan2024).toBeDefined();
      expect(jan2024!.winningTrades).toBe(0);
      expect(jan2024!.losingTrades).toBe(2);
      expect(jan2024!.winRate).toBe(0);
      expect(jan2024!.profitFactor).toBe(0); // No wins
      expect(jan2024!.totalPnL).toBe(-2000);
      expect(jan2024!.returnPercent).toBeLessThan(0);
    });

    it('should handle periods with only winning trades', () => {
      const winningTrades: Trade[] = [
        {
          id: 1,
          strategyId: 1,
          entryDate: new Date('2024-01-15T10:00:00Z'),
          exitDate: new Date('2024-01-15T14:00:00Z'),
          direction: 'long',
          entryPrice: 480000,
          exitPrice: 490000,
          quantity: 1,
          pnl: 100000,
          pnlPercent: 20833,
          commission: 1000,
          createdAt: new Date(),
        },
        {
          id: 2,
          strategyId: 1,
          entryDate: new Date('2024-01-16T10:00:00Z'),
          exitDate: new Date('2024-01-16T14:00:00Z'),
          direction: 'long',
          entryPrice: 490000,
          exitPrice: 500000,
          quantity: 1,
          pnl: 100000,
          pnlPercent: 20408,
          commission: 1000,
          createdAt: new Date(),
        },
      ];

      const result = breakdown.calculatePerformanceBreakdown(winningTrades, 100000);
      const jan2024 = result.monthly.find(m => m.period === '2024-01');

      expect(jan2024).toBeDefined();
      expect(jan2024!.winningTrades).toBe(2);
      expect(jan2024!.losingTrades).toBe(0);
      expect(jan2024!.winRate).toBe(100);
      expect(jan2024!.avgLoss).toBe(0); // No losses
      expect(jan2024!.totalPnL).toBe(2000);
      expect(jan2024!.returnPercent).toBeGreaterThan(0);
    });

    it('should format period strings correctly', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      // Check monthly format (YYYY-MM)
      const monthlyPeriods = result.monthly.map(m => m.period);
      monthlyPeriods.forEach(period => {
        expect(period).toMatch(/^\d{4}-\d{2}$/);
      });

      // Check quarterly format (YYYY-Q#)
      const quarterlyPeriods = result.quarterly.map(q => q.period);
      quarterlyPeriods.forEach(period => {
        expect(period).toMatch(/^\d{4}-Q[1-4]$/);
      });

      // Check yearly format (YYYY)
      const yearlyPeriods = result.yearly.map(y => y.period);
      yearlyPeriods.forEach(period => {
        expect(period).toMatch(/^\d{4}$/);
      });
    });

    it('should include period type in results', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      result.daily.forEach(d => expect(d.periodType).toBe('daily'));
      result.weekly.forEach(w => expect(w.periodType).toBe('weekly'));
      result.monthly.forEach(m => expect(m.periodType).toBe('monthly'));
      result.quarterly.forEach(q => expect(q.periodType).toBe('quarterly'));
      result.yearly.forEach(y => expect(y.periodType).toBe('yearly'));
    });

    it('should include start and end dates for each period', () => {
      const result = breakdown.calculatePerformanceBreakdown(sampleTrades, 100000);

      result.monthly.forEach(period => {
        expect(period.startDate).toBeInstanceOf(Date);
        expect(period.endDate).toBeInstanceOf(Date);
        expect(period.endDate.getTime()).toBeGreaterThanOrEqual(period.startDate.getTime());
      });
    });
  });
});
