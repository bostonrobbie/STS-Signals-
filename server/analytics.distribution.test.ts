import { describe, it, expect } from 'vitest';
import { calculateDailyReturnsDistribution, calculateMajorDrawdowns } from './analytics';

describe('Distribution Analytics', () => {
  describe('calculateDailyReturnsDistribution', () => {
    it('should calculate distribution for normal returns', () => {
      // Normal distribution centered around 0
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 101000 }, // +1%
        { date: new Date('2024-01-03'), equity: 100990 }, // -0.01%
        { date: new Date('2024-01-04'), equity: 102000 }, // +1%
        { date: new Date('2024-01-05'), equity: 101980 }, // -0.02%
        { date: new Date('2024-01-06'), equity: 103000 }, // +1%
      ];

      const result = calculateDailyReturnsDistribution(equity);

      expect(result.mean).toBeGreaterThan(0);
      expect(result.stdDev).toBeGreaterThan(0);
      expect(result.buckets.length).toBeGreaterThan(0);
      expect(result.buckets.every(b => b.count >= 0)).toBe(true);
      
      // Sum of counts should equal number of returns
      const totalCount = result.buckets.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(equity.length - 1);
    });

    it('should detect positive skew (more extreme gains)', () => {
      // Create distribution with outlier gains
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 100100 }, // +0.1%
        { date: new Date('2024-01-03'), equity: 100200 }, // +0.1%
        { date: new Date('2024-01-04'), equity: 100300 }, // +0.1%
        { date: new Date('2024-01-05'), equity: 110000 }, // +9.7% - outlier
        { date: new Date('2024-01-06'), equity: 110100 }, // +0.09%
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      expect(result.skewness).toBeGreaterThan(0); // Positive skew
    });

    it('should detect negative skew (more extreme losses)', () => {
      // Create distribution with outlier losses
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 99900 }, // -0.1%
        { date: new Date('2024-01-03'), equity: 99800 }, // -0.1%
        { date: new Date('2024-01-04'), equity: 99700 }, // -0.1%
        { date: new Date('2024-01-05'), equity: 90000 }, // -9.7% - outlier
        { date: new Date('2024-01-06'), equity: 89900 }, // -0.11%
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      expect(result.skewness).toBeLessThan(0); // Negative skew
    });

    it('should detect fat tails (high kurtosis)', () => {
      // Create distribution with many outliers
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 100000 }, // 0%
        { date: new Date('2024-01-03'), equity: 100000 }, // 0%
        { date: new Date('2024-01-04'), equity: 110000 }, // +10% outlier
        { date: new Date('2024-01-05'), equity: 99000 }, // -10% outlier
        { date: new Date('2024-01-06'), equity: 109000 }, // +10% outlier
        { date: new Date('2024-01-07'), equity: 98000 }, // -10% outlier
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      // High kurtosis indicates fat tails (more outliers than normal distribution)
      expect(Math.abs(result.kurtosis)).toBeGreaterThan(0);
    });

    it('should calculate tail percentages correctly', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 102000 }, // +2% (> +1%)
        { date: new Date('2024-01-03'), equity: 101500 }, // -0.49%
        { date: new Date('2024-01-04'), equity: 101000 }, // -0.49%
        { date: new Date('2024-01-05'), equity: 99000 }, // -1.98% (< -1%)
        { date: new Date('2024-01-06'), equity: 99500 }, // +0.51%
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      // 1 out of 5 returns > +1% = 20%
      expect(result.pctGt1pct).toBeCloseTo(20, 1);
      
      // 1 out of 5 returns < -1% = 20%
      expect(result.pctLtMinus1pct).toBeCloseTo(20, 1);
    });

    it('should handle empty equity curve', () => {
      const result = calculateDailyReturnsDistribution([]);
      
      expect(result.mean).toBe(0);
      expect(result.stdDev).toBe(0);
      expect(result.skewness).toBe(0);
      expect(result.kurtosis).toBe(0);
      expect(result.buckets.length).toBe(0);
      expect(result.pctGt1pct).toBe(0);
      expect(result.pctLtMinus1pct).toBe(0);
    });

    it('should handle single data point', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      expect(result.mean).toBe(0);
      expect(result.stdDev).toBe(0);
      expect(result.buckets.length).toBe(0);
    });

    it('should create appropriate buckets buckets', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 103000 }, // +3%
        { date: new Date('2024-01-03'), equity: 102000 }, // -0.97%
        { date: new Date('2024-01-04'), equity: 104000 }, // +1.96%
        { date: new Date('2024-01-05'), equity: 102000 }, // -1.92%
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      // Should have buckets covering the range
      expect(result.buckets.length).toBeGreaterThan(0);
      
      // Each bucket should have valid range
      result.buckets.forEach(bucket => {
        expect(bucket.from).toBeLessThanOrEqual(bucket.to);
        expect(bucket.count).toBeGreaterThanOrEqual(0);
      });
      
      // Buckets should be contiguous
      for (let i = 1; i < result.buckets.length; i++) {
        expect(result.buckets[i].from).toBeCloseTo(result.buckets[i - 1].to, 5);
      }
    });

    it('should handle extreme returns', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 150000 }, // +50%
        { date: new Date('2024-01-03'), equity: 75000 }, // -50%
      ];

      const result = calculateDailyReturnsDistribution(equity);
      
      expect(result.mean).toBeDefined();
      expect(result.stdDev).toBeGreaterThan(0);
      // Histogram might be empty if range is too extreme
      expect(result.buckets).toBeDefined();
    });

    it('should calculate statistics consistently', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 101000 },
        { date: new Date('2024-01-03'), equity: 102000 },
        { date: new Date('2024-01-04'), equity: 101500 },
        { date: new Date('2024-01-05'), equity: 103000 },
      ];

      const result1 = calculateDailyReturnsDistribution(equity);
      const result2 = calculateDailyReturnsDistribution(equity);
      
      // Results should be deterministic
      expect(result1.mean).toBe(result2.mean);
      expect(result1.stdDev).toBe(result2.stdDev);
      expect(result1.skewness).toBe(result2.skewness);
      expect(result1.kurtosis).toBe(result2.kurtosis);
    });
  });

  describe('calculateMajorDrawdowns', () => {
    it('should identify single major drawdown', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak
        { date: new Date('2024-01-02'), equity: 95000 },
        { date: new Date('2024-01-03'), equity: 85000 }, // Trough (-15%)
        { date: new Date('2024-01-04'), equity: 90000 },
        { date: new Date('2024-01-05'), equity: 100001 }, // Recovery (must exceed peak)
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(1);
      expect(result[0].depthPct).toBeCloseTo(-15, 1);
      expect(result[0].startDate).toEqual(new Date('2024-01-01'));
      expect(result[0].troughDate).toEqual(new Date('2024-01-03'));
      expect(result[0].recoveryDate).toEqual(new Date('2024-01-05'));
      expect(result[0].daysToTrough).toBe(2);
      expect(result[0].daysToRecovery).toBe(2);
      expect(result[0].totalDurationDays).toBe(4);
    });

    it('should filter out minor drawdowns (< -10%)', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 95000 }, // -5% (minor)
        { date: new Date('2024-01-03'), equity: 100000 },
        { date: new Date('2024-01-04'), equity: 92000 }, // -8% (minor)
        { date: new Date('2024-01-05'), equity: 100000 },
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(0); // No major drawdowns
    });

    it('should identify multiple major drawdowns', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak 1
        { date: new Date('2024-01-02'), equity: 85000 }, // Trough 1 (-15%)
        { date: new Date('2024-01-03'), equity: 100000 }, // Recovery 1
        { date: new Date('2024-01-04'), equity: 105000 }, // Peak 2
        { date: new Date('2024-01-05'), equity: 92000 }, // Trough 2 (-12.4%)
        { date: new Date('2024-01-06'), equity: 105000 }, // Recovery 2
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(2);
      expect(result[0].depthPct).toBeCloseTo(-15, 1); // Sorted by depth (worst first)
      expect(result[1].depthPct).toBeCloseTo(-12.4, 1);
    });

    it('should handle ongoing drawdown (no recovery)', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak
        { date: new Date('2024-01-02'), equity: 95000 },
        { date: new Date('2024-01-03'), equity: 85000 }, // Trough (-15%)
        { date: new Date('2024-01-04'), equity: 87000 }, // Still in drawdown
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(1);
      expect(result[0].depthPct).toBeCloseTo(-15, 1);
      expect(result[0].recoveryDate).toBeNull();
      expect(result[0].daysToRecovery).toBeNull();
      expect(result[0].totalDurationDays).toBe(3); // Days from peak to current
    });

    it('should calculate days correctly', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak (Day 0)
        { date: new Date('2024-01-03'), equity: 85000 }, // Trough (Day 2)
        { date: new Date('2024-01-08'), equity: 100001 }, // Recovery (Day 7, must exceed peak)
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result[0].daysToTrough).toBe(2); // 2 days from peak to trough
      expect(result[0].daysToRecovery).toBe(5); // 5 days from trough to recovery
      expect(result[0].totalDurationDays).toBe(7); // 7 days total
    });

    it('should handle flat equity curve', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 100000 },
        { date: new Date('2024-01-03'), equity: 100000 },
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(0);
    });

    it('should handle empty equity curve', () => {
      const result = calculateMajorDrawdowns([]);
      
      expect(result.length).toBe(0);
    });

    it('should handle single data point', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(0);
    });

    it('should handle continuous decline (one long drawdown)', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak
        { date: new Date('2024-01-02'), equity: 95000 },
        { date: new Date('2024-01-03'), equity: 90000 },
        { date: new Date('2024-01-04'), equity: 85000 }, // Trough (-15%)
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(1);
      expect(result[0].depthPct).toBeCloseTo(-15, 1);
      expect(result[0].recoveryDate).toBeNull(); // Ongoing
    });

    it('should sort by depth (worst first)', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 88000 }, // -12%
        { date: new Date('2024-01-03'), equity: 100001 },
        { date: new Date('2024-01-04'), equity: 80000 }, // -20%
        { date: new Date('2024-01-05'), equity: 100002 },
        { date: new Date('2024-01-06'), equity: 85000 }, // -15%
        { date: new Date('2024-01-07'), equity: 100003 },
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(3);
      expect(result[0].depthPct).toBeCloseTo(-20, 1); // Worst
      expect(result[1].depthPct).toBeCloseTo(-15, 1); // Second worst
      expect(result[2].depthPct).toBeCloseTo(-12, 1); // Third worst
    });

    it('should handle recovery to new high', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak 1
        { date: new Date('2024-01-02'), equity: 85000 }, // Trough (-15%)
        { date: new Date('2024-01-03'), equity: 110000 }, // New high (recovery)
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(1);
      expect(result[0].recoveryDate).toEqual(new Date('2024-01-03'));
      expect(result[0].depthPct).toBeCloseTo(-15, 1);
    });

    it('should handle exact -10% threshold', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 89999 }, // Just below -10%
        { date: new Date('2024-01-03'), equity: 100001 },
      ];

      const result = calculateMajorDrawdowns(equity);
      
      // Threshold is < -10%, so -10.001% should be included
      expect(result.length).toBe(1);
      expect(result[0].depthPct).toBeLessThan(-10);
    });

    it('should handle multiple peaks at same level', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak
        { date: new Date('2024-01-02'), equity: 85000 }, // Trough (-15%)
        { date: new Date('2024-01-03'), equity: 100001 }, // Recovery to new peak (must be > old peak)
        { date: new Date('2024-01-04'), equity: 100001 }, // Still at peak
        { date: new Date('2024-01-05'), equity: 85000 }, // Another drawdown (-15%)
        { date: new Date('2024-01-06'), equity: 100002 }, // Recovery to new peak
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(2); // Two separate drawdowns
    });

    it('should handle recovery that takes multiple days', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 }, // Peak
        { date: new Date('2024-01-02'), equity: 85000 }, // Trough
        { date: new Date('2024-01-03'), equity: 90000 }, // Partial recovery
        { date: new Date('2024-01-04'), equity: 95000 }, // Partial recovery
        { date: new Date('2024-01-05'), equity: 100001 }, // Full recovery (must exceed peak)
      ];

      const result = calculateMajorDrawdowns(equity);
      
      expect(result.length).toBe(1);
      expect(result[0].daysToRecovery).toBe(3); // 3 days from trough to recovery
      expect(result[0].totalDurationDays).toBe(4); // 4 days from peak to recovery
    });
  });

  describe('Integration: Distribution + Drawdowns', () => {
    it('should provide consistent insights for volatile portfolio', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 110000 }, // +10%
        { date: new Date('2024-01-03'), equity: 95000 }, // -13.6%
        { date: new Date('2024-01-04'), equity: 105000 }, // +10.5%
        { date: new Date('2024-01-05'), equity: 90000 }, // -14.3%
        { date: new Date('2024-01-06'), equity: 111000 }, // +23.3% (must exceed previous peak)
      ];

      const distribution = calculateDailyReturnsDistribution(equity);
      const drawdowns = calculateMajorDrawdowns(equity);
      
      // High volatility should show in distribution
      expect(distribution.stdDev).toBeGreaterThan(5); // > 5% daily volatility
      
      // Should have major drawdowns
      expect(drawdowns.length).toBeGreaterThan(0);
      
      // Fat tails expected with extreme moves
      expect(Math.abs(distribution.kurtosis)).toBeGreaterThan(0);
    });

    it('should show low risk for stable portfolio', () => {
      const equity = [
        { date: new Date('2024-01-01'), equity: 100000 },
        { date: new Date('2024-01-02'), equity: 100100 }, // +0.1%
        { date: new Date('2024-01-03'), equity: 100200 }, // +0.1%
        { date: new Date('2024-01-04'), equity: 100300 }, // +0.1%
        { date: new Date('2024-01-05'), equity: 100400 }, // +0.1%
      ];

      const distribution = calculateDailyReturnsDistribution(equity);
      const drawdowns = calculateMajorDrawdowns(equity);
      
      // Low volatility
      expect(distribution.stdDev).toBeLessThan(1); // < 1% daily volatility
      
      // No major drawdowns
      expect(drawdowns.length).toBe(0);
    });
  });
});
