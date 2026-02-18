/**
 * In-App Notification Service
 *
 * Provides a unified notification system within the dashboard
 * for alerts, trade signals, system events, and user messages.
 */

import { getDb } from "../db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { notifications, users } from "../../drizzle/schema";

// Use the types from the schema
export type NotificationType =
  | "trade_executed"
  | "trade_error"
  | "position_opened"
  | "position_closed"
  | "webhook_failed"
  | "daily_digest"
  | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  strategyId?: number;
  tradeId?: number;
  webhookLogId?: number;
}

export interface NotificationFilters {
  userId: number;
  unreadOnly?: boolean;
  types?: NotificationType[];
  since?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Create a new notification for a user
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { userId, type, title, message, strategyId, tradeId, webhookLogId } =
    params;

  const result = await db.insert(notifications).values({
    // @ts-expect-error TS2769
    userId,
    type,
    title,
    message,
    strategyId,
    tradeId,
    webhookLogId,
    read: false,
    dismissed: false,
    emailSent: false,
  });

  return Number((result as any)[0]?.insertId ?? 0);
}

/**
 * Create notifications for all admin users
 */
export async function notifyAdmins(
  params: Omit<CreateNotificationParams, "userId">
): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const adminUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"));

  const notificationIds: number[] = [];

  for (const admin of adminUsers) {
    const id = await createNotification({
      ...params,
      userId: admin.id,
    });
    notificationIds.push(id);
  }

  return notificationIds;
}

/**
 * Get notifications for a user with optional filters
 */
export async function getNotifications(filters: NotificationFilters) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { userId, unreadOnly, types, since, limit = 50, offset = 0 } = filters;

  const conditions = [eq(notifications.userId, userId)];

  if (unreadOnly) {
    conditions.push(eq(notifications.read, 0));
  }

  if (since) {
    // @ts-expect-error TS2769
    conditions.push(gte(notifications.createdAt, since));
  }

  const results = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  // Filter by types if specified
  let filtered = results;
  if (types && types.length > 0) {
    filtered = results.filter((n: (typeof results)[0]) =>
      types.includes(n.type as NotificationType)
    );
  }

  return filtered;
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));

  return result[0]?.count ?? 0;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: number,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .update(notifications)
    // @ts-expect-error TS2322
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );

  return ((result as any)[0]?.affectedRows ?? 0) > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .update(notifications)
    // @ts-expect-error TS2322
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, 0)));

  return (result as any)[0]?.affectedRows ?? 0;
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  notificationId: number,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );

  return ((result as any)[0]?.affectedRows ?? 0) > 0;
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(
  olderThanDays: number = 30
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.read, 1),
        sql`${notifications.createdAt} < ${cutoff}`
      )
    );

  return (result as any)[0]?.affectedRows ?? 0;
}

// Convenience functions for common notification types

export async function notifyTradeExecuted(
  userId: number,
  strategy: string,
  action: string,
  symbol: string,
  price: number,
  strategyId?: number,
  tradeId?: number
): Promise<number> {
  return createNotification({
    userId,
    type: "trade_executed",
    title: `${action.toUpperCase()} Signal: ${strategy}`,
    message: `${strategy} triggered a ${action} signal for ${symbol} at $${price.toFixed(2)}`,
    strategyId,
    tradeId,
  });
}

export async function notifyPositionOpened(
  userId: number,
  strategy: string,
  direction: string,
  entryPrice: number,
  quantity: number,
  strategyId?: number
): Promise<number> {
  return createNotification({
    userId,
    type: "position_opened",
    title: `Position Opened: ${strategy}`,
    message: `Opened ${direction} position: ${quantity} contracts at $${entryPrice.toFixed(2)}`,
    strategyId,
  });
}

export async function notifyPositionClosed(
  userId: number,
  strategy: string,
  pnl: number,
  pnlPercent: number,
  strategyId?: number,
  tradeId?: number
): Promise<number> {
  const isProfit = pnl >= 0;
  return createNotification({
    userId,
    type: "position_closed",
    title: `Position Closed: ${strategy}`,
    message: `Closed with ${isProfit ? "profit" : "loss"}: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`,
    strategyId,
    tradeId,
  });
}

export async function notifySystemAlert(
  userId: number,
  errorType: string,
  details: string
): Promise<number> {
  return createNotification({
    userId,
    type: "system",
    title: `System Alert: ${errorType}`,
    message: details,
  });
}

export async function notifyWebhookFailure(
  userId: number,
  webhookLogId: number,
  error: string
): Promise<number> {
  return createNotification({
    userId,
    type: "webhook_failed",
    title: "Webhook Processing Failed",
    message: `Webhook failed: ${error}`,
    webhookLogId,
  });
}

export async function notifyDailyDigest(
  userId: number,
  summary: string
): Promise<number> {
  return createNotification({
    userId,
    type: "daily_digest",
    title: "Daily Trading Summary",
    message: summary,
  });
}

export async function notifyTradeError(
  userId: number,
  error: string,
  strategyId?: number
): Promise<number> {
  return createNotification({
    userId,
    type: "trade_error",
    title: "Trade Error",
    message: error,
    strategyId,
  });
}
