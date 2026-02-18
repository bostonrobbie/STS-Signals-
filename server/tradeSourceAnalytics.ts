/**
 * Trade Source Analytics
 *
 * Provides breakdown of trades by source (csv_import, webhook, manual)
 * for analyzing signal performance and data quality.
 */

import { getDb } from "./db";
import { trades } from "../drizzle/schema";
import { sql, eq, and, gte, lte, inArray } from "drizzle-orm";

export interface TradeSourceBreakdown {
  source: "csv_import" | "webhook" | "manual";
  tradeCount: number;
  totalPnL: number; // in dollars
  winCount: number;
  lossCount: number;
  winRate: number; // percentage
  avgPnL: number; // in dollars
  avgWin: number; // in dollars
  avgLoss: number; // in dollars
  profitFactor: number;
  firstTradeDate: Date | null;
  lastTradeDate: Date | null;
}

export interface TradeSourceStats {
  breakdown: TradeSourceBreakdown[];
  totalTrades: number;
  sourceDistribution: {
    source: "csv_import" | "webhook" | "manual";
    percentage: number;
  }[];
}

/**
 * Get trade source breakdown statistics
 */
export async function getTradeSourceBreakdown(params: {
  strategyIds?: number[];
  startDate?: Date;
  endDate?: Date;
}): Promise<TradeSourceStats> {
  const db = await getDb();
  if (!db) {
    return {
      breakdown: [],
      totalTrades: 0,
      sourceDistribution: [],
    };
  }

  // Build conditions
  const conditions = [];

  if (params.strategyIds && params.strategyIds.length > 0) {
    conditions.push(inArray(trades.strategyId, params.strategyIds));
  }

  if (params.startDate) {
    conditions.push(gte(trades.exitDate, params.startDate.toISOString()));
  }

  if (params.endDate) {
    conditions.push(lte(trades.exitDate, params.endDate.toISOString()));
  }

  // Query trades grouped by source
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sourceStats = await db
    .select({
      source: trades.source,
      tradeCount: sql<number>`COUNT(*)`,
      totalPnL: sql<number>`SUM(${trades.pnl})`,
      winCount: sql<number>`SUM(CASE WHEN ${trades.pnl} > 0 THEN 1 ELSE 0 END)`,
      lossCount: sql<number>`SUM(CASE WHEN ${trades.pnl} <= 0 THEN 1 ELSE 0 END)`,
      totalWins: sql<number>`SUM(CASE WHEN ${trades.pnl} > 0 THEN ${trades.pnl} ELSE 0 END)`,
      totalLosses: sql<number>`SUM(CASE WHEN ${trades.pnl} < 0 THEN ABS(${trades.pnl}) ELSE 0 END)`,
      firstTradeDate: sql<Date>`MIN(${trades.exitDate})`,
      lastTradeDate: sql<Date>`MAX(${trades.exitDate})`,
    })
    .from(trades)
    .where(whereClause)
    .groupBy(trades.source);

  // Calculate total trades
  const totalTrades = sourceStats.reduce(
    (sum, s) => sum + Number(s.tradeCount),
    0
  );

  // Build breakdown with calculated metrics
  const breakdown: TradeSourceBreakdown[] = sourceStats.map(s => {
    const tradeCount = Number(s.tradeCount);
    const winCount = Number(s.winCount);
    const lossCount = Number(s.lossCount);
    const totalPnL = Number(s.totalPnL) / 100; // Convert from cents to dollars
    const totalWins = Number(s.totalWins) / 100;
    const totalLosses = Number(s.totalLosses) / 100;

    return {
      source: (s.source || "csv_import") as "csv_import" | "webhook" | "manual",
      tradeCount,
      totalPnL,
      winCount,
      lossCount,
      winRate: tradeCount > 0 ? (winCount / tradeCount) * 100 : 0,
      avgPnL: tradeCount > 0 ? totalPnL / tradeCount : 0,
      avgWin: winCount > 0 ? totalWins / winCount : 0,
      avgLoss: lossCount > 0 ? totalLosses / lossCount : 0,
      profitFactor:
        totalLosses > 0
          ? totalWins / totalLosses
          : totalWins > 0
            ? Infinity
            : 0,
      firstTradeDate: s.firstTradeDate,
      lastTradeDate: s.lastTradeDate,
    };
  });

  // Calculate source distribution
  const sourceDistribution = breakdown.map(b => ({
    source: b.source,
    percentage: totalTrades > 0 ? (b.tradeCount / totalTrades) * 100 : 0,
  }));

  return {
    breakdown,
    totalTrades,
    sourceDistribution,
  };
}

/**
 * Get webhook signal performance metrics
 * Specifically for analyzing TradingView webhook signals
 */
export async function getWebhookSignalPerformance(params: {
  strategyIds?: number[];
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalSignals: number;
  successfulTrades: number;
  totalPnL: number;
  winRate: number;
  avgPnL: number;
  profitFactor: number;
  signalsByStrategy: {
    strategyId: number;
    tradeCount: number;
    totalPnL: number;
    winRate: number;
  }[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalSignals: 0,
      successfulTrades: 0,
      totalPnL: 0,
      winRate: 0,
      avgPnL: 0,
      profitFactor: 0,
      signalsByStrategy: [],
    };
  }

  // Build conditions for webhook trades only
  const conditions = [eq(trades.source, "webhook")];

  if (params.strategyIds && params.strategyIds.length > 0) {
    conditions.push(inArray(trades.strategyId, params.strategyIds));
  }

  if (params.startDate) {
    conditions.push(gte(trades.exitDate, params.startDate.toISOString()));
  }

  if (params.endDate) {
    conditions.push(lte(trades.exitDate, params.endDate.toISOString()));
  }

  // Get overall webhook stats
  const overallStats = await db
    .select({
      totalSignals: sql<number>`COUNT(*)`,
      totalPnL: sql<number>`SUM(${trades.pnl})`,
      winCount: sql<number>`SUM(CASE WHEN ${trades.pnl} > 0 THEN 1 ELSE 0 END)`,
      totalWins: sql<number>`SUM(CASE WHEN ${trades.pnl} > 0 THEN ${trades.pnl} ELSE 0 END)`,
      totalLosses: sql<number>`SUM(CASE WHEN ${trades.pnl} < 0 THEN ABS(${trades.pnl}) ELSE 0 END)`,
    })
    .from(trades)
    .where(and(...conditions));

  // Get stats by strategy
  const strategyStats = await db
    .select({
      strategyId: trades.strategyId,
      tradeCount: sql<number>`COUNT(*)`,
      totalPnL: sql<number>`SUM(${trades.pnl})`,
      winCount: sql<number>`SUM(CASE WHEN ${trades.pnl} > 0 THEN 1 ELSE 0 END)`,
    })
    .from(trades)
    .where(and(...conditions))
    .groupBy(trades.strategyId);

  const stats = overallStats[0];
  const totalSignals = Number(stats?.totalSignals || 0);
  const totalPnL = Number(stats?.totalPnL || 0) / 100;
  const winCount = Number(stats?.winCount || 0);
  const totalWins = Number(stats?.totalWins || 0) / 100;
  const totalLosses = Number(stats?.totalLosses || 0) / 100;

  return {
    totalSignals,
    successfulTrades: totalSignals, // All webhook entries are successful trades
    totalPnL,
    winRate: totalSignals > 0 ? (winCount / totalSignals) * 100 : 0,
    avgPnL: totalSignals > 0 ? totalPnL / totalSignals : 0,
    profitFactor:
      totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    signalsByStrategy: strategyStats.map(s => ({
      strategyId: s.strategyId,
      tradeCount: Number(s.tradeCount),
      totalPnL: Number(s.totalPnL) / 100,
      winRate:
        Number(s.tradeCount) > 0
          ? (Number(s.winCount) / Number(s.tradeCount)) * 100
          : 0,
    })),
  };
}
