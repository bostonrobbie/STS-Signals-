/**
 * Daily Equity Curve Module
 *
 * Implements industry-standard daily equity curve calculation:
 * - Aggregates all trades to one data point per trading day
 * - Forward-fills days with no trades (equity stays flat)
 * - Excludes weekends and market holidays
 * - Provides proper foundation for Sharpe/Sortino calculations
 */

import { Trade } from "../analytics";
import {
  getTradingCalendar,
  isMarketOpen,
  TradingCalendar,
} from "./tradingCalendar";

export interface DailyEquityPoint {
  date: Date;
  dateString: string; // YYYY-MM-DD for easy comparison
  equity: number; // cumulative equity in dollars
  dailyPnL: number; // P&L for this day in dollars
  dailyReturn: number; // daily return as decimal (0.01 = 1%)
  tradeCount: number; // number of trades closed on this day
  isForwardFilled: boolean; // true if no trades on this day
}

export interface DailyEquityCurveResult {
  dailyCurve: DailyEquityPoint[];
  tradingDays: number;
  totalReturn: number;
  dailyReturns: number[]; // array of daily returns for Sharpe calculation
  negativeDailyReturns: number[]; // for Sortino calculation
}

/**
 * Converts a Date to YYYY-MM-DD string in UTC
 */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parses a YYYY-MM-DD string to Date at midnight UTC
 */
function fromDateString(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00.000Z");
}

/**
 * Gets the next calendar day
 */
function nextDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Aggregates trades by exit date
 * Returns a map of dateString -> total P&L for that day
 * @param contractMultiplier - Multiplier for contract size (1 for mini, 0.1 for micro)
 */
function aggregateTradesByDay(
  trades: Trade[],
  contractMultiplier: number = 1
): Map<string, { pnl: number; count: number }> {
  const dailyPnL = new Map<string, { pnl: number; count: number }>();

  for (const trade of trades) {
    const dateStr = toDateString(trade.exitDate);
    const existing = dailyPnL.get(dateStr) || { pnl: 0, count: 0 };
    existing.pnl += (trade.pnl / 100) * contractMultiplier; // Convert cents to dollars and apply contract multiplier
    existing.count += 1;
    dailyPnL.set(dateStr, existing);
  }

  return dailyPnL;
}

/**
 * Calculates daily equity curve with proper forward-filling
 *
 * @param trades - Array of trades sorted by exit date
 * @param startingCapital - Initial capital in dollars
 * @param calendar - Trading calendar for excluding non-trading days
 * @param contractMultiplier - Multiplier for contract size (1 for mini, 0.1 for micro)
 */
export function calculateDailyEquityCurve(
  trades: Trade[],
  startingCapital: number = 100000,
  calendar?: TradingCalendar,
  contractMultiplier: number = 1
): DailyEquityCurveResult {
  if (trades.length === 0) {
    return {
      dailyCurve: [],
      tradingDays: 0,
      totalReturn: 0,
      dailyReturns: [],
      negativeDailyReturns: [],
    };
  }

  // Sort trades by exit date
  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  // Get date range
  const firstTradeDate = sortedTrades[0].exitDate;
  const lastTradeDate = sortedTrades[sortedTrades.length - 1].exitDate;

  // Aggregate trades by day (with contract multiplier applied to P&L)
  const dailyPnLMap = aggregateTradesByDay(sortedTrades, contractMultiplier);

  // Build daily curve with forward-filling
  const dailyCurve: DailyEquityPoint[] = [];
  const dailyReturns: number[] = [];
  const negativeDailyReturns: number[] = [];

  let currentEquity = startingCapital;
  let currentDate = fromDateString(toDateString(firstTradeDate));
  const endDate = fromDateString(toDateString(lastTradeDate));

  // Use provided calendar or get default
  const tradingCalendar = calendar || getTradingCalendar();

  while (currentDate <= endDate) {
    const dateStr = toDateString(currentDate);

    // Skip non-trading days (weekends and holidays)
    if (!isMarketOpen(currentDate, tradingCalendar)) {
      currentDate = nextDay(currentDate);
      continue;
    }

    const dayData = dailyPnLMap.get(dateStr);
    const dailyPnL = dayData?.pnl || 0;
    const tradeCount = dayData?.count || 0;
    const isForwardFilled = tradeCount === 0;

    // Calculate daily return
    const previousEquity = currentEquity;
    currentEquity += dailyPnL;
    const dailyReturn = previousEquity > 0 ? dailyPnL / previousEquity : 0;

    dailyCurve.push({
      date: new Date(currentDate),
      dateString: dateStr,
      equity: currentEquity,
      dailyPnL,
      dailyReturn,
      tradeCount,
      isForwardFilled,
    });

    dailyReturns.push(dailyReturn);
    if (dailyReturn < 0) {
      negativeDailyReturns.push(dailyReturn);
    }

    currentDate = nextDay(currentDate);
  }

  const totalReturn =
    startingCapital > 0
      ? (currentEquity - startingCapital) / startingCapital
      : 0;

  return {
    dailyCurve,
    tradingDays: dailyCurve.length,
    totalReturn,
    dailyReturns,
    negativeDailyReturns,
  };
}

/**
 * Calculates Sharpe ratio using proper daily returns
 *
 * Sharpe = (Mean Daily Return - Risk-Free Rate) / StdDev(Daily Returns) * sqrt(252)
 *
 * @param dailyReturns - Array of daily returns as decimals
 * @param riskFreeRate - Annual risk-free rate (default 0.05 = 5%)
 */
export function calculateDailySharpeRatio(
  dailyReturns: number[],
  riskFreeRate: number = 0
): number {
  if (dailyReturns.length < 2) return 0;

  // Convert annual risk-free rate to daily
  const dailyRiskFreeRate = riskFreeRate / 252;

  // Calculate mean daily return
  const meanReturn =
    dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // Calculate standard deviation of daily returns
  const variance =
    dailyReturns.reduce((sum, r) => {
      const diff = r - meanReturn;
      return sum + diff * diff;
    }, 0) /
    (dailyReturns.length - 1); // Use N-1 for sample std dev

  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Sharpe ratio annualized
  const sharpe = ((meanReturn - dailyRiskFreeRate) / stdDev) * Math.sqrt(252);

  return Number(sharpe.toFixed(2));
}

/**
 * Calculates Sortino ratio using proper daily returns
 *
 * Sortino = (Mean Daily Return - Risk-Free Rate) / Downside StdDev * sqrt(252)
 *
 * Uses only negative returns for downside deviation
 *
 * @param dailyReturns - Array of daily returns as decimals
 * @param riskFreeRate - Annual risk-free rate (default 0.05 = 5%)
 */
export function calculateDailySortinoRatio(
  dailyReturns: number[],
  riskFreeRate: number = 0
): number {
  if (dailyReturns.length < 2) return 0;

  // Convert annual risk-free rate to daily
  const dailyRiskFreeRate = riskFreeRate / 252;

  // Calculate mean daily return
  const meanReturn =
    dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

  // Calculate downside deviation (only negative returns below target)
  const target = dailyRiskFreeRate;
  const downsideReturns = dailyReturns.filter(r => r < target);

  if (downsideReturns.length === 0) {
    // No downside, return high positive value
    return meanReturn > dailyRiskFreeRate ? 99.99 : 0;
  }

  const downsideVariance =
    downsideReturns.reduce((sum, r) => {
      const diff = r - target;
      return sum + diff * diff;
    }, 0) / downsideReturns.length;

  const downsideStdDev = Math.sqrt(downsideVariance);

  if (downsideStdDev === 0) return 0;

  // Sortino ratio annualized
  const sortino =
    ((meanReturn - dailyRiskFreeRate) / downsideStdDev) * Math.sqrt(252);

  return Number(sortino.toFixed(2));
}

/**
 * Calculates maximum drawdown from daily equity curve
 *
 * @param dailyCurve - Array of daily equity points
 * @returns Object with max drawdown percentage and dollar amount
 */
export function calculateDailyMaxDrawdown(dailyCurve: DailyEquityPoint[]): {
  percentage: number;
  dollars: number;
  peakDate: Date | null;
  troughDate: Date | null;
} {
  if (dailyCurve.length === 0) {
    return { percentage: 0, dollars: 0, peakDate: null, troughDate: null };
  }

  let peak = dailyCurve[0].equity;
  let peakDate = dailyCurve[0].date;
  let maxDrawdownPct = 0;
  let maxDrawdownDollars = 0;
  let maxDrawdownPeakDate = dailyCurve[0].date;
  let maxDrawdownTroughDate = dailyCurve[0].date;

  for (const point of dailyCurve) {
    if (point.equity > peak) {
      peak = point.equity;
      peakDate = point.date;
    }

    const drawdownDollars = peak - point.equity;
    const drawdownPct = peak > 0 ? drawdownDollars / peak : 0;

    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct;
      maxDrawdownDollars = drawdownDollars;
      maxDrawdownPeakDate = peakDate;
      maxDrawdownTroughDate = point.date;
    }
  }

  return {
    percentage: Number((maxDrawdownPct * 100).toFixed(2)),
    dollars: Number(maxDrawdownDollars.toFixed(2)),
    peakDate: maxDrawdownPeakDate,
    troughDate: maxDrawdownTroughDate,
  };
}

/**
 * Calculates Calmar ratio using daily equity curve
 *
 * Calmar = Annualized Return / Max Drawdown
 *
 * @param annualizedReturn - Annualized return as percentage
 * @param maxDrawdown - Max drawdown as percentage
 */
export function calculateCalmarRatio(
  annualizedReturn: number,
  maxDrawdown: number
): number {
  if (maxDrawdown === 0) return 0;
  return Number((annualizedReturn / maxDrawdown).toFixed(2));
}

/**
 * Calculates annualized return from daily equity curve
 *
 * @param totalReturn - Total return as decimal (0.5 = 50%)
 * @param tradingDays - Number of trading days
 */
export function calculateAnnualizedReturn(
  totalReturn: number,
  tradingDays: number
): number {
  if (tradingDays === 0) return 0;

  // Annualize based on 252 trading days per year
  const years = tradingDays / 252;
  if (years === 0) return 0;

  // Compound annual growth rate
  const annualized = Math.pow(1 + totalReturn, 1 / years) - 1;

  return Number((annualized * 100).toFixed(2));
}
