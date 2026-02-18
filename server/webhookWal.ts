/**
 * Webhook Write-Ahead Log (WAL) Service
 *
 * Ensures crash-safe webhook processing by:
 * 1. Writing webhooks to database BEFORE processing
 * 2. Tracking status through the processing lifecycle
 * 3. Recovering stuck webhooks on server restart
 * 4. Providing replay capability for failed webhooks
 */

import { getDb } from "./db";
import { webhookWal } from "../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// WAL entry status
export type WalStatus =
  | "received"
  | "processing"
  | "completed"
  | "failed"
  | "retrying";

// WAL entry interface
export interface WalEntry {
  walId: string;
  correlationId: string;
  rawPayload: string;
  strategySymbol?: string;
  action?: string;
  direction?: string;
  price?: number;
  quantity?: number;
  status: WalStatus;
  attempts: number;
  sourceIp?: string;
  userAgent?: string;
  receivedAt: string; // ISO 8601 datetime string from database
}

// Generate unique WAL ID
function generateWalId(): string {
  return `wal_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

/**
 * Write webhook to WAL before processing
 * This is the first step - ensures we never lose a webhook
 */
export async function writeToWal(params: {
  correlationId: string;
  rawPayload: string;
  parsedPayload?: {
    strategySymbol?: string;
    action?: string;
    direction?: string;
    price?: number;
    quantity?: number;
  };
  sourceIp?: string;
  userAgent?: string;
}): Promise<string> {
  const walId = generateWalId();
  const now = new Date();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(webhookWal).values({
    walId,
    correlationId: params.correlationId,
    rawPayload: params.rawPayload,
    strategySymbol: params.parsedPayload?.strategySymbol,
    action: params.parsedPayload?.action,
    direction: params.parsedPayload?.direction,
    price: params.parsedPayload?.price,
    quantity: params.parsedPayload?.quantity,
    status: "received",
    attempts: 0,
    sourceIp: params.sourceIp,
    userAgent: params.userAgent,
    receivedAt: now.toISOString(),
  });

  console.log(`[WAL] Written: ${walId} (correlation: ${params.correlationId})`);
  return walId;
}

/**
 * Mark WAL entry as processing
 * Called when we start processing the webhook
 */
export async function markProcessing(walId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(webhookWal)
    .set({
      status: "processing",
      attempts: sql`attempts + 1` as unknown as number,
      lastAttemptAt: new Date().toISOString(),
    })
    .where(eq(webhookWal.walId, walId));

  console.log(`[WAL] Processing: ${walId}`);
}

/**
 * Mark WAL entry as completed
 * Called when webhook processing succeeds
 */
export async function markCompleted(
  walId: string,
  webhookLogId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(webhookWal)
    .set({
      status: "completed",
      completedAt: new Date().toISOString(),
      resultWebhookLogId: webhookLogId,
    })
    .where(eq(webhookWal.walId, walId));

  console.log(`[WAL] Completed: ${walId}`);
}

/**
 * Mark WAL entry as failed
 * Called when webhook processing fails permanently
 */
export async function markFailed(
  walId: string,
  errorMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(webhookWal)
    .set({
      status: "failed",
      errorMessage,
    })
    .where(eq(webhookWal.walId, walId));

  console.log(`[WAL] Failed: ${walId} - ${errorMessage}`);
}

/**
 * Mark WAL entry for retry
 * Called when webhook processing fails but can be retried
 */
export async function markForRetry(
  walId: string,
  errorMessage: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(webhookWal)
    .set({
      status: "retrying",
      errorMessage,
    })
    .where(eq(webhookWal.walId, walId));

  console.log(`[WAL] Marked for retry: ${walId}`);
}

/**
 * Get stuck webhooks (in "processing" state)
 * These are webhooks that were being processed when the server crashed
 */
export async function getStuckWebhooks(
  maxAge: number = 5 * 60 * 1000
): Promise<WalEntry[]> {
  const cutoff = new Date(Date.now() - maxAge);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(webhookWal)
    .where(
      and(
        eq(webhookWal.status, "processing"),
        sql`${webhookWal.lastAttemptAt} IS NOT NULL AND ${webhookWal.lastAttemptAt} < ${cutoff.toISOString()}`
      )
    );

  return results.map(r => ({
    walId: r.walId,
    correlationId: r.correlationId,
    rawPayload: r.rawPayload,
    strategySymbol: r.strategySymbol ?? undefined,
    action: r.action ?? undefined,
    direction: r.direction ?? undefined,
    price: r.price ?? undefined,
    quantity: r.quantity ?? undefined,
    status: r.status as WalStatus,
    attempts: r.attempts,
    sourceIp: r.sourceIp ?? undefined,
    userAgent: r.userAgent ?? undefined,
    receivedAt: r.receivedAt,
  }));
}

/**
 * Get webhooks pending retry
 */
export async function getRetryableWebhooks(
  maxAttempts: number = 5
): Promise<WalEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(webhookWal)
    .where(
      and(
        eq(webhookWal.status, "retrying"),
        sql`${webhookWal.attempts} < ${maxAttempts}`
      )
    );

  return results.map(r => ({
    walId: r.walId,
    correlationId: r.correlationId,
    rawPayload: r.rawPayload,
    strategySymbol: r.strategySymbol ?? undefined,
    action: r.action ?? undefined,
    direction: r.direction ?? undefined,
    price: r.price ?? undefined,
    quantity: r.quantity ?? undefined,
    status: r.status as WalStatus,
    attempts: r.attempts,
    sourceIp: r.sourceIp ?? undefined,
    userAgent: r.userAgent ?? undefined,
    receivedAt: r.receivedAt,
  }));
}

/**
 * Get WAL entry by ID
 */
export async function getWalEntry(walId: string): Promise<WalEntry | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select()
    .from(webhookWal)
    .where(eq(webhookWal.walId, walId))
    .limit(1);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    walId: r.walId,
    correlationId: r.correlationId,
    rawPayload: r.rawPayload,
    strategySymbol: r.strategySymbol ?? undefined,
    action: r.action ?? undefined,
    direction: r.direction ?? undefined,
    price: r.price ?? undefined,
    quantity: r.quantity ?? undefined,
    status: r.status as WalStatus,
    attempts: r.attempts,
    sourceIp: r.sourceIp ?? undefined,
    userAgent: r.userAgent ?? undefined,
    receivedAt: r.receivedAt || new Date().toISOString(),
  };
}

/**
 * Safely parse receivedAt timestamp
 */
export function parseReceivedAt(receivedAt: string | null | undefined): Date {
  if (!receivedAt) {
    return new Date();
  }
  try {
    return new Date(receivedAt);
  } catch (error) {
    console.error("Failed to parse receivedAt timestamp:", receivedAt, error);
    return new Date();
  }
}

/**
 * Clean up old completed WAL entries
 * Keeps the WAL table from growing indefinitely
 */
export async function cleanupOldEntries(
  maxAge: number = 7 * 24 * 60 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAge);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .delete(webhookWal)
    .where(
      and(
        inArray(webhookWal.status, ["completed", "failed"]),
        sql`${webhookWal.completedAt} IS NOT NULL AND ${webhookWal.completedAt} < ${cutoff.toISOString()}`
      )
    );

  const deletedCount =
    (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
  console.log(`[WAL] Cleaned up ${deletedCount} old entries`);
  return deletedCount;
}

/**
 * Get WAL statistics
 */
export async function getWalStats(): Promise<{
  received: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  total: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const results = await db
    .select({
      status: webhookWal.status,
    })
    .from(webhookWal);

  const stats = {
    received: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retrying: 0,
    total: results.length,
  };

  for (const r of results) {
    const status = r.status as WalStatus;
    if (status in stats) {
      (stats as Record<string, number>)[status]++;
    }
  }

  return stats;
}

/**
 * Recovery function to run on server startup
 * Finds and reprocesses any webhooks that were stuck in "processing" state
 */
export async function recoverStuckWebhooks(): Promise<number> {
  console.log("[WAL] Checking for stuck webhooks...");

  const stuck = await getStuckWebhooks();

  if (stuck.length === 0) {
    console.log("[WAL] No stuck webhooks found");
    return 0;
  }

  console.log(
    `[WAL] Found ${stuck.length} stuck webhooks, marking for retry...`
  );

  for (const entry of stuck) {
    await markForRetry(entry.walId, "Server restart recovery");
  }

  return stuck.length;
}

// Export for use in server startup
export const webhookWalService = {
  writeToWal,
  markProcessing,
  markCompleted,
  markFailed,
  markForRetry,
  getStuckWebhooks,
  getRetryableWebhooks,
  getWalEntry,
  cleanupOldEntries,
  getWalStats,
  recoverStuckWebhooks,
};
