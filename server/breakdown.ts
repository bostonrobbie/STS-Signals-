/**
 * Performance Breakdown Analytics
 *
 * Calculates performance metrics broken down by time periods (mini contracts only)
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

export interface PerformanceBreakdown {
  daily: TimePeriodPerformance[];
  weekly: TimePeriodPerformance[];
  monthly: TimePeriodPerformance[];
  quarterly: TimePeriodPerformance[];
  yearly: TimePeriodPerformance[];
}

interface Trade {
  exitDate: Date;
  pnl: number;
}

/**
 * Calculate performance breakdown by time periods (mini contracts only)
 */
export function calculatePerformanceBreakdown(
  trades: Trade[],
  startingCapital: number
): PerformanceBreakdown {
  if (trades.length === 0) {
    return {
      daily: [],
      weekly: [],
      monthly: [],
      quarterly: [],
      yearly: [],
    };
  }

  const sortedTrades = [...trades].sort(
    (a, b) => a.exitDate.getTime() - b.exitDate.getTime()
  );

  return {
    daily: calculateDailyBreakdown(sortedTrades, startingCapital),
    weekly: calculateWeeklyBreakdown(sortedTrades, startingCapital),
    monthly: calculateMonthlyBreakdown(sortedTrades, startingCapital),
    quarterly: calculateQuarterlyBreakdown(sortedTrades, startingCapital),
    yearly: calculateYearlyBreakdown(sortedTrades, startingCapital),
  };
}

// Helper function to convert P&L from cents to dollars
function convertPnL(pnl: number): number {
  return pnl / 100;
}

function calculateDailyBreakdown(
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance[] {
  if (trades.length === 0) return [];

  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const dateKey = trade.exitDate.toISOString().split("T")[0]!;
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(trade);
  }

  // Only include days that actually have trades
  // This avoids cluttering the calendar with empty weekend/holiday entries
  const allDays: TimePeriodPerformance[] = [];

  // @ts-expect-error TS2802
  for (const [dateKey, dayTrades] of grouped.entries()) {
    allDays.push(
      calculatePeriodMetrics(dateKey, "daily", dayTrades, startingCapital)
    );
  }

  // Sort chronologically (ascending) so the calendar can group by month properly
  // The frontend CalendarPnL component handles display ordering
  return allDays.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateWeeklyBreakdown(
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance[] {
  if (trades.length === 0) return [];

  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const date = new Date(trade.exitDate);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekKey = `${year}-W${week.toString().padStart(2, "0")}`;

    if (!grouped.has(weekKey)) {
      grouped.set(weekKey, []);
    }
    grouped.get(weekKey)!.push(trade);
  }

  // Only include weeks that have actual trades
  const allWeeks: TimePeriodPerformance[] = [];

  // @ts-expect-error TS2802
  for (const [weekKey, weekTrades] of grouped.entries()) {
    allWeeks.push(
      calculatePeriodMetrics(weekKey, "weekly", weekTrades, startingCapital)
    );
  }

  // Sort chronologically by period key (YYYY-Wxx format sorts correctly)
  return allWeeks.sort((a, b) => a.period.localeCompare(b.period));
}

function calculateMonthlyBreakdown(
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance[] {
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const date = new Date(trade.exitDate);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;

    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(trade);
  }

  return Array.from(grouped.entries())
    .map(([monthKey, monthTrades]) =>
      calculatePeriodMetrics(monthKey, "monthly", monthTrades, startingCapital)
    )
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

function calculateQuarterlyBreakdown(
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance[] {
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const date = new Date(trade.exitDate);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const quarterKey = `${date.getFullYear()}-Q${quarter}`;

    if (!grouped.has(quarterKey)) {
      grouped.set(quarterKey, []);
    }
    grouped.get(quarterKey)!.push(trade);
  }

  return Array.from(grouped.entries())
    .map(([quarterKey, quarterTrades]) =>
      calculatePeriodMetrics(
        quarterKey,
        "quarterly",
        quarterTrades,
        startingCapital
      )
    )
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

function calculateYearlyBreakdown(
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance[] {
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const yearKey = trade.exitDate.getFullYear().toString();

    if (!grouped.has(yearKey)) {
      grouped.set(yearKey, []);
    }
    grouped.get(yearKey)!.push(trade);
  }

  return Array.from(grouped.entries())
    .map(([yearKey, yearTrades]) =>
      calculatePeriodMetrics(yearKey, "yearly", yearTrades, startingCapital)
    )
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

function calculatePeriodMetrics(
  period: string,
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  trades: Trade[],
  startingCapital: number
): TimePeriodPerformance {
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);

  const totalPnL = trades.reduce((sum, t) => sum + convertPnL(t.pnl), 0);
  const totalWins = winningTrades.reduce(
    (sum, t) => sum + convertPnL(t.pnl),
    0
  );
  const totalLosses = Math.abs(
    losingTrades.reduce((sum, t) => sum + convertPnL(t.pnl), 0)
  );

  const avgWin =
    winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss =
    losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  const profitFactor =
    totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  const winRate =
    trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
  const returnPercent = (totalPnL / startingCapital) * 100;

  const startDate = new Date(
    Math.min(...trades.map(t => t.exitDate.getTime()))
  );
  const endDate = new Date(Math.max(...trades.map(t => t.exitDate.getTime())));

  return {
    period,
    periodType,
    startDate,
    endDate,
    trades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    totalPnL,
    returnPercent,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
  };
}

function getWeekNumber(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
