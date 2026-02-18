/**
 * Broker Order Service
 *
 * Tracks order lifecycle from submission to fill/rejection:
 * 1. Creates order record before submission
 * 2. Updates with broker order ID after submission
 * 3. Polls for order status updates
 * 4. Updates trade record with actual fill price
 * 5. Alerts on failures or partial fills
 */

import { getDb } from "./db";
import { brokerOrders, trades } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";

// Order status type
export type OrderStatus =
  | "pending"
  | "submitted"
  | "acknowledged"
  | "working"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired"
  | "error";

// Order action type
export type OrderAction = "buy" | "sell";

// Order type
export type OrderType = "market" | "limit" | "stop" | "stop_limit";

// Order record interface
export interface BrokerOrderRecord {
  id: number;
  internalOrderId: string;
  brokerOrderId?: string;
  broker: string;
  strategySymbol: string;
  symbol: string;
  action: OrderAction;
  orderType: OrderType;
  quantity: number;
  requestedPrice?: number;
  filledQuantity: number;
  avgFillPrice?: number;
  commission?: number;
  status: OrderStatus;
  brokerStatus?: string;
  rejectReason?: string;
  submittedAt?: Date;
  filledAt?: Date;
  isTest: boolean;
}

// Generate unique internal order ID
function generateOrderId(): string {
  return `ord_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

/**
 * Create a new order record before submission
 */
export async function createOrder(params: {
  webhookLogId?: number;
  openPositionId?: number;
  broker: string;
  strategySymbol: string;
  symbol: string;
  action: OrderAction;
  orderType?: OrderType;
  quantity: number;
  requestedPrice?: number;
  limitPrice?: number;
  stopPrice?: number;
  isTest?: boolean;
}): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const internalOrderId = generateOrderId();

  // @ts-expect-error TS2769
  await db.insert(brokerOrders).values({
    internalOrderId,
    webhookLogId: params.webhookLogId,
    openPositionId: params.openPositionId,
    broker: params.broker,
    strategySymbol: params.strategySymbol,
    symbol: params.symbol,
    action: params.action,
    orderType: params.orderType ?? "market",
    quantity: params.quantity,
    requestedPrice: params.requestedPrice,
    limitPrice: params.limitPrice,
    stopPrice: params.stopPrice,
    status: "pending",
    filledQuantity: 0,
    isTest: params.isTest ?? false,
  });

  console.log(
    `[BrokerOrder] Created: ${internalOrderId} (${params.action} ${params.quantity} ${params.symbol})`
  );
  return internalOrderId;
}

/**
 * Mark order as submitted to broker
 */
export async function markSubmitted(
  internalOrderId: string,
  brokerOrderId?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(brokerOrders)
    .set({
      status: "submitted",
      brokerOrderId,
      // @ts-expect-error TS2322
      submittedAt: new Date(),
    })
    .where(eq(brokerOrders.internalOrderId, internalOrderId));

  console.log(
    `[BrokerOrder] Submitted: ${internalOrderId} -> ${brokerOrderId}`
  );
}

/**
 * Update order status from broker
 */
export async function updateOrderStatus(
  internalOrderId: string,
  status: OrderStatus,
  details?: {
    brokerStatus?: string;
    filledQuantity?: number;
    avgFillPrice?: number;
    commission?: number;
    rejectReason?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: Record<string, unknown> = { status };

  if (details?.brokerStatus) updates.brokerStatus = details.brokerStatus;
  if (details?.filledQuantity !== undefined)
    updates.filledQuantity = details.filledQuantity;
  if (details?.avgFillPrice !== undefined)
    updates.avgFillPrice = details.avgFillPrice;
  if (details?.commission !== undefined)
    updates.commission = details.commission;
  if (details?.rejectReason) updates.rejectReason = details.rejectReason;

  // Set timestamps based on status
  if (status === "filled" || status === "partially_filled") {
    updates.filledAt = new Date();
  }
  if (status === "cancelled") {
    updates.cancelledAt = new Date();
  }
  if (status === "acknowledged") {
    updates.acknowledgedAt = new Date();
  }

  await db
    .update(brokerOrders)
    .set(updates)
    .where(eq(brokerOrders.internalOrderId, internalOrderId));

  console.log(`[BrokerOrder] Status update: ${internalOrderId} -> ${status}`);
}

/**
 * Mark order as filled and update related trade
 */
export async function markFilled(
  internalOrderId: string,
  fillDetails: {
    filledQuantity: number;
    avgFillPrice: number;
    commission?: number;
    brokerOrderId?: string;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Update order record
  await db
    .update(brokerOrders)
    .set({
      status: "filled",
      filledQuantity: fillDetails.filledQuantity,
      avgFillPrice: fillDetails.avgFillPrice,
      commission: fillDetails.commission ?? 0,
      brokerOrderId: fillDetails.brokerOrderId,
      // @ts-expect-error TS2322
      filledAt: new Date(),
    })
    .where(eq(brokerOrders.internalOrderId, internalOrderId));

  // Get the order to find related trade
  const orders = await db
    .select()
    .from(brokerOrders)
    .where(eq(brokerOrders.internalOrderId, internalOrderId))
    .limit(1);

  if (orders.length > 0 && orders[0].tradeId) {
    // Update trade with actual fill price
    await db
      .update(trades)
      .set({
        exitPrice: fillDetails.avgFillPrice,
        commission: fillDetails.commission ?? 0,
      })
      .where(eq(trades.id, orders[0].tradeId));

    console.log(
      `[BrokerOrder] Updated trade ${orders[0].tradeId} with fill price ${fillDetails.avgFillPrice}`
    );
  }

  console.log(
    `[BrokerOrder] Filled: ${internalOrderId} @ ${fillDetails.avgFillPrice}`
  );
}

/**
 * Mark order as rejected
 */
export async function markRejected(
  internalOrderId: string,
  reason: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(brokerOrders)
    .set({
      status: "rejected",
      rejectReason: reason,
    })
    .where(eq(brokerOrders.internalOrderId, internalOrderId));

  console.log(`[BrokerOrder] Rejected: ${internalOrderId} - ${reason}`);
}

/**
 * Get order by internal ID
 */
export async function getOrder(
  internalOrderId: string
): Promise<BrokerOrderRecord | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select()
    .from(brokerOrders)
    .where(eq(brokerOrders.internalOrderId, internalOrderId))
    .limit(1);

  if (results.length === 0) return null;

  const r = results[0];
  return {
    id: r.id,
    internalOrderId: r.internalOrderId,
    brokerOrderId: r.brokerOrderId ?? undefined,
    broker: r.broker,
    strategySymbol: r.strategySymbol,
    symbol: r.symbol,
    action: r.action as OrderAction,
    orderType: r.orderType as OrderType,
    quantity: r.quantity,
    requestedPrice: r.requestedPrice ?? undefined,
    filledQuantity: r.filledQuantity,
    avgFillPrice: r.avgFillPrice ?? undefined,
    commission: r.commission ?? undefined,
    status: r.status as OrderStatus,
    brokerStatus: r.brokerStatus ?? undefined,
    rejectReason: r.rejectReason ?? undefined,
    // @ts-expect-error TS2322
    submittedAt: r.submittedAt ?? undefined,
    // @ts-expect-error TS2322
    filledAt: r.filledAt ?? undefined,
    // @ts-expect-error TS2322
    isTest: r.isTest,
  };
}

/**
 * Get pending orders that need status polling
 */
export async function getPendingOrders(): Promise<BrokerOrderRecord[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const pendingStatuses: OrderStatus[] = [
    "submitted",
    "acknowledged",
    "working",
    "partially_filled",
  ];

  const results = await db
    .select()
    .from(brokerOrders)
    .where(inArray(brokerOrders.status, pendingStatuses));

  // @ts-expect-error TS2322
  return results.map(r => ({
    id: r.id,
    internalOrderId: r.internalOrderId,
    brokerOrderId: r.brokerOrderId ?? undefined,
    broker: r.broker,
    strategySymbol: r.strategySymbol,
    symbol: r.symbol,
    action: r.action as OrderAction,
    orderType: r.orderType as OrderType,
    quantity: r.quantity,
    requestedPrice: r.requestedPrice ?? undefined,
    filledQuantity: r.filledQuantity,
    avgFillPrice: r.avgFillPrice ?? undefined,
    commission: r.commission ?? undefined,
    status: r.status as OrderStatus,
    brokerStatus: r.brokerStatus ?? undefined,
    rejectReason: r.rejectReason ?? undefined,
    submittedAt: r.submittedAt ?? undefined,
    filledAt: r.filledAt ?? undefined,
    isTest: r.isTest,
  }));
}

/**
 * Link order to trade record
 */
export async function linkOrderToTrade(
  internalOrderId: string,
  tradeId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(brokerOrders)
    .set({ tradeId })
    .where(eq(brokerOrders.internalOrderId, internalOrderId));

  console.log(`[BrokerOrder] Linked ${internalOrderId} to trade ${tradeId}`);
}

/**
 * Get order statistics
 */
export async function getOrderStats(): Promise<{
  pending: number;
  filled: number;
  rejected: number;
  total: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const results = await db
    .select({ status: brokerOrders.status })
    .from(brokerOrders);

  const stats = {
    pending: 0,
    filled: 0,
    rejected: 0,
    total: results.length,
  };

  for (const r of results) {
    if (
      [
        "pending",
        "submitted",
        "acknowledged",
        "working",
        "partially_filled",
      ].includes(r.status)
    ) {
      stats.pending++;
    } else if (r.status === "filled") {
      stats.filled++;
    } else if (
      ["rejected", "cancelled", "expired", "error"].includes(r.status)
    ) {
      stats.rejected++;
    }
  }

  return stats;
}

// Export service
export const brokerOrderService = {
  createOrder,
  markSubmitted,
  updateOrderStatus,
  markFilled,
  markRejected,
  getOrder,
  getPendingOrders,
  linkOrderToTrade,
  getOrderStats,
};
