/**
 * Portfolio Analytics Engine
 * Comprehensive calculations for trading strategy performance metrics
 */

import {
  calculateDailyEquityCurve as calculateDailyEquityCurveSync,
  calculateDailySharpeRatio as calculateDailySharpeRatioSync,
  calculateDailySortinoRatio as calculateDailySortinoRatioSync,
} from "./core/dailyEquityCurve";

export interface Trade {
  id: number;
  strategyId: number;
  entryDate: Date;
  exitDate: Date;
  direction: string;
  entryPrice: number; // in cents
  exitPrice: number; // in cents
  quantity: number;
  pnl: number; // in cents
  pnlPercent: number; // in basis points (10000 = 1%)
  commission: number; // in cents
}

export interface BenchmarkData {
  date: Date;
  close: number; // in cents
}

export interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // percentage
  averageTradePnL: number; // dollars
  medianTradePnL: number; // dollars
  bestTradePnL: number; // dollars
  worstTradePnL: number; // dollars
  profitFactor: number;
  expectancyPnL: number; // dollars per trade
  expectancyPct: number; // percentage per trade
  averageHoldingTimeMinutes: number;
  medianHoldingTimeMinutes: number;
  longestWinStreak: number;
  longestLossStreak: number;
  avgWin: number; // dollars
  avgLoss: number; // dollars
  // Professional risk metrics
  payoffRatio: number; // avgWin / avgLoss
  riskOfRuin: number; // percentage
  riskOfRuinDetails: {
    // NEW: Detailed RoR breakdown
    capitalUnits: number; // Account balance / avg loss
    tradingAdvantage: number; // (WinRate * PayoffRatio - LossRate) / PayoffRatio
    minBalanceForZeroRisk: number; // Minimum balance for <0.01% RoR (mini contracts)
    minBalanceForZeroRiskMicro: number; // Minimum balance for <0.01% RoR (micro contracts - 1/10th size)
  } | null;
  kellyPercentage: number; // optimal position size
  recoveryFactor: number; // net profit / max drawdown
  ulcerIndex: number; // volatility of drawdowns
  marRatio: number; // return / max drawdown
  monthlyConsistency: number; // percentage of profitable months
  quarterlyConsistency: number; // percentage of profitable quarters
}

export interface PerformanceMetrics {
  totalReturn: number; // percentage
  annualizedReturn: number; // percentage
  sharpeRatio: number; // Daily-based (industry standard)
  sortinoRatio: number; // Daily-based (industry standard)
  tradeBasedSharpe: number; // Trade-to-trade based (legacy)
  tradeBasedSortino: number; // Trade-to-trade based (legacy)
  calmarRatio: number; // Calmar ratio
  maxDrawdown: number; // percentage
  maxDrawdownDollars: number; // Max drawdown in dollars (peak to trough)
  winRate: number; // percentage
  profitFactor: number;
  avgWin: number; // dollars
  avgLoss: number; // dollars
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  tradingDays: number; // Number of trading days in period
  tradeStats: TradeStats; // Enhanced trade statistics
}

export interface EquityPoint {
  date: Date;
  equity: number; // in dollars
  drawdown: number; // percentage
}

/**
 * Calculate equity curve from trades (mini contracts only)
 * Uses fixed dollar P&L - suitable for unleveraged strategies
 * @param trades Array of trades
 * @param startingCapital Starting capital in dollars
 */
export function calculateEquityCurve(
  trades: Trade[],
  startingCapital: number = 100000,
  baseCapital: number = 100000 // Base capital for drawdown % calculation (default $100K for mini contracts)
): EquityPoint[] {
  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  const points: EquityPoint[] = [];
  let equity = startingCapital;
  let peak = startingCapital;

  // Track P&L relative to base capital for consistent drawdown calculation
  // This ensures drawdowns are calculated as % of the backtest capital ($100K)
  // not the user's starting capital, matching the leveraged mode behavior
  let basePnL = 0; // Cumulative P&L in dollars
  let basePeak = 0; // Peak P&L in dollars

  // Add starting point
  if (sortedTrades.length > 0) {
    points.push({
      date: sortedTrades[0]!.entryDate,
      equity: startingCapital,
      drawdown: 0,
    });
  }

  for (const trade of sortedTrades) {
    // Convert P&L from cents to dollars (mini contracts)
    const pnlDollars = trade.pnl / 100;
    equity += pnlDollars;
    peak = Math.max(peak, equity);

    // Track P&L for base capital drawdown calculation
    basePnL += pnlDollars;
    basePeak = Math.max(basePeak, basePnL);

    // Calculate drawdown as percentage of base capital (not user's starting capital)
    // This gives consistent drawdown percentages regardless of account size
    // e.g., a $10K drawdown is always -10% (relative to $100K base), not -100% (relative to $10K account)
    const drawdownDollars = basePeak - basePnL;
    const drawdown =
      baseCapital > 0 ? (drawdownDollars / baseCapital) * 100 : 0;

    points.push({
      date: trade.exitDate,
      equity,
      drawdown,
    });
  }

  return points;
}

/**
 * Calculate equity curve using percentage returns (leveraged strategies)
 * Calculates P&L as percentage of base capital, then compounds with user's starting capital
 * This simulates scaling position size proportionally with account size
 * @param trades Array of trades
 * @param startingCapital Starting capital in dollars (user's account size)
 * @param baseCapital Base capital used for calculating percentage returns (default $100K for mini contracts)
 */
export function calculateLeveragedEquityCurve(
  trades: Trade[],
  startingCapital: number = 10000,
  baseCapital: number = 100000 // The capital the original P&L was calculated on (1 mini contract)
): EquityPoint[] {
  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  const points: EquityPoint[] = [];
  let equity = startingCapital;
  let peak = startingCapital;

  // Add starting point
  if (sortedTrades.length > 0) {
    points.push({
      date: sortedTrades[0]!.entryDate,
      equity: startingCapital,
      drawdown: 0,
    });
  }

  for (const trade of sortedTrades) {
    // Convert P&L from cents to dollars
    const pnlDollars = trade.pnl / 100;

    // Calculate percentage return relative to base capital
    // This represents the return if trading 1 mini contract with $100K
    const pnlPercent = pnlDollars / baseCapital;

    // Apply the percentage return to current equity (compounding)
    // This scales the return proportionally to the user's account size
    equity = equity * (1 + pnlPercent);
    peak = Math.max(peak, equity);
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;

    points.push({
      date: trade.exitDate,
      equity,
      drawdown,
    });
  }

  return points;
}

/**
 * Recalculate drawdowns in an equity curve using a specific peak value
 * This is used to calculate drawdowns relative to all-time peak, not just peak within the time range
 */
export function recalculateDrawdownsWithPeak(
  equityCurve: EquityPoint[],
  allTimePeak: number
): EquityPoint[] {
  return equityCurve.map(point => ({
    ...point,
    drawdown:
      allTimePeak > 0 ? ((allTimePeak - point.equity) / allTimePeak) * 100 : 0,
  }));
}

/**
 * Forward-fill equity curve to create continuous daily series
 */
export function forwardFillEquityCurve(
  points: EquityPoint[],
  startDate: Date,
  endDate: Date
): EquityPoint[] {
  if (points.length === 0) return [];

  const filled: EquityPoint[] = [];
  let currentIndex = 0;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const currentDate = new Date(d);

    // Find the most recent point before or on this date
    while (
      currentIndex < points.length - 1 &&
      points[currentIndex + 1]!.date <= currentDate
    ) {
      currentIndex++;
    }

    // Use the current point if it's on or before this date
    // Otherwise, if we haven't reached the first point yet, skip this date
    const point = points[currentIndex];
    if (point && point.date <= currentDate) {
      filled.push({
        date: new Date(currentDate),
        equity: point.equity,
        drawdown: point.drawdown,
      });
    }
  }

  return filled;
}

/**
 * Calculate enhanced trade statistics
 */
export function calculateTradeStats(
  trades: Trade[],
  startingCapital: number = 100000
): TradeStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageTradePnL: 0,
      medianTradePnL: 0,
      bestTradePnL: 0,
      worstTradePnL: 0,
      profitFactor: 0,
      expectancyPnL: 0,
      expectancyPct: 0,
      averageHoldingTimeMinutes: 0,
      medianHoldingTimeMinutes: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      avgWin: 0,
      avgLoss: 0,
      payoffRatio: 0,
      riskOfRuin: 100,
      riskOfRuinDetails: null,
      kellyPercentage: 0,
      recoveryFactor: 0,
      ulcerIndex: 0,
      marRatio: 0,
      monthlyConsistency: 0,
      quarterlyConsistency: 0,
    };
  }

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  // P&L statistics
  const pnlValues = trades.map(t => t.pnl / 100); // Convert to dollars
  const sortedPnl = [...pnlValues].sort((a, b) => a - b);
  const averageTradePnL =
    pnlValues.reduce((sum, p) => sum + p, 0) / pnlValues.length;
  const medianTradePnL = sortedPnl[Math.floor(sortedPnl.length / 2)]!;
  const bestTradePnL = Math.max(...pnlValues);
  const worstTradePnL = Math.min(...pnlValues);

  // Profit factor
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)
  );
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Average win/loss
  const avgWin =
    winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss =
    losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  // Expectancy
  const expectancyPnL =
    avgWin * (winRate / 100) - avgLoss * ((100 - winRate) / 100);

  // Expectancy percentage (based on average trade size)
  const avgTradeSize = Math.abs(averageTradePnL);
  const expectancyPct =
    avgTradeSize > 0 ? (expectancyPnL / avgTradeSize) * 100 : 0;

  // Holding time statistics
  const holdingTimes = trades.map(t => {
    const entryTime = t.entryDate.getTime();
    const exitTime = t.exitDate.getTime();
    return (exitTime - entryTime) / (1000 * 60); // Minutes
  });
  const averageHoldingTimeMinutes =
    holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length;
  const sortedHoldingTimes = [...holdingTimes].sort((a, b) => a - b);
  const medianHoldingTimeMinutes =
    sortedHoldingTimes[Math.floor(sortedHoldingTimes.length / 2)]!;

  // Win/Loss streaks
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );
  for (const trade of sortedTrades) {
    if (trade.pnl > 0) {
      currentWinStreak++;
      currentLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
    } else if (trade.pnl < 0) {
      currentLossStreak++;
      currentWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
    }
  }

  // Professional risk metrics
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Risk of Ruin with detailed breakdown
  // Formula: RoR = ((1 - A) / (1 + A))^U
  // where A = trading advantage, U = capital units
  const winProb = winRate / 100;
  const lossProb = 1 - winProb;

  let riskOfRuin = 100;
  let riskOfRuinDetails: TradeStats["riskOfRuinDetails"] = null;

  if (payoffRatio > 0 && winProb > 0 && avgLoss > 0) {
    // Trading Advantage: A = (WinRate * PayoffRatio - LossRate) / PayoffRatio
    const tradingAdvantage = (winProb * payoffRatio - lossProb) / payoffRatio;

    // Capital Units: U = Account Balance / Average Loss
    const capitalUnits = startingCapital / avgLoss;

    // Calculate RoR
    if (tradingAdvantage > 0) {
      // Positive expectancy: RoR approaches 0 as capital units increase
      riskOfRuin =
        Math.pow(
          (1 - tradingAdvantage) / (1 + tradingAdvantage),
          capitalUnits
        ) * 100;
    } else if (tradingAdvantage < 0) {
      // Negative expectancy: RoR is 100%
      riskOfRuin = 100;
    } else {
      // Zero expectancy: RoR is 50%
      riskOfRuin = 50;
    }

    // Calculate minimum balance for <0.01% RoR
    // This needs to account for BOTH the mathematical RoR formula AND the historical max drawdown
    // The true minimum should be the MAX of both to ensure survival

    // First, calculate the equity curve to get max drawdown in dollars
    const tempEquityCurve = calculateEquityCurve(trades, startingCapital);
    let tempPeak = startingCapital;
    let maxDrawdownDollars = 0;
    for (const point of tempEquityCurve) {
      tempPeak = Math.max(tempPeak, point.equity);
      const dd = tempPeak - point.equity;
      maxDrawdownDollars = Math.max(maxDrawdownDollars, dd);
    }

    // Margin requirements (approximate IBKR values for portfolio of futures)
    const marginMini = 5000; // Approximate margin for mini contracts
    const marginMicro = 500; // Approximate margin for micro contracts

    let minBalanceForZeroRisk = 0;
    let minBalanceForZeroRiskMicro = 0;

    if (tradingAdvantage > 0) {
      // Solve for U where RoR = 0.0001 (0.01%)
      // 0.0001 = ((1-A)/(1+A))^U
      // U = ln(0.0001) / ln((1-A)/(1+A))
      const targetRoR = 0.0001;
      const requiredUnits =
        Math.log(targetRoR) /
        Math.log((1 - tradingAdvantage) / (1 + tradingAdvantage));

      // Mathematical RoR-based minimum
      const rorBasedMinMini = requiredUnits * avgLoss;
      const rorBasedMinMicro = requiredUnits * (avgLoss / 10);

      // Drawdown-based minimum (max drawdown + margin requirement)
      const ddBasedMinMini = maxDrawdownDollars + marginMini;
      const ddBasedMinMicro = maxDrawdownDollars / 10 + marginMicro;

      // Take the MAX of both to ensure true 0% risk of ruin
      minBalanceForZeroRisk = Math.max(rorBasedMinMini, ddBasedMinMini);
      minBalanceForZeroRiskMicro = Math.max(rorBasedMinMicro, ddBasedMinMicro);
    } else {
      // If no positive edge, minimum is just max drawdown + margin
      minBalanceForZeroRisk = maxDrawdownDollars + marginMini;
      minBalanceForZeroRiskMicro = maxDrawdownDollars / 10 + marginMicro;
    }

    riskOfRuinDetails = {
      capitalUnits,
      tradingAdvantage,
      minBalanceForZeroRisk,
      minBalanceForZeroRiskMicro,
    };
  }

  // Kelly Criterion: f* = (p * b - q) / b, where p = win rate, q = loss rate, b = payoff ratio
  const kellyPercentage =
    payoffRatio > 0
      ? Math.max(0, ((winProb * payoffRatio - lossProb) / payoffRatio) * 100)
      : 0;

  // Calculate equity curve for additional metrics
  const equityCurve = calculateEquityCurve(trades, 100000);
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || 100000;
  const netProfit = finalEquity - 100000;

  // Max drawdown in dollars
  let peak = 100000;
  let maxDD = 0;
  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);
    const dd = peak - point.equity;
    maxDD = Math.max(maxDD, dd);
  }

  // Recovery Factor: Net Profit / Max Drawdown
  const recoveryFactor = maxDD > 0 ? netProfit / maxDD : 0;

  // Ulcer Index: sqrt(mean(drawdown^2))
  const drawdownSquares = equityCurve.map(p => Math.pow(p.drawdown, 2));
  const meanDrawdownSquare =
    drawdownSquares.reduce((sum, d) => sum + d, 0) / drawdownSquares.length;
  const ulcerIndex = Math.sqrt(meanDrawdownSquare);

  // MAR Ratio: Annualized Return / Max Drawdown %
  const totalDays =
    equityCurve.length > 0
      ? (equityCurve[equityCurve.length - 1]!.date.getTime() -
          equityCurve[0]!.date.getTime()) /
        (1000 * 60 * 60 * 24)
      : 1;
  const totalReturnPct = ((finalEquity - 100000) / 100000) * 100;
  const annualizedReturn =
    (Math.pow(1 + totalReturnPct / 100, 365 / totalDays) - 1) * 100;
  const maxDrawdownPct = equityCurve.reduce(
    (max, p) => Math.max(max, p.drawdown),
    0
  );
  const marRatio = maxDrawdownPct > 0 ? annualizedReturn / maxDrawdownPct : 0;

  // Monthly/Quarterly consistency
  const monthlyPnL = new Map<string, number>();
  const quarterlyPnL = new Map<string, number>();

  for (const trade of trades) {
    const monthKey = `${trade.exitDate.getFullYear()}-${String(trade.exitDate.getMonth() + 1).padStart(2, "0")}`;
    const quarter = Math.floor(trade.exitDate.getMonth() / 3) + 1;
    const quarterKey = `${trade.exitDate.getFullYear()}-Q${quarter}`;

    monthlyPnL.set(monthKey, (monthlyPnL.get(monthKey) || 0) + trade.pnl / 100);
    quarterlyPnL.set(
      quarterKey,
      (quarterlyPnL.get(quarterKey) || 0) + trade.pnl / 100
    );
  }

  const profitableMonths = Array.from(monthlyPnL.values()).filter(
    p => p > 0
  ).length;
  const profitableQuarters = Array.from(quarterlyPnL.values()).filter(
    p => p > 0
  ).length;
  const monthlyConsistency =
    monthlyPnL.size > 0 ? (profitableMonths / monthlyPnL.size) * 100 : 0;
  const quarterlyConsistency =
    quarterlyPnL.size > 0 ? (profitableQuarters / quarterlyPnL.size) * 100 : 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    averageTradePnL,
    medianTradePnL,
    bestTradePnL,
    worstTradePnL,
    profitFactor,
    expectancyPnL,
    expectancyPct,
    averageHoldingTimeMinutes,
    medianHoldingTimeMinutes,
    longestWinStreak,
    longestLossStreak,
    avgWin,
    avgLoss,
    payoffRatio,
    riskOfRuin,
    riskOfRuinDetails,
    kellyPercentage,
    recoveryFactor,
    ulcerIndex,
    marRatio,
    monthlyConsistency,
    quarterlyConsistency,
  };
}

/**
 * Calculate comprehensive performance metrics (mini contracts only)
 * @param trades Array of trades
 * @param startingCapital Starting capital in dollars
 * @param daysInPeriod Optional period length in days
 */
export function calculatePerformanceMetrics(
  trades: Trade[],
  startingCapital: number = 100000,
  daysInPeriod?: number
): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      tradeBasedSharpe: 0,
      tradeBasedSortino: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDollars: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      tradingDays: 0,
      tradeStats: calculateTradeStats([], startingCapital),
    };
  }

  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  // Calculate total P&L (mini contracts)
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl / 100, 0);
  const totalReturn = (totalPnl / startingCapital) * 100;

  // Calculate period length in years
  const firstDate = sortedTrades[0]!.exitDate;
  const lastDate = sortedTrades[sortedTrades.length - 1]!.exitDate;
  const daysElapsed =
    daysInPeriod ||
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  const yearsElapsed = daysElapsed / 365.25;

  // Annualized return
  const annualizedReturn =
    yearsElapsed > 0
      ? (Math.pow(1 + totalReturn / 100, 1 / yearsElapsed) - 1) * 100
      : totalReturn;

  // Win/Loss statistics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)
  );
  const avgWin =
    winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss =
    losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  // Calculate equity curve for drawdown (trade-by-trade for display)
  const equityCurve = calculateEquityCurve(trades, startingCapital);
  const maxDrawdown = Math.max(...equityCurve.map(p => p.drawdown), 0);

  // Calculate max drawdown in dollars (peak to trough)
  let maxEquity = equityCurve[0].equity;
  let maxDrawdownDollars = 0;
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity;
    }
    const drawdownDollars = maxEquity - point.equity;
    if (drawdownDollars > maxDrawdownDollars) {
      maxDrawdownDollars = drawdownDollars;
    }
  }

  // ============================================================
  // TRADE-BASED SHARPE/SORTINO (Legacy - for comparison)
  // Uses trade-to-trade returns (not industry standard)
  // ============================================================
  const tradeReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1]!.equity;
    const currEquity = equityCurve[i]!.equity;
    const tradeReturn = (currEquity - prevEquity) / prevEquity;
    tradeReturns.push(tradeReturn);
  }

  const avgTradeReturn =
    tradeReturns.length > 0
      ? tradeReturns.reduce((sum, r) => sum + r, 0) / tradeReturns.length
      : 0;

  const tradeStdDev =
    tradeReturns.length > 1
      ? Math.sqrt(
          tradeReturns.reduce(
            (sum, r) => sum + Math.pow(r - avgTradeReturn, 2),
            0
          ) /
            (tradeReturns.length - 1)
        )
      : 0;

  const tradeBasedSharpe =
    tradeStdDev > 0 ? (avgTradeReturn / tradeStdDev) * Math.sqrt(252) : 0;

  const downsideTradeReturns = tradeReturns.filter(r => r < 0);
  const downsideTradeStdDev =
    downsideTradeReturns.length > 1
      ? Math.sqrt(
          downsideTradeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
            (downsideTradeReturns.length - 1)
        )
      : 0;

  const tradeBasedSortino =
    downsideTradeStdDev > 0
      ? (avgTradeReturn / downsideTradeStdDev) * Math.sqrt(252)
      : tradeBasedSharpe;

  // ============================================================
  // INDUSTRY-STANDARD SHARPE/SORTINO CALCULATION
  // Uses proper daily equity curve with forward-filling
  // ============================================================

  // Calculate proper daily equity curve
  const dailyEquityResult = calculateDailyEquityCurveSync(
    trades,
    startingCapital
  );

  // Use proper daily returns for Sharpe/Sortino
  const sharpeRatio = calculateDailySharpeRatioSync(
    dailyEquityResult.dailyReturns
  );
  const sortinoRatio = calculateDailySortinoRatioSync(
    dailyEquityResult.dailyReturns
  );

  // Calmar ratio: annualized return / max drawdown
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  // Calculate enhanced trade statistics
  const tradeStats = calculateTradeStats(trades, startingCapital);

  return {
    totalReturn,
    annualizedReturn,
    sharpeRatio,
    sortinoRatio,
    tradeBasedSharpe: Number(tradeBasedSharpe.toFixed(2)),
    tradeBasedSortino: Number(tradeBasedSortino.toFixed(2)),
    calmarRatio,
    maxDrawdown,
    maxDrawdownDollars,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    tradingDays: dailyEquityResult.tradingDays,
    tradeStats,
  };
}

/**
 * Calculate comprehensive performance metrics for leveraged strategies
 * Uses pnlPercent for compounding returns instead of fixed dollar P&L
 * @param trades Array of trades
 * @param startingCapital Starting capital in dollars
 * @param daysInPeriod Optional period length in days
 */
export function calculateLeveragedPerformanceMetrics(
  trades: Trade[],
  startingCapital: number = 10000,
  daysInPeriod?: number
): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      tradeBasedSharpe: 0,
      tradeBasedSortino: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDollars: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      tradingDays: 0,
      tradeStats: calculateTradeStats([], startingCapital),
    };
  }

  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  // Calculate equity curve using percentage returns (leveraged)
  const equityCurve = calculateLeveragedEquityCurve(trades, startingCapital);
  const finalEquity = equityCurve[equityCurve.length - 1]!.equity;
  const totalReturn = ((finalEquity - startingCapital) / startingCapital) * 100;

  // Calculate period length in years
  const firstDate = sortedTrades[0]!.exitDate;
  const lastDate = sortedTrades[sortedTrades.length - 1]!.exitDate;
  const daysElapsed =
    daysInPeriod ||
    (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  const yearsElapsed = daysElapsed / 365.25;

  // Annualized return (using CAGR formula)
  const annualizedReturn =
    yearsElapsed > 0
      ? (Math.pow(finalEquity / startingCapital, 1 / yearsElapsed) - 1) * 100
      : totalReturn;

  // Win/Loss statistics using pnl (since pnlPercent may be 0 in database)
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  // Calculate avg win/loss in dollars, then convert to percentage of starting capital
  const avgWinDollars =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl / 100, 0) /
        winningTrades.length
      : 0;
  const avgLossDollars =
    losingTrades.length > 0
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)) /
        losingTrades.length
      : 0;

  // These are the actual dollar amounts
  const avgWin = avgWinDollars;
  const avgLoss = avgLossDollars;

  const totalWinsDollars = winningTrades.reduce(
    (sum, t) => sum + t.pnl / 100,
    0
  );
  const totalLossesDollars = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)
  );
  const profitFactor =
    totalLossesDollars > 0
      ? totalWinsDollars / totalLossesDollars
      : totalWinsDollars > 0
        ? Infinity
        : 0;

  // Max drawdown from equity curve (already calculated as % from peak)
  const maxDrawdown = Math.max(...equityCurve.map(p => p.drawdown), 0);

  // Calculate max drawdown in dollars (peak to trough)
  let maxEquity = equityCurve[0]!.equity;
  let maxDrawdownDollars = 0;
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity;
    }
    const drawdownDollars = maxEquity - point.equity;
    if (drawdownDollars > maxDrawdownDollars) {
      maxDrawdownDollars = drawdownDollars;
    }
  }

  // Trade-based Sharpe/Sortino using percentage returns
  const tradeReturns = trades.map(t => t.pnlPercent / 10000);
  const avgTradeReturn =
    tradeReturns.reduce((sum, r) => sum + r, 0) / tradeReturns.length;

  const tradeStdDev =
    tradeReturns.length > 1
      ? Math.sqrt(
          tradeReturns.reduce(
            (sum, r) => sum + Math.pow(r - avgTradeReturn, 2),
            0
          ) /
            (tradeReturns.length - 1)
        )
      : 0;

  const tradeBasedSharpe =
    tradeStdDev > 0 ? (avgTradeReturn / tradeStdDev) * Math.sqrt(252) : 0;

  const downsideTradeReturns = tradeReturns.filter(r => r < 0);
  const downsideTradeStdDev =
    downsideTradeReturns.length > 1
      ? Math.sqrt(
          downsideTradeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
            (downsideTradeReturns.length - 1)
        )
      : 0;

  const tradeBasedSortino =
    downsideTradeStdDev > 0
      ? (avgTradeReturn / downsideTradeStdDev) * Math.sqrt(252)
      : tradeBasedSharpe;

  // Daily Sharpe/Sortino (use trade-based for leveraged since daily returns compound)
  const sharpeRatio = tradeBasedSharpe;
  const sortinoRatio = tradeBasedSortino;

  // Calmar ratio: annualized return / max drawdown
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  // Calculate enhanced trade statistics (using leveraged metrics)
  const tradeStats = calculateLeveragedTradeStats(trades, startingCapital);

  return {
    totalReturn,
    annualizedReturn,
    sharpeRatio,
    sortinoRatio,
    tradeBasedSharpe: Number(tradeBasedSharpe.toFixed(2)),
    tradeBasedSortino: Number(tradeBasedSortino.toFixed(2)),
    calmarRatio,
    maxDrawdown,
    maxDrawdownDollars,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    tradingDays: Math.ceil(daysElapsed),
    tradeStats,
  };
}

/**
 * Calculate trade statistics for leveraged strategies using pnlPercent
 */
function calculateLeveragedTradeStats(
  trades: Trade[],
  startingCapital: number
): TradeStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageTradePnL: 0,
      medianTradePnL: 0,
      bestTradePnL: 0,
      worstTradePnL: 0,
      profitFactor: 0,
      expectancyPnL: 0,
      expectancyPct: 0,
      averageHoldingTimeMinutes: 0,
      medianHoldingTimeMinutes: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      avgWin: 0,
      avgLoss: 0,
      payoffRatio: 0,
      riskOfRuin: 0,
      riskOfRuinDetails: null,
      kellyPercentage: 0,
      recoveryFactor: 0,
      ulcerIndex: 0,
      marRatio: 0,
      monthlyConsistency: 0,
      quarterlyConsistency: 0,
    };
  }

  // Calculate pnlPercent from pnl if pnlPercent is 0 (legacy data)
  // For leveraged mode, we calculate the percentage based on the base capital ($100K for mini contracts)
  const BASE_CAPITAL = 100000; // Base capital used in backtest
  const pnlPercentages = trades.map(t => {
    if (t.pnlPercent !== 0) {
      return t.pnlPercent / 10000; // Convert stored value to decimal
    }
    // Calculate from pnl: pnl is in cents, so convert to dollars first
    const pnlDollars = t.pnl / 100;
    return pnlDollars / BASE_CAPITAL; // Percentage as decimal
  });
  const pnlDollars = pnlPercentages.map(p => p * startingCapital); // Convert to dollars for display

  // Use pnl for win/loss determination since pnlPercent may be 0
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = (winningTrades.length / trades.length) * 100;

  const sortedPnl = [...pnlDollars].sort((a, b) => a - b);
  const medianPnl =
    sortedPnl.length % 2 === 0
      ? (sortedPnl[sortedPnl.length / 2 - 1]! +
          sortedPnl[sortedPnl.length / 2]!) /
        2
      : sortedPnl[Math.floor(sortedPnl.length / 2)]!;

  // Calculate avgWin and avgLoss using pnl (since pnlPercent may be 0)
  const avgWinPct =
    winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + t.pnl / 100 / BASE_CAPITAL, 0) /
        winningTrades.length
      : 0;
  const avgLossPct =
    losingTrades.length > 0
      ? Math.abs(
          losingTrades.reduce((sum, t) => sum + t.pnl / 100 / BASE_CAPITAL, 0)
        ) / losingTrades.length
      : 0;

  const avgWin = avgWinPct * startingCapital;
  const avgLoss = avgLossPct * startingCapital;

  // Calculate profit factor using pnl
  const totalWinsPct = winningTrades.reduce(
    (sum, t) => sum + t.pnl / 100 / BASE_CAPITAL,
    0
  );
  const totalLossesPct = Math.abs(
    losingTrades.reduce((sum, t) => sum + t.pnl / 100 / BASE_CAPITAL, 0)
  );
  const profitFactor =
    totalLossesPct > 0
      ? totalWinsPct / totalLossesPct
      : totalWinsPct > 0
        ? Infinity
        : 0;

  // Expectancy in percentage terms
  const expectancyPct =
    (pnlPercentages.reduce((sum, p) => sum + p, 0) / trades.length) * 100;
  const expectancyPnL = (expectancyPct / 100) * startingCapital;

  // Holding times
  const holdingTimes = trades.map(
    t => (t.exitDate.getTime() - t.entryDate.getTime()) / (1000 * 60)
  );
  const avgHoldingTime =
    holdingTimes.reduce((sum, t) => sum + t, 0) / holdingTimes.length;
  const sortedHoldingTimes = [...holdingTimes].sort((a, b) => a - b);
  const medianHoldingTime =
    sortedHoldingTimes.length % 2 === 0
      ? (sortedHoldingTimes[sortedHoldingTimes.length / 2 - 1]! +
          sortedHoldingTimes[sortedHoldingTimes.length / 2]!) /
        2
      : sortedHoldingTimes[Math.floor(sortedHoldingTimes.length / 2)]!;

  // Win/Loss streaks
  let currentWinStreak = 0,
    maxWinStreak = 0;
  let currentLossStreak = 0,
    maxLossStreak = 0;
  for (const trade of trades) {
    // Use pnl instead of pnlPercent since pnlPercent may be 0
    if (trade.pnl > 0) {
      currentWinStreak++;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      currentLossStreak = 0;
    } else if (trade.pnl < 0) {
      currentLossStreak++;
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      currentWinStreak = 0;
    }
  }

  // Professional metrics
  const payoffRatio =
    avgLossPct > 0 ? avgWinPct / avgLossPct : avgWinPct > 0 ? Infinity : 0;
  const kellyPercentage =
    payoffRatio > 0
      ? (winRate / 100 - (1 - winRate / 100) / payoffRatio) * 100
      : 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    averageTradePnL: pnlDollars.reduce((sum, p) => sum + p, 0) / trades.length,
    medianTradePnL: medianPnl,
    bestTradePnL: Math.max(...pnlDollars),
    worstTradePnL: Math.min(...pnlDollars),
    profitFactor,
    expectancyPnL,
    expectancyPct,
    averageHoldingTimeMinutes: avgHoldingTime,
    medianHoldingTimeMinutes: medianHoldingTime,
    longestWinStreak: maxWinStreak,
    longestLossStreak: maxLossStreak,
    avgWin,
    avgLoss,
    payoffRatio,
    riskOfRuin: 0, // Simplified for leveraged
    riskOfRuinDetails: null,
    kellyPercentage,
    recoveryFactor: 0, // Calculate if needed
    ulcerIndex: 0, // Calculate if needed
    marRatio: 0, // Calculate if needed
    monthlyConsistency: 0, // Calculate if needed
    quarterlyConsistency: 0, // Calculate if needed
  };
}

/**
 * Calculate benchmark equity curve from OHLC data
 */
export function calculateBenchmarkEquityCurve(
  benchmarkData: BenchmarkData[],
  startingCapital: number = 100000
): EquityPoint[] {
  if (benchmarkData.length === 0) return [];

  const sorted = [...benchmarkData].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const startPrice = sorted[0]!.close / 100; // Convert cents to dollars
  const shares = startingCapital / startPrice;

  return sorted.map(data => {
    const price = data.close / 100;
    const equity = shares * price;
    return {
      date: data.date,
      equity,
      drawdown: 0, // Calculate separately if needed
    };
  });
}

/**
 * Calculate Pearson correlation between two equity curves
 * Uses daily returns and filters out days where both strategies have zero return
 * (which happens with forward-filled curves when no trades occur)
 */
export function calculateCorrelation(
  curve1: EquityPoint[],
  curve2: EquityPoint[]
): number {
  if (curve1.length < 2 || curve2.length < 2) {
    return 0;
  }

  // Build a date-aligned map of returns (P&L changes)
  // For sparse equity curves, we need to aggregate by week or month
  // to get enough overlapping data points
  const weeklyReturns1 = new Map<string, number>();
  const weeklyReturns2 = new Map<string, number>();

  // Helper to get week key from date
  const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    // Get the Monday of the week
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split("T")[0]!;
  };

  // Calculate weekly returns for curve1
  for (let i = 1; i < curve1.length; i++) {
    const prevEquity = curve1[i - 1]!.equity;
    if (prevEquity > 0) {
      const r = (curve1[i]!.equity - prevEquity) / prevEquity;
      const weekKey = getWeekKey(curve1[i]!.date);
      // Accumulate returns for the same week
      weeklyReturns1.set(weekKey, (weeklyReturns1.get(weekKey) || 0) + r);
    }
  }

  // Calculate weekly returns for curve2
  for (let i = 1; i < curve2.length; i++) {
    const prevEquity = curve2[i - 1]!.equity;
    if (prevEquity > 0) {
      const r = (curve2[i]!.equity - prevEquity) / prevEquity;
      const weekKey = getWeekKey(curve2[i]!.date);
      weeklyReturns2.set(weekKey, (weeklyReturns2.get(weekKey) || 0) + r);
    }
  }

  // Find common weeks - for weeks where one strategy has no trades, use 0 return
  const allWeeks = new Set([
    ...Array.from(weeklyReturns1.keys()),
    ...Array.from(weeklyReturns2.keys()),
  ]);
  const returns1: number[] = [];
  const returns2: number[] = [];

  for (const week of Array.from(allWeeks).sort()) {
    const r1 = weeklyReturns1.get(week) || 0;
    const r2 = weeklyReturns2.get(week) || 0;
    // Only include weeks where at least one strategy had activity
    if (Math.abs(r1) > 1e-10 || Math.abs(r2) > 1e-10) {
      returns1.push(r1);
      returns2.push(r2);
    }
  }

  // Need at least 10 data points for meaningful correlation
  if (returns1.length < 10) return 0;

  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i]! - mean1;
    const diff2 = returns2[i]! - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2);
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Calculate correlation matrix for multiple strategies
 * @param strategiesData Map of strategy ID/name to equity curve
 * @returns Correlation matrix with labels and values
 */
export interface CorrelationMatrix {
  labels: string[];
  matrix: number[][];
}

export function calculateStrategyCorrelationMatrix(
  strategiesData: Map<string, EquityPoint[]>
): CorrelationMatrix {
  const labels = Array.from(strategiesData.keys());
  const n = labels.length;
  const matrix: number[][] = Array(n)
    .fill(0)
    .map(() => Array(n).fill(0));

  // Calculate daily returns for each strategy
  const returnsMap = new Map<string, number[]>();
  for (const [label, curve] of Array.from(strategiesData.entries())) {
    const returns: number[] = [];
    for (let i = 1; i < curve.length; i++) {
      const prevEquity = curve[i - 1]!.equity;
      const currEquity = curve[i]!.equity;
      if (prevEquity > 0) {
        returns.push((currEquity - prevEquity) / prevEquity);
      }
    }
    returnsMap.set(label, returns);
  }

  // Calculate correlation for each pair
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i]![j] = 1.0; // Perfect correlation with self
      } else {
        const returns1 = returnsMap.get(labels[i]!)!;
        const returns2 = returnsMap.get(labels[j]!)!;

        // Use minimum length to handle different curve lengths
        const minLen = Math.min(returns1.length, returns2.length);
        if (minLen === 0) {
          matrix[i]![j] = 0;
          continue;
        }

        const r1 = returns1.slice(0, minLen);
        const r2 = returns2.slice(0, minLen);

        const mean1 = r1.reduce((sum, r) => sum + r, 0) / r1.length;
        const mean2 = r2.reduce((sum, r) => sum + r, 0) / r2.length;

        let numerator = 0;
        let sumSq1 = 0;
        let sumSq2 = 0;

        for (let k = 0; k < r1.length; k++) {
          const diff1 = r1[k]! - mean1;
          const diff2 = r2[k]! - mean2;
          numerator += diff1 * diff2;
          sumSq1 += diff1 * diff1;
          sumSq2 += diff2 * diff2;
        }

        const denominator = Math.sqrt(sumSq1 * sumSq2);
        matrix[i]![j] = denominator > 0 ? numerator / denominator : 0;
      }
    }
  }

  return { labels, matrix };
}

/**
 * Filter trades by date range
 */
export function filterTradesByDateRange(
  trades: Trade[],
  startDate?: Date,
  endDate?: Date
): Trade[] {
  let filtered = trades;

  if (startDate) {
    filtered = filtered.filter(t => t.exitDate >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter(t => t.exitDate <= endDate);
  }

  return filtered;
}

/**
 * Calculate performance by time period (day, week, month, quarter, year)
 */
export interface PeriodPerformance {
  period: string;
  return: number; // percentage
  trades: number;
  winRate: number; // percentage
}

export function calculatePerformanceByPeriod(
  trades: Trade[],
  periodType: "day" | "week" | "month" | "quarter" | "year"
): PeriodPerformance[] {
  if (trades.length === 0) return [];

  const periods = new Map<string, Trade[]>();

  for (const trade of trades) {
    const date = trade.exitDate;
    let key: string;

    switch (periodType) {
      case "day":
        key = date.toISOString().split("T")[0]!;
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split("T")[0]!;
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        break;
      case "quarter":
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      case "year":
        key = String(date.getFullYear());
        break;
    }

    if (!periods.has(key)) {
      periods.set(key, []);
    }
    periods.get(key)!.push(trade);
  }

  const results: PeriodPerformance[] = [];

  for (const [period, periodTrades] of Array.from(periods.entries())) {
    const totalPnl = periodTrades.reduce(
      (sum: number, t: Trade) => sum + t.pnl / 100,
      0
    );
    const winningTrades = periodTrades.filter((t: Trade) => t.pnl > 0).length;
    const winRate = (winningTrades / periodTrades.length) * 100;

    results.push({
      period,
      return: totalPnl, // This would need starting capital context for percentage
      trades: periodTrades.length,
      winRate,
    });
  }

  return results.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Time Period Performance Interface
 */
export interface TimePeriodPerformance {
  period: string;
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  startDate: Date;
  endDate: Date;
  trades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  returnPercent: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

export interface PerformanceBreakdownData {
  daily: TimePeriodPerformance[];
  weekly: TimePeriodPerformance[];
  monthly: TimePeriodPerformance[];
  quarterly: TimePeriodPerformance[];
  yearly: TimePeriodPerformance[];
}

/**
 * Calculate performance breakdown by time periods
 * @param trades Array of trades
 * @param startingCapital Starting capital in dollars
 * @param contractSize Target contract size (mini or micro)
 * @param conversionRatio Micro-to-mini ratio (default 10, BTC is 50)
 */
export function calculatePerformanceBreakdown(
  trades: Trade[],
  startingCapital: number,
  contractSize: "mini" | "micro" = "mini",
  conversionRatio: number = 10
): PerformanceBreakdownData {
  if (trades.length === 0) {
    return {
      daily: [],
      weekly: [],
      monthly: [],
      quarterly: [],
      yearly: [],
    };
  }

  return {
    daily: calculatePeriodBreakdown(
      trades,
      startingCapital,
      "daily",
      contractSize,
      conversionRatio
    ),
    weekly: calculatePeriodBreakdown(
      trades,
      startingCapital,
      "weekly",
      contractSize,
      conversionRatio
    ),
    monthly: calculatePeriodBreakdown(
      trades,
      startingCapital,
      "monthly",
      contractSize,
      conversionRatio
    ),
    quarterly: calculatePeriodBreakdown(
      trades,
      startingCapital,
      "quarterly",
      contractSize,
      conversionRatio
    ),
    yearly: calculatePeriodBreakdown(
      trades,
      startingCapital,
      "yearly",
      contractSize,
      conversionRatio
    ),
  };
}

/**
 * Calculate breakdown for a specific period type
 */
function calculatePeriodBreakdown(
  trades: Trade[],
  startingCapital: number,
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  contractSize: "mini" | "micro" = "mini",
  conversionRatio: number = 10
): TimePeriodPerformance[] {
  // Group trades by period
  const periods = new Map<string, Trade[]>();

  for (const trade of trades) {
    const date = trade.exitDate;
    let key: string;
    let startDate: Date;
    let endDate: Date;

    switch (periodType) {
      case "daily":
        key = date.toISOString().split("T")[0]!;
        startDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );
        endDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59
        );
        break;
      case "weekly":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59);
        key = `${weekStart.getFullYear()}-W${getWeekNumber(weekStart)}`;
        startDate = weekStart;
        endDate = weekEnd;
        break;
      case "monthly":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        break;
      case "quarterly":
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        const quarterStartMonth = (quarter - 1) * 3;
        startDate = new Date(date.getFullYear(), quarterStartMonth, 1);
        endDate = new Date(
          date.getFullYear(),
          quarterStartMonth + 3,
          0,
          23,
          59,
          59
        );
        break;
      case "yearly":
        key = String(date.getFullYear());
        startDate = new Date(date.getFullYear(), 0, 1);
        endDate = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
        break;
    }

    if (!periods.has(key)) {
      periods.set(key, []);
    }
    periods.get(key)!.push(trade);

    // Store dates for this period (will be overwritten with same values)
    if (!periods.has(`${key}_dates`)) {
      (periods as any).set(`${key}_dates`, { startDate, endDate });
    }
  }

  // Calculate metrics for each period
  const results: TimePeriodPerformance[] = [];

  for (const [period, periodTrades] of Array.from(periods.entries())) {
    if (period.endsWith("_dates")) continue;

    const dates = (periods as any).get(`${period}_dates`);

    // Apply contract conversion to P&L
    const totalPnL = periodTrades.reduce((sum, t) => {
      let pnl = t.pnl / 100;
      if (contractSize === "micro") {
        pnl = pnl / conversionRatio;
      }
      return sum + pnl;
    }, 0);
    const returnPercent = (totalPnL / startingCapital) * 100;

    const winningTradesList = periodTrades.filter(t => t.pnl > 0);
    const losingTradesList = periodTrades.filter(t => t.pnl < 0);

    const totalWins = winningTradesList.reduce((sum, t) => {
      let pnl = t.pnl / 100;
      if (contractSize === "micro") {
        pnl = pnl / conversionRatio;
      }
      return sum + pnl;
    }, 0);
    const totalLosses = Math.abs(
      losingTradesList.reduce((sum, t) => {
        let pnl = t.pnl / 100;
        if (contractSize === "micro") {
          pnl = pnl / conversionRatio;
        }
        return sum + pnl;
      }, 0)
    );

    const avgWin =
      winningTradesList.length > 0 ? totalWins / winningTradesList.length : 0;
    const avgLoss =
      losingTradesList.length > 0 ? totalLosses / losingTradesList.length : 0;
    const profitFactor =
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    results.push({
      period,
      periodType,
      startDate: dates.startDate,
      endDate: dates.endDate,
      trades: periodTrades.length,
      winningTrades: winningTradesList.length,
      losingTrades: losingTradesList.length,
      totalPnL,
      returnPercent,
      winRate: (winningTradesList.length / periodTrades.length) * 100,
      avgWin,
      avgLoss,
      profitFactor: profitFactor === Infinity ? 0 : profitFactor,
    });
  }

  // Sort by period descending (most recent first)
  return results.sort((a, b) => b.period.localeCompare(a.period));
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get top N performing periods by return percentage
 */
export function getTopPerformers(
  breakdowns: Array<{
    period: string;
    returnPercent: number;
    pnl: number;
    trades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    periodType: string;
    startDate: Date;
    endDate: Date;
  }>,
  limit: number = 10
) {
  return [...breakdowns]
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .slice(0, limit);
}

/**
 * Get worst N performing periods by return percentage
 */
export function getWorstPerformers(
  breakdowns: Array<{
    period: string;
    returnPercent: number;
    pnl: number;
    trades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    periodType: string;
    startDate: Date;
    endDate: Date;
  }>,
  limit: number = 10
) {
  return [...breakdowns]
    .sort((a, b) => a.returnPercent - b.returnPercent)
    .slice(0, limit);
}

/**
 * Analyze performance by day of week (0=Sunday, 6=Saturday)
 */
export function getDayOfWeekAnalysis(trades: Trade[], startingCapital: number) {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayStats: Record<
    number,
    {
      trades: Trade[];
      totalPnL: number;
      winningTrades: number;
      losingTrades: number;
    }
  > = {};

  // Initialize all days
  for (let i = 0; i < 7; i++) {
    dayStats[i] = {
      trades: [],
      totalPnL: 0,
      winningTrades: 0,
      losingTrades: 0,
    };
  }

  // Group trades by exit day of week
  trades.forEach(trade => {
    const dayOfWeek = trade.exitDate.getDay();
    dayStats[dayOfWeek].trades.push(trade);
    dayStats[dayOfWeek].totalPnL += trade.pnl;
    if (trade.pnl > 0) {
      dayStats[dayOfWeek].winningTrades++;
    } else if (trade.pnl < 0) {
      dayStats[dayOfWeek].losingTrades++;
    }
  });

  // Calculate metrics for each day
  return Object.entries(dayStats)
    .map(([day, stats]) => {
      const dayNum = parseInt(day);
      const totalTrades = stats.trades.length;
      const winRate =
        totalTrades > 0 ? (stats.winningTrades / totalTrades) * 100 : 0;
      const returnPercent = (stats.totalPnL / startingCapital) * 100;

      const wins = stats.trades.filter(t => t.pnl > 0);
      const losses = stats.trades.filter(t => t.pnl < 0);
      const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
      const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor =
        totalLosses > 0
          ? totalWins / totalLosses
          : totalWins > 0
            ? Infinity
            : 0;

      return {
        day: dayNames[dayNum],
        dayOfWeek: dayNum,
        trades: totalTrades,
        pnl: stats.totalPnL / 100, // Convert to dollars
        returnPercent,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        winRate,
        profitFactor,
        avgWin: wins.length > 0 ? totalWins / wins.length / 100 : 0,
        avgLoss: losses.length > 0 ? totalLosses / losses.length / 100 : 0,
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

/**
 * Analyze performance by month of year (1=Jan, 12=Dec)
 */
export function getMonthOfYearAnalysis(
  trades: Trade[],
  startingCapital: number
) {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthStats: Record<
    number,
    {
      trades: Trade[];
      totalPnL: number;
      winningTrades: number;
      losingTrades: number;
    }
  > = {};

  // Initialize all months
  for (let i = 1; i <= 12; i++) {
    monthStats[i] = {
      trades: [],
      totalPnL: 0,
      winningTrades: 0,
      losingTrades: 0,
    };
  }

  // Group trades by exit month
  trades.forEach(trade => {
    const month = trade.exitDate.getMonth() + 1; // 0-indexed to 1-indexed
    monthStats[month].trades.push(trade);
    monthStats[month].totalPnL += trade.pnl;
    if (trade.pnl > 0) {
      monthStats[month].winningTrades++;
    } else if (trade.pnl < 0) {
      monthStats[month].losingTrades++;
    }
  });

  // Calculate metrics for each month
  return Object.entries(monthStats)
    .map(([month, stats]) => {
      const monthNum = parseInt(month);
      const totalTrades = stats.trades.length;
      const winRate =
        totalTrades > 0 ? (stats.winningTrades / totalTrades) * 100 : 0;
      const returnPercent = (stats.totalPnL / startingCapital) * 100;

      const wins = stats.trades.filter(t => t.pnl > 0);
      const losses = stats.trades.filter(t => t.pnl < 0);
      const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
      const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
      const profitFactor =
        totalLosses > 0
          ? totalWins / totalLosses
          : totalWins > 0
            ? Infinity
            : 0;

      return {
        month: monthNames[monthNum - 1],
        monthOfYear: monthNum,
        trades: totalTrades,
        pnl: stats.totalPnL / 100, // Convert to dollars
        returnPercent,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        winRate,
        profitFactor,
        avgWin: wins.length > 0 ? totalWins / wins.length / 100 : 0,
        avgLoss: losses.length > 0 ? totalLosses / losses.length / 100 : 0,
      };
    })
    .sort((a, b) => a.monthOfYear - b.monthOfYear);
}

/**
 * Calculate underwater equity curve (drawdown over time)
 * Shows how far below the peak the equity is at each point
 */
export interface UnderwaterPoint {
  date: Date;
  drawdownPercent: number; // Negative percentage
  daysUnderwater: number; // Days since last peak
}

export interface UnderwaterMetrics {
  curve: UnderwaterPoint[];
  maxDrawdownPct: number;
  longestDrawdownDays: number;
  averageDrawdownDays: number;
  pctTimeInDrawdown: number; // % of days where drawdown < 0
  pctTimeBelowMinus10: number; // % of days where drawdown <= -10%
}

export function calculateUnderwaterCurve(
  equityCurve: EquityPoint[],
  baseCapital: number = 100000, // Base capital for consistent drawdown % calculation
  isLeveraged: boolean = false // Whether to use leveraged (% from peak) or unleveraged (% of base capital) calculation
): UnderwaterPoint[] {
  if (equityCurve.length === 0) return [];

  const underwater: UnderwaterPoint[] = [];

  // Get starting equity to calculate P&L-based drawdowns
  const startingEquity = equityCurve[0]!.equity;
  let peakPnL = 0; // Track peak P&L (not peak equity)
  let peakEquity = startingEquity; // Track peak equity for leveraged mode
  let lastPeakDate = equityCurve[0]!.date;

  for (const point of equityCurve) {
    // Calculate current P&L from starting equity
    const currentPnL = point.equity - startingEquity;

    if (isLeveraged) {
      // Leveraged mode: track peak equity for percentage-based drawdown
      if (point.equity >= peakEquity) {
        peakEquity = point.equity;
        lastPeakDate = point.date;
      }

      // Calculate drawdown as percentage from peak equity (traditional drawdown)
      // This is the correct calculation for compounding returns
      const drawdownPercent =
        peakEquity > 0 && point.equity < peakEquity
          ? -((peakEquity - point.equity) / peakEquity) * 100
          : 0;

      const daysUnderwater = Math.floor(
        (point.date.getTime() - lastPeakDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      underwater.push({
        date: point.date,
        drawdownPercent,
        daysUnderwater,
      });
    } else {
      // Unleveraged mode: track peak P&L for base capital percentage
      if (currentPnL >= peakPnL) {
        peakPnL = currentPnL;
        lastPeakDate = point.date;
      }

      // Calculate drawdown as percentage of BASE CAPITAL (not current equity or starting equity)
      // This ensures consistent drawdown percentages regardless of account size
      // e.g., a $10K drawdown from peak is always -10% (relative to $100K base)
      const drawdownDollars = peakPnL - currentPnL;
      const drawdownPercent =
        baseCapital > 0 && drawdownDollars > 0
          ? -(drawdownDollars / baseCapital) * 100
          : 0;

      const daysUnderwater = Math.floor(
        (point.date.getTime() - lastPeakDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      underwater.push({
        date: point.date,
        drawdownPercent,
        daysUnderwater,
      });
    }
  }

  return underwater;
}

/**
 * Calculate underwater metrics including duration statistics
 */
export function calculateUnderwaterMetrics(
  equityCurve: EquityPoint[],
  baseCapital: number = 100000,
  isLeveraged: boolean = false
): UnderwaterMetrics {
  const curve = calculateUnderwaterCurve(equityCurve, baseCapital, isLeveraged);

  if (curve.length === 0) {
    return {
      curve: [],
      maxDrawdownPct: 0,
      longestDrawdownDays: 0,
      averageDrawdownDays: 0,
      pctTimeInDrawdown: 0,
      pctTimeBelowMinus10: 0,
    };
  }

  // Find max drawdown
  const maxDrawdown = Math.min(...curve.map(p => p.drawdownPercent));

  // Find longest drawdown duration
  let longestDuration = 0;
  let currentDuration = 0;
  const drawdownPeriods: number[] = [];
  let inDrawdown = false;

  for (let i = 0; i < curve.length; i++) {
    const point = curve[i]!;

    if (point.drawdownPercent < 0) {
      if (!inDrawdown) {
        inDrawdown = true;
      }
      currentDuration++;
      longestDuration = Math.max(longestDuration, currentDuration);
    } else {
      if (inDrawdown) {
        // Recovery complete
        drawdownPeriods.push(currentDuration);
        inDrawdown = false;
        currentDuration = 0;
      }
    }
  }

  // If still in drawdown at the end, add the current period
  if (inDrawdown && currentDuration > 0) {
    drawdownPeriods.push(currentDuration);
  }

  // Calculate average drawdown duration
  const averageDrawdown =
    drawdownPeriods.length > 0
      ? drawdownPeriods.reduce((sum, days) => sum + days, 0) /
        drawdownPeriods.length
      : 0;

  // Calculate percentage of time in drawdown (drawdown < 0)
  const daysInDrawdown = curve.filter(p => p.drawdownPercent < 0).length;
  const pctInDrawdown = (daysInDrawdown / curve.length) * 100;

  // Calculate percentage of time below -10%
  const daysBelowMinus10 = curve.filter(p => p.drawdownPercent <= -10).length;
  const pctBelowMinus10 = (daysBelowMinus10 / curve.length) * 100;

  return {
    curve,
    maxDrawdownPct: maxDrawdown,
    longestDrawdownDays: longestDuration,
    averageDrawdownDays: Math.round(averageDrawdown),
    pctTimeInDrawdown: pctInDrawdown,
    pctTimeBelowMinus10: pctBelowMinus10,
  };
}

/**
 * Calculate underwater metrics for portfolio only
 */
export function calculatePortfolioUnderwater(
  portfolioEquity: EquityPoint[],
  baseCapital: number = 100000,
  isLeveraged: boolean = false
): UnderwaterMetrics {
  return calculateUnderwaterMetrics(portfolioEquity, baseCapital, isLeveraged);
}

/**
 * Generate a narrative summary of portfolio performance
 */
export function generatePortfolioSummary(
  metrics: PerformanceMetrics,
  underwater: UnderwaterMetrics,
  startDate: Date,
  endDate: Date
): string {
  const daysDuration = Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const yearsDuration = (daysDuration / 365).toFixed(1);

  // Format dates
  const startStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  const endStr = endDate.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  // Build summary
  const parts: string[] = [];

  // Time period
  parts.push(`Over ${yearsDuration} years (${startStr} to ${endStr})`);

  // Return performance
  const returnSign = metrics.totalReturn >= 0 ? "gained" : "lost";
  parts.push(
    `the portfolio ${returnSign} ${Math.abs(metrics.totalReturn).toFixed(1)}%`
  );

  // Annualized return
  if (daysDuration >= 365) {
    parts.push(`(${metrics.annualizedReturn.toFixed(1)}% annualized)`);
  }

  // Risk metrics
  parts.push(
    `with a maximum drawdown of ${Math.abs(underwater.maxDrawdownPct).toFixed(1)}%`
  );

  // Time in drawdown context
  if (underwater.pctTimeInDrawdown > 90) {
    parts.push(
      `The portfolio spent ${underwater.pctTimeInDrawdown.toFixed(0)}% of the time below its peak`
    );
  } else if (underwater.pctTimeInDrawdown > 70) {
    parts.push(
      `and was underwater ${underwater.pctTimeInDrawdown.toFixed(0)}% of the time`
    );
  } else {
    parts.push(
      `spending ${underwater.pctTimeInDrawdown.toFixed(0)}% of days in drawdown`
    );
  }

  // Deep drawdown context
  if (underwater.pctTimeBelowMinus10 > 30) {
    parts.push(
      `with ${underwater.pctTimeBelowMinus10.toFixed(0)}% of days experiencing drawdowns exceeding -10%`
    );
  } else if (underwater.pctTimeBelowMinus10 > 10) {
    parts.push(
      `including ${underwater.pctTimeBelowMinus10.toFixed(0)}% of days below -10%`
    );
  }

  // Trade efficiency
  if (metrics.tradeStats) {
    const { winRate, profitFactor, expectancyPnL } = metrics.tradeStats;
    parts.push(
      `Trading ${metrics.tradeStats.totalTrades} times with a ${winRate.toFixed(1)}% win rate`
    );

    if (profitFactor > 1.5) {
      parts.push(
        `the strategy showed strong profit factor of ${profitFactor.toFixed(2)}`
      );
    } else if (profitFactor > 1.0) {
      parts.push(`achieving a profit factor of ${profitFactor.toFixed(2)}`);
    }

    parts.push(
      `and an average expectancy of $${expectancyPnL.toFixed(0)} per trade`
    );
  }

  return parts.join(", ") + ".";
}

/**
 * Calculate performance breakdown by day of week
 */
export interface DayOfWeekPerformance {
  dayName: string;
  dayNumber: number; // 0=Sunday, 6=Saturday
  trades: number;
  totalPnL: number;
  avgPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export function calculateDayOfWeekBreakdown(
  trades: Trade[]
): DayOfWeekPerformance[] {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayGroups = new Map<number, Trade[]>();

  // Initialize all days
  for (let i = 0; i < 7; i++) {
    dayGroups.set(i, []);
  }

  // Group trades by day of week
  for (const trade of trades) {
    const dayNum = trade.exitDate.getDay();
    dayGroups.get(dayNum)!.push(trade);
  }

  // Calculate metrics for each day
  const results: DayOfWeekPerformance[] = [];
  for (let dayNum = 0; dayNum < 7; dayNum++) {
    const dayTrades = dayGroups.get(dayNum)!;
    const winningTrades = dayTrades.filter(t => t.pnl > 0);
    const losingTrades = dayTrades.filter(t => t.pnl < 0);

    const totalPnL = dayTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
    const totalLosses = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)
    );

    results.push({
      dayName: dayNames[dayNum]!,
      dayNumber: dayNum,
      trades: dayTrades.length,
      totalPnL,
      avgPnL: dayTrades.length > 0 ? totalPnL / dayTrades.length : 0,
      winRate:
        dayTrades.length > 0
          ? (winningTrades.length / dayTrades.length) * 100
          : 0,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    });
  }

  return results;
}

/**
 * Calculate performance breakdown by week of month
 */
export interface WeekOfMonthPerformance {
  weekNumber: number; // 1-5
  weekLabel: string; // "Week 1", "Week 2", etc.
  trades: number;
  totalPnL: number;
  avgPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

export function calculateWeekOfMonthBreakdown(
  trades: Trade[]
): WeekOfMonthPerformance[] {
  const weekGroups = new Map<number, Trade[]>();

  // Initialize all weeks (1-5)
  for (let i = 1; i <= 5; i++) {
    weekGroups.set(i, []);
  }

  // Group trades by week of month
  for (const trade of trades) {
    const dayOfMonth = trade.exitDate.getDate();
    let weekNum: number;

    // Determine week of month based on day of month
    if (dayOfMonth <= 7) {
      weekNum = 1;
    } else if (dayOfMonth <= 14) {
      weekNum = 2;
    } else if (dayOfMonth <= 21) {
      weekNum = 3;
    } else if (dayOfMonth <= 28) {
      weekNum = 4;
    } else {
      weekNum = 5; // Days 29-31
    }

    weekGroups.get(weekNum)!.push(trade);
  }

  // Calculate metrics for each week
  const results: WeekOfMonthPerformance[] = [];
  for (let weekNum = 1; weekNum <= 5; weekNum++) {
    const weekTrades = weekGroups.get(weekNum)!;
    const winningTrades = weekTrades.filter(t => t.pnl > 0);
    const losingTrades = weekTrades.filter(t => t.pnl < 0);

    const totalPnL = weekTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl / 100, 0);
    const totalLosses = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.pnl / 100, 0)
    );

    results.push({
      weekNumber: weekNum,
      weekLabel: `Week ${weekNum}`,
      trades: weekTrades.length,
      totalPnL,
      avgPnL: weekTrades.length > 0 ? totalPnL / weekTrades.length : 0,
      winRate:
        weekTrades.length > 0
          ? (winningTrades.length / weekTrades.length) * 100
          : 0,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    });
  }

  return results;
}

/**
 * Rolling Metrics Interface
 */
export interface RollingMetricsData {
  window: number; // Days in rolling window
  data: Array<{
    date: Date;
    sharpe: number | null;
    sortino: number | null;
    maxDrawdown: number | null;
  }>;
}

/**
 * Calculate rolling metrics (Sharpe, Sortino, Max Drawdown) over different windows
 * @param equityCurve Full equity curve (should be complete history for accurate rolling windows)
 * @param windows Array of window sizes in days (e.g., [30, 90, 365])
 * @param startDate Optional start date to filter results (compute on full history, then filter)
 * @param endDate Optional end date to filter results
 */
export function calculateRollingMetrics(
  equityCurve: EquityPoint[],
  windows: number[] = [30, 90, 365],
  startDate?: Date,
  endDate?: Date
): RollingMetricsData[] {
  const results: RollingMetricsData[] = [];

  for (const window of windows) {
    const windowData: Array<{
      date: Date;
      sharpe: number | null;
      sortino: number | null;
      maxDrawdown: number | null;
    }> = [];

    // For each point in the equity curve, calculate metrics for the trailing window
    for (let i = window; i < equityCurve.length; i++) {
      const windowSlice = equityCurve.slice(i - window, i + 1);

      // Calculate daily returns for the window
      const returns: number[] = [];
      for (let j = 1; j < windowSlice.length; j++) {
        const prevEquity = windowSlice[j - 1]!.equity;
        const currEquity = windowSlice[j]!.equity;
        if (prevEquity > 0) {
          returns.push((currEquity - prevEquity) / prevEquity);
        }
      }

      // Calculate Sharpe ratio
      let sharpe: number | null = null;
      if (returns.length > 0) {
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance =
          returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
          returns.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev > 0) {
          sharpe = (mean / stdDev) * Math.sqrt(252); // Annualized
        }
      }

      // Calculate Sortino ratio (downside deviation only)
      let sortino: number | null = null;
      if (returns.length > 0) {
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const downsideReturns = returns.filter(r => r < 0);
        if (downsideReturns.length > 0) {
          const downsideVariance =
            downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
            downsideReturns.length;
          const downsideStdDev = Math.sqrt(downsideVariance);
          if (downsideStdDev > 0) {
            sortino = (mean / downsideStdDev) * Math.sqrt(252); // Annualized
          }
        }
      }

      // Calculate max drawdown
      let maxDrawdown: number | null = null;
      let peak = windowSlice[0]!.equity;
      let maxDD = 0;
      for (const point of windowSlice) {
        if (point.equity > peak) {
          peak = point.equity;
        }
        const drawdown = (point.equity - peak) / peak;
        if (drawdown < maxDD) {
          maxDD = drawdown;
        }
      }
      maxDrawdown = maxDD * 100; // Convert to percentage

      windowData.push({
        date: equityCurve[i]!.date,
        sharpe,
        sortino,
        maxDrawdown,
      });
    }

    // Filter windowData to the specified date range if provided
    let filteredData = windowData;
    if (startDate || endDate) {
      filteredData = windowData.filter(point => {
        const pointTime = point.date.getTime();
        if (startDate && pointTime < startDate.getTime()) return false;
        if (endDate && pointTime > endDate.getTime()) return false;
        return true;
      });
    }

    results.push({ window, data: filteredData });
  }

  return results;
}

/**
 * Monthly Returns Calendar Interface
 */
export interface MonthlyReturn {
  year: number;
  month: number; // 1-12
  monthName: string;
  return: number; // Percentage
  startEquity: number;
  endEquity: number;
}

/**
 * Calculate monthly returns for calendar heatmap
 */
export function calculateMonthlyReturnsCalendar(
  equityCurve: EquityPoint[]
): MonthlyReturn[] {
  if (equityCurve.length === 0) return [];

  const monthlyData: Map<
    string,
    {
      year: number;
      month: number;
      startEquity: number;
      endEquity: number;
      firstDate: Date;
      lastDate: Date;
    }
  > = new Map();

  // Group equity points by year-month
  for (const point of equityCurve) {
    const year = point.date.getFullYear();
    const month = point.date.getMonth() + 1; // 1-12
    const key = `${year}-${month}`;

    const existing = monthlyData.get(key);
    if (!existing) {
      monthlyData.set(key, {
        year,
        month,
        startEquity: point.equity,
        endEquity: point.equity,
        firstDate: point.date,
        lastDate: point.date,
      });
    } else {
      // Update end equity if this is a later date
      if (point.date > existing.lastDate) {
        existing.endEquity = point.equity;
        existing.lastDate = point.date;
      }
      // Update start equity if this is an earlier date
      if (point.date < existing.firstDate) {
        existing.startEquity = point.equity;
        existing.firstDate = point.date;
      }
    }
  }

  // Calculate returns and format
  const results: MonthlyReturn[] = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (const [_, data] of Array.from(monthlyData.entries())) {
    const returnPct =
      data.startEquity > 0
        ? ((data.endEquity - data.startEquity) / data.startEquity) * 100
        : 0;

    results.push({
      year: data.year,
      month: data.month,
      monthName: monthNames[data.month - 1]!,
      return: returnPct,
      startEquity: data.startEquity,
      endEquity: data.endEquity,
    });
  }

  // Sort by year and month
  results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return results;
}

/**
 * Distribution bucket for histogram
 */
export interface DistributionBucket {
  from: number;
  to: number;
  count: number;
  percentage: number;
}

/**
 * Daily returns distribution with statistical measures
 */
export interface DailyReturnsDistribution {
  buckets: DistributionBucket[];
  skewness: number;
  kurtosis: number;
  pctGt1pct: number; // % of days with returns > +1%
  pctLtMinus1pct: number; // % of days with returns < -1%
  mean: number;
  stdDev: number;
  totalDays: number;
}

/**
 * Calculate skewness of a dataset
 * Skewness measures asymmetry of the distribution
 * - Positive skew: right tail is longer (more extreme positive values)
 * - Negative skew: left tail is longer (more extreme negative values)
 * - Zero skew: symmetric distribution
 */
function calculateSkewness(values: number[]): number {
  if (values.length === 0) return 0;

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const m3 =
    values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 3), 0) / n;

  return m3;
}

/**
 * Calculate excess kurtosis of a dataset
 * Kurtosis measures "tailedness" of the distribution
 * - Positive kurtosis (leptokurtic): fat tails, more extreme values than normal distribution
 * - Negative kurtosis (platykurtic): thin tails, fewer extreme values
 * - Zero kurtosis (mesokurtic): similar to normal distribution
 *
 * We return excess kurtosis (kurtosis - 3) so normal distribution = 0
 */
function calculateKurtosis(values: number[]): number {
  if (values.length === 0) return 0;

  const n = values.length;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const m4 =
    values.reduce((sum, v) => sum + Math.pow((v - mean) / stdDev, 4), 0) / n;

  // Return excess kurtosis (subtract 3 to make normal distribution = 0)
  return m4 - 3;
}

/**
 * Calculate daily returns distribution from equity curve
 *
 * Performance: O(n) where n is number of equity points
 * Expected execution time: <10ms for 10,000 days
 *
 * @param equityCurve - Array of equity points
 * @param bucketSize - Size of each histogram bucket in percentage points (default: 0.5%)
 * @param rangeMin - Minimum bucket value (default: -5%)
 * @param rangeMax - Maximum bucket value (default: +5%)
 * @returns Distribution with buckets and statistical measures
 */
export function calculateDailyReturnsDistribution(
  equityCurve: EquityPoint[],
  bucketSize: number = 0.5,
  rangeMin: number = -5,
  rangeMax: number = 5
): DailyReturnsDistribution {
  const startTime = Date.now();

  if (equityCurve.length < 2) {
    console.log("[Distribution] Insufficient data points:", equityCurve.length);
    return {
      buckets: [],
      skewness: 0,
      kurtosis: 0,
      pctGt1pct: 0,
      pctLtMinus1pct: 0,
      mean: 0,
      stdDev: 0,
      totalDays: 0,
    };
  }

  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1]!.equity;
    const currEquity = equityCurve[i]!.equity;

    if (prevEquity > 0) {
      const returnPct = ((currEquity - prevEquity) / prevEquity) * 100;
      dailyReturns.push(returnPct);
    }
  }

  if (dailyReturns.length === 0) {
    console.log("[Distribution] No valid returns calculated");
    return {
      buckets: [],
      skewness: 0,
      kurtosis: 0,
      pctGt1pct: 0,
      pctLtMinus1pct: 0,
      mean: 0,
      stdDev: 0,
      totalDays: 0,
    };
  }

  // Calculate statistics
  const mean =
    dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const skewness = calculateSkewness(dailyReturns);
  const kurtosis = calculateKurtosis(dailyReturns);

  // Calculate tail percentages
  const gt1pct = dailyReturns.filter(r => r > 1).length;
  const ltMinus1pct = dailyReturns.filter(r => r < -1).length;
  const pctGt1pct = (gt1pct / dailyReturns.length) * 100;
  const pctLtMinus1pct = (ltMinus1pct / dailyReturns.length) * 100;

  // Create histogram buckets
  const buckets: DistributionBucket[] = [];
  const bucketCounts = new Map<string, number>();

  // Initialize all buckets
  for (let edge = rangeMin; edge < rangeMax; edge += bucketSize) {
    const from = edge;
    const to = edge + bucketSize;
    const key = `${from.toFixed(2)}_${to.toFixed(2)}`;
    bucketCounts.set(key, 0);
    buckets.push({ from, to, count: 0, percentage: 0 });
  }

  // Count returns into buckets
  for (const returnPct of dailyReturns) {
    // Clamp to range
    const clampedReturn = Math.max(
      rangeMin,
      Math.min(rangeMax - 0.01, returnPct)
    );

    // Find bucket
    const bucketIndex = Math.floor((clampedReturn - rangeMin) / bucketSize);
    const safeBucketIndex = Math.max(
      0,
      Math.min(buckets.length - 1, bucketIndex)
    );

    buckets[safeBucketIndex]!.count++;
  }

  // Calculate percentages
  for (const bucket of buckets) {
    bucket.percentage = (bucket.count / dailyReturns.length) * 100;
  }

  const executionTime = Date.now() - startTime;
  console.log(
    `[Distribution] Calculated for ${dailyReturns.length} days in ${executionTime}ms`
  );
  console.log(
    `[Distribution] Stats: mean=${mean.toFixed(3)}%, stdDev=${stdDev.toFixed(3)}%, skew=${skewness.toFixed(3)}, kurtosis=${kurtosis.toFixed(3)}`
  );

  // Validation
  const totalPercentage = buckets.reduce((sum, b) => sum + b.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.1) {
    console.warn(
      `[Distribution] Validation warning: bucket percentages sum to ${totalPercentage.toFixed(2)}%, expected 100%`
    );
  }

  return {
    buckets,
    skewness,
    kurtosis,
    pctGt1pct,
    pctLtMinus1pct,
    mean,
    stdDev,
    totalDays: dailyReturns.length,
  };
}

/**
 * Major drawdown period information
 */
export interface MajorDrawdown {
  startDate: Date; // Peak date before drawdown
  troughDate: Date; // Lowest point date
  recoveryDate: Date | null; // Return to peak date (null if not recovered)
  depthPct: number; // Maximum drawdown percentage (negative value)
  daysToTrough: number; // Days from peak to trough
  daysToRecovery: number | null; // Days from trough to recovery (null if not recovered)
  totalDurationDays: number; // Total days in drawdown (peak to recovery or to present)
  isOngoing: boolean; // True if drawdown hasn't recovered yet
}

/**
 * Calculate major drawdowns from equity curve
 *
 * A major drawdown is defined as any drawdown period where the depth exceeds the threshold (default -10%).
 *
 * Algorithm:
 * 1. Track running peak equity
 * 2. When equity drops below peak, start a drawdown period
 * 3. Track trough (lowest point) during the period
 * 4. When equity returns to peak, end the period
 * 5. Filter for major drawdowns (depth < threshold)
 *
 * Performance: O(n) where n is number of equity points
 * Expected execution time: <5ms for 10,000 days
 *
 * @param equityCurve - Array of equity points
 * @param depthThreshold - Minimum depth to be considered "major" (default: -10%)
 * @returns Array of major drawdown periods, sorted by depth (worst first)
 */
export function calculateMajorDrawdowns(
  equityCurve: EquityPoint[],
  depthThreshold: number = -10
): MajorDrawdown[] {
  const startTime = Date.now();

  if (equityCurve.length < 2) {
    console.log(
      "[MajorDrawdowns] Insufficient data points:",
      equityCurve.length
    );
    return [];
  }

  const allDrawdowns: MajorDrawdown[] = [];
  let peak = equityCurve[0]!.equity;
  let peakDate = equityCurve[0]!.date;
  let inDrawdown = false;
  let troughEquity = peak;
  let troughDate = peakDate;

  for (let i = 1; i < equityCurve.length; i++) {
    const point = equityCurve[i]!;

    if (point.equity > peak) {
      // New peak - if we were in a drawdown, it has recovered
      if (inDrawdown) {
        const depthPct = ((troughEquity - peak) / peak) * 100;
        const daysToTrough = Math.floor(
          (troughDate.getTime() - peakDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysToRecovery = Math.floor(
          (point.date.getTime() - troughDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const totalDurationDays = Math.floor(
          (point.date.getTime() - peakDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        allDrawdowns.push({
          startDate: peakDate,
          troughDate,
          recoveryDate: point.date,
          depthPct,
          daysToTrough,
          daysToRecovery,
          totalDurationDays,
          isOngoing: false,
        });

        inDrawdown = false;
      }

      // Update peak
      peak = point.equity;
      peakDate = point.date;
      troughEquity = peak;
      troughDate = peakDate;
    } else if (point.equity < peak) {
      // Below peak - in drawdown
      if (!inDrawdown) {
        inDrawdown = true;
        troughEquity = point.equity;
        troughDate = point.date;
      } else if (point.equity < troughEquity) {
        // New trough
        troughEquity = point.equity;
        troughDate = point.date;
      }
    }
  }

  // Handle ongoing drawdown (hasn't recovered yet)
  if (inDrawdown) {
    const depthPct = ((troughEquity - peak) / peak) * 100;
    const daysToTrough = Math.floor(
      (troughDate.getTime() - peakDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const lastDate = equityCurve[equityCurve.length - 1]!.date;
    const totalDurationDays = Math.floor(
      (lastDate.getTime() - peakDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    allDrawdowns.push({
      startDate: peakDate,
      troughDate,
      recoveryDate: null,
      depthPct,
      daysToTrough,
      daysToRecovery: null,
      totalDurationDays,
      isOngoing: true,
    });
  }

  // Filter for major drawdowns (depth < threshold)
  const majorDrawdowns = allDrawdowns.filter(
    dd => dd.depthPct < depthThreshold
  );

  // Sort by depth (worst first)
  majorDrawdowns.sort((a, b) => a.depthPct - b.depthPct);

  const executionTime = Date.now() - startTime;
  console.log(
    `[MajorDrawdowns] Found ${majorDrawdowns.length} major drawdowns (threshold: ${depthThreshold}%) in ${executionTime}ms`
  );

  if (majorDrawdowns.length > 0) {
    const worstDD = majorDrawdowns[0]!;
    console.log(
      `[MajorDrawdowns] Worst: ${worstDD.depthPct.toFixed(2)}% from ${worstDD.startDate.toISOString().split("T")[0]} to ${worstDD.troughDate.toISOString().split("T")[0]}`
    );
  }

  // Validation
  for (const dd of majorDrawdowns) {
    if (dd.depthPct >= 0) {
      console.warn(
        `[MajorDrawdowns] Validation warning: drawdown depth is positive: ${dd.depthPct}%`
      );
    }
    if (dd.troughDate < dd.startDate) {
      console.warn(
        `[MajorDrawdowns] Validation warning: trough date before start date`
      );
    }
    if (dd.recoveryDate && dd.recoveryDate < dd.troughDate) {
      console.warn(
        `[MajorDrawdowns] Validation warning: recovery date before trough date`
      );
    }
  }

  return majorDrawdowns;
}
