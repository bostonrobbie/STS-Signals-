import { describe, it, expect } from 'vitest';
import {
  calculateDailyEquityCurve,
  calculateDailySharpeRatio,
  calculateDailySortinoRatio,
  calculateDailyMaxDrawdown,
  calculateAnnualizedReturn,
} from './dailyEquityCurve';
import { Trade } from '../analytics';

// Helper to create mock trades
function createTrade(
  id: number,
  exitDate: string,
  pnl: number, // in dollars
  strategyId: number = 1
): Trade {
  const exit = new Date(exitDate);
  const entry = new Date(exit.getTime() - 60 * 60 * 1000); // 1 hour before
  return {
    id,
    strategyId,
    entryDate: entry,
    exitDate: exit,
    direction: pnl >= 0 ? 'Long' : 'Short',
    entryPrice: 100000, // $1000 in cents
    exitPrice: 100000 + pnl * 100, // Adjust based on P&L
    quantity: 1,
    pnl: pnl * 100, // Convert to cents
    pnlPercent: (pnl / 1000) * 10000, // basis points
    commission: 0,
  };
}

describe('Daily Equity Curve Module', () => {
  describe('calculateDailyEquityCurve', () => {
    it('should return empty result for no trades', () => {
      const result = calculateDailyEquityCurve([], 100000);
      expect(result.dailyCurve).toHaveLength(0);
      expect(result.tradingDays).toBe(0);
      expect(result.totalReturn).toBe(0);
    });

    it('should aggregate multiple trades on the same day', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100), // +$100
        createTrade(2, '2024-01-02T14:00:00Z', 50),  // +$50
        createTrade(3, '2024-01-02T16:00:00Z', -30), // -$30
      ];
      
      const result = calculateDailyEquityCurve(trades, 100000);
      
      // Should have exactly 1 day
      expect(result.dailyCurve).toHaveLength(1);
      expect(result.dailyCurve[0]!.dailyPnL).toBe(120); // 100 + 50 - 30
      expect(result.dailyCurve[0]!.tradeCount).toBe(3);
    });

    it('should forward-fill days with no trades', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100), // Tuesday
        createTrade(2, '2024-01-04T10:00:00Z', 50),  // Thursday
      ];
      
      const result = calculateDailyEquityCurve(trades, 100000);
      
      // Should have 3 trading days (Tue, Wed, Thu)
      expect(result.dailyCurve).toHaveLength(3);
      
      // Wednesday should be forward-filled
      const wednesday = result.dailyCurve[1]!;
      expect(wednesday.isForwardFilled).toBe(true);
      expect(wednesday.dailyPnL).toBe(0);
      expect(wednesday.tradeCount).toBe(0);
    });

    it('should skip weekends', () => {
      const trades = [
        createTrade(1, '2024-01-05T10:00:00Z', 100), // Friday
        createTrade(2, '2024-01-08T10:00:00Z', 50),  // Monday
      ];
      
      const result = calculateDailyEquityCurve(trades, 100000);
      
      // Should have 2 trading days (Fri, Mon) - weekend skipped
      expect(result.dailyCurve).toHaveLength(2);
    });

    it('should calculate correct daily returns', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 1000), // +1% on $100k
        createTrade(2, '2024-01-03T10:00:00Z', 1010), // +1% on $101k
      ];
      
      const result = calculateDailyEquityCurve(trades, 100000);
      
      expect(result.dailyReturns).toHaveLength(2);
      expect(result.dailyReturns[0]).toBeCloseTo(0.01, 4); // 1%
      expect(result.dailyReturns[1]).toBeCloseTo(0.01, 4); // ~1%
    });
  });

  describe('calculateDailySharpeRatio', () => {
    it('should return 0 for empty returns', () => {
      expect(calculateDailySharpeRatio([])).toBe(0);
    });

    it('should return 0 for single return', () => {
      expect(calculateDailySharpeRatio([0.01])).toBe(0);
    });

    it('should return positive Sharpe for consistent positive returns', () => {
      // 252 days of 0.1% daily return = ~28% annual
      const dailyReturns = Array(252).fill(0.001);
      const sharpe = calculateDailySharpeRatio(dailyReturns);
      
      // With consistent returns, Sharpe should be very high
      expect(sharpe).toBeGreaterThan(2);
    });

    it('should return lower Sharpe for volatile returns', () => {
      // Alternating +1% and -0.9% returns
      const dailyReturns = Array(252).fill(0).map((_, i) => 
        i % 2 === 0 ? 0.01 : -0.009
      );
      const sharpe = calculateDailySharpeRatio(dailyReturns);
      
      // Volatile returns should have lower Sharpe
      expect(sharpe).toBeLessThan(2);
      expect(sharpe).toBeGreaterThan(0); // Still positive expectancy
    });

    it('should return negative Sharpe for losing strategy', () => {
      // Consistent -0.1% daily return
      const dailyReturns = Array(252).fill(-0.001);
      const sharpe = calculateDailySharpeRatio(dailyReturns);
      
      expect(sharpe).toBeLessThan(0);
    });
  });

  describe('calculateDailySortinoRatio', () => {
    it('should return 0 for empty returns', () => {
      expect(calculateDailySortinoRatio([])).toBe(0);
    });

    it('should handle strategies with few down days', () => {
      // Mostly positive returns with occasional small losses
      const dailyReturns = Array(252).fill(0.001);
      dailyReturns[50] = -0.002;
      dailyReturns[100] = -0.001;
      dailyReturns[150] = -0.003;
      
      const sharpe = calculateDailySharpeRatio(dailyReturns);
      const sortino = calculateDailySortinoRatio(dailyReturns);
      
      // Both should be positive for a profitable strategy
      expect(sharpe).toBeGreaterThan(0);
      expect(sortino).toBeGreaterThan(0);
    });
  });

  describe('calculateDailyMaxDrawdown', () => {
    it('should return 0 for empty curve', () => {
      const result = calculateDailyMaxDrawdown([]);
      expect(result.percentage).toBe(0);
      expect(result.dollars).toBe(0);
    });

    it('should calculate correct max drawdown', () => {
      const dailyCurve = [
        { date: new Date('2024-01-02'), dateString: '2024-01-02', equity: 100000, dailyPnL: 0, dailyReturn: 0, tradeCount: 0, isForwardFilled: false },
        { date: new Date('2024-01-03'), dateString: '2024-01-03', equity: 110000, dailyPnL: 10000, dailyReturn: 0.1, tradeCount: 1, isForwardFilled: false },
        { date: new Date('2024-01-04'), dateString: '2024-01-04', equity: 99000, dailyPnL: -11000, dailyReturn: -0.1, tradeCount: 1, isForwardFilled: false },
        { date: new Date('2024-01-05'), dateString: '2024-01-05', equity: 105000, dailyPnL: 6000, dailyReturn: 0.06, tradeCount: 1, isForwardFilled: false },
      ];
      
      const result = calculateDailyMaxDrawdown(dailyCurve);
      
      // Max drawdown: from 110000 to 99000 = 11000 / 110000 = 10%
      expect(result.percentage).toBe(10);
      expect(result.dollars).toBe(11000);
    });
  });

  describe('calculateAnnualizedReturn', () => {
    it('should return 0 for 0 trading days', () => {
      expect(calculateAnnualizedReturn(0.5, 0)).toBe(0);
    });

    it('should correctly annualize a 1-year return', () => {
      // 50% return over 252 trading days = 50% annualized
      const annualized = calculateAnnualizedReturn(0.5, 252);
      expect(annualized).toBeCloseTo(50, 0);
    });

    it('should correctly annualize a 6-month return', () => {
      // 25% return over 126 trading days (~6 months)
      // Annualized: (1.25)^2 - 1 = 56.25%
      const annualized = calculateAnnualizedReturn(0.25, 126);
      expect(annualized).toBeCloseTo(56.25, 0);
    });
  });
});
