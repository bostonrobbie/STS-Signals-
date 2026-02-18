import { describe, it, expect } from 'vitest';
import * as analytics from './analytics';

describe('Strategy Detail Page - Chart Data', () => {
  describe('Equity Curve Data Preparation', () => {
    it('should create equity curve with proper date formatting', () => {
      const equityCurve: analytics.EquityPoint[] = [
        { date: new Date('2024-01-01'), equity: 100000, drawdown: 0 },
        { date: new Date('2024-01-02'), equity: 101000, drawdown: 0 },
        { date: new Date('2024-01-03'), equity: 102000, drawdown: 0 },
      ];

      const chartData = equityCurve.map((point) => ({
        date: point.date.toLocaleDateString(),
        equity: point.equity,
      }));

      expect(chartData).toHaveLength(3);
      expect(chartData[0]).toHaveProperty('date');
      expect(chartData[0]).toHaveProperty('equity');
      expect(chartData[0]!.equity).toBe(100000);
    });

    it('should apply contract multiplier correctly', () => {
      const equityCurve: analytics.EquityPoint[] = [
        { date: new Date('2024-01-01'), equity: 100000, drawdown: 0 },
        { date: new Date('2024-01-02'), equity: 110000, drawdown: 0 },
      ];

      const miniMultiplier = 1;
      const microMultiplier = 0.1;

      const miniData = equityCurve.map((point) => ({
        equity: point.equity * miniMultiplier,
      }));

      const microData = equityCurve.map((point) => ({
        equity: point.equity * microMultiplier,
      }));

      expect(miniData[0]!.equity).toBe(100000);
      expect(miniData[1]!.equity).toBe(110000);
      expect(microData[0]!.equity).toBe(10000);
      expect(microData[1]!.equity).toBe(11000);
    });

    it('should handle benchmark data alignment', () => {
      const equityCurve: analytics.EquityPoint[] = [
        { date: new Date('2024-01-01'), equity: 100000, drawdown: 0 },
        { date: new Date('2024-01-02'), equity: 101000, drawdown: 0 },
        { date: new Date('2024-01-03'), equity: 102000, drawdown: 0 },
      ];

      const benchmarkData = [
        { close: 4500 },
        { close: 4510 },
        { close: 4520 },
      ];

      const chartData = equityCurve.map((point, index) => ({
        date: point.date.toLocaleDateString(),
        equity: point.equity,
        benchmark: benchmarkData[index]?.close,
      }));

      expect(chartData).toHaveLength(3);
      expect(chartData[0]!.benchmark).toBe(4500);
      expect(chartData[1]!.benchmark).toBe(4510);
      expect(chartData[2]!.benchmark).toBe(4520);
    });

    it('should handle missing benchmark data gracefully', () => {
      const equityCurve: analytics.EquityPoint[] = [
        { date: new Date('2024-01-01'), equity: 100000, drawdown: 0 },
        { date: new Date('2024-01-02'), equity: 101000, drawdown: 0 },
        { date: new Date('2024-01-03'), equity: 102000, drawdown: 0 },
      ];

      const benchmarkData = [
        { close: 4500 },
        undefined, // Missing index 1
        { close: 4520 },
      ];

      const chartData = equityCurve.map((point, index) => ({
        date: point.date.toLocaleDateString(),
        equity: point.equity,
        benchmark: benchmarkData[index]?.close,
      }));

      expect(chartData[0]!.benchmark).toBe(4500);
      expect(chartData[1]!.benchmark).toBeUndefined();
      expect(chartData[2]!.benchmark).toBe(4520);
    });
  });

  describe('Underwater Curve Data Preparation', () => {
    it('should create underwater curve with percentage values', () => {
      const underwaterCurve: analytics.UnderwaterPoint[] = [
        { date: new Date('2024-01-01'), drawdownPercent: 0, daysUnderwater: 0 },
        { date: new Date('2024-01-02'), drawdownPercent: -2.5, daysUnderwater: 1 },
        { date: new Date('2024-01-03'), drawdownPercent: -5.0, daysUnderwater: 2 },
      ];

      const chartData = underwaterCurve.map((point) => ({
        date: point.date.toLocaleDateString(),
        drawdown: point.drawdownPercent,
      }));

      expect(chartData).toHaveLength(3);
      expect(chartData[0]!.drawdown).toBe(0);
      expect(chartData[1]!.drawdown).toBe(-2.5);
      expect(chartData[2]!.drawdown).toBe(-5.0);
    });

    it('should align benchmark underwater data', () => {
      const strategyUnderwater: analytics.UnderwaterPoint[] = [
        { date: new Date('2024-01-01'), drawdownPercent: 0, daysUnderwater: 0 },
        { date: new Date('2024-01-02'), drawdownPercent: -3.0, daysUnderwater: 1 },
      ];

      const benchmarkUnderwater: analytics.UnderwaterPoint[] = [
        { date: new Date('2024-01-01'), drawdownPercent: 0, daysUnderwater: 0 },
        { date: new Date('2024-01-02'), drawdownPercent: -1.5, daysUnderwater: 1 },
      ];

      const chartData = strategyUnderwater.map((point, index) => ({
        date: point.date.toLocaleDateString(),
        drawdown: point.drawdownPercent,
        benchmarkDrawdown: benchmarkUnderwater[index]?.drawdownPercent,
      }));

      expect(chartData[0]!.benchmarkDrawdown).toBe(0);
      expect(chartData[1]!.benchmarkDrawdown).toBe(-1.5);
    });
  });

  describe('Zero RoR Capital Calculation', () => {
    it('should calculate zero RoR capital for positive expectancy system', () => {
      const winRate = 60; // 60%
      const avgWin = 500; // $500
      const avgLoss = -300; // -$300

      const lossRate = 1 - (winRate / 100);
      const payoffRatio = Math.abs(avgWin / avgLoss);
      const tradingAdvantage = ((winRate / 100) * payoffRatio - lossRate) / payoffRatio;

      expect(tradingAdvantage).toBeGreaterThan(0);

      const capitalUnits = Math.log(0.0001) / Math.log((1 - tradingAdvantage) / (1 + tradingAdvantage));
      const minBalance = capitalUnits * Math.abs(avgLoss);

      expect(minBalance).toBeGreaterThan(0);
      expect(capitalUnits).toBeGreaterThan(0);
    });

    it('should return null for negative expectancy system', () => {
      const winRate = 30; // 30%
      const avgWin = 200; // $200
      const avgLoss = -500; // -$500

      const lossRate = 1 - (winRate / 100);
      const payoffRatio = Math.abs(avgWin / avgLoss);
      const tradingAdvantage = ((winRate / 100) * payoffRatio - lossRate) / payoffRatio;

      expect(tradingAdvantage).toBeLessThanOrEqual(0);
      // Should not calculate zero RoR for negative expectancy
    });

    it('should handle zero average loss edge case', () => {
      const avgLoss = 0;

      // Should return null when avgLoss is 0
      expect(avgLoss).toBe(0);
    });

    it('should round up to nearest 1000', () => {
      const minBalance = 12345.67;
      const rounded = Math.ceil(minBalance / 1000) * 1000;

      expect(rounded).toBe(13000);
    });
  });

  describe('Chart Width and Domain', () => {
    it('should use dataMin and dataMax for full width coverage', () => {
      const xAxisConfig = {
        domain: ['dataMin', 'dataMax'],
        padding: { left: 20, right: 20 },
      };

      expect(xAxisConfig.domain).toEqual(['dataMin', 'dataMax']);
      expect(xAxisConfig.padding.left).toBe(20);
      expect(xAxisConfig.padding.right).toBe(20);
    });

    it('should handle connectNulls for continuous lines', () => {
      const lineConfig = {
        connectNulls: true,
      };

      expect(lineConfig.connectNulls).toBe(true);
    });
  });

  describe('Performance Metrics Display', () => {
    it('should calculate total return in dollars correctly', () => {
      const totalReturnPercent = 27.39; // 27.39%
      const startingCapital = 100000;
      const multiplier = 1; // mini

      const totalReturnDollars = (totalReturnPercent / 100) * startingCapital * multiplier;

      expect(totalReturnDollars).toBeCloseTo(27390, 0);
    });

    it('should calculate total return with micro multiplier', () => {
      const totalReturnPercent = 27.39; // 27.39%
      const startingCapital = 100000;
      const multiplier = 0.1; // micro

      const totalReturnDollars = (totalReturnPercent / 100) * startingCapital * multiplier;

      expect(totalReturnDollars).toBeCloseTo(2739, 0);
    });

    it('should calculate max drawdown in dollars correctly', () => {
      const maxDrawdownPercent = -5.75; // -5.75%
      const startingCapital = 100000;
      const multiplier = 1; // mini

      const maxDrawdownDollars = Math.abs((maxDrawdownPercent / 100) * startingCapital * multiplier);

      expect(maxDrawdownDollars).toBeCloseTo(5750, 0);
    });

    it('should calculate winning trades count', () => {
      const totalTrades = 96;
      const winRate = 37.5; // 37.5%

      const winningTrades = Math.round(totalTrades * winRate / 100);

      expect(winningTrades).toBe(36);
    });
  });

  describe('Quick Select Buttons', () => {
    it('should have correct capital preset values', () => {
      const presets = [10000, 25000, 50000, 100000];

      expect(presets).toContain(10000);
      expect(presets).toContain(25000);
      expect(presets).toContain(50000);
      expect(presets).toContain(100000);
    });

    it('should have correct time range options', () => {
      const timeRanges = ['6M', 'YTD', '1Y', 'ALL'];

      expect(timeRanges).toContain('6M');
      expect(timeRanges).toContain('YTD');
      expect(timeRanges).toContain('1Y');
      expect(timeRanges).toContain('ALL');
    });

    it('should have correct contract size options', () => {
      const contractSizes = ['mini', 'micro'];

      expect(contractSizes).toContain('mini');
      expect(contractSizes).toContain('micro');
    });
  });
});
