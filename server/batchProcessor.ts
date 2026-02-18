/**
 * Batch Signal Processing Service
 * Groups rapid-fire webhook signals for efficient processing
 */

import { getDb } from "./db";
import { signalBatches } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// Batch configuration
const BATCH_WINDOW_MS = 2000; // 2 second window to collect signals
const MAX_BATCH_SIZE = 10; // Maximum signals per batch

// In-memory batch tracking
interface PendingBatch {
  batchId: string;
  strategySymbol: string;
  signals: Array<{
    action: string;
    direction: string;
    price: number;
    quantity: number;
    timestamp: Date;
    correlationId: string;
  }>;
  windowStartAt: Date;
  timeoutId: NodeJS.Timeout;
}

const pendingBatches: Map<string, PendingBatch> = new Map();

/**
 * Generate a unique batch ID
 */
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get batch key for a strategy
 */
function getBatchKey(strategySymbol: string): string {
  return `batch_${strategySymbol}`;
}

/**
 * Add a signal to a batch (or create new batch)
 */
export async function addSignalToBatch(
  strategySymbol: string,
  signal: {
    action: string;
    direction: string;
    price: number;
    quantity: number;
    correlationId: string;
  }
): Promise<{ batchId: string; isNewBatch: boolean; signalCount: number }> {
  const batchKey = getBatchKey(strategySymbol);
  const now = new Date();

  let batch = pendingBatches.get(batchKey);
  let isNewBatch = false;

  if (!batch) {
    // Create new batch
    const batchId = generateBatchId();

    batch = {
      batchId,
      strategySymbol,
      signals: [],
      windowStartAt: now,
      timeoutId: setTimeout(() => processBatch(batchKey), BATCH_WINDOW_MS),
    };

    pendingBatches.set(batchKey, batch);
    isNewBatch = true;

    // Record batch in database
    const db = await getDb();
    if (db) {
      // @ts-expect-error TS2769
      await db.insert(signalBatches).values({
        batchId,
        strategySymbol,
        windowStartAt: now,
        signalCount: 0,
        status: "collecting",
      });
    }
  }

  // Add signal to batch
  batch.signals.push({
    ...signal,
    timestamp: now,
  });

  // Update database
  const db = await getDb();
  if (db) {
    await db
      .update(signalBatches)
      .set({ signalCount: batch.signals.length })
      .where(eq(signalBatches.batchId, batch.batchId));
  }

  // If batch is full, process immediately
  if (batch.signals.length >= MAX_BATCH_SIZE) {
    clearTimeout(batch.timeoutId);
    await processBatch(batchKey);
  }

  return {
    batchId: batch.batchId,
    isNewBatch,
    signalCount: batch.signals.length,
  };
}

/**
 * Process a batch of signals
 */
async function processBatch(batchKey: string): Promise<void> {
  const batch = pendingBatches.get(batchKey);
  if (!batch) return;

  // Remove from pending
  pendingBatches.delete(batchKey);

  const db = await getDb();
  if (!db) return;

  try {
    // Update status to processing
    await db
      .update(signalBatches)
      .set({
        status: "processing",
        // @ts-expect-error TS2322
        windowEndAt: new Date(),
      })
      .where(eq(signalBatches.batchId, batch.batchId));

    // Calculate net position from all signals
    const netResult = calculateNetPosition(batch.signals);

    // Update batch with results
    await db
      .update(signalBatches)
      .set({
        status: "completed",
        netDirection: netResult.direction,
        netQuantity: netResult.quantity,
        avgPrice: netResult.avgPrice,
      })
      .where(eq(signalBatches.batchId, batch.batchId));

    console.log(
      `[BatchProcessor] Processed batch ${batch.batchId}: ${batch.signals.length} signals -> net ${netResult.direction} ${netResult.quantity} @ ${netResult.avgPrice}`
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db
      .update(signalBatches)
      .set({
        status: "failed",
        errorMessage,
      })
      .where(eq(signalBatches.batchId, batch.batchId));

    console.error(
      `[BatchProcessor] Failed to process batch ${batch.batchId}:`,
      error
    );
  }
}

/**
 * Calculate net position from multiple signals
 */
function calculateNetPosition(
  signals: Array<{
    action: string;
    direction: string;
    price: number;
    quantity: number;
  }>
): {
  direction: string | null;
  quantity: number;
  avgPrice: number;
} {
  if (signals.length === 0) {
    return { direction: null, quantity: 0, avgPrice: 0 };
  }

  // Separate entries and exits
  const entries = signals.filter(s => s.action === "entry");
  const exits = signals.filter(s => s.action === "exit");

  // Calculate net long/short quantities
  let longQty = 0;
  let shortQty = 0;
  let totalLongValue = 0;
  let totalShortValue = 0;

  for (const signal of entries) {
    if (signal.direction === "long") {
      longQty += signal.quantity;
      totalLongValue += signal.price * signal.quantity;
    } else {
      shortQty += signal.quantity;
      totalShortValue += signal.price * signal.quantity;
    }
  }

  // Exits reduce position
  for (const signal of exits) {
    if (signal.direction === "long") {
      longQty -= signal.quantity;
    } else {
      shortQty -= signal.quantity;
    }
  }

  // Calculate net
  const netQty = longQty - shortQty;

  if (netQty === 0) {
    return { direction: null, quantity: 0, avgPrice: 0 };
  }

  const direction = netQty > 0 ? "long" : "short";
  const quantity = Math.abs(netQty);

  // Calculate average price (weighted by quantity)
  let avgPrice = 0;
  if (direction === "long" && longQty > 0) {
    avgPrice = Math.round(totalLongValue / longQty);
  } else if (direction === "short" && shortQty > 0) {
    avgPrice = Math.round(totalShortValue / shortQty);
  }

  return { direction, quantity, avgPrice };
}

/**
 * Get batch statistics
 */
export async function getBatchStats(): Promise<{
  collecting: number;
  processing: number;
  completed: number;
  failed: number;
  pendingInMemory: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      collecting: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      pendingInMemory: pendingBatches.size,
    };
  }

  const stats = await db
    .select({
      status: signalBatches.status,
      count: sql<number>`count(*)`,
    })
    .from(signalBatches)
    .groupBy(signalBatches.status);

  const result = {
    collecting: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    pendingInMemory: pendingBatches.size,
  };

  for (const stat of stats) {
    const count = Number(stat.count);
    switch (stat.status) {
      case "collecting":
        result.collecting = count;
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
 * Check if batching is enabled for a strategy
 */
export function isBatchingEnabled(_strategySymbol: string): boolean {
  // For now, batching is disabled by default
  // Can be enabled per-strategy in the future
  return false;
}

/**
 * Get pending batch for a strategy
 */
export function getPendingBatch(strategySymbol: string): PendingBatch | null {
  const batchKey = getBatchKey(strategySymbol);
  return pendingBatches.get(batchKey) || null;
}

/**
 * Cancel a pending batch
 */
export function cancelPendingBatch(strategySymbol: string): boolean {
  const batchKey = getBatchKey(strategySymbol);
  const batch = pendingBatches.get(batchKey);

  if (batch) {
    clearTimeout(batch.timeoutId);
    pendingBatches.delete(batchKey);
    return true;
  }

  return false;
}

/**
 * Flush all pending batches (for shutdown)
 */
export async function flushAllBatches(): Promise<void> {
  const batchKeys = Array.from(pendingBatches.keys());

  for (const batchKey of batchKeys) {
    const batch = pendingBatches.get(batchKey);
    if (batch) {
      clearTimeout(batch.timeoutId);
      await processBatch(batchKey);
    }
  }
}
