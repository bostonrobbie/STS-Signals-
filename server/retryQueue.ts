/**
 * Webhook Retry Queue Service
 * Handles failed webhooks with exponential backoff retry logic
 */

import { getDb } from "./db";
import { webhookRetryQueue } from "../drizzle/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { processWebhook } from "./webhookService";

// Retry configuration
const INITIAL_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 300000; // 5 minutes
const BACKOFF_MULTIPLIER = 2;
const DEFAULT_MAX_RETRIES = 5;

// Processing state
let isProcessing = false;
let processingInterval: NodeJS.Timeout | null = null;

/**
 * Calculate next retry delay using exponential backoff
 */
function calculateNextDelay(retryCount: number): number {
  const delay = INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
  return Math.min(delay, MAX_DELAY_MS);
}

/**
 * Add a failed webhook to the retry queue
 */
export async function addToRetryQueue(
  originalPayload: string,
  correlationId: string,
  strategySymbol: string | null,
  error: string,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const nextRetryAt = new Date(Date.now() + INITIAL_DELAY_MS);

  // @ts-expect-error TS2769
  const result = await db.insert(webhookRetryQueue).values({
    originalPayload,
    correlationId,
    strategySymbol,
    retryCount: 0,
    maxRetries,
    nextRetryAt,
    lastError: error,
    status: "pending",
  });

  console.log(
    `[RetryQueue] Added webhook ${correlationId} to retry queue, next retry at ${nextRetryAt.toISOString()}`
  );

  return result[0].insertId;
}

/**
 * Get pending items ready for retry
 */
export async function getPendingRetries(limit: number = 10): Promise<
  Array<{
    id: number;
    originalPayload: string;
    correlationId: string;
    strategySymbol: string | null;
    retryCount: number;
    maxRetries: number;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  return db
    .select({
      id: webhookRetryQueue.id,
      originalPayload: webhookRetryQueue.originalPayload,
      correlationId: webhookRetryQueue.correlationId,
      strategySymbol: webhookRetryQueue.strategySymbol,
      retryCount: webhookRetryQueue.retryCount,
      maxRetries: webhookRetryQueue.maxRetries,
    })
    .from(webhookRetryQueue)
    .where(
      and(
        eq(webhookRetryQueue.status, "pending"),
        // @ts-expect-error TS2769
        lte(webhookRetryQueue.nextRetryAt, now)
      )
    )
    .limit(limit);
}

/**
 * Mark an item as processing
 */
export async function markAsProcessing(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(webhookRetryQueue)
    .set({ status: "processing" })
    .where(eq(webhookRetryQueue.id, id));
}

/**
 * Mark an item as completed (successful retry)
 */
export async function markAsCompleted(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(webhookRetryQueue)
    .set({
      status: "completed",
      // @ts-expect-error TS2322
      completedAt: new Date(),
    })
    .where(eq(webhookRetryQueue.id, id));

  console.log(`[RetryQueue] Item ${id} completed successfully`);
}

/**
 * Schedule next retry for an item
 */
export async function scheduleNextRetry(
  id: number,
  retryCount: number,
  error: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const nextDelay = calculateNextDelay(retryCount);
  const nextRetryAt = new Date(Date.now() + nextDelay);

  await db
    .update(webhookRetryQueue)
    .set({
      status: "pending",
      retryCount: retryCount + 1,
      // @ts-expect-error TS2322
      nextRetryAt,
      lastError: error,
    })
    .where(eq(webhookRetryQueue.id, id));

  console.log(
    `[RetryQueue] Item ${id} scheduled for retry #${retryCount + 1} at ${nextRetryAt.toISOString()}`
  );
}

/**
 * Mark an item as permanently failed
 */
export async function markAsFailed(id: number, error: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(webhookRetryQueue)
    .set({
      status: "failed",
      lastError: error,
      // @ts-expect-error TS2322
      completedAt: new Date(),
    })
    .where(eq(webhookRetryQueue.id, id));

  console.log(`[RetryQueue] Item ${id} permanently failed: ${error}`);
}

/**
 * Process a single retry item
 */
async function processRetryItem(item: {
  id: number;
  originalPayload: string;
  correlationId: string;
  strategySymbol: string | null;
  retryCount: number;
  maxRetries: number;
}): Promise<void> {
  try {
    await markAsProcessing(item.id);

    // Parse the original payload
    const payload = JSON.parse(item.originalPayload);

    // Generate a new correlation ID for the retry
    const retryCorrelationId = `${item.correlationId}_retry${item.retryCount + 1}`;

    // Process the webhook
    const result = await processWebhook(payload, retryCorrelationId);

    if (result.success) {
      await markAsCompleted(item.id);
    } else {
      // Check if we should retry again
      if (item.retryCount + 1 >= item.maxRetries) {
        await markAsFailed(item.id, result.error || "Max retries exceeded");
      } else {
        await scheduleNextRetry(
          item.id,
          item.retryCount,
          result.error || "Unknown error"
        );
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    if (item.retryCount + 1 >= item.maxRetries) {
      await markAsFailed(item.id, errorMessage);
    } else {
      await scheduleNextRetry(item.id, item.retryCount, errorMessage);
    }
  }
}

/**
 * Process all pending retries
 */
export async function processPendingRetries(): Promise<number> {
  if (isProcessing) {
    return 0;
  }

  isProcessing = true;
  let processedCount = 0;

  try {
    const pendingItems = await getPendingRetries(10);

    for (const item of pendingItems) {
      await processRetryItem(item);
      processedCount++;
    }
  } catch (error) {
    console.error("[RetryQueue] Error processing retries:", error);
  } finally {
    isProcessing = false;
  }

  return processedCount;
}

/**
 * Start the retry queue processor
 */
export function startRetryQueueProcessor(intervalMs: number = 5000): void {
  if (processingInterval) {
    console.log("[RetryQueue] Processor already running");
    return;
  }

  console.log(`[RetryQueue] Starting processor with ${intervalMs}ms interval`);

  processingInterval = setInterval(async () => {
    const processed = await processPendingRetries();
    if (processed > 0) {
      console.log(`[RetryQueue] Processed ${processed} retry items`);
    }
  }, intervalMs);
}

/**
 * Stop the retry queue processor
 */
export function stopRetryQueueProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[RetryQueue] Processor stopped");
  }
}

/**
 * Get retry queue statistics
 */
export async function getRetryQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  const db = await getDb();
  if (!db)
    return { pending: 0, processing: 0, completed: 0, failed: 0, total: 0 };

  const stats = await db
    .select({
      status: webhookRetryQueue.status,
      count: sql<number>`count(*)`,
    })
    .from(webhookRetryQueue)
    .groupBy(webhookRetryQueue.status);

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  for (const stat of stats) {
    const count = Number(stat.count);
    result.total += count;

    switch (stat.status) {
      case "pending":
        result.pending = count;
        break;
      case "processing":
        result.processing = count;
        break;
      case "completed":
        result.completed = count;
        break;
      case "failed":
        result.failed = count;
        break;
    }
  }

  return result;
}

/**
 * Cancel a pending retry
 */
export async function cancelRetry(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .update(webhookRetryQueue)
    .set({ status: "cancelled" })
    .where(
      and(eq(webhookRetryQueue.id, id), eq(webhookRetryQueue.status, "pending"))
    );

  return result[0].affectedRows > 0;
}

/**
 * Clear old completed/failed items (cleanup)
 */
export async function cleanupOldItems(
  olderThanDays: number = 7
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await db
    .delete(webhookRetryQueue)
    .where(
      and(
        sql`${webhookRetryQueue.status} IN ('completed', 'failed', 'cancelled')`,
        sql`${webhookRetryQueue.completedAt} IS NOT NULL AND ${webhookRetryQueue.completedAt} <= ${cutoffDate.toISOString()}`
      )
    );

  return result[0].affectedRows;
}
