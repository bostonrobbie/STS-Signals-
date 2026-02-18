/**
 * Core Performance Metrics Module
 * 
 * Centralized, standardized formulas for all performance calculations.
 * All functions are pure and testable with golden test cases.
 * 
 * Assumptions:
 * - 252 trading days per year (standard for equity markets)
 * - Risk-free rate = 0% (can be overridden)
 * - Daily returns are computed as simple returns: r_t = E_t / E_{t-1} - 1
 */

export interface EquityPoint {
  date: Date | string;
  equity: number;
}

export interface ReturnWithDate {
  date: Date | string;
  return: number;
}

export interface WeekdayBreakdown {
  weekday: number; // 0 = Sunday, 6 = Saturday
  weekdayName: string;
  avgReturnPct: number;
  winRate: number;
  tradeCount: number;
  cumReturnPct: number;
}

export interface MonthBreakdown {
  yearMonth: string; // "YYYY-MM"
  monthReturnPct: number;
  avgDailyReturnPct: number;
  winRate: number;
  tradeCount: number;
}

/**
 * Convert equity curve to daily returns
 * Formula: r_t = E_t / E_{t-1} - 1
 */
export function equityToDailyReturns(
  equityCurve: EquityPoint[]
): number[] {
  if (equityCurve.length < 2) return [];
  
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1]!.equity;
    const currEquity = equityCurve[i]!.equity;
    
    if (prevEquity === 0) {
      returns.push(0); // Avoid division by zero
    } else {
      returns.push(currEquity / prevEquity - 1);
    }
  }
  
  return returns;
}

/**
 * Calculate total return
 * Formula: (E_N / E_0) - 1
 */
export function totalReturn(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;
  
  const startEquity = equityCurve[0]!.equity;
  const endEquity = equityCurve[equityCurve.length - 1]!.equity;
  
  if (startEquity === 0) return 0;
  
  return (endEquity / startEquity) - 1;
}

/**
 * Calculate annualized return
 * Formula: (1 + totalReturn)^(tradingDaysPerYear / N) - 1
 */
export function annualizedReturn(
  equityCurve: EquityPoint[],
  tradingDaysPerYear: number = 252
): number {
  if (equityCurve.length < 2) return 0;
  
  const total = totalReturn(equityCurve);
  const N = equityCurve.length - 1; // Number of periods
  
  if (N === 0) return 0;
  
  return Math.pow(1 + total, tradingDaysPerYear / N) - 1;
}

/**
 * Calculate daily mean and volatility (standard deviation)
 * Returns: { mean, vol }
 */
export function dailyMeanAndVol(returns: number[]): { mean: number; vol: number } {
  if (returns.length === 0) return { mean: 0, vol: 0 };
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  if (returns.length < 2) return { mean, vol: 0 };
  
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  const vol = Math.sqrt(variance);
  
  return { mean, vol };
}

/**
 * Calculate annualized volatility
 * Formula: daily vol * sqrt(tradingDaysPerYear)
 */
export function annualizedVol(
  returns: number[],
  tradingDaysPerYear: number = 252
): number {
  const { vol } = dailyMeanAndVol(returns);
  return vol * Math.sqrt(tradingDaysPerYear);
}

/**
 * Calculate Sharpe ratio
 * Formula: ((meanDaily - (rfAnnual / tradingDaysPerYear)) / dailyVol) * sqrt(tradingDaysPerYear)
 */
export function sharpe(
  returns: number[],
  riskFreeAnnual: number = 0,
  tradingDaysPerYear: number = 252
): number {
  if (returns.length < 2) return 0;
  
  const { mean, vol } = dailyMeanAndVol(returns);
  
  if (vol === 0) return 0;
  
  const dailyRiskFree = riskFreeAnnual / tradingDaysPerYear;
  const excessReturn = mean - dailyRiskFree;
  
  return (excessReturn / vol) * Math.sqrt(tradingDaysPerYear);
}

/**
 * Calculate Sortino ratio (downside deviation only)
 * Formula: same as Sharpe but with downside-only standard deviation
 */
export function sortino(
  returns: number[],
  riskFreeAnnual: number = 0,
  tradingDaysPerYear: number = 252
): number {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const dailyRiskFree = riskFreeAnnual / tradingDaysPerYear;
  
  // Calculate downside deviation (only negative returns)
  const downsideReturns = returns.filter(r => r < 0);
  
  if (downsideReturns.length === 0) {
    // No downside, return Sharpe ratio as fallback
    return sharpe(returns, riskFreeAnnual, tradingDaysPerYear);
  }
  
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downsideReturns.length;
  const downsideVol = Math.sqrt(downsideVariance);
  
  if (downsideVol === 0) return 0;
  
  const excessReturn = mean - dailyRiskFree;
  
  return (excessReturn / downsideVol) * Math.sqrt(tradingDaysPerYear);
}

/**
 * Calculate maximum drawdown
 * Formula: min(E_t / max_{i<=t} E_i - 1)
 * Returns: percentage (negative value)
 */
export function maxDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;
  
  let peak = equityCurve[0]!.equity;
  let maxDD = 0;
  
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    
    if (peak > 0) {
      const drawdown = (point.equity / peak) - 1;
      maxDD = Math.min(maxDD, drawdown);
    }
  }
  
  return maxDD;
}

/**
 * Calculate Calmar ratio
 * Formula: annualizedReturn / abs(maxDrawdown)
 */
export function calmar(
  equityCurve: EquityPoint[],
  tradingDaysPerYear: number = 252
): number {
  if (equityCurve.length < 2) return 0;
  
  const annReturn = annualizedReturn(equityCurve, tradingDaysPerYear);
  const maxDD = maxDrawdown(equityCurve);
  
  if (maxDD === 0) return 0;
  
  return annReturn / Math.abs(maxDD);
}

/**
 * Break down returns by day of week
 * Returns array of stats for each weekday (0=Sunday, 6=Saturday)
 */
export function breakdownByWeekday(
  returnsWithDates: ReturnWithDate[]
): WeekdayBreakdown[] {
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayMap = new Map<number, number[]>();
  
  // Group returns by weekday
  for (const item of returnsWithDates) {
    const date = typeof item.date === 'string' ? new Date(item.date) : item.date;
    const weekday = date.getDay();
    
    if (!weekdayMap.has(weekday)) {
      weekdayMap.set(weekday, []);
    }
    weekdayMap.get(weekday)!.push(item.return);
  }
  
  // Calculate stats for each weekday
  const results: WeekdayBreakdown[] = [];
  
  for (let weekday = 0; weekday < 7; weekday++) {
    const returns = weekdayMap.get(weekday) || [];
    
    if (returns.length === 0) continue;
    
    const avgReturn = returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length;
    const winCount = returns.filter((r: number) => r > 0).length;
    const winRate = winCount / returns.length;
    
    // Calculate cumulative return (geometric)
    const cumReturn = returns.reduce((cum: number, r: number) => cum * (1 + r), 1) - 1;
    
    results.push({
      weekday,
      weekdayName: weekdayNames[weekday]!,
      avgReturnPct: avgReturn * 100,
      winRate: winRate * 100,
      tradeCount: returns.length,
      cumReturnPct: cumReturn * 100,
    });
  }
  
  return results.sort((a, b) => a.weekday - b.weekday);
}

/**
 * Break down returns by month
 * Returns array of stats for each month
 */
export function breakdownByMonth(
  returnsWithDates: ReturnWithDate[]
): MonthBreakdown[] {
  const monthMap = new Map<string, number[]>();
  
  // Group returns by year-month
  for (const item of returnsWithDates) {
    const date = typeof item.date === 'string' ? new Date(item.date) : item.date;
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthMap.has(yearMonth)) {
      monthMap.set(yearMonth, []);
    }
    monthMap.get(yearMonth)!.push(item.return);
  }
  
  // Calculate stats for each month
  const results: MonthBreakdown[] = [];
  
  for (const [yearMonth, returns] of Array.from(monthMap.entries())) {
    if (returns.length === 0) continue;
    
    // Geometric compounding for month return
    const monthReturn = returns.reduce((cum: number, r: number) => cum * (1 + r), 1) - 1;
    
    const avgDailyReturn = returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length;
    const winCount = returns.filter((r: number) => r > 0).length;
    const winRate = winCount / returns.length;
    
    results.push({
      yearMonth,
      monthReturnPct: monthReturn * 100,
      avgDailyReturnPct: avgDailyReturn * 100,
      winRate: winRate * 100,
      tradeCount: returns.length,
    });
  }
  
  return results.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
}
