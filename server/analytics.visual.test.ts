import { describe, it, expect } from 'vitest';
import { calculateStreakDistribution, calculateDurationDistribution, calculateDayOfWeekPerformance } from './analytics.visual';
import type { Trade } from './analytics';

describe('Visual Analytics', () => {
  const mockTrades: Trade[] = [
    {
      id: 1,
      strategyId: 1,
      entryDate: new Date('2024-01-02T09:30:00'), // Tuesday
      exitDate: new Date('2024-01-02T10:30:00'), // 1 hour
      direction: 'LONG',
      entryPrice: 500000,
      exitPrice: 505000,
      quantity: 1,
      pnl: 5000, // Win
      pnlPercent: 100,
      commission: 10,
    },
    {
      id: 2,
      strategyId: 1,
      entryDate: new Date('2024-01-03T09:30:00'), // Wednesday
      exitDate: new Date('2024-01-03T11:00:00'), // 1.5 hours
      direction: 'LONG',
      entryPrice: 505000,
      exitPrice: 510000,
      quantity: 1,
      pnl: 5000, // Win (streak of 2)
      pnlPercent: 99,
      commission: 10,
    },
    {
      id: 3,
      strategyId: 1,
      entryDate: new Date('2024-01-04T09:30:00'), // Thursday
      exitDate: new Date('2024-01-04T14:00:00'), // 4.5 hours
      direction: 'SHORT',
      entryPrice: 510000,
      exitPrice: 512000,
      quantity: 1,
      pnl: -2000, // Loss
      pnlPercent: -39,
      commission: 10,
    },
    {
      id: 4,
      strategyId: 1,
      entryDate: new Date('2024-01-05T09:30:00'), // Friday
      exitDate: new Date('2024-01-05T10:00:00'), // 30 min
      direction: 'LONG',
      entryPrice: 512000,
      exitPrice: 515000,
      quantity: 1,
      pnl: 3000, // Win
      pnlPercent: 59,
      commission: 10,
    },
  ];

  describe('calculateStreakDistribution', () => {
    it('should calculate win and loss streaks correctly', () => {
      const result = calculateStreakDistribution(mockTrades);
      
      // Should have one 2-win streak and one 1-loss streak and one 1-win streak
      expect(result.winStreaks).toContainEqual({ length: 2, count: 1 });
      expect(result.winStreaks).toContainEqual({ length: 1, count: 1 });
      expect(result.lossStreaks).toContainEqual({ length: 1, count: 1 });
    });

    it('should return empty arrays for no trades', () => {
      const result = calculateStreakDistribution([]);
      
      expect(result.winStreaks).toEqual([]);
      expect(result.lossStreaks).toEqual([]);
    });

    it('should handle all winning trades', () => {
      const allWins = mockTrades.filter(t => t.pnl > 0);
      const result = calculateStreakDistribution(allWins);
      
      expect(result.lossStreaks).toEqual([]);
      expect(result.winStreaks.length).toBeGreaterThan(0);
    });
  });

  describe('calculateDurationDistribution', () => {
    it('should categorize trades by duration', () => {
      const result = calculateDurationDistribution(mockTrades);
      
      // Should have buckets with trades (empty buckets are filtered out)
      expect(result.buckets.length).toBeGreaterThan(0);
      
      // Check that buckets have correct structure
      result.buckets.forEach(bucket => {
        expect(bucket).toHaveProperty('label');
        expect(bucket).toHaveProperty('count');
        expect(bucket).toHaveProperty('avgPnL');
      });
      
      // Should have trades in short duration buckets (30m-1h for 30min and 1h trades)
      const hasShortTrades = result.buckets.some(b => 
        b.label === '30m-1h' || b.label === '15-30m' || b.label === '1-2h'
      );
      expect(hasShortTrades).toBe(true);
    });

    it('should calculate average P&L correctly', () => {
      const result = calculateDurationDistribution(mockTrades);
      
      // All returned buckets should have trades (empty ones are filtered)
      result.buckets.forEach(bucket => {
        expect(bucket.count).toBeGreaterThan(0);
        expect(bucket.avgPnL).toBeDefined();
        expect(typeof bucket.avgPnL).toBe('number');
      });
    });

    it('should return empty buckets for no trades', () => {
      const result = calculateDurationDistribution([]);
      
      expect(result.buckets).toEqual([]);
    });
  });

  describe('calculateDayOfWeekPerformance', () => {
    it('should calculate performance by day of week', () => {
      const result = calculateDayOfWeekPerformance(mockTrades);
      
      // Should have entries for Tuesday, Wednesday, Thursday, Friday
      expect(result.length).toBe(4);
      
      result.forEach(day => {
        expect(day).toHaveProperty('dayOfWeek');
        expect(day).toHaveProperty('trades');
        expect(day).toHaveProperty('wins');
        expect(day).toHaveProperty('losses');
        expect(day).toHaveProperty('winRate');
        expect(day).toHaveProperty('totalPnL');
        expect(day).toHaveProperty('avgPnL');
      });
    });

    it('should calculate win rate correctly', () => {
      const result = calculateDayOfWeekPerformance(mockTrades);
      
      // Tuesday: 1 win, 1 trade = 100%
      const tuesday = result.find(d => d.dayOfWeek === 'Tuesday');
      expect(tuesday?.winRate).toBe(100);
      
      // Thursday: 0 wins, 1 trade = 0%
      const thursday = result.find(d => d.dayOfWeek === 'Thursday');
      expect(thursday?.winRate).toBe(0);
    });

    it('should calculate average P&L correctly', () => {
      const result = calculateDayOfWeekPerformance(mockTrades);
      
      result.forEach(day => {
        if (day.trades > 0) {
          expect(day.avgPnL).toBe(day.totalPnL / day.trades);
        }
      });
    });

    it('should return empty array for no trades', () => {
      const result = calculateDayOfWeekPerformance([]);
      
      expect(result).toEqual([]);
    });

    it('should filter out days with no trades', () => {
      const result = calculateDayOfWeekPerformance(mockTrades);
      
      // Should not have Monday, Saturday, or Sunday
      expect(result.find(d => d.dayOfWeek === 'Monday')).toBeUndefined();
      expect(result.find(d => d.dayOfWeek === 'Saturday')).toBeUndefined();
      expect(result.find(d => d.dayOfWeek === 'Sunday')).toBeUndefined();
    });
  });
});
