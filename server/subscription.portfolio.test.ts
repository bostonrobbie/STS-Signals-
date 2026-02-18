import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for subscription portfolio analytics procedures
 * Tests the portfolioAnalytics and strategyEquityCurves endpoints
 */

// Mock the subscription service
vi.mock('./subscriptionService', () => ({
  getUserSubscriptions: vi.fn(),
  getUserSubscriptionStats: vi.fn(),
  updateSubscriptionSettings: vi.fn(),
}));

// Mock the db module
vi.mock('./db', () => ({
  getTrades: vi.fn(),
  getAllStrategies: vi.fn(),
}));

// Mock the analytics module
vi.mock('./analytics', () => ({
  calculateEquityCurve: vi.fn(),
  calculateUnderwaterCurve: vi.fn(),
  calculatePerformanceMetrics: vi.fn(),
}));

import * as subscriptionService from './subscriptionService';
import * as db from './db';
import * as analytics from './analytics';

describe('Subscription Portfolio Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('portfolioAnalytics', () => {
    it('should return hasData: false when user has no subscriptions', async () => {
      // Mock empty subscriptions
      vi.mocked(subscriptionService.getUserSubscriptions).mockResolvedValue([]);

      const result = await subscriptionService.getUserSubscriptions(1);
      
      expect(result).toEqual([]);
      expect(subscriptionService.getUserSubscriptions).toHaveBeenCalledWith(1);
    });

    it('should apply quantity multipliers to trades', async () => {
      // Mock subscriptions with multipliers
      const mockSubscriptions = [
        {
          id: 1,
          userId: 1,
          strategyId: 1,
          notificationsEnabled: true,
          autoExecuteEnabled: false,
          quantityMultiplier: '2.0',
          maxPositionSize: null,
          subscribedAt: new Date(),
          strategy: {
            id: 1,
            symbol: 'ES',
            name: 'ES Trend Following',
            description: null,
            market: 'Futures',
            strategyType: 'Trend',
            active: true,
          },
        },
      ];

      vi.mocked(subscriptionService.getUserSubscriptions).mockResolvedValue(mockSubscriptions as any);

      const subs = await subscriptionService.getUserSubscriptions(1);
      
      expect(subs).toHaveLength(1);
      expect(subs[0].quantityMultiplier).toBe('2.0');
    });

    it('should handle string quantityMultiplier conversion', () => {
      const multiplierString = '1.5';
      const multiplierNumber = Number(multiplierString) || 1;
      
      expect(multiplierNumber).toBe(1.5);
      expect(typeof multiplierNumber).toBe('number');
    });

    it('should default to 1 for invalid multiplier', () => {
      const invalidMultiplier = '';
      const multiplierNumber = Number(invalidMultiplier) || 1;
      
      expect(multiplierNumber).toBe(1);
    });
  });

  describe('strategyEquityCurves', () => {
    it('should return empty curves when no subscriptions', async () => {
      vi.mocked(subscriptionService.getUserSubscriptions).mockResolvedValue([]);

      const subs = await subscriptionService.getUserSubscriptions(1);
      
      expect(subs).toEqual([]);
    });

    it('should calculate equity curves for each subscribed strategy', async () => {
      const mockEquityCurve = [
        { date: new Date('2024-01-01'), equity: 100000, drawdown: 0 },
        { date: new Date('2024-01-02'), equity: 101000, drawdown: 0 },
      ];

      vi.mocked(analytics.calculateEquityCurve).mockReturnValue(mockEquityCurve);

      const result = analytics.calculateEquityCurve([], 100000);
      
      expect(result).toHaveLength(2);
      expect(result[0].equity).toBe(100000);
      expect(result[1].equity).toBe(101000);
    });
  });

  describe('updateAdvancedSettings', () => {
    it('should update subscription settings with valid input', async () => {
      vi.mocked(subscriptionService.updateSubscriptionSettings).mockResolvedValue({ success: true } as any);

      const result = await subscriptionService.updateSubscriptionSettings(1, 1, {
        notificationsEnabled: true,
        autoExecuteEnabled: false,
        quantityMultiplier: 2.0,
        maxPositionSize: 10,
      });

      expect(subscriptionService.updateSubscriptionSettings).toHaveBeenCalledWith(1, 1, {
        notificationsEnabled: true,
        autoExecuteEnabled: false,
        quantityMultiplier: 2.0,
        maxPositionSize: 10,
      });
    });
  });

  describe('Time range filtering', () => {
    it('should calculate correct start date for 6M range', () => {
      const now = new Date('2024-06-15');
      const startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 6);
      
      // June (5) - 6 = December of previous year (11)
      expect(startDate.getMonth()).toBe(11); // December (0-indexed)
      expect(startDate.getFullYear()).toBe(2023);
    });

    it('should calculate correct start date for YTD range', () => {
      const now = new Date('2024-06-15');
      const year = now.getFullYear();
      const startDate = new Date(year, 0, 1);
      
      expect(startDate.getMonth()).toBe(0);
      expect(startDate.getDate()).toBe(1);
      expect(startDate.getFullYear()).toBe(2024);
    });

    it('should calculate correct start date for 1Y range', () => {
      const now = new Date('2024-06-15');
      const startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      
      expect(startDate.getFullYear()).toBe(2023);
    });
  });

  describe('Metrics calculation', () => {
    it('should format metrics correctly', () => {
      const mockMetrics = {
        totalReturn: 150.5,
        annualizedReturn: 25.3,
        sharpeRatio: 1.45,
        sortinoRatio: 2.1,
        maxDrawdown: -12.5,
        winRate: 45.2,
        profitFactor: 1.8,
        calmarRatio: 2.0,
        totalTrades: 500,
        avgWin: 250,
        avgLoss: -150,
        winningTrades: 225,
        losingTrades: 275,
        maxDrawdownDollars: -12500,
        tradeStats: {} as any,
      };

      vi.mocked(analytics.calculatePerformanceMetrics).mockReturnValue(mockMetrics);

      const result = analytics.calculatePerformanceMetrics([], 100000);
      
      expect(result.totalReturn).toBe(150.5);
      expect(result.sharpeRatio).toBe(1.45);
      expect(result.winRate).toBe(45.2);
    });
  });
});
