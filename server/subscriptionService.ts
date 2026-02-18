/**
 * User Subscription Service
 *
 * Manages user subscriptions to trading strategies.
 * Users can subscribe to strategies to receive signals and optionally auto-execute trades.
 */

import { getDb } from "./db";
import {
  userSubscriptions,
  strategies,
  userSignals,
  auditLogs,
} from "../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export interface SubscriptionSettings {
  notificationsEnabled: boolean;
  autoExecuteEnabled: boolean;
  quantityMultiplier: number;
  maxPositionSize: number | null;
  accountValue: number | null;
  useLeveraged: boolean;
}

export interface UserSubscriptionWithStrategy {
  id: number;
  userId: number;
  strategyId: number;
  notificationsEnabled: boolean;
  autoExecuteEnabled: boolean;
  quantityMultiplier: string;
  maxPositionSize: number | null;
  accountValue: number | null;
  useLeveraged: boolean;
  subscribedAt: Date;
  strategy: {
    id: number;
    symbol: string;
    name: string;
    description: string | null;
    market: string | null;
    strategyType: string | null;
    active: boolean;
  };
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(
  userId: number
): Promise<UserSubscriptionWithStrategy[]> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      id: userSubscriptions.id,
      userId: userSubscriptions.userId,
      strategyId: userSubscriptions.strategyId,
      notificationsEnabled: userSubscriptions.notificationsEnabled,
      autoExecuteEnabled: userSubscriptions.autoExecuteEnabled,
      quantityMultiplier: userSubscriptions.quantityMultiplier,
      maxPositionSize: userSubscriptions.maxPositionSize,
      accountValue: userSubscriptions.accountValue,
      useLeveraged: userSubscriptions.useLeveraged,
      subscribedAt: userSubscriptions.subscribedAt,
      strategy: {
        id: strategies.id,
        symbol: strategies.symbol,
        name: strategies.name,
        description: strategies.description,
        market: strategies.market,
        strategyType: strategies.strategyType,
        active: strategies.active,
      },
    })
    .from(userSubscriptions)
    .innerJoin(strategies, eq(userSubscriptions.strategyId, strategies.id))
    .where(eq(userSubscriptions.userId, userId));

  return results.map(r => ({
    ...r,
    notificationsEnabled: Boolean(r.notificationsEnabled),
    autoExecuteEnabled: Boolean(r.autoExecuteEnabled),
    quantityMultiplier: r.quantityMultiplier || "1.0000",
    useLeveraged: Boolean(r.useLeveraged),
    subscribedAt: new Date(r.subscribedAt),
    strategy: {
      ...r.strategy,
      active: Boolean(r.strategy.active),
    },
  }));
}

/**
 * Subscribe a user to a strategy
 */
export async function subscribeToStrategy(
  userId: number,
  strategyId: number,
  settings?: Partial<SubscriptionSettings>
): Promise<{ success: boolean; subscriptionId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Check if strategy exists and is active
    const [strategy] = await db
      .select()
      .from(strategies)
      .where(eq(strategies.id, strategyId));

    if (!strategy) {
      return { success: false, error: "Strategy not found" };
    }

    if (!strategy.active) {
      return { success: false, error: "Strategy is not active" };
    }

    // Check if already subscribed
    const [existing] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.strategyId, strategyId)
        )
      );

    if (existing) {
      return { success: false, error: "Already subscribed to this strategy" };
    }

    // Create subscription
    const [result] = await db.insert(userSubscriptions).values({
      userId,
      strategyId,
      notificationsEnabled: (settings?.notificationsEnabled ?? true) ? 1 : 0,
      autoExecuteEnabled: (settings?.autoExecuteEnabled ?? false) ? 1 : 0,
      quantityMultiplier: settings?.quantityMultiplier?.toString() ?? "1.0000",
      maxPositionSize: settings?.maxPositionSize ?? null,
    });

    // Log audit
    await logAudit(
      userId,
      "subscription.created",
      "user_subscription",
      result.insertId,
      {
        strategyId,
        strategySymbol: strategy.symbol,
        settings,
      }
    );

    return { success: true, subscriptionId: result.insertId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Unsubscribe a user from a strategy
 */
export async function unsubscribeFromStrategy(
  userId: number,
  strategyId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get existing subscription for audit
    const [existing] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.strategyId, strategyId)
        )
      );

    if (!existing) {
      return { success: false, error: "Subscription not found" };
    }

    // Delete subscription
    await db
      .delete(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.strategyId, strategyId)
        )
      );

    // Log audit
    await logAudit(
      userId,
      "subscription.deleted",
      "user_subscription",
      existing.id,
      {
        strategyId,
        previousSettings: {
          notificationsEnabled: existing.notificationsEnabled,
          autoExecuteEnabled: existing.autoExecuteEnabled,
          quantityMultiplier: existing.quantityMultiplier,
        },
      }
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update subscription settings
 */
export async function updateSubscriptionSettings(
  userId: number,
  strategyId: number,
  settings: Partial<SubscriptionSettings>
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get existing subscription
    const [existing] = await db
      .select()
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.strategyId, strategyId)
        )
      );

    if (!existing) {
      return { success: false, error: "Subscription not found" };
    }

    // Build update object
    const updateData: Record<string, any> = {};
    if (settings.notificationsEnabled !== undefined) {
      updateData.notificationsEnabled = settings.notificationsEnabled;
    }
    if (settings.autoExecuteEnabled !== undefined) {
      updateData.autoExecuteEnabled = settings.autoExecuteEnabled;
    }
    if (settings.quantityMultiplier !== undefined) {
      updateData.quantityMultiplier = settings.quantityMultiplier.toString();
    }
    if (settings.maxPositionSize !== undefined) {
      updateData.maxPositionSize = settings.maxPositionSize;
    }
    if (settings.accountValue !== undefined) {
      updateData.accountValue = settings.accountValue;
    }
    if (settings.useLeveraged !== undefined) {
      updateData.useLeveraged = settings.useLeveraged;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: "No settings to update" };
    }

    // Update subscription
    await db
      .update(userSubscriptions)
      .set(updateData)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.strategyId, strategyId)
        )
      );

    // Log audit
    await logAudit(
      userId,
      "subscription.updated",
      "user_subscription",
      existing.id,
      {
        strategyId,
        previousSettings: {
          notificationsEnabled: existing.notificationsEnabled,
          autoExecuteEnabled: existing.autoExecuteEnabled,
          quantityMultiplier: existing.quantityMultiplier,
          maxPositionSize: existing.maxPositionSize,
        },
        newSettings: settings,
      }
    );

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all users subscribed to a strategy
 */
export async function getStrategySubscribers(
  strategyId: number
): Promise<Array<{ userId: number; settings: SubscriptionSettings }>> {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      userId: userSubscriptions.userId,
      notificationsEnabled: userSubscriptions.notificationsEnabled,
      autoExecuteEnabled: userSubscriptions.autoExecuteEnabled,
      quantityMultiplier: userSubscriptions.quantityMultiplier,
      maxPositionSize: userSubscriptions.maxPositionSize,
      accountValue: userSubscriptions.accountValue,
      useLeveraged: userSubscriptions.useLeveraged,
    })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.strategyId, strategyId));

  return results.map(r => ({
    userId: r.userId,
    settings: {
      notificationsEnabled: Boolean(r.notificationsEnabled),
      autoExecuteEnabled: Boolean(r.autoExecuteEnabled),
      quantityMultiplier: parseFloat(r.quantityMultiplier || "1"),
      maxPositionSize: r.maxPositionSize,
      accountValue: r.accountValue,
      useLeveraged: Boolean(r.useLeveraged),
    },
  }));
}

/**
 * Record a signal for a user (when a webhook is received for a subscribed strategy)
 */
export async function recordUserSignal(
  userId: number,
  webhookLogId: number,
  strategyId: number,
  direction: string,
  price: number,
  quantity: number,
  expiresAt?: Date
): Promise<{ success: boolean; signalId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const [result] = await db.insert(userSignals).values({
      userId,
      webhookLogId,
      strategyId,
      direction,
      price,
      quantity,
      action: "pending",
      signalReceivedAt: new Date().toISOString(),
      expiresAt: (
        expiresAt || new Date(Date.now() + 5 * 60 * 1000)
      ).toISOString(), // Default 5 min expiry
    });

    return { success: true, signalId: result.insertId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get pending signals for a user
 */
export async function getUserPendingSignals(
  userId: number
): Promise<Array<typeof userSignals.$inferSelect>> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(userSignals)
    .where(
      and(eq(userSignals.userId, userId), eq(userSignals.action, "pending"))
    )
    .orderBy(desc(userSignals.signalReceivedAt));
}

/**
 * Mark a signal as executed, skipped, or expired
 */
export async function updateSignalAction(
  signalId: number,
  userId: number,
  action: "executed" | "skipped" | "expired",
  executionLogId?: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Verify ownership
    const [signal] = await db
      .select()
      .from(userSignals)
      .where(eq(userSignals.id, signalId));

    if (!signal) {
      return { success: false, error: "Signal not found" };
    }

    if (signal.userId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    await db
      .update(userSignals)
      .set({
        action,
        actionTakenAt: new Date().toISOString(),
        executionLogId: executionLogId || null,
      })
      .where(eq(userSignals.id, signalId));

    // Log audit
    await logAudit(userId, `signal.${action}`, "user_signal", signalId, {
      strategyId: signal.strategyId,
      direction: signal.direction,
      price: signal.price,
      quantity: signal.quantity,
      executionLogId,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get subscription statistics for a user
 */
export async function getUserSubscriptionStats(userId: number): Promise<{
  totalSubscriptions: number;
  activeStrategies: number;
  totalSignalsReceived: number;
  signalsExecuted: number;
  signalsSkipped: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalSubscriptions: 0,
      activeStrategies: 0,
      totalSignalsReceived: 0,
      signalsExecuted: 0,
      signalsSkipped: 0,
    };
  }

  // Get subscription count
  const [subCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId));

  // Get signal stats
  const [signalStats] = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN action = 'executed' THEN 1 ELSE 0 END) as executed,
      SUM(CASE WHEN action = 'skipped' THEN 1 ELSE 0 END) as skipped
    FROM user_signals
    WHERE userId = ${userId}
  `);

  const stats = signalStats as any;

  return {
    totalSubscriptions: subCount?.count || 0,
    activeStrategies: subCount?.count || 0,
    totalSignalsReceived: stats?.total || 0,
    signalsExecuted: stats?.executed || 0,
    signalsSkipped: stats?.skipped || 0,
  };
}

// Helper to log audit entries
async function logAudit(
  userId: number,
  action: string,
  resourceType: string,
  resourceId: number,
  data: any
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      newValue: JSON.stringify(data),
      status: "success",
    });
  } catch (error) {
    console.error("[SubscriptionService] Failed to log audit entry:", error);
  }
}
