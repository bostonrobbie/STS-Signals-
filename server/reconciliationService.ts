/**
 * Position Reconciliation Service
 *
 * Compares database positions with broker positions to detect discrepancies:
 * 1. Fetches current positions from broker
 * 2. Compares with database open_positions table
 * 3. Logs discrepancies for review
 * 4. Provides tools to resolve discrepancies
 */

import { getDb } from "./db";
import {
  reconciliationLogs,
  openPositions,
  positionAdjustments,
} from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";

// Discrepancy types
export type DiscrepancyType =
  | "missing_in_db"
  | "missing_in_broker"
  | "quantity_mismatch"
  | "direction_mismatch"
  | "price_mismatch"
  | "matched";

// Position from broker
export interface BrokerPosition {
  symbol: string;
  direction: "long" | "short";
  quantity: number;
  avgPrice: number;
  accountId?: string;
}

// Position from database
export interface DbPosition {
  id: number;
  strategySymbol: string;
  symbol: string;
  direction: "long" | "short";
  quantity: number;
  entryPrice: number;
}

// Reconciliation result
export interface ReconciliationResult {
  reconciliationId: string;
  runAt: Date;
  broker: string;
  discrepancies: Array<{
    type: DiscrepancyType;
    symbol: string;
    strategySymbol?: string;
    dbPosition?: DbPosition;
    brokerPosition?: BrokerPosition;
    details: string;
  }>;
  matchedCount: number;
  discrepancyCount: number;
}

// Generate unique reconciliation ID
function generateReconciliationId(): string {
  return `rec_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

/**
 * Get all open positions from database
 */
export async function getDbPositions(): Promise<DbPosition[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(openPositions)
    .where(eq(openPositions.isTest, 0));

  return results.map(r => ({
    id: r.id,
    strategySymbol: r.strategySymbol,
    symbol: r.strategySymbol, // Use strategySymbol as the symbol
    direction: r.direction as "long" | "short",
    quantity: r.quantity,
    entryPrice: r.entryPrice,
  }));
}

/**
 * Run reconciliation between database and broker positions
 */
export async function runReconciliation(
  broker: string,
  brokerPositions: BrokerPosition[],
  accountId?: string
): Promise<ReconciliationResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const reconciliationId = generateReconciliationId();
  const runAt = new Date();
  const dbPositions = await getDbPositions();

  const discrepancies: ReconciliationResult["discrepancies"] = [];
  const matchedSymbols = new Set<string>();

  // Check each broker position against DB
  for (const brokerPos of brokerPositions) {
    const dbPos = dbPositions.find(p => p.symbol === brokerPos.symbol);

    if (!dbPos) {
      // Position exists in broker but not in DB
      discrepancies.push({
        type: "missing_in_db",
        symbol: brokerPos.symbol,
        brokerPosition: brokerPos,
        details: `Position exists in ${broker} but not in database: ${brokerPos.direction} ${brokerPos.quantity} @ ${brokerPos.avgPrice}`,
      });

      // Log to database
      // @ts-expect-error TS2769
      await db.insert(reconciliationLogs).values({
        reconciliationId,
        runAt,
        broker,
        accountId,
        symbol: brokerPos.symbol,
        brokerDirection: brokerPos.direction,
        brokerQuantity: brokerPos.quantity,
        brokerAvgPrice: brokerPos.avgPrice,
        discrepancyType: "missing_in_db",
        discrepancyDetails: `Position exists in ${broker} but not in database`,
      });
    } else {
      matchedSymbols.add(brokerPos.symbol);

      // Check for direction mismatch
      if (dbPos.direction !== brokerPos.direction) {
        discrepancies.push({
          type: "direction_mismatch",
          symbol: brokerPos.symbol,
          strategySymbol: dbPos.strategySymbol,
          dbPosition: dbPos,
          brokerPosition: brokerPos,
          details: `Direction mismatch: DB=${dbPos.direction}, Broker=${brokerPos.direction}`,
        });

        // @ts-expect-error TS2769
        await db.insert(reconciliationLogs).values({
          reconciliationId,
          runAt,
          broker,
          accountId,
          strategySymbol: dbPos.strategySymbol,
          symbol: brokerPos.symbol,
          dbPositionId: dbPos.id,
          dbDirection: dbPos.direction,
          dbQuantity: dbPos.quantity,
          dbEntryPrice: dbPos.entryPrice,
          brokerDirection: brokerPos.direction,
          brokerQuantity: brokerPos.quantity,
          brokerAvgPrice: brokerPos.avgPrice,
          discrepancyType: "direction_mismatch",
          discrepancyDetails: `Direction mismatch: DB=${dbPos.direction}, Broker=${brokerPos.direction}`,
        });
      }
      // Check for quantity mismatch
      else if (dbPos.quantity !== brokerPos.quantity) {
        discrepancies.push({
          type: "quantity_mismatch",
          symbol: brokerPos.symbol,
          strategySymbol: dbPos.strategySymbol,
          dbPosition: dbPos,
          brokerPosition: brokerPos,
          details: `Quantity mismatch: DB=${dbPos.quantity}, Broker=${brokerPos.quantity}`,
        });

        // @ts-expect-error TS2769
        await db.insert(reconciliationLogs).values({
          reconciliationId,
          runAt,
          broker,
          accountId,
          strategySymbol: dbPos.strategySymbol,
          symbol: brokerPos.symbol,
          dbPositionId: dbPos.id,
          dbDirection: dbPos.direction,
          dbQuantity: dbPos.quantity,
          dbEntryPrice: dbPos.entryPrice,
          brokerDirection: brokerPos.direction,
          brokerQuantity: brokerPos.quantity,
          brokerAvgPrice: brokerPos.avgPrice,
          discrepancyType: "quantity_mismatch",
          discrepancyDetails: `Quantity mismatch: DB=${dbPos.quantity}, Broker=${brokerPos.quantity}`,
        });
      }
      // Check for significant price mismatch (>5% difference)
      else {
        const priceDiff =
          Math.abs(dbPos.entryPrice - brokerPos.avgPrice) / dbPos.entryPrice;
        if (priceDiff > 0.05) {
          discrepancies.push({
            type: "price_mismatch",
            symbol: brokerPos.symbol,
            strategySymbol: dbPos.strategySymbol,
            dbPosition: dbPos,
            brokerPosition: brokerPos,
            details: `Price mismatch (${(priceDiff * 100).toFixed(1)}%): DB=${dbPos.entryPrice}, Broker=${brokerPos.avgPrice}`,
          });

          // @ts-expect-error TS2769
          await db.insert(reconciliationLogs).values({
            reconciliationId,
            runAt,
            broker,
            accountId,
            strategySymbol: dbPos.strategySymbol,
            symbol: brokerPos.symbol,
            dbPositionId: dbPos.id,
            dbDirection: dbPos.direction,
            dbQuantity: dbPos.quantity,
            dbEntryPrice: dbPos.entryPrice,
            brokerDirection: brokerPos.direction,
            brokerQuantity: brokerPos.quantity,
            brokerAvgPrice: brokerPos.avgPrice,
            discrepancyType: "price_mismatch",
            discrepancyDetails: `Price mismatch: DB=${dbPos.entryPrice}, Broker=${brokerPos.avgPrice}`,
          });
        } else {
          // Matched - log for completeness
          // @ts-expect-error TS2769
          await db.insert(reconciliationLogs).values({
            reconciliationId,
            runAt,
            broker,
            accountId,
            strategySymbol: dbPos.strategySymbol,
            symbol: brokerPos.symbol,
            dbPositionId: dbPos.id,
            dbDirection: dbPos.direction,
            dbQuantity: dbPos.quantity,
            dbEntryPrice: dbPos.entryPrice,
            brokerDirection: brokerPos.direction,
            brokerQuantity: brokerPos.quantity,
            brokerAvgPrice: brokerPos.avgPrice,
            discrepancyType: "matched",
          });
        }
      }
    }
  }

  // Check for DB positions missing in broker
  for (const dbPos of dbPositions) {
    if (!matchedSymbols.has(dbPos.symbol)) {
      discrepancies.push({
        type: "missing_in_broker",
        symbol: dbPos.symbol,
        strategySymbol: dbPos.strategySymbol,
        dbPosition: dbPos,
        details: `Position exists in database but not in ${broker}: ${dbPos.direction} ${dbPos.quantity} @ ${dbPos.entryPrice}`,
      });

      // @ts-expect-error TS2769
      await db.insert(reconciliationLogs).values({
        reconciliationId,
        runAt,
        broker,
        accountId,
        strategySymbol: dbPos.strategySymbol,
        symbol: dbPos.symbol,
        dbPositionId: dbPos.id,
        dbDirection: dbPos.direction,
        dbQuantity: dbPos.quantity,
        dbEntryPrice: dbPos.entryPrice,
        discrepancyType: "missing_in_broker",
        discrepancyDetails: `Position exists in database but not in ${broker}`,
      });
    }
  }

  const result: ReconciliationResult = {
    reconciliationId,
    runAt,
    broker,
    discrepancies,
    matchedCount: matchedSymbols.size,
    discrepancyCount: discrepancies.length,
  };

  console.log(
    `[Reconciliation] ${reconciliationId}: ${result.matchedCount} matched, ${result.discrepancyCount} discrepancies`
  );

  return result;
}

/**
 * Get unresolved discrepancies
 */
export async function getUnresolvedDiscrepancies(broker?: string): Promise<
  Array<{
    id: number;
    reconciliationId: string;
    runAt: Date;
    broker: string;
    symbol: string;
    strategySymbol?: string;
    discrepancyType: DiscrepancyType;
    discrepancyDetails?: string;
    dbDirection?: string;
    dbQuantity?: number;
    brokerDirection?: string;
    brokerQuantity?: number;
  }>
> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let query = db
    .select()
    .from(reconciliationLogs)
    .where(
      and(
        eq(reconciliationLogs.resolved, 0),
        broker ? eq(reconciliationLogs.broker, broker) : undefined
      )
    )
    .orderBy(desc(reconciliationLogs.runAt));

  const results = await query;

  // @ts-expect-error TS2322
  return results
    .filter(r => r.discrepancyType !== "matched")
    .map(r => ({
      id: r.id,
      reconciliationId: r.reconciliationId,
      runAt: r.runAt,
      broker: r.broker,
      symbol: r.symbol,
      strategySymbol: r.strategySymbol ?? undefined,
      discrepancyType: r.discrepancyType as DiscrepancyType,
      discrepancyDetails: r.discrepancyDetails ?? undefined,
      dbDirection: r.dbDirection ?? undefined,
      dbQuantity: r.dbQuantity ?? undefined,
      brokerDirection: r.brokerDirection ?? undefined,
      brokerQuantity: r.brokerQuantity ?? undefined,
    }));
}

/**
 * Resolve a discrepancy
 */
export async function resolveDiscrepancy(
  discrepancyId: number,
  resolution: {
    action: "sync_from_broker" | "force_close" | "ignore" | "manual_fix";
    resolvedBy: string;
    notes?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(reconciliationLogs)
    .set({
      resolved: 1,
      resolvedAt: new Date().toISOString(),
      resolvedBy: resolution.resolvedBy,
      resolutionAction: resolution.action,
      resolutionNotes: resolution.notes,
    })
    .where(eq(reconciliationLogs.id, discrepancyId));

  console.log(
    `[Reconciliation] Resolved discrepancy ${discrepancyId}: ${resolution.action}`
  );
}

/**
 * Force close a position (mark as closed without exit signal)
 */
export async function forceClosePosition(
  positionId: number,
  reason: string,
  adjustedBy: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current position state
  const positions = await db
    .select()
    .from(openPositions)
    .where(eq(openPositions.id, positionId))
    .limit(1);

  if (positions.length === 0) {
    throw new Error(`Position ${positionId} not found`);
  }

  const pos = positions[0];

  // Log the adjustment
  await db.insert(positionAdjustments).values({
    openPositionId: positionId,
    strategySymbol: pos.strategySymbol,
    adjustmentType: "force_close",
    beforeDirection: pos.direction,
    beforeQuantity: pos.quantity,
    beforeEntryPrice: pos.entryPrice,
    afterDirection: null,
    afterQuantity: 0,
    afterEntryPrice: null,
    reason,
    adjustedBy,
  });

  // Delete the position
  await db.delete(openPositions).where(eq(openPositions.id, positionId));

  console.log(
    `[Reconciliation] Force closed position ${positionId}: ${reason}`
  );
}

/**
 * Sync position from broker (update DB to match broker state)
 */
export async function syncPositionFromBroker(
  strategySymbol: string,
  brokerPosition: BrokerPosition,
  adjustedBy: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if position exists
  const existing = await db
    .select()
    .from(openPositions)
    .where(eq(openPositions.strategySymbol, strategySymbol))
    .limit(1);

  if (existing.length > 0) {
    const pos = existing[0];

    // Log the adjustment
    await db.insert(positionAdjustments).values({
      openPositionId: pos.id,
      strategySymbol,
      adjustmentType: "sync_from_broker",
      beforeDirection: pos.direction,
      beforeQuantity: pos.quantity,
      beforeEntryPrice: pos.entryPrice,
      afterDirection: brokerPosition.direction,
      afterQuantity: brokerPosition.quantity,
      afterEntryPrice: brokerPosition.avgPrice,
      reason: `Synced from broker: ${brokerPosition.direction} ${brokerPosition.quantity} @ ${brokerPosition.avgPrice}`,
      adjustedBy,
    });

    // Update the position
    await db
      .update(openPositions)
      .set({
        direction: brokerPosition.direction,
        quantity: brokerPosition.quantity,
        entryPrice: brokerPosition.avgPrice,
      })
      .where(eq(openPositions.id, pos.id));
  } else {
    // Create new position - need to look up strategyId
    // For now, use 0 as placeholder - admin should verify
    await db.insert(openPositions).values({
      // @ts-expect-error TS2769
      strategyId: 0, // Placeholder - needs manual verification
      strategySymbol,
      direction: brokerPosition.direction,
      quantity: brokerPosition.quantity,
      entryPrice: brokerPosition.avgPrice,
      entryTime: new Date(),
      isTest: false,
    });

    // Log the adjustment
    await db.insert(positionAdjustments).values({
      strategySymbol,
      adjustmentType: "sync_from_broker",
      beforeDirection: null,
      beforeQuantity: 0,
      beforeEntryPrice: null,
      afterDirection: brokerPosition.direction,
      afterQuantity: brokerPosition.quantity,
      afterEntryPrice: brokerPosition.avgPrice,
      reason: `Created from broker sync: ${brokerPosition.direction} ${brokerPosition.quantity} @ ${brokerPosition.avgPrice}`,
      adjustedBy,
    });
  }

  console.log(
    `[Reconciliation] Synced position for ${strategySymbol} from broker`
  );
}

/**
 * Get position adjustment history
 */
export async function getAdjustmentHistory(strategySymbol?: string): Promise<
  Array<{
    id: number;
    strategySymbol: string;
    adjustmentType: string;
    beforeDirection?: string;
    beforeQuantity?: number;
    afterDirection?: string;
    afterQuantity?: number;
    reason: string;
    adjustedBy: string;
    createdAt: Date;
  }>
> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = strategySymbol
    ? await db
        .select()
        .from(positionAdjustments)
        .where(eq(positionAdjustments.strategySymbol, strategySymbol))
        .orderBy(desc(positionAdjustments.createdAt))
    : await db
        .select()
        .from(positionAdjustments)
        .orderBy(desc(positionAdjustments.createdAt));

  // @ts-expect-error TS2322
  return results.map(r => ({
    id: r.id,
    strategySymbol: r.strategySymbol,
    adjustmentType: r.adjustmentType,
    beforeDirection: r.beforeDirection ?? undefined,
    beforeQuantity: r.beforeQuantity ?? undefined,
    afterDirection: r.afterDirection ?? undefined,
    afterQuantity: r.afterQuantity ?? undefined,
    reason: r.reason,
    adjustedBy: r.adjustedBy,
    createdAt: r.createdAt,
  }));
}

// Export service
export const reconciliationService = {
  getDbPositions,
  runReconciliation,
  getUnresolvedDiscrepancies,
  resolveDiscrepancy,
  forceClosePosition,
  syncPositionFromBroker,
  getAdjustmentHistory,
};
