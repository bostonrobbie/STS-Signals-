import { describe, it, expect } from 'vitest';
import { calculateTradeStats } from './analytics';
import type { Trade } from './analytics';

describe('Risk of Ruin Calculations', () => {
  // Helper to create mock trade
  const createTrade = (pnl: number, entryDate: Date, exitDate: Date): Trade => ({
    id: Math.random(),
    strategyId: 1,
    entryDate,
    exitDate,
    direction: 'LONG',
    entryPrice: 500000,
    exitPrice: 500000 + pnl,
    quantity: 1,
    pnl, // in cents
    pnlPercent: (pnl / 500000) * 10000,
    commission: 10,
  });

  describe('Positive Expectancy System', () => {
    it('should calculate RoR details for profitable system', () => {
      // Create a profitable system: 60% win rate, 2:1 payoff ratio
      const trades: Trade[] = [
        // 6 wins @ $1000 each
        ...Array(6).fill(null).map((_, i) => 
          createTrade(100000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        // 4 losses @ $500 each
        ...Array(4).fill(null).map((_, i) => 
          createTrade(-50000, new Date(2024, 0, i + 7, 9, 30), new Date(2024, 0, i + 7, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      expect(stats.riskOfRuinDetails).not.toBeNull();
      
      if (stats.riskOfRuinDetails) {
        // Win rate should be 60%
        expect(stats.winRate).toBe(60);
        
        // Payoff ratio should be 2.0
        expect(stats.payoffRatio).toBeCloseTo(2.0, 1);
        
        // Trading advantage should be positive
        // A = (0.6 * 2.0 - 0.4) / 2.0 = 0.4
        expect(stats.riskOfRuinDetails.tradingAdvantage).toBeGreaterThan(0);
        expect(stats.riskOfRuinDetails.tradingAdvantage).toBeCloseTo(0.4, 1);
        
        // Capital units = 100000 / 500 = 200
        expect(stats.riskOfRuinDetails.capitalUnits).toBeCloseTo(200, 0);
        
        // RoR should be very low (approaching 0)
        expect(stats.riskOfRuin).toBeLessThan(1);
        
        // Min balance should be calculated
        expect(stats.riskOfRuinDetails.minBalanceForZeroRisk).toBeGreaterThan(0);
      }
    });

    it('should show near-zero RoR for high capital units', () => {
      // System with good edge but moderate win rate
      const trades: Trade[] = [
        ...Array(40).fill(null).map((_, i) => 
          createTrade(150000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        ...Array(60).fill(null).map((_, i) => 
          createTrade(-50000, new Date(2024, 0, i + 41, 9, 30), new Date(2024, 0, i + 41, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      // 40% win rate, 3:1 payoff ratio
      // A = (0.4 * 3.0 - 0.6) / 3.0 = 0.2
      // With 100000 / 500 = 200 capital units, RoR should be extremely low
      expect(stats.riskOfRuin).toBeLessThan(0.01);
      expect(stats.riskOfRuinDetails?.tradingAdvantage).toBeGreaterThan(0);
    });
  });

  describe('Negative Expectancy System', () => {
    it('should return 100% RoR for negative expectancy', () => {
      // Losing system: 30% win rate, 1:1 payoff ratio
      const trades: Trade[] = [
        ...Array(3).fill(null).map((_, i) => 
          createTrade(50000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        ...Array(7).fill(null).map((_, i) => 
          createTrade(-50000, new Date(2024, 0, i + 4, 9, 30), new Date(2024, 0, i + 4, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      // Negative expectancy = 100% RoR
      expect(stats.riskOfRuin).toBe(100);
      
      if (stats.riskOfRuinDetails) {
        // Trading advantage should be negative
        expect(stats.riskOfRuinDetails.tradingAdvantage).toBeLessThan(0);
        
        // Min balance calculation may still return a value even for negative expectancy
        // The key indicator is that RoR is 100%
        expect(stats.riskOfRuinDetails.minBalanceForZeroRisk).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero expectancy', () => {
      // 50% win rate, 1:1 payoff ratio = zero expectancy
      const trades: Trade[] = [
        ...Array(5).fill(null).map((_, i) => 
          createTrade(50000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        ...Array(5).fill(null).map((_, i) => 
          createTrade(-50000, new Date(2024, 0, i + 6, 9, 30), new Date(2024, 0, i + 6, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      // Zero expectancy = 50% RoR (random walk)
      expect(stats.riskOfRuin).toBe(50);
      
      if (stats.riskOfRuinDetails) {
        expect(stats.riskOfRuinDetails.tradingAdvantage).toBeCloseTo(0, 2);
      }
    });

    it('should return null details for no trades', () => {
      const stats = calculateTradeStats([]);

      expect(stats.riskOfRuin).toBe(100);
      expect(stats.riskOfRuinDetails).toBeNull();
    });

    it('should handle very small average loss', () => {
      // Tiny losses, decent wins
      const trades: Trade[] = [
        ...Array(5).fill(null).map((_, i) => 
          createTrade(100000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        ...Array(5).fill(null).map((_, i) => 
          createTrade(-1000, new Date(2024, 0, i + 6, 9, 30), new Date(2024, 0, i + 6, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      // Very high capital units (100000 / 10 = 10000)
      expect(stats.riskOfRuinDetails?.capitalUnits).toBeGreaterThan(1000);
      
      // RoR should be essentially 0
      expect(stats.riskOfRuin).toBeLessThan(0.0001);
    });
  });

  describe('Minimum Balance Calculation', () => {
    it('should calculate realistic minimum balance', () => {
      // Good system: 55% win rate, 2:1 payoff
      const trades: Trade[] = [
        ...Array(55).fill(null).map((_, i) => 
          createTrade(200000, new Date(2024, 0, i + 1, 9, 30), new Date(2024, 0, i + 1, 10, 30))
        ),
        ...Array(45).fill(null).map((_, i) => 
          createTrade(-100000, new Date(2024, 0, i + 56, 9, 30), new Date(2024, 0, i + 56, 10, 30))
        ),
      ];

      const stats = calculateTradeStats(trades);

      if (stats.riskOfRuinDetails) {
        const minBalance = stats.riskOfRuinDetails.minBalanceForZeroRisk;
        
        // Should be a reasonable number
        expect(minBalance).toBeGreaterThan(0);
        expect(minBalance).toBeLessThan(1000000); // Less than $1M
        
        // Should be some multiple of average loss
        expect(minBalance).toBeGreaterThan(stats.avgLoss);
      }
    });
  });
});
