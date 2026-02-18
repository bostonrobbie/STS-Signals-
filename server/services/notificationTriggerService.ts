/**
 * Notification Trigger Service
 * 
 * Wires various system events to the in-app notification system.
 * This service acts as a bridge between system events and user notifications.
 */

import {
  notifyAdmins,
  notifyTradeExecuted,
  notifyPositionOpened,
  notifyPositionClosed,
  notifyTradeError,
  notifyDailyDigest,
} from './inAppNotificationService';
import { getDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { webhookLogs, trades, openPositions, users } from '../../drizzle/schema';

/**
 * Configuration for notification triggers
 */
export interface NotificationTriggerConfig {
  // Webhook failure thresholds
  webhookFailureRateThreshold: number;  // Percentage (0-100)
  webhookFailureWindowMinutes: number;  // Time window to check
  
  // Position alerts
  notifyOnPositionOpen: boolean;
  notifyOnPositionClose: boolean;
  notifyOnLargeDrawdown: boolean;
  largeDrawdownThreshold: number;  // Percentage
  
  // Trade alerts
  notifyOnTradeExecution: boolean;
  notifyOnTradeError: boolean;
  
  // System alerts
  notifyOnHighLatency: boolean;
  highLatencyThresholdMs: number;
}

const defaultConfig: NotificationTriggerConfig = {
  webhookFailureRateThreshold: 20,  // Alert if >20% failures
  webhookFailureWindowMinutes: 30,
  notifyOnPositionOpen: true,
  notifyOnPositionClose: true,
  notifyOnLargeDrawdown: true,
  largeDrawdownThreshold: 10,  // 10% drawdown
  notifyOnTradeExecution: true,
  notifyOnTradeError: true,
  notifyOnHighLatency: true,
  highLatencyThresholdMs: 5000,  // 5 seconds
};

let config = { ...defaultConfig };

/**
 * Update notification trigger configuration
 */
export function updateConfig(newConfig: Partial<NotificationTriggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): NotificationTriggerConfig {
  return { ...config };
}

/**
 * Trigger notification for webhook processing failure
 */
export async function triggerWebhookFailureNotification(
  webhookLogId: number,
  error: string,
  strategySymbol?: string
): Promise<void> {
  if (!config.notifyOnTradeError) return;

  // Only notify for critical errors, not expected ones like POSITION_EXISTS
  const criticalErrors = [
    'VALIDATION_ERROR',
    'DATABASE_ERROR',
    'TIMEOUT',
    'UNKNOWN_ERROR',
  ];
  
  const isCritical = criticalErrors.some(e => error.includes(e));
  
  if (isCritical) {
    await notifyAdmins({
      type: 'webhook_failed',
      title: `Webhook Failed: ${strategySymbol || 'Unknown'}`,
      message: `Error: ${error}`,
      webhookLogId,
    });
  }
}

/**
 * Trigger notification for position opened
 */
export async function triggerPositionOpenedNotification(
  userId: number,
  strategyName: string,
  direction: string,
  entryPrice: number,
  quantity: number,
  strategyId?: number
): Promise<void> {
  if (!config.notifyOnPositionOpen) return;

  await notifyPositionOpened(
    userId,
    strategyName,
    direction,
    entryPrice,
    quantity,
    strategyId
  );
}

/**
 * Trigger notification for position closed
 */
export async function triggerPositionClosedNotification(
  userId: number,
  strategyName: string,
  pnl: number,
  pnlPercent: number,
  strategyId?: number,
  tradeId?: number
): Promise<void> {
  if (!config.notifyOnPositionClose) return;

  await notifyPositionClosed(
    userId,
    strategyName,
    pnl,
    pnlPercent,
    strategyId,
    tradeId
  );

  // Check for large drawdown
  if (config.notifyOnLargeDrawdown && pnlPercent < -config.largeDrawdownThreshold) {
    await notifyAdmins({
      type: 'system',
      title: `Large Drawdown Alert: ${strategyName}`,
      message: `Position closed with ${pnlPercent.toFixed(2)}% loss ($${pnl.toFixed(2)})`,
      strategyId,
      tradeId,
    });
  }
}

/**
 * Trigger notification for trade execution
 */
export async function triggerTradeExecutedNotification(
  userId: number,
  strategyName: string,
  action: string,
  symbol: string,
  price: number,
  strategyId?: number,
  tradeId?: number
): Promise<void> {
  if (!config.notifyOnTradeExecution) return;

  await notifyTradeExecuted(
    userId,
    strategyName,
    action,
    symbol,
    price,
    strategyId,
    tradeId
  );
}

/**
 * Trigger notification for trade error
 */
export async function triggerTradeErrorNotification(
  userId: number,
  error: string,
  strategyId?: number
): Promise<void> {
  if (!config.notifyOnTradeError) return;

  await notifyTradeError(userId, error, strategyId);
}

/**
 * Check webhook failure rate and trigger alert if above threshold
 */
export async function checkWebhookFailureRate(): Promise<{
  failureRate: number;
  alertTriggered: boolean;
}> {
  const db = await getDb();
  if (!db) return { failureRate: 0, alertTriggered: false };

  const windowStart = new Date(Date.now() - config.webhookFailureWindowMinutes * 60 * 1000);
  
  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      failed: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
    })
    .from(webhookLogs)
    .where(
      and(
        sql`${webhookLogs.createdAt} >= ${windowStart}`,
        sql`${webhookLogs.isTest} = false OR ${webhookLogs.isTest} IS NULL`
      )
    );

  const total = result[0]?.total ?? 0;
  const failed = result[0]?.failed ?? 0;
  
  if (total === 0) return { failureRate: 0, alertTriggered: false };

  const failureRate = (failed / total) * 100;
  let alertTriggered = false;

  if (failureRate > config.webhookFailureRateThreshold) {
    await notifyAdmins({
      type: 'system',
      title: 'High Webhook Failure Rate',
      message: `Webhook failure rate is ${failureRate.toFixed(1)}% (${failed}/${total}) in the last ${config.webhookFailureWindowMinutes} minutes`,
    });
    alertTriggered = true;
  }

  return { failureRate, alertTriggered };
}

/**
 * Check for high latency webhooks and trigger alert
 */
export async function checkHighLatencyWebhooks(): Promise<{
  avgLatency: number;
  alertTriggered: boolean;
}> {
  if (!config.notifyOnHighLatency) return { avgLatency: 0, alertTriggered: false };

  const db = await getDb();
  if (!db) return { avgLatency: 0, alertTriggered: false };

  const windowStart = new Date(Date.now() - 60 * 60 * 1000); // Last hour
  
  const result = await db
    .select({
      avgLatency: sql<number>`AVG(processing_time_ms)`,
      maxLatency: sql<number>`MAX(processing_time_ms)`,
    })
    .from(webhookLogs)
    .where(sql`${webhookLogs.createdAt} >= ${windowStart}`);

  const avgLatency = result[0]?.avgLatency ?? 0;
  const maxLatency = result[0]?.maxLatency ?? 0;
  let alertTriggered = false;

  if (maxLatency > config.highLatencyThresholdMs) {
    await notifyAdmins({
      type: 'system',
      title: 'High Webhook Latency Detected',
      message: `Max latency: ${maxLatency}ms, Avg latency: ${avgLatency.toFixed(0)}ms in the last hour`,
    });
    alertTriggered = true;
  }

  return { avgLatency, alertTriggered };
}

/**
 * Generate and send daily digest notification
 */
export async function generateDailyDigest(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get today's trades
  const todaysTrades = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalPnl: sql<number>`SUM(pnl)`,
      winners: sql<number>`SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END)`,
    })
    .from(trades)
    .where(sql`exit_time >= ${today}`);

  const tradeCount = todaysTrades[0]?.count ?? 0;
  const totalPnl = todaysTrades[0]?.totalPnl ?? 0;
  const winners = todaysTrades[0]?.winners ?? 0;
  const winRate = tradeCount > 0 ? (winners / tradeCount) * 100 : 0;

  // Get open positions count
  const openPositionsResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(openPositions)
    .where(eq(openPositions.status, 'open'));

  const openPositionsCount = openPositionsResult[0]?.count ?? 0;

  const summary = tradeCount > 0
    ? `Today: ${tradeCount} trades, ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} P&L, ${winRate.toFixed(0)}% win rate. ${openPositionsCount} open positions.`
    : `No trades today. ${openPositionsCount} open positions.`;

  await notifyDailyDigest(userId, summary);
}

/**
 * Run all periodic checks
 */
export async function runPeriodicChecks(): Promise<{
  webhookFailureRate: number;
  avgLatency: number;
  alertsTriggered: number;
}> {
  let alertsTriggered = 0;

  const webhookCheck = await checkWebhookFailureRate();
  if (webhookCheck.alertTriggered) alertsTriggered++;

  const latencyCheck = await checkHighLatencyWebhooks();
  if (latencyCheck.alertTriggered) alertsTriggered++;

  return {
    webhookFailureRate: webhookCheck.failureRate,
    avgLatency: latencyCheck.avgLatency,
    alertsTriggered,
  };
}

/**
 * Send daily digest to all admin users
 */
export async function sendDailyDigestToAdmins(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'admin'));

  for (const admin of adminUsers) {
    await generateDailyDigest(admin.id);
  }

  return adminUsers.length;
}
