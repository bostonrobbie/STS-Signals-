/**
 * Test Data Cleanup Utility
 *
 * This module provides functions to clean up test data from the database.
 * Test data is identified by the isTest flag on trades, webhook_logs, and open_positions.
 *
 * Use this to:
 * 1. Clean up after test runs
 * 2. Remove accidentally created test data from production
 * 3. Maintain database hygiene
 */

import { getDb } from "./db";
import { trades, webhookLogs, openPositions } from "../drizzle/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export interface CleanupResult {
  tradesDeleted: number;
  webhookLogsDeleted: number;
  positionsDeleted: number;
  totalDeleted: number;
}

/**
 * Delete all test data from the database
 * This removes records where isTest = true
 */
export async function cleanupAllTestData(): Promise<CleanupResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[TestCleanup] Database not available");
    return {
      tradesDeleted: 0,
      webhookLogsDeleted: 0,
      positionsDeleted: 0,
      totalDeleted: 0,
    };
  }

  try {
    // Delete test trades
    const tradesResult = await db.delete(trades).where(eq(trades.isTest, 1));
    const tradesDeleted = (tradesResult as any)[0]?.affectedRows || 0;

    // Delete test webhook logs
    const webhookResult = await db
      .delete(webhookLogs)
      .where(eq(webhookLogs.isTest, 1));
    const webhookLogsDeleted = (webhookResult as any)[0]?.affectedRows || 0;

    // Delete test open positions
    const positionsResult = await db
      .delete(openPositions)
      .where(eq(openPositions.isTest, 1));
    const positionsDeleted = (positionsResult as any)[0]?.affectedRows || 0;

    const totalDeleted = tradesDeleted + webhookLogsDeleted + positionsDeleted;

    console.log(`[TestCleanup] Cleaned up ${totalDeleted} test records:`, {
      tradesDeleted,
      webhookLogsDeleted,
      positionsDeleted,
    });

    return {
      tradesDeleted,
      webhookLogsDeleted,
      positionsDeleted,
      totalDeleted,
    };
  } catch (error) {
    console.error("[TestCleanup] Error cleaning up test data:", error);
    throw error;
  }
}

/**
 * Delete test data older than a specified number of hours
 * Useful for cleaning up stale test data while preserving recent test runs
 */
export async function cleanupOldTestData(
  hoursOld: number = 24
): Promise<CleanupResult> {
  const db = await getDb();
  if (!db) {
    console.warn("[TestCleanup] Database not available");
    return {
      tradesDeleted: 0,
      webhookLogsDeleted: 0,
      positionsDeleted: 0,
      totalDeleted: 0,
    };
  }

  const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  const cutoffDateISO = cutoffDate.toISOString();

  try {
    // Delete old test trades
    const tradesResult = await db
      .delete(trades)
      .where(and(eq(trades.isTest, 1), lt(trades.createdAt, cutoffDateISO)));
    const tradesDeleted = (tradesResult as any)[0]?.affectedRows || 0;

    // Delete old test webhook logs
    const webhookResult = await db
      .delete(webhookLogs)
      .where(
        and(eq(webhookLogs.isTest, 1), lt(webhookLogs.createdAt, cutoffDateISO))
      );
    const webhookLogsDeleted = (webhookResult as any)[0]?.affectedRows || 0;

    // Delete old test positions
    const positionsResult = await db
      .delete(openPositions)
      .where(
        and(
          eq(openPositions.isTest, 1),
          lt(openPositions.createdAt, cutoffDateISO)
        )
      );
    const positionsDeleted = (positionsResult as any)[0]?.affectedRows || 0;

    const totalDeleted = tradesDeleted + webhookLogsDeleted + positionsDeleted;

    console.log(
      `[TestCleanup] Cleaned up ${totalDeleted} test records older than ${hoursOld} hours:`,
      {
        tradesDeleted,
        webhookLogsDeleted,
        positionsDeleted,
      }
    );

    return {
      tradesDeleted,
      webhookLogsDeleted,
      positionsDeleted,
      totalDeleted,
    };
  } catch (error) {
    console.error("[TestCleanup] Error cleaning up old test data:", error);
    throw error;
  }
}

/**
 * Get counts of test data in the database
 * Useful for monitoring and debugging
 */
export async function getTestDataCounts(): Promise<{
  testTrades: number;
  testWebhookLogs: number;
  testPositions: number;
  total: number;
}> {
  const db = await getDb();
  if (!db) {
    return { testTrades: 0, testWebhookLogs: 0, testPositions: 0, total: 0 };
  }

  try {
    const [tradesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(eq(trades.isTest, 1));

    const [webhookCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs)
      .where(eq(webhookLogs.isTest, 1));

    const [positionsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(openPositions)
      .where(eq(openPositions.isTest, 1));

    const testTrades = Number(tradesCount?.count || 0);
    const testWebhookLogs = Number(webhookCount?.count || 0);
    const testPositions = Number(positionsCount?.count || 0);

    return {
      testTrades,
      testWebhookLogs,
      testPositions,
      total: testTrades + testWebhookLogs + testPositions,
    };
  } catch (error) {
    console.error("[TestCleanup] Error getting test data counts:", error);
    return { testTrades: 0, testWebhookLogs: 0, testPositions: 0, total: 0 };
  }
}

/**
 * Mark existing data as test data (for migration/cleanup purposes)
 * This is useful if test data was accidentally created without the isTest flag
 */
export async function markDataAsTest(options: {
  tradeIds?: number[];
  webhookLogIds?: number[];
  positionIds?: number[];
}): Promise<{ updated: number }> {
  const db = await getDb();
  if (!db) {
    return { updated: 0 };
  }

  let updated = 0;

  try {
    if (options.tradeIds && options.tradeIds.length > 0) {
      for (const id of options.tradeIds) {
        await db.update(trades).set({ isTest: 1 }).where(eq(trades.id, id));
        updated++;
      }
    }

    if (options.webhookLogIds && options.webhookLogIds.length > 0) {
      for (const id of options.webhookLogIds) {
        await db
          .update(webhookLogs)
          .set({ isTest: 1 })
          .where(eq(webhookLogs.id, id));
        updated++;
      }
    }

    if (options.positionIds && options.positionIds.length > 0) {
      for (const id of options.positionIds) {
        await db
          .update(openPositions)
          .set({ isTest: 1 })
          .where(eq(openPositions.id, id));
        updated++;
      }
    }

    return { updated };
  } catch (error) {
    console.error("[TestCleanup] Error marking data as test:", error);
    throw error;
  }
}
