/**
 * Data Integrity Validation Service
 *
 * Provides comprehensive validation of the webhook-to-trade data pipeline,
 * detecting orphaned records, P&L mismatches, and other data consistency issues.
 */

import { getDb } from "../db";
import { trades, openPositions, webhookLogs } from "../../drizzle/schema";
import { eq, sql, and, isNull, isNotNull } from "drizzle-orm";

export interface ValidationResult {
  isValid: boolean;
  timestamp: Date;
  duration: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: ValidationStats;
}

export interface ValidationError {
  code: string;
  message: string;
  table: string;
  recordId: number;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  table: string;
  recordId?: number;
  details?: Record<string, unknown>;
}

export interface ValidationStats {
  openPositions: number;
  closedPositions: number;
  totalTrades: number;
  webhookLogs: number;
  successfulWebhooks: number;
  failedWebhooks: number;
  orphanedPositions: number;
  orphanedTrades: number;
  pnlMismatches: number;
}

/**
 * Run comprehensive data integrity validation
 */
export async function validateDataIntegrity(): Promise<ValidationResult> {
  const startTime = Date.now();
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const db = await getDb();
  if (!db) {
    return {
      isValid: false,
      timestamp: new Date(),
      duration: Date.now() - startTime,
      errors: [
        {
          code: "DB_UNAVAILABLE",
          message: "Database connection not available",
          table: "system",
          recordId: 0,
        },
      ],
      warnings: [],
      stats: {
        openPositions: 0,
        closedPositions: 0,
        totalTrades: 0,
        webhookLogs: 0,
        successfulWebhooks: 0,
        failedWebhooks: 0,
        orphanedPositions: 0,
        orphanedTrades: 0,
        pnlMismatches: 0,
      },
    };
  }

  // Gather stats
  const [positionStats] = await db
    .select({
      open: sql<number>`SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)`,
      closed: sql<number>`SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)`,
    })
    .from(openPositions);

  const [tradeStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
    })
    .from(trades);

  const [webhookStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      success: sql<number>`SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(webhookLogs);

  // Validation 1: Check for closed positions without trades
  const orphanedPositions = await db
    .select({
      id: openPositions.id,
      strategySymbol: openPositions.strategySymbol,
      direction: openPositions.direction,
      entryPrice: openPositions.entryPrice,
      exitPrice: openPositions.exitPrice,
      pnl: openPositions.pnl,
    })
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNull(openPositions.tradeId))
    );

  orphanedPositions.forEach(pos => {
    errors.push({
      code: "ORPHANED_POSITION",
      message: `Closed position ${pos.id} (${pos.strategySymbol}) has no associated trade`,
      table: "open_positions",
      recordId: pos.id,
      details: {
        strategySymbol: pos.strategySymbol,
        direction: pos.direction,
        pnl: pos.pnl,
      },
    });
  });

  // Validation 2: Check for trades without corresponding closed positions
  // NOTE: CSV-imported historical trades don't have corresponding positions - this is expected.
  // We only track the count for stats but don't generate warnings since most trades are imports.
  const closedPositionsWithTrades = await db
    .select({
      tradeId: openPositions.tradeId,
    })
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNotNull(openPositions.tradeId))
    );

  const tradeIdsWithPositions = new Set(
    closedPositionsWithTrades.map(p => p.tradeId)
  );

  // Count orphaned trades for stats only (no warnings - CSV imports are expected)
  const allTradesForCount = await db.select({ id: trades.id }).from(trades);
  const orphanedTradesCount = allTradesForCount.filter(
    t => !tradeIdsWithPositions.has(t.id)
  ).length;

  // Validation 3: Check for P&L mismatches between positions and trades
  const positionsWithTrades = await db
    .select({
      positionId: openPositions.id,
      positionPnl: openPositions.pnl,
      tradeId: openPositions.tradeId,
      strategySymbol: openPositions.strategySymbol,
    })
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNotNull(openPositions.tradeId))
    );

  let pnlMismatches = 0;
  for (const pos of positionsWithTrades) {
    if (pos.tradeId) {
      const [trade] = await db
        .select({
          pnl: trades.pnl,
        })
        .from(trades)
        .where(eq(trades.id, pos.tradeId));

      if (trade && pos.positionPnl !== trade.pnl) {
        pnlMismatches++;
        errors.push({
          code: "PNL_MISMATCH",
          message: `P&L mismatch: Position ${pos.positionId} has ${pos.positionPnl}, Trade ${pos.tradeId} has ${trade.pnl}`,
          table: "open_positions",
          recordId: pos.positionId,
          details: {
            positionPnl: pos.positionPnl,
            tradePnl: trade.pnl,
            difference: (pos.positionPnl || 0) - trade.pnl,
          },
        });
      }
    }
  }

  // Validation 4: Check for webhook logs with success status but no trade ID for exit signals
  const exitWebhooksWithoutTrade = await db
    .select({
      id: webhookLogs.id,
      strategySymbol: webhookLogs.strategySymbol,
      exitPrice: webhookLogs.exitPrice,
    })
    .from(webhookLogs)
    .where(
      and(
        eq(webhookLogs.status, "success"),
        isNotNull(webhookLogs.exitPrice),
        isNull(webhookLogs.tradeId)
      )
    );

  exitWebhooksWithoutTrade.forEach(log => {
    warnings.push({
      code: "EXIT_WEBHOOK_NO_TRADE",
      message: `Successful exit webhook ${log.id} has no trade ID`,
      table: "webhook_logs",
      recordId: log.id,
      details: {
        strategySymbol: log.strategySymbol,
        exitPrice: log.exitPrice,
      },
    });
  });

  // Validation 5: Check for open positions older than expected (potential stuck positions)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const stalePositions = await db
    .select({
      id: openPositions.id,
      strategySymbol: openPositions.strategySymbol,
      entryTime: openPositions.entryTime,
      direction: openPositions.direction,
    })
    .from(openPositions)
    .where(
      and(
        eq(openPositions.status, "open"),
        sql`${openPositions.entryTime} < ${oneDayAgo}`
      )
    );

  stalePositions.forEach(pos => {
    warnings.push({
      code: "STALE_POSITION",
      message: `Position ${pos.id} (${pos.strategySymbol}) has been open for more than 24 hours`,
      table: "open_positions",
      recordId: pos.id,
      details: {
        strategySymbol: pos.strategySymbol,
        direction: pos.direction,
        entryTime: pos.entryTime,
      },
    });
  });

  return {
    isValid: errors.length === 0,
    timestamp: new Date(),
    duration: Date.now() - startTime,
    errors,
    warnings,
    stats: {
      openPositions: Number(positionStats?.open) || 0,
      closedPositions: Number(positionStats?.closed) || 0,
      totalTrades: Number(tradeStats?.total) || 0,
      webhookLogs: Number(webhookStats?.total) || 0,
      successfulWebhooks: Number(webhookStats?.success) || 0,
      failedWebhooks: Number(webhookStats?.failed) || 0,
      orphanedPositions: orphanedPositions.length,
      orphanedTrades: orphanedTradesCount,
      pnlMismatches,
    },
  };
}

/**
 * Quick health check for the data pipeline
 */
export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    value?: number;
  }[];
}> {
  const checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message: string;
    value?: number;
  }[] = [];

  const db = await getDb();
  if (!db) {
    return {
      healthy: false,
      checks: [
        {
          name: "Database Connection",
          status: "fail",
          message: "Cannot connect to database",
        },
      ],
    };
  }

  // Check 1: Database connection
  checks.push({
    name: "Database Connection",
    status: "pass",
    message: "Connected",
  });

  // Check 2: Recent webhook success rate (excluding test webhooks and expected test failures)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  // Exclude test webhooks (isTest=1) and also exclude common test failure patterns
  const [recentWebhooks] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      success: sql<number>`SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' AND errorMessage NOT LIKE '%Invalid%authentication%' AND errorMessage NOT LIKE '%Unknown strategy%' AND errorMessage NOT LIKE '%POSITION_EXISTS%' THEN 1 ELSE 0 END)`,
    })
    .from(webhookLogs)
    .where(
      sql`${webhookLogs.createdAt} > ${oneHourAgo} AND (${webhookLogs.isTest} = 0 OR ${webhookLogs.isTest} IS NULL)`
    );

  const total = Number(recentWebhooks?.total) || 0;
  const failed = Number(recentWebhooks?.failed) || 0;
  const failureRate = total > 0 ? (failed / total) * 100 : 0;

  if (failureRate > 20) {
    checks.push({
      name: "Webhook Success Rate",
      status: "fail",
      message: `${(100 - failureRate).toFixed(1)}% success rate (last hour)`,
      value: 100 - failureRate,
    });
  } else if (failureRate > 10) {
    checks.push({
      name: "Webhook Success Rate",
      status: "warn",
      message: `${(100 - failureRate).toFixed(1)}% success rate (last hour)`,
      value: 100 - failureRate,
    });
  } else {
    checks.push({
      name: "Webhook Success Rate",
      status: "pass",
      message:
        total > 0
          ? `${(100 - failureRate).toFixed(1)}% success rate (last hour)`
          : "No webhooks in last hour",
      value: 100 - failureRate,
    });
  }

  // Check 3: Orphaned positions
  const [orphanedCount] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNull(openPositions.tradeId))
    );

  const orphaned = Number(orphanedCount?.count) || 0;
  if (orphaned > 0) {
    checks.push({
      name: "Data Integrity",
      status: "fail",
      message: `${orphaned} closed positions without trades`,
      value: orphaned,
    });
  } else {
    checks.push({
      name: "Data Integrity",
      status: "pass",
      message: "All closed positions have trades",
      value: 0,
    });
  }

  // Check 4: Open positions count
  const [openCount] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(openPositions)
    .where(eq(openPositions.status, "open"));

  const open = Number(openCount?.count) || 0;
  checks.push({
    name: "Open Positions",
    status: "pass",
    message: `${open} positions currently open`,
    value: open,
  });

  // Check 5: Recent processing latency (excluding test webhooks)
  const [latencyStats] = await db
    .select({
      avgLatency: sql<number>`AVG(processingTimeMs)`,
      maxLatency: sql<number>`MAX(processingTimeMs)`,
    })
    .from(webhookLogs)
    .where(
      sql`${webhookLogs.createdAt} > ${oneHourAgo} AND ${webhookLogs.isTest} = false`
    );

  const avgLatency = Number(latencyStats?.avgLatency) || 0;
  const maxLatency = Number(latencyStats?.maxLatency) || 0;

  if (avgLatency > 1000) {
    checks.push({
      name: "Processing Latency",
      status: "warn",
      message: `Avg: ${avgLatency.toFixed(0)}ms, Max: ${maxLatency.toFixed(0)}ms`,
      value: avgLatency,
    });
  } else {
    checks.push({
      name: "Processing Latency",
      status: "pass",
      message:
        avgLatency > 0
          ? `Avg: ${avgLatency.toFixed(0)}ms, Max: ${maxLatency.toFixed(0)}ms`
          : "No recent data",
      value: avgLatency,
    });
  }

  return {
    healthy: checks.every(c => c.status !== "fail"),
    checks,
  };
}

/**
 * Get detailed reconciliation report
 */
export async function getReconciliationReport(): Promise<{
  generatedAt: Date;
  summary: {
    totalPositions: number;
    totalTrades: number;
    matchedRecords: number;
    unmatchedPositions: number;
    unmatchedTrades: number;
  };
  unmatchedPositions: Array<{
    id: number;
    strategySymbol: string;
    direction: string;
    entryTime: Date;
    exitTime: Date | null;
    pnl: number | null;
    issue: string;
  }>;
  unmatchedTrades: Array<{
    id: number;
    strategyId: number;
    direction: string;
    entryDate: Date;
    exitDate: Date;
    pnl: number;
    issue: string;
  }>;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Get all closed positions
  const allClosedPositions = await db
    .select()
    .from(openPositions)
    .where(eq(openPositions.status, "closed"));

  // Get all trades
  const allTrades = await db.select().from(trades);

  // Find unmatched positions (closed but no trade)
  const unmatchedPositions = allClosedPositions
    .filter(p => !p.tradeId)
    .map(p => ({
      id: p.id,
      strategySymbol: p.strategySymbol,
      direction: p.direction,
      entryTime: p.entryTime,
      exitTime: p.exitTime,
      pnl: p.pnl,
      issue: "No trade ID assigned",
    }));

  // Find unmatched trades (no corresponding position)
  const positionTradeIds = new Set(
    allClosedPositions.map(p => p.tradeId).filter(Boolean)
  );
  const unmatchedTrades = allTrades
    .filter(t => !positionTradeIds.has(t.id))
    .map(t => ({
      id: t.id,
      strategyId: t.strategyId,
      direction: t.direction,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
      pnl: t.pnl,
      issue: "No corresponding position (may be from CSV import)",
    }));

  return {
    generatedAt: new Date(),
    summary: {
      totalPositions: allClosedPositions.length,
      totalTrades: allTrades.length,
      matchedRecords: allClosedPositions.filter(p => p.tradeId).length,
      unmatchedPositions: unmatchedPositions.length,
      unmatchedTrades: unmatchedTrades.length,
    },
    // @ts-expect-error TS2322
    unmatchedPositions,
    // @ts-expect-error TS2322
    unmatchedTrades,
  };
}
