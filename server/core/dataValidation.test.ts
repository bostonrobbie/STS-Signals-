import { describe, it, expect } from 'vitest';
import {
  validateTrade,
  validateTrades,
  detectOutliers,
  checkNegativeEquity,
  detectDataIssues,
  generateDataQualityReport,
} from './dataValidation';
import { Trade } from '../analytics';

// Helper to create mock trades
function createTrade(
  id: number,
  exitDate: string,
  pnl: number, // in dollars
  strategyId: number = 1,
  direction: string = 'Long'
): Trade {
  const exit = new Date(exitDate);
  const entry = new Date(exit.getTime() - 60 * 60 * 1000); // 1 hour before
  return {
    id,
    strategyId,
    entryDate: entry,
    exitDate: exit,
    direction,
    entryPrice: 100000, // $1000 in cents
    exitPrice: 100000 + pnl * 100, // Adjust based on P&L
    quantity: 1,
    pnl: pnl * 100, // Convert to cents
    pnlPercent: (pnl / 1000) * 10000, // basis points
    commission: 0,
  };
}

describe('Data Validation Module', () => {
  describe('validateTrade', () => {
    it('should validate a correct trade', () => {
      const trade = createTrade(1, '2024-01-02T10:00:00Z', 100);
      const result = validateTrade(trade);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const trade = {
        id: 0, // Invalid
        strategyId: 0, // Invalid
        entryDate: null as any,
        exitDate: null as any,
        direction: '',
        entryPrice: undefined as any,
        exitPrice: undefined as any,
        quantity: undefined as any,
        pnl: 0,
        pnlPercent: 0,
        commission: 0,
      };
      
      const result = validateTrade(trade);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect exit date before entry date', () => {
      const trade = createTrade(1, '2024-01-02T10:00:00Z', 100);
      trade.entryDate = new Date('2024-01-03T10:00:00Z'); // After exit
      
      const result = validateTrade(trade);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('before entry'))).toBe(true);
    });

    it('should warn about long trade duration', () => {
      const trade = createTrade(1, '2024-01-03T10:00:00Z', 100);
      trade.entryDate = new Date('2024-01-01T08:00:00Z'); // 50 hours before
      
      const result = validateTrade(trade);
      
      expect(result.warnings.some(w => w.includes('exceeds 24 hours'))).toBe(true);
    });

    it('should detect negative prices', () => {
      const trade = createTrade(1, '2024-01-02T10:00:00Z', 100);
      trade.entryPrice = -100;
      
      const result = validateTrade(trade);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be negative'))).toBe(true);
    });

    it('should detect invalid direction', () => {
      const trade = createTrade(1, '2024-01-02T10:00:00Z', 100);
      trade.direction = 'Invalid';
      
      const result = validateTrade(trade);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid direction'))).toBe(true);
    });
  });

  describe('validateTrades', () => {
    it('should separate valid and invalid trades', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100),
        createTrade(2, '2024-01-03T10:00:00Z', 50),
        { ...createTrade(3, '2024-01-04T10:00:00Z', -30), direction: 'Invalid' },
      ];
      
      const result = validateTrades(trades);
      
      expect(result.validTrades).toHaveLength(2);
      expect(result.invalidTrades).toHaveLength(1);
    });
  });

  describe('detectOutliers', () => {
    it('should return empty for less than 3 trades', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100),
        createTrade(2, '2024-01-03T10:00:00Z', 50),
      ];
      
      const outliers = detectOutliers(trades);
      expect(outliers).toHaveLength(0);
    });

    it('should detect statistical outliers', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100),
        createTrade(2, '2024-01-03T10:00:00Z', 110),
        createTrade(3, '2024-01-04T10:00:00Z', 90),
        createTrade(4, '2024-01-05T10:00:00Z', 105),
        createTrade(5, '2024-01-08T10:00:00Z', 95),
        createTrade(6, '2024-01-09T10:00:00Z', 10000), // Huge outlier
      ];
      
      const outliers = detectOutliers(trades, 2.0); // Lower threshold
      
      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers[0]!.trade.pnl).toBe(1000000); // 10000 * 100 cents
    });
  });

  describe('checkNegativeEquity', () => {
    it('should detect negative equity', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', -60000), // -$60k
        createTrade(2, '2024-01-03T10:00:00Z', -50000), // -$50k (total -$110k)
      ];
      
      const result = checkNegativeEquity(trades, 100000);
      
      expect(result.hasNegativeEquity).toBe(true);
      expect(result.lowestEquity).toBeLessThan(0);
    });

    it('should track lowest equity point', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', -30000), // -$30k
        createTrade(2, '2024-01-03T10:00:00Z', 50000),  // +$50k
        createTrade(3, '2024-01-04T10:00:00Z', -40000), // -$40k
      ];
      
      const result = checkNegativeEquity(trades, 100000);
      
      expect(result.hasNegativeEquity).toBe(false);
      expect(result.lowestEquity).toBe(70000); // 100k - 30k
    });
  });

  describe('detectDataIssues', () => {
    it('should detect weekend trades', () => {
      const trades = [
        createTrade(1, '2024-01-06T10:00:00Z', 100), // Saturday
      ];
      
      const issues = detectDataIssues(trades);
      
      expect(issues.some(i => i.includes('weekend'))).toBe(true);
    });

    it('should detect large gaps between trades', () => {
      const trades = [
        createTrade(1, '2024-01-02T10:00:00Z', 100),
        createTrade(2, '2024-03-02T10:00:00Z', 50), // 60 days later
      ];
      
      const issues = detectDataIssues(trades);
      
      expect(issues.some(i => i.includes('Large gap'))).toBe(true);
    });
  });

  describe('generateDataQualityReport', () => {
    it('should generate excellent quality report for clean data', () => {
      const trades = Array(100).fill(null).map((_, i) => 
        createTrade(i + 1, `2024-01-${String(2 + (i % 20)).padStart(2, '0')}T10:00:00Z`, 100 + (i % 50))
      );
      
      const report = generateDataQualityReport(trades, 100000);
      
      expect(report.totalTrades).toBe(100);
      expect(report.validTrades).toBe(100);
      expect(report.invalidTrades).toBe(0);
    });

    it('should detect poor quality data', () => {
      const trades = [
        { ...createTrade(1, '2024-01-02T10:00:00Z', 100), direction: 'Invalid' },
        { ...createTrade(2, '2024-01-03T10:00:00Z', 50), quantity: -1 },
        createTrade(3, '2024-01-04T10:00:00Z', -30),
      ];
      
      const report = generateDataQualityReport(trades, 100000);
      
      expect(report.invalidTrades).toBe(2);
      expect(report.overallQuality).toBe('poor');
    });
  });
});
