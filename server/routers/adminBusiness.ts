/**
 * Admin business-metrics router.
 *
 * Read-only aggregate queries over existing tables (users, payment_history,
 * webhook_logs, webhook_retry_queue, dead_letter_queue) to power the
 * /admin/business dashboard. No schema changes, no migrations, safe to merge.
 *
 * All endpoints are adminProcedure — unauthenticated callers 401.
 */
import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import {
  users,
  paymentHistory,
  webhookLogs,
  webhookRetryQueue,
  deadLetterQueue,
} from "../../drizzle/schema";

const PLAN_PRICE_USD = 50;

const DaysInput = z
  .object({ days: z.number().int().min(1).max(365).default(30) })
  .default({ days: 30 });

export const adminBusinessRouter = router({
  /**
   * MRR + active subscriber count + total paid.
   * MRR = count of active subs × plan price.
   */
  subscriberSnapshot: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [row] = (await db
      .select({
        active: sql<number>`SUM(CASE WHEN ${users.subscriptionStatus} = 'active' THEN 1 ELSE 0 END)`,
        past_due: sql<number>`SUM(CASE WHEN ${users.subscriptionStatus} = 'past_due' THEN 1 ELSE 0 END)`,
        canceled: sql<number>`SUM(CASE WHEN ${users.subscriptionStatus} = 'canceled' THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
        pro_tier: sql<number>`SUM(CASE WHEN ${users.subscriptionTier} = 'pro' THEN 1 ELSE 0 END)`,
        premium_tier: sql<number>`SUM(CASE WHEN ${users.subscriptionTier} = 'premium' THEN 1 ELSE 0 END)`,
      })
      .from(users)) as Array<{
      active: number;
      past_due: number;
      canceled: number;
      total: number;
      pro_tier: number;
      premium_tier: number;
    }>;
    const active = Number(row?.active ?? 0);
    const mrrUsd = active * PLAN_PRICE_USD;
    return {
      activeSubscribers: active,
      pastDueSubscribers: Number(row?.past_due ?? 0),
      canceledSubscribers: Number(row?.canceled ?? 0),
      totalUsers: Number(row?.total ?? 0),
      mrrUsd,
      mrrSource: "active_subscribers_x_50usd",
      proTier: Number(row?.pro_tier ?? 0),
      premiumTier: Number(row?.premium_tier ?? 0),
    };
  }),

  /**
   * New signups + new paid subs over the window.
   */
  newSignups: adminProcedure.input(DaysInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = (await db
      .select({
        new_users: sql<number>`SUM(CASE WHEN ${users.createdAt} >= DATE_SUB(NOW(), INTERVAL ${input.days} DAY) THEN 1 ELSE 0 END)`,
        new_paid: sql<number>`SUM(CASE WHEN ${users.createdAt} >= DATE_SUB(NOW(), INTERVAL ${input.days} DAY) AND ${users.subscriptionStatus} = 'active' THEN 1 ELSE 0 END)`,
      })
      .from(users)) as Array<{ new_users: number; new_paid: number }>;
    const newUsers = Number(row?.new_users ?? 0);
    const newPaid = Number(row?.new_paid ?? 0);
    const conversionPct = newUsers > 0 ? (newPaid / newUsers) * 100 : 0;
    return {
      periodDays: input.days,
      newUsers,
      newPaidSubscribers: newPaid,
      signupToPaidConversionPct: Math.round(conversionPct * 10) / 10,
    };
  }),

  /**
   * Webhook delivery health — success rate + failure count.
   */
  webhookHealth: adminProcedure.input(DaysInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = (await db
      .select({
        total: sql<number>`COUNT(*)`,
        success: sql<number>`SUM(CASE WHEN ${webhookLogs.status} = 'success' THEN 1 ELSE 0 END)`,
        failure: sql<number>`SUM(CASE WHEN ${webhookLogs.status} = 'failed' THEN 1 ELSE 0 END)`,
        processing: sql<number>`SUM(CASE WHEN ${webhookLogs.status} = 'processing' THEN 1 ELSE 0 END)`,
      })
      .from(webhookLogs)
      .where(
        sql`${webhookLogs.receivedAt} >= DATE_SUB(NOW(), INTERVAL ${input.days} DAY)`
      )) as Array<{
      total: number;
      success: number;
      failure: number;
      processing: number;
    }>;
    const total = Number(row?.total ?? 0);
    const success = Number(row?.success ?? 0);
    const successRate = total > 0 ? (success / total) * 100 : 100;
    return {
      periodDays: input.days,
      totalWebhooks: total,
      successfulWebhooks: success,
      failedWebhooks: Number(row?.failure ?? 0),
      processingWebhooks: Number(row?.processing ?? 0),
      successRatePct: Math.round(successRate * 10) / 10,
    };
  }),

  /**
   * Retry queue + dead-letter queue depths. Non-zero dead-letter count
   * means subscribers silently missed signals.
   */
  retryQueueStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    const [retryRow] = (await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(webhookRetryQueue)) as Array<{ n: number }>;
    const [dlqRow] = (await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(deadLetterQueue)) as Array<{ n: number }>;
    return {
      pendingRetries: Number(retryRow?.n ?? 0),
      deadLetter: Number(dlqRow?.n ?? 0),
    };
  }),

  /**
   * 10 most recent signups with their basic info.
   */
  recentSignups: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).default({ limit: 10 }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = (await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionTier: users.subscriptionTier,
          loginMethod: users.loginMethod,
        })
        .from(users)
        .orderBy(sql`${users.createdAt} DESC`)
        .limit(input.limit)) as Array<{
        id: number;
        email: string | null;
        name: string | null;
        createdAt: string | null;
        subscriptionStatus: string | null;
        subscriptionTier: string | null;
        loginMethod: string | null;
      }>;
      return rows;
    }),

  /**
   * Recent payments (paid signups, renewals, etc.)
   */
  recentPayments: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).default({ limit: 10 }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = (await db
        .select({
          id: paymentHistory.id,
          userId: paymentHistory.userId,
          amount: paymentHistory.amount,
          currency: paymentHistory.currency,
          status: paymentHistory.status,
          description: paymentHistory.description,
          createdAt: paymentHistory.createdAt,
        })
        .from(paymentHistory)
        .orderBy(sql`${paymentHistory.createdAt} DESC`)
        .limit(input.limit)) as Array<{
        id: number;
        userId: number;
        amount: number;
        currency: string | null;
        status: string | null;
        description: string | null;
        createdAt: string | null;
      }>;
      return rows;
    }),

  /**
   * Churn rate — % of subs that canceled in the window relative to
   * average active-at-start-of-window count. Crude but useful.
   */
  churn: adminProcedure.input(DaysInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = (await db
      .select({
        churned: sql<number>`SUM(CASE WHEN ${users.subscriptionStatus} = 'canceled' AND ${users.updatedAt} >= DATE_SUB(NOW(), INTERVAL ${input.days} DAY) THEN 1 ELSE 0 END)`,
        active: sql<number>`SUM(CASE WHEN ${users.subscriptionStatus} = 'active' THEN 1 ELSE 0 END)`,
      })
      .from(users)) as Array<{ churned: number; active: number }>;
    const churned = Number(row?.churned ?? 0);
    const active = Number(row?.active ?? 0);
    const denom = active + churned;
    const churnPct = denom > 0 ? (churned / denom) * 100 : 0;
    return {
      periodDays: input.days,
      churnedInPeriod: churned,
      currentActive: active,
      churnRatePct: Math.round(churnPct * 10) / 10,
    };
  }),
});
