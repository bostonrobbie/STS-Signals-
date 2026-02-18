/**
 * Scheduled Integrity Check Service
 * 
 * Runs periodic data integrity checks and sends notifications
 * when issues are detected. Can be triggered by cron jobs or
 * called manually from the admin panel.
 */

import { getDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { 
  openPositions, 
  webhookLogs
} from '../../drizzle/schema';
import { notifyAdmins } from './inAppNotificationService';
import { runPeriodicChecks, sendDailyDigestToAdmins } from './notificationTriggerService';

export interface IntegrityCheckResult {
  checkName: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface FullIntegrityReport {
  overallStatus: 'healthy' | 'warning' | 'critical';
  checks: IntegrityCheckResult[];
  executionTimeMs: number;
  timestamp: Date;
}

/**
 * Check for orphaned open positions (positions without recent webhook activity)
 */
async function checkOrphanedPositions(): Promise<IntegrityCheckResult> {
  const db = await getDb();
  if (!db) {
    return {
      checkName: 'Orphaned Positions',
      status: 'fail',
      message: 'Database not available',
      timestamp: new Date(),
    };
  }

  // Positions open for more than 7 days without activity
  const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const stalePositions = await db
    .select({
      id: openPositions.id,
      strategyId: openPositions.strategyId,
      entryTime: openPositions.entryTime,
    })
    .from(openPositions)
    .where(
      and(
        eq(openPositions.status, 'open'),
        sql`${openPositions.entryTime} < ${staleThreshold}`
      )
    );

  if (stalePositions.length > 0) {
    return {
      checkName: 'Orphaned Positions',
      status: 'warning',
      message: `Found ${stalePositions.length} positions open for more than 7 days`,
      details: { positions: stalePositions.map(p => p.id) },
      timestamp: new Date(),
    };
  }

  return {
    checkName: 'Orphaned Positions',
    status: 'pass',
    message: 'No orphaned positions detected',
    timestamp: new Date(),
  };
}

/**
 * Check for webhook processing failures in the last 24 hours
 */
async function checkWebhookFailures(): Promise<IntegrityCheckResult> {
  const db = await getDb();
  if (!db) {
    return {
      checkName: 'Webhook Failures',
      status: 'fail',
      message: 'Database not available',
      timestamp: new Date(),
    };
  }

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(webhookLogs)
    .where(
      and(
        sql`created_at >= ${last24Hours}`,
        sql`(is_test = false OR is_test IS NULL)`
      )
    );

  const total = result[0]?.total ?? 0;
  const failed = result[0]?.failed ?? 0;
  const failureRate = total > 0 ? (failed / total) * 100 : 0;

  if (failureRate > 20) {
    return {
      checkName: 'Webhook Failures',
      status: 'fail',
      message: `High failure rate: ${failureRate.toFixed(1)}% (${failed}/${total}) in last 24 hours`,
      details: { total, failed, failureRate },
      timestamp: new Date(),
    };
  }

  if (failureRate > 5) {
    return {
      checkName: 'Webhook Failures',
      status: 'warning',
      message: `Elevated failure rate: ${failureRate.toFixed(1)}% (${failed}/${total}) in last 24 hours`,
      details: { total, failed, failureRate },
      timestamp: new Date(),
    };
  }

  return {
    checkName: 'Webhook Failures',
    status: 'pass',
    message: `Healthy: ${failureRate.toFixed(1)}% failure rate (${failed}/${total}) in last 24 hours`,
    details: { total, failed, failureRate },
    timestamp: new Date(),
  };
}

/**
 * Check for P&L calculation discrepancies
 */
async function checkPnlDiscrepancies(): Promise<IntegrityCheckResult> {
  const db = await getDb();
  if (!db) {
    return {
      checkName: 'P&L Discrepancies',
      status: 'fail',
      message: 'Database not available',
      timestamp: new Date(),
    };
  }

  // Check for trades where calculated P&L doesn't match stored P&L
  const discrepancies = await db.execute(sql`
    SELECT 
      t.id,
      t.pnl as stored_pnl,
      (t.exit_price - t.entry_price) * t.quantity * 
        CASE WHEN t.direction = 'Long' THEN 1 ELSE -1 END as calculated_pnl
    FROM trades t
    WHERE t.pnl IS NOT NULL 
      AND t.entry_price IS NOT NULL 
      AND t.exit_price IS NOT NULL
      AND ABS(t.pnl - ((t.exit_price - t.entry_price) * t.quantity * 
        CASE WHEN t.direction = 'Long' THEN 1 ELSE -1 END)) > 100
    LIMIT 10
  `);

  const discrepancyCount = (discrepancies as any)[0]?.length ?? 0;

  if (discrepancyCount > 0) {
    return {
      checkName: 'P&L Discrepancies',
      status: 'warning',
      message: `Found ${discrepancyCount} trades with P&L calculation discrepancies`,
      details: { count: discrepancyCount },
      timestamp: new Date(),
    };
  }

  return {
    checkName: 'P&L Discrepancies',
    status: 'pass',
    message: 'No P&L discrepancies detected',
    timestamp: new Date(),
  };
}

/**
 * Check database connection health
 */
async function checkDatabaseHealth(): Promise<IntegrityCheckResult> {
  const startTime = Date.now();
  
  try {
    const db = await getDb();
    if (!db) {
      return {
        checkName: 'Database Health',
        status: 'fail',
        message: 'Database connection failed',
        timestamp: new Date(),
      };
    }

    // Simple query to test connection
    await db.execute(sql`SELECT 1`);
    
    const latency = Date.now() - startTime;

    if (latency > 1000) {
      return {
        checkName: 'Database Health',
        status: 'warning',
        message: `Database responding slowly: ${latency}ms`,
        details: { latencyMs: latency },
        timestamp: new Date(),
      };
    }

    return {
      checkName: 'Database Health',
      status: 'pass',
      message: `Database healthy: ${latency}ms response time`,
      details: { latencyMs: latency },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      checkName: 'Database Health',
      status: 'fail',
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date(),
    };
  }
}

/**
 * Check for strategies without recent trades
 */
async function checkInactiveStrategies(): Promise<IntegrityCheckResult> {
  const db = await getDb();
  if (!db) {
    return {
      checkName: 'Inactive Strategies',
      status: 'fail',
      message: 'Database not available',
      timestamp: new Date(),
    };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get strategies with no trades in last 30 days
  const inactiveStrategies = await db.execute(sql`
    SELECT s.id, s.name, MAX(t.exit_time) as last_trade
    FROM strategies s
    LEFT JOIN trades t ON s.id = t.strategy_id
    WHERE s.is_active = true
    GROUP BY s.id, s.name
    HAVING MAX(t.exit_time) < ${thirtyDaysAgo} OR MAX(t.exit_time) IS NULL
  `);

  const count = (inactiveStrategies as any)[0]?.length ?? 0;

  if (count > 0) {
    return {
      checkName: 'Inactive Strategies',
      status: 'warning',
      message: `${count} active strategies have no trades in the last 30 days`,
      details: { count },
      timestamp: new Date(),
    };
  }

  return {
    checkName: 'Inactive Strategies',
    status: 'pass',
    message: 'All active strategies have recent trades',
    timestamp: new Date(),
  };
}

/**
 * Run all integrity checks
 */
export async function runFullIntegrityCheck(): Promise<FullIntegrityReport> {
  const startTime = Date.now();
  
  const checks = await Promise.all([
    checkDatabaseHealth(),
    checkWebhookFailures(),
    checkOrphanedPositions(),
    checkPnlDiscrepancies(),
    checkInactiveStrategies(),
  ]);

  const executionTimeMs = Date.now() - startTime;

  // Determine overall status
  const hasFailure = checks.some(c => c.status === 'fail');
  const hasWarning = checks.some(c => c.status === 'warning');
  
  let overallStatus: 'healthy' | 'warning' | 'critical';
  if (hasFailure) {
    overallStatus = 'critical';
  } else if (hasWarning) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'healthy';
  }

  return {
    overallStatus,
    checks,
    executionTimeMs,
    timestamp: new Date(),
  };
}

/**
 * Run integrity check and send notifications if issues found
 */
export async function runScheduledIntegrityCheck(): Promise<{
  report: FullIntegrityReport;
  notificationsSent: number;
}> {
  const report = await runFullIntegrityCheck();
  let notificationsSent = 0;

  // Send notifications for failures and warnings
  if (report.overallStatus === 'critical') {
    const failedChecks = report.checks.filter(c => c.status === 'fail');
    await notifyAdmins({
      type: 'system',
      title: 'Critical: Data Integrity Issues Detected',
      message: `${failedChecks.length} critical issues found: ${failedChecks.map(c => c.checkName).join(', ')}`,
    });
    notificationsSent++;
  } else if (report.overallStatus === 'warning') {
    const warningChecks = report.checks.filter(c => c.status === 'warning');
    await notifyAdmins({
      type: 'system',
      title: 'Warning: Data Integrity Warnings',
      message: `${warningChecks.length} warnings: ${warningChecks.map(c => c.checkName).join(', ')}`,
    });
    notificationsSent++;
  }

  return { report, notificationsSent };
}

/**
 * Run all scheduled tasks (integrity check + periodic checks + daily digest)
 * This is the main entry point for scheduled jobs
 */
export async function runAllScheduledTasks(): Promise<{
  integrityReport: FullIntegrityReport;
  periodicChecks: {
    webhookFailureRate: number;
    avgLatency: number;
    alertsTriggered: number;
  };
  dailyDigestsSent: number;
}> {
  // Run integrity check
  const { report: integrityReport } = await runScheduledIntegrityCheck();

  // Run periodic checks (webhook failure rate, latency)
  const periodicChecks = await runPeriodicChecks();

  // Send daily digests to admins
  const dailyDigestsSent = await sendDailyDigestToAdmins();

  return {
    integrityReport,
    periodicChecks,
    dailyDigestsSent,
  };
}

/**
 * Get the last integrity check result (for display in UI)
 */
let lastIntegrityReport: FullIntegrityReport | null = null;

export function getLastIntegrityReport(): FullIntegrityReport | null {
  return lastIntegrityReport;
}

export function setLastIntegrityReport(report: FullIntegrityReport): void {
  lastIntegrityReport = report;
}
