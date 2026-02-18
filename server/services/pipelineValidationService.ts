/**
 * Pipeline Validation Service
 *
 * Provides comprehensive validation for all data pipelines:
 * - CSV Import validation
 * - Webhook processing validation
 * - Position tracking validation
 * - Trade data validation
 * - Analytics calculation validation
 */

import { getDb } from "../db";
import {
  trades,
  openPositions,
  webhookLogs,
  strategies,
} from "../../drizzle/schema";
import { eq, sql, and, isNull, isNotNull, desc } from "drizzle-orm";
import * as dataValidation from "../core/dataValidation";

// ============================================================================
// Types
// ============================================================================

export interface PipelineValidationResult {
  pipeline: string;
  status: "healthy" | "degraded" | "critical";
  checks: PipelineCheck[];
  timestamp: Date;
  duration: number;
}

export interface PipelineCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  details?: Record<string, unknown>;
  fixable?: boolean;
  fixAction?: string;
}

export interface CSVImportValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicates: number;
  invalidTrades: number;
  validTrades: number;
}

export interface WebhookPipelineStatus {
  walPendingCount: number;
  recentFailureRate: number;
  avgProcessingTime: number;
  orphanedExits: number;
  duplicateWebhooks: number;
}

export interface PositionPipelineStatus {
  openPositions: number;
  stalePositions: number;
  orphanedPositions: number;
  positionsWithoutTrades: number;
  inconsistentPnl: number;
}

// ============================================================================
// CSV Import Validation
// ============================================================================

/**
 * Validate trades before CSV import
 */
export function validateCSVImport(
  tradesToImport: Array<{
    entryDate: Date;
    exitDate: Date;
    direction: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
  }>
): CSVImportValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let duplicates = 0;
  let invalidTrades = 0;
  let validTrades = 0;

  // Track seen trades for duplicate detection
  const seenTrades = new Set<string>();

  for (let i = 0; i < tradesToImport.length; i++) {
    const trade = tradesToImport[i]!;
    const tradeIndex = i + 1;

    // Create unique key for duplicate detection
    const tradeKey = `${trade.entryDate.getTime()}-${trade.exitDate.getTime()}-${trade.entryPrice}-${trade.exitPrice}-${trade.direction}`;

    if (seenTrades.has(tradeKey)) {
      duplicates++;
      warnings.push(
        `Row ${tradeIndex}: Duplicate trade detected (same entry/exit date, price, direction)`
      );
      continue;
    }
    seenTrades.add(tradeKey);

    // Validate individual trade
    // Use index+1 for ID (must be > 0) and strategyId of 1 (placeholder for CSV import)
    const validation = dataValidation.validateTrade({
      id: i + 1,
      strategyId: 1,
      entryDate: trade.entryDate,
      exitDate: trade.exitDate,
      direction: trade.direction as "Long" | "Short",
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      pnl: trade.pnl,
      pnlPercent: 0,
      commission: 0,
    });

    if (!validation.isValid) {
      invalidTrades++;
      validation.errors.forEach(err =>
        errors.push(`Row ${tradeIndex}: ${err}`)
      );
    } else {
      validTrades++;
    }

    validation.warnings.forEach(warn =>
      warnings.push(`Row ${tradeIndex}: ${warn}`)
    );

    // Additional validations

    // Check for future dates
    const now = new Date();
    if (trade.exitDate > now) {
      errors.push(`Row ${tradeIndex}: Exit date is in the future`);
      invalidTrades++;
      validTrades--;
    }

    // Check for reasonable price ranges (futures typically 100-50000)
    if (trade.entryPrice < 100 || trade.entryPrice > 5000000) {
      warnings.push(
        `Row ${tradeIndex}: Entry price ${trade.entryPrice} seems unusual`
      );
    }

    // Check P&L consistency
    const expectedPnlDirection =
      trade.direction === "Long"
        ? trade.exitPrice > trade.entryPrice
          ? 1
          : -1
        : trade.exitPrice < trade.entryPrice
          ? 1
          : -1;

    if (trade.pnl !== 0 && Math.sign(trade.pnl) !== expectedPnlDirection) {
      warnings.push(
        `Row ${tradeIndex}: P&L sign doesn't match price movement for ${trade.direction} trade`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    duplicates,
    invalidTrades,
    validTrades,
  };
}

/**
 * Check for duplicates against existing database trades
 */
export async function checkDuplicatesAgainstDB(
  strategyId: number,
  tradesToImport: Array<{
    entryDate: Date;
    exitDate: Date;
    direction: string;
    entryPrice: number;
    exitPrice: number;
  }>
): Promise<{ duplicateCount: number; duplicateIndices: number[] }> {
  const db = await getDb();
  if (!db) return { duplicateCount: 0, duplicateIndices: [] };

  // Get existing trades for this strategy
  const existingTrades = await db
    .select({
      entryDate: trades.entryDate,
      exitDate: trades.exitDate,
      direction: trades.direction,
      entryPrice: trades.entryPrice,
      exitPrice: trades.exitPrice,
    })
    .from(trades)
    .where(eq(trades.strategyId, strategyId));

  // Create set of existing trade keys
  const existingKeys = new Set(
    existingTrades.map(
      t =>
        `${new Date(t.entryDate).getTime()}-${new Date(t.exitDate).getTime()}-${t.entryPrice}-${t.exitPrice}-${t.direction}`
    )
  );

  const duplicateIndices: number[] = [];

  tradesToImport.forEach((trade, index) => {
    const tradeKey = `${trade.entryDate.getTime()}-${trade.exitDate.getTime()}-${trade.entryPrice}-${trade.exitPrice}-${trade.direction}`;
    if (existingKeys.has(tradeKey)) {
      duplicateIndices.push(index);
    }
  });

  return {
    duplicateCount: duplicateIndices.length,
    duplicateIndices,
  };
}

// ============================================================================
// Webhook Pipeline Validation
// ============================================================================

/**
 * Get webhook pipeline status
 */
export async function getWebhookPipelineStatus(): Promise<WebhookPipelineStatus> {
  const db = await getDb();
  if (!db) {
    return {
      walPendingCount: 0,
      recentFailureRate: 0,
      avgProcessingTime: 0,
      orphanedExits: 0,
      duplicateWebhooks: 0,
    };
  }

  // Check WAL pending count
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Get recent webhook stats
  // Use sql template for date comparison to ensure proper column name handling
  const [webhookStats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      avgTime: sql<number>`AVG(processing_time_ms)`,
    })
    .from(webhookLogs)
    .where(sql`${webhookLogs.createdAt} > ${oneHourAgo}`);

  const total = Number(webhookStats?.total) || 0;
  const failed = Number(webhookStats?.failed) || 0;
  const avgTime = Number(webhookStats?.avgTime) || 0;

  // Check for orphaned exit webhooks (success but no trade ID)
  const [orphanedExits] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(webhookLogs)
    .where(
      and(
        eq(webhookLogs.status, "success"),
        isNotNull(webhookLogs.exitPrice),
        isNull(webhookLogs.tradeId)
      )
    );

  // Check for duplicate webhooks (same correlation ID within 5 seconds)
  const [duplicates] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(webhookLogs).where(sql`correlation_id IN (
    SELECT correlation_id FROM webhook_logs 
    GROUP BY correlation_id 
    HAVING COUNT(*) > 1
  )`);

  return {
    walPendingCount: 0, // Would need to query webhook_wal table
    recentFailureRate: total > 0 ? (failed / total) * 100 : 0,
    avgProcessingTime: avgTime,
    orphanedExits: Number(orphanedExits?.count) || 0,
    duplicateWebhooks: Number(duplicates?.count) || 0,
  };
}

/**
 * Validate webhook pipeline
 */
export async function validateWebhookPipeline(): Promise<PipelineValidationResult> {
  const startTime = Date.now();
  const checks: PipelineCheck[] = [];

  const status = await getWebhookPipelineStatus();

  // Check 1: Failure rate
  if (status.recentFailureRate > 20) {
    checks.push({
      name: "Webhook Failure Rate",
      status: "fail",
      message: `${status.recentFailureRate.toFixed(1)}% failure rate in last hour`,
      details: { failureRate: status.recentFailureRate },
    });
  } else if (status.recentFailureRate > 10) {
    checks.push({
      name: "Webhook Failure Rate",
      status: "warn",
      message: `${status.recentFailureRate.toFixed(1)}% failure rate in last hour`,
      details: { failureRate: status.recentFailureRate },
    });
  } else {
    checks.push({
      name: "Webhook Failure Rate",
      status: "pass",
      message: `${status.recentFailureRate.toFixed(1)}% failure rate in last hour`,
      details: { failureRate: status.recentFailureRate },
    });
  }

  // Check 2: Processing time
  if (status.avgProcessingTime > 1000) {
    checks.push({
      name: "Processing Time",
      status: "warn",
      message: `Average processing time ${status.avgProcessingTime.toFixed(0)}ms exceeds 1s`,
      details: { avgTime: status.avgProcessingTime },
    });
  } else {
    checks.push({
      name: "Processing Time",
      status: "pass",
      message: `Average processing time ${status.avgProcessingTime.toFixed(0)}ms`,
      details: { avgTime: status.avgProcessingTime },
    });
  }

  // Check 3: Orphaned exits
  if (status.orphanedExits > 0) {
    checks.push({
      name: "Orphaned Exit Webhooks",
      status: "warn",
      message: `${status.orphanedExits} successful exit webhooks without trade IDs`,
      details: { count: status.orphanedExits },
      fixable: true,
      fixAction: "Link orphaned exits to trades or investigate missing trades",
    });
  } else {
    checks.push({
      name: "Orphaned Exit Webhooks",
      status: "pass",
      message: "No orphaned exit webhooks",
    });
  }

  // Check 4: Duplicates
  if (status.duplicateWebhooks > 0) {
    checks.push({
      name: "Duplicate Webhooks",
      status: "warn",
      message: `${status.duplicateWebhooks} duplicate webhooks detected`,
      details: { count: status.duplicateWebhooks },
    });
  } else {
    checks.push({
      name: "Duplicate Webhooks",
      status: "pass",
      message: "No duplicate webhooks",
    });
  }

  // Determine overall status
  const hasFailures = checks.some(c => c.status === "fail");
  const hasWarnings = checks.some(c => c.status === "warn");

  return {
    pipeline: "webhook",
    status: hasFailures ? "critical" : hasWarnings ? "degraded" : "healthy",
    checks,
    timestamp: new Date(),
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Position Pipeline Validation
// ============================================================================

/**
 * Get position pipeline status
 */
export async function getPositionPipelineStatus(): Promise<PositionPipelineStatus> {
  const db = await getDb();
  if (!db) {
    return {
      openPositions: 0,
      stalePositions: 0,
      orphanedPositions: 0,
      positionsWithoutTrades: 0,
      inconsistentPnl: 0,
    };
  }

  // Count open positions
  const [openCount] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(openPositions)
    .where(eq(openPositions.status, "open"));

  // Count stale positions (open > 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [staleCount] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(openPositions)
    .where(
      and(
        eq(openPositions.status, "open"),
        sql`${openPositions.entryTime} < ${oneDayAgo}`
      )
    );

  // Count closed positions without trade IDs
  const [orphanedCount] = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNull(openPositions.tradeId))
    );

  return {
    openPositions: Number(openCount?.count) || 0,
    stalePositions: Number(staleCount?.count) || 0,
    orphanedPositions: Number(orphanedCount?.count) || 0,
    positionsWithoutTrades: Number(orphanedCount?.count) || 0,
    inconsistentPnl: 0, // Would need to compare position PnL vs trade PnL
  };
}

/**
 * Validate position pipeline
 */
export async function validatePositionPipeline(): Promise<PipelineValidationResult> {
  const startTime = Date.now();
  const checks: PipelineCheck[] = [];

  const status = await getPositionPipelineStatus();

  // Check 1: Open positions
  checks.push({
    name: "Open Positions",
    status: "pass",
    message: `${status.openPositions} positions currently open`,
    details: { count: status.openPositions },
  });

  // Check 2: Stale positions
  if (status.stalePositions > 0) {
    checks.push({
      name: "Stale Positions",
      status: "warn",
      message: `${status.stalePositions} positions open for more than 24 hours`,
      details: { count: status.stalePositions },
      fixable: true,
      fixAction:
        "Review and close stale positions or verify they are intentional",
    });
  } else {
    checks.push({
      name: "Stale Positions",
      status: "pass",
      message: "No stale positions",
    });
  }

  // Check 3: Orphaned positions
  if (status.orphanedPositions > 0) {
    checks.push({
      name: "Orphaned Positions",
      status: "fail",
      message: `${status.orphanedPositions} closed positions without trade records`,
      details: { count: status.orphanedPositions },
      fixable: true,
      fixAction: "Create missing trade records for orphaned positions",
    });
  } else {
    checks.push({
      name: "Orphaned Positions",
      status: "pass",
      message: "All closed positions have trade records",
    });
  }

  // Determine overall status
  const hasFailures = checks.some(c => c.status === "fail");
  const hasWarnings = checks.some(c => c.status === "warn");

  return {
    pipeline: "position",
    status: hasFailures ? "critical" : hasWarnings ? "degraded" : "healthy",
    checks,
    timestamp: new Date(),
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Trade Data Validation
// ============================================================================

/**
 * Validate trade data integrity
 */
export async function validateTradeData(
  strategyId?: number
): Promise<PipelineValidationResult> {
  const startTime = Date.now();
  const checks: PipelineCheck[] = [];

  const db = await getDb();
  if (!db) {
    return {
      pipeline: "trade-data",
      status: "critical",
      checks: [
        {
          name: "Database Connection",
          status: "fail",
          message: "Cannot connect to database",
        },
      ],
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  // Get trades to validate
  let tradesQuery = db.select().from(trades);
  if (strategyId) {
    tradesQuery = tradesQuery.where(eq(trades.strategyId, strategyId)) as any;
  }
  const allTrades = await tradesQuery;

  // Convert to validation format
  const tradesToValidate = allTrades.map(t => ({
    id: t.id,
    strategyId: t.strategyId,
    entryDate: new Date(t.entryDate),
    exitDate: new Date(t.exitDate),
    direction: t.direction as "Long" | "Short",
    entryPrice: t.entryPrice,
    exitPrice: t.exitPrice,
    quantity: t.quantity,
    pnl: t.pnl,
    pnlPercent: t.pnlPercent,
    commission: t.commission,
  }));

  // Run validation
  const validation = dataValidation.validateTrades(tradesToValidate);
  const outliers = dataValidation.detectOutliers(validation.validTrades);
  const issues = dataValidation.detectDataIssues(validation.validTrades);

  // Check 1: Invalid trades
  if (validation.invalidTrades.length > 0) {
    checks.push({
      name: "Trade Validation",
      status: "fail",
      message: `${validation.invalidTrades.length} invalid trades found`,
      details: {
        invalidCount: validation.invalidTrades.length,
        totalErrors: validation.totalErrors,
      },
      fixable: true,
      fixAction: "Review and fix invalid trade records",
    });
  } else {
    checks.push({
      name: "Trade Validation",
      status: "pass",
      message: `All ${validation.validTrades.length} trades are valid`,
    });
  }

  // Check 2: Outliers
  if (outliers.length > 0) {
    checks.push({
      name: "Outlier Detection",
      status: "warn",
      message: `${outliers.length} statistical outliers detected`,
      details: {
        outlierCount: outliers.length,
        outliers: outliers.slice(0, 5).map(o => ({
          tradeId: o.trade.id,
          reason: o.reason,
          zScore: o.zScore,
        })),
      },
    });
  } else {
    checks.push({
      name: "Outlier Detection",
      status: "pass",
      message: "No statistical outliers detected",
    });
  }

  // Check 3: Data issues
  if (issues.length > 0) {
    checks.push({
      name: "Data Issues",
      status: "warn",
      message: `${issues.length} potential data issues found`,
      details: { issues: issues.slice(0, 10) },
    });
  } else {
    checks.push({
      name: "Data Issues",
      status: "pass",
      message: "No data issues detected",
    });
  }

  // Determine overall status
  const hasFailures = checks.some(c => c.status === "fail");
  const hasWarnings = checks.some(c => c.status === "warn");

  return {
    pipeline: "trade-data",
    status: hasFailures ? "critical" : hasWarnings ? "degraded" : "healthy",
    checks,
    timestamp: new Date(),
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Analytics Pipeline Validation
// ============================================================================

/**
 * Validate analytics calculations
 */
export async function validateAnalyticsPipeline(): Promise<PipelineValidationResult> {
  const startTime = Date.now();
  const checks: PipelineCheck[] = [];

  const db = await getDb();
  if (!db) {
    return {
      pipeline: "analytics",
      status: "critical",
      checks: [
        {
          name: "Database Connection",
          status: "fail",
          message: "Cannot connect to database",
        },
      ],
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  // Check 1: Strategy coverage
  const allStrategies = await db.select().from(strategies);
  const strategiesWithTrades = await db
    .select({
      strategyId: trades.strategyId,
      count: sql<number>`COUNT(*)`,
    })
    .from(trades)
    .groupBy(trades.strategyId);

  const strategiesWithTradesSet = new Set(
    strategiesWithTrades.map(s => s.strategyId)
  );
  const strategiesWithoutTrades = allStrategies.filter(
    s => !strategiesWithTradesSet.has(s.id)
  );

  if (strategiesWithoutTrades.length > 0) {
    checks.push({
      name: "Strategy Coverage",
      status: "warn",
      message: `${strategiesWithoutTrades.length} strategies have no trades`,
      details: {
        strategiesWithoutTrades: strategiesWithoutTrades.map(s => s.name),
      },
    });
  } else {
    checks.push({
      name: "Strategy Coverage",
      status: "pass",
      message: `All ${allStrategies.length} strategies have trade data`,
    });
  }

  // Check 2: Trade date coverage
  const [dateRange] = await db
    .select({
      minDate: sql<Date>`MIN(exit_date)`,
      maxDate: sql<Date>`MAX(exit_date)`,
    })
    .from(trades);

  if (dateRange?.minDate && dateRange?.maxDate) {
    const daysCovered = Math.round(
      (new Date(dateRange.maxDate).getTime() -
        new Date(dateRange.minDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    checks.push({
      name: "Date Coverage",
      status: "pass",
      message: `Trade data spans ${daysCovered} days`,
      details: {
        minDate: dateRange.minDate,
        maxDate: dateRange.maxDate,
        daysCovered,
      },
    });
  }

  // Check 3: Recent data freshness
  const [recentTrade] = await db
    .select({
      maxDate: sql<Date>`MAX(exit_date)`,
    })
    .from(trades);

  if (recentTrade?.maxDate) {
    const daysSinceLastTrade = Math.round(
      (Date.now() - new Date(recentTrade.maxDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastTrade > 7) {
      checks.push({
        name: "Data Freshness",
        status: "warn",
        message: `Last trade was ${daysSinceLastTrade} days ago`,
        details: {
          lastTradeDate: recentTrade.maxDate,
          daysSince: daysSinceLastTrade,
        },
      });
    } else {
      checks.push({
        name: "Data Freshness",
        status: "pass",
        message: `Last trade was ${daysSinceLastTrade} days ago`,
        details: {
          lastTradeDate: recentTrade.maxDate,
          daysSince: daysSinceLastTrade,
        },
      });
    }
  }

  // Determine overall status
  const hasFailures = checks.some(c => c.status === "fail");
  const hasWarnings = checks.some(c => c.status === "warn");

  return {
    pipeline: "analytics",
    status: hasFailures ? "critical" : hasWarnings ? "degraded" : "healthy",
    checks,
    timestamp: new Date(),
    duration: Date.now() - startTime,
  };
}

// ============================================================================
// Full Pipeline Validation
// ============================================================================

/**
 * Run validation on all pipelines
 */
export async function validateAllPipelines(): Promise<{
  overall: "healthy" | "degraded" | "critical";
  pipelines: PipelineValidationResult[];
  timestamp: Date;
  totalDuration: number;
}> {
  const startTime = Date.now();

  const pipelines = await Promise.all([
    validateWebhookPipeline(),
    validatePositionPipeline(),
    validateTradeData(),
    validateAnalyticsPipeline(),
  ]);

  // Determine overall status
  const hasCritical = pipelines.some(p => p.status === "critical");
  const hasDegraded = pipelines.some(p => p.status === "degraded");

  return {
    overall: hasCritical ? "critical" : hasDegraded ? "degraded" : "healthy",
    pipelines,
    timestamp: new Date(),
    totalDuration: Date.now() - startTime,
  };
}

// ============================================================================
// Auto-Repair Functions
// ============================================================================

/**
 * Create missing trades for orphaned closed positions
 */
export async function repairOrphanedPositions(): Promise<{
  repaired: number;
  failed: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db)
    return { repaired: 0, failed: 0, errors: ["Database not available"] };

  const errors: string[] = [];
  let repaired = 0;
  let failed = 0;

  // Get orphaned positions
  const orphaned = await db
    .select()
    .from(openPositions)
    .where(
      and(eq(openPositions.status, "closed"), isNull(openPositions.tradeId))
    );

  for (const position of orphaned) {
    try {
      // Get strategy ID from symbol
      const [strategy] = await db
        .select()
        .from(strategies)
        .where(eq(strategies.symbol, position.strategySymbol));

      if (!strategy) {
        errors.push(
          `Position ${position.id}: Strategy not found for symbol ${position.strategySymbol}`
        );
        failed++;
        continue;
      }

      // Create trade record
      // @ts-expect-error TS2769
      const [result] = await db.insert(trades).values({
        strategyId: strategy.id,
        entryDate: position.entryTime,
        exitDate: position.exitTime || new Date(),
        direction: position.direction === "long" ? "Long" : "Short",
        entryPrice: position.entryPrice,
        exitPrice: position.exitPrice || position.entryPrice,
        quantity: position.quantity,
        pnl: position.pnl || 0,
        pnlPercent: 0,
        commission: 0,
      });

      // Update position with trade ID
      const insertId = (result as any).insertId;
      if (insertId) {
        await db
          .update(openPositions)
          .set({ tradeId: insertId })
          .where(eq(openPositions.id, position.id));
        repaired++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Position ${position.id}: ${errorMsg}`);
      failed++;
    }
  }

  return { repaired, failed, errors };
}

/**
 * Link orphaned exit webhooks to their trades
 */
export async function repairOrphanedExitWebhooks(): Promise<{
  repaired: number;
  failed: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db)
    return { repaired: 0, failed: 0, errors: ["Database not available"] };

  const errors: string[] = [];
  let repaired = 0;
  let failed = 0;

  // Get orphaned exit webhooks
  const orphaned = await db
    .select()
    .from(webhookLogs)
    .where(
      and(
        eq(webhookLogs.status, "success"),
        isNotNull(webhookLogs.exitPrice),
        isNull(webhookLogs.tradeId)
      )
    );

  for (const webhook of orphaned) {
    try {
      // Find matching trade by strategy, exit price, and time
      const [matchingTrade] = await db
        .select()
        .from(trades)
        .innerJoin(strategies, eq(trades.strategyId, strategies.id))
        .where(
          and(
            eq(strategies.symbol, webhook.strategySymbol || ""),
            eq(trades.exitPrice, webhook.exitPrice || 0)
          )
        )
        .orderBy(desc(trades.exitDate))
        .limit(1);

      if (matchingTrade) {
        await db
          .update(webhookLogs)
          .set({ tradeId: matchingTrade.trades.id })
          .where(eq(webhookLogs.id, webhook.id));
        repaired++;
      } else {
        errors.push(`Webhook ${webhook.id}: No matching trade found`);
        failed++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Webhook ${webhook.id}: ${errorMsg}`);
      failed++;
    }
  }

  return { repaired, failed, errors };
}
