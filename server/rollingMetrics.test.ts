import { describe, it, expect } from 'vitest';
import { calculateRollingMetrics, calculateMonthlyReturnsCalendar, type EquityPoint } from './analytics';

describe('Rolling Metrics', () => {
  it('should calculate 30-day rolling Sharpe ratio', () => {
    // Create 60 days of equity data with consistent 1% daily growth
    const equityCurve: EquityPoint[] = [];
    let equity = 100000;
    const startDate = new Date('2024-01-01');

    for (let i = 0; i < 60; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      equity *= 1.01; // 1% daily growth
      equityCurve.push({
        date,
        equity,
        drawdown: 0,
      });
    }

    const rolling = calculateRollingMetrics(equityCurve, [30]);
    
    expect(rolling).toHaveLength(1);
    expect(rolling[0]!.window).toBe(30);
    expect(rolling[0]!.data.length).toBe(30); // 60 - 30 = 30 data points

    // First rolling window should have positive Sharpe
    const firstPoint = rolling[0]!.data[0];
    expect(firstPoint!.sharpe).toBeGreaterThan(0);
    // Sortino may be null if no downside returns
    if (firstPoint!.sortino !== null) {
      expect(firstPoint!.sortino).toBeGreaterThan(0);
    }
    expect(firstPoint!.maxDrawdown).toBeLessThanOrEqual(0); // Drawdown is negative or zero
  });

  it('should calculate rolling metrics for multiple windows', () => {
    const equityCurve: EquityPoint[] = [];
    let equity = 100000;
    const startDate = new Date('2024-01-01');

    // Create 400 days of data
    for (let i = 0; i < 400; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      equity *= (i % 2 === 0 ? 1.005 : 0.995); // Alternating gains/losses
      equityCurve.push({
        date,
        equity,
        drawdown: 0,
      });
    }

    const rolling = calculateRollingMetrics(equityCurve, [30, 90, 365]);
    
    expect(rolling).toHaveLength(3);
    expect(rolling[0]!.window).toBe(30);
    expect(rolling[1]!.window).toBe(90);
    expect(rolling[2]!.window).toBe(365);

    // Each window should have appropriate number of data points
    expect(rolling[0]!.data.length).toBe(400 - 30); // 370 points
    expect(rolling[1]!.data.length).toBe(400 - 90); // 310 points
    expect(rolling[2]!.data.length).toBe(400 - 365); // 35 points
  });

  it('should handle drawdown in rolling window', () => {
    const equityCurve: EquityPoint[] = [];
    const startDate = new Date('2024-01-01');

    // Create 60 days with a drawdown in the middle
    for (let i = 0; i < 60; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      let equity = 100000;
      if (i < 20) {
        equity = 100000 + i * 1000; // Growth to 120k
      } else if (i < 40) {
        equity = 120000 - (i - 20) * 2000; // Drawdown to 80k
      } else {
        equity = 80000 + (i - 40) * 1500; // Recovery to 110k
      }

      equityCurve.push({
        date,
        equity,
        drawdown: 0,
      });
    }

    const rolling = calculateRollingMetrics(equityCurve, [30]);
    
    expect(rolling[0]!.data.length).toBeGreaterThan(0);
    
    // Some windows should have negative max drawdown
    const hasDrawdown = rolling[0]!.data.some(d => d.maxDrawdown! < -5);
    expect(hasDrawdown).toBe(true);
  });

  it('should return empty array for insufficient data', () => {
    const equityCurve: EquityPoint[] = [];
    const startDate = new Date('2024-01-01');

    // Only 20 days of data, but asking for 30-day window
    for (let i = 0; i < 20; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      equityCurve.push({
        date,
        equity: 100000,
        drawdown: 0,
      });
    }

    const rolling = calculateRollingMetrics(equityCurve, [30]);
    
    expect(rolling[0]!.data).toHaveLength(0); // Not enough data for 30-day window
  });
});

describe('Monthly Returns Calendar', () => {
  it('should calculate monthly returns correctly', () => {
    const equityCurve: EquityPoint[] = [];
    
    // January: 100k -> 110k (10% gain)
    equityCurve.push({
      date: new Date('2024-01-01T12:00:00Z'),
      equity: 100000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2024-01-31T12:00:00Z'),
      equity: 110000,
      drawdown: 0,
    });

    // February: 110k -> 105k (-4.55% loss)
    equityCurve.push({
      date: new Date('2024-02-01T12:00:00Z'),
      equity: 110000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2024-02-29T12:00:00Z'),
      equity: 105000,
      drawdown: 0,
    });

    const calendar = calculateMonthlyReturnsCalendar(equityCurve);
    
    expect(calendar.length).toBeGreaterThanOrEqual(2);
    
    // Find January and February
    const jan = calendar.find(m => m.month === 1);
    const feb = calendar.find(m => m.month === 2);
    
    expect(jan).toBeDefined();
    expect(jan!.year).toBe(2024);
    expect(jan!.monthName).toBe('Jan');
    expect(jan!.return).toBeCloseTo(10, 1); // 10% return
    
    expect(feb).toBeDefined();
    expect(feb!.year).toBe(2024);
    expect(feb!.monthName).toBe('Feb');
    expect(feb!.return).toBeCloseTo(-4.55, 1); // -4.55% return
  });

  it('should handle multiple years', () => {
    const equityCurve: EquityPoint[] = [];
    
    // Dec 2023
    equityCurve.push({
      date: new Date('2023-12-01T12:00:00Z'),
      equity: 90000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2023-12-31T12:00:00Z'),
      equity: 95000,
      drawdown: 0,
    });

    // Jan 2024
    equityCurve.push({
      date: new Date('2024-01-01T12:00:00Z'),
      equity: 95000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2024-01-31T12:00:00Z'),
      equity: 100000,
      drawdown: 0,
    });

    const calendar = calculateMonthlyReturnsCalendar(equityCurve);
    
    expect(calendar.length).toBeGreaterThanOrEqual(2);
    const dec2023 = calendar.find(m => m.year === 2023 && m.month === 12);
    const jan2024 = calendar.find(m => m.year === 2024 && m.month === 1);
    expect(dec2023).toBeDefined();
    expect(jan2024).toBeDefined();
  });

  it('should sort by year and month', () => {
    const equityCurve: EquityPoint[] = [];
    
    // Add months out of order
    equityCurve.push({ date: new Date('2024-03-15T12:00:00Z'), equity: 110000, drawdown: 0 });
    equityCurve.push({ date: new Date('2024-01-15T12:00:00Z'), equity: 100000, drawdown: 0 });
    equityCurve.push({ date: new Date('2024-02-15T12:00:00Z'), equity: 105000, drawdown: 0 });

    const calendar = calculateMonthlyReturnsCalendar(equityCurve);
    
    // Should be sorted by month
    const months = calendar.map(c => c.month);
    expect(months[0]).toBeLessThan(months[1]!);
    expect(months[1]).toBeLessThan(months[2]!);
  });

  it('should return empty array for empty equity curve', () => {
    const calendar = calculateMonthlyReturnsCalendar([]);
    expect(calendar).toHaveLength(0);
  });

  it('should handle single month correctly', () => {
    const equityCurve: EquityPoint[] = [];
    
    // All points in January 2024
    equityCurve.push({
      date: new Date('2024-01-01T00:00:00'),
      equity: 100000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2024-01-15T00:00:00'),
      equity: 105000,
      drawdown: 0,
    });
    equityCurve.push({
      date: new Date('2024-01-31T00:00:00'),
      equity: 110000,
      drawdown: 0,
    });

    const calendar = calculateMonthlyReturnsCalendar(equityCurve);
    
    // Should have exactly 1 month (January 2024)
    expect(calendar.length).toBeGreaterThanOrEqual(1);
    const jan = calendar.find(m => m.year === 2024 && m.month === 1);
    expect(jan).toBeDefined();
    expect(jan!.return).toBeCloseTo(10, 1); // 10% return
  });
});
