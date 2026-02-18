/**
 * Paper Trading Service
 * Simulates order execution without connecting to a real broker.
 * Allows users to test strategies with virtual money.
 */

import { getDb } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  paperTrades,
  paperPositions,
  paperAccounts,
  type PaperTrade,
  type PaperPosition,
  type PaperAccount,
} from "../drizzle/schema";
import type {
  PaperOrder,
  PaperOrderResult,
  PaperAccountSummary,
} from "../shared/paperTrading";

// Re-export types for backward compatibility
export type { PaperOrder, PaperOrderResult, PaperAccountSummary };

// Default starting balance: $100,000
const DEFAULT_STARTING_BALANCE = 10000000; // in cents

/**
 * Get or create a paper trading account for a user
 */
export async function getOrCreatePaperAccount(
  userId: number
): Promise<PaperAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if account exists
  const existing = await db
    .select()
    .from(paperAccounts)
    .where(eq(paperAccounts.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Create new account
  const [result] = await db.insert(paperAccounts).values({
    userId,
    name: "Paper Trading Account",
    balance: DEFAULT_STARTING_BALANCE,
    startingBalance: DEFAULT_STARTING_BALANCE,
    realizedPnl: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
  });

  const [newAccount] = await db
    .select()
    .from(paperAccounts)
    .where(eq(paperAccounts.id, result.insertId))
    .limit(1);

  return newAccount;
}

/**
 * Get paper account summary with calculated metrics
 */
export async function getPaperAccountSummary(
  userId: number
): Promise<PaperAccountSummary | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const account = await getOrCreatePaperAccount(userId);

  // Get open positions
  const positions = await db
    .select()
    .from(paperPositions)
    .where(
      and(
        eq(paperPositions.accountId, account.id),
        eq(paperPositions.status, "open")
      )
    );

  // Calculate unrealized P&L (simplified - would need real market data)
  const unrealizedPnl = positions.reduce((sum: number, pos: PaperPosition) => {
    return sum + (pos.unrealizedPnl || 0);
  }, 0);

  // Calculate win rate
  const totalTrades = account.totalTrades || 0;
  const winningTrades = account.winningTrades || 0;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Calculate profit factor
  const [profitStats] = await db
    .select({
      totalProfit: sql<number>`COALESCE(SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END), 0)`,
      totalLoss: sql<number>`COALESCE(SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END), 0)`,
    })
    .from(paperTrades)
    .where(eq(paperTrades.accountId, account.id));

  const profitFactor =
    profitStats.totalLoss > 0
      ? profitStats.totalProfit / profitStats.totalLoss
      : profitStats.totalProfit > 0
        ? Infinity
        : 0;

  return {
    accountId: account.id,
    balance: account.balance,
    equity: account.balance + unrealizedPnl,
    unrealizedPnl,
    realizedPnl: account.realizedPnl || 0,
    openPositions: positions.length,
    totalTrades,
    winRate,
    profitFactor,
  };
}

/**
 * Execute a paper trade (simulated order)
 */
export async function executePaperOrder(
  order: PaperOrder
): Promise<PaperOrderResult> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const account = await getOrCreatePaperAccount(order.userId);

    // Simulate fill price (for market orders, use a simulated price)
    // In a real implementation, this would fetch current market price
    let fillPrice: number;

    if (order.orderType === "MARKET") {
      // Simulate market price (would normally fetch from market data)
      // For now, use limit price if provided, or a placeholder
      fillPrice = order.limitPrice || 500000; // $5000 default for futures
    } else if (order.orderType === "LIMIT") {
      if (!order.limitPrice) {
        return {
          success: false,
          error: "Limit price required for limit orders",
        };
      }
      fillPrice = order.limitPrice;
    } else if (order.orderType === "STOP") {
      if (!order.stopPrice) {
        return { success: false, error: "Stop price required for stop orders" };
      }
      fillPrice = order.stopPrice;
    } else {
      return { success: false, error: "Invalid order type" };
    }

    // Check if we have an existing position
    const [existingPosition] = await db
      .select()
      .from(paperPositions)
      .where(
        and(
          eq(paperPositions.accountId, account.id),
          eq(paperPositions.symbol, order.symbol),
          eq(paperPositions.status, "open")
        )
      )
      .limit(1);

    let tradeId: number;
    let positionId: number;
    let pnl = 0;

    if (existingPosition) {
      // We have an existing position
      const isClosing =
        (existingPosition.side === "LONG" && order.side === "SELL") ||
        (existingPosition.side === "SHORT" && order.side === "BUY");

      if (isClosing) {
        // Close the position
        pnl = calculatePnl(
          existingPosition.side,
          existingPosition.entryPrice,
          fillPrice,
          Math.min(order.quantity, existingPosition.quantity)
        );

        const remainingQty = existingPosition.quantity - order.quantity;

        if (remainingQty <= 0) {
          // Fully close position
          await db
            .update(paperPositions)
            .set({
              status: "closed",
              exitPrice: fillPrice,
              // @ts-expect-error TS2322
              exitDate: new Date(),
              realizedPnl: pnl,
              // @ts-expect-error TS2322
              updatedAt: new Date(),
            })
            .where(eq(paperPositions.id, existingPosition.id));
        } else {
          // Partially close position
          await db
            .update(paperPositions)
            .set({
              quantity: remainingQty,
              realizedPnl: (existingPosition.realizedPnl || 0) + pnl,
              // @ts-expect-error TS2322
              updatedAt: new Date(),
            })
            .where(eq(paperPositions.id, existingPosition.id));
        }

        // Update account balance
        await db
          .update(paperAccounts)
          .set({
            balance: account.balance + pnl,
            realizedPnl: (account.realizedPnl || 0) + pnl,
            totalTrades: (account.totalTrades || 0) + 1,
            winningTrades:
              pnl > 0
                ? (account.winningTrades || 0) + 1
                : account.winningTrades || 0,
            losingTrades:
              pnl < 0
                ? (account.losingTrades || 0) + 1
                : account.losingTrades || 0,
            // @ts-expect-error TS2322
            updatedAt: new Date(),
          })
          .where(eq(paperAccounts.id, account.id));

        positionId = existingPosition.id;
      } else {
        // Adding to position
        const newQty = existingPosition.quantity + order.quantity;
        const newAvgPrice = Math.round(
          (existingPosition.entryPrice * existingPosition.quantity +
            fillPrice * order.quantity) /
            newQty
        );

        await db
          .update(paperPositions)
          .set({
            quantity: newQty,
            entryPrice: newAvgPrice,
            // @ts-expect-error TS2322
            updatedAt: new Date(),
          })
          .where(eq(paperPositions.id, existingPosition.id));

        positionId = existingPosition.id;
      }
    } else {
      // Create new position
      const side = order.side === "BUY" ? "LONG" : "SHORT";

      // @ts-expect-error TS2769
      const [posResult] = await db.insert(paperPositions).values({
        accountId: account.id,
        strategyId: order.strategyId,
        symbol: order.symbol,
        side,
        quantity: order.quantity,
        entryPrice: fillPrice,
        entryDate: new Date(),
        status: "open",
        unrealizedPnl: 0,
        realizedPnl: 0,
      });

      positionId = posResult.insertId;
    }

    // Record the trade
    // @ts-expect-error TS2769
    const [tradeResult] = await db.insert(paperTrades).values({
      accountId: account.id,
      positionId,
      strategyId: order.strategyId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: fillPrice,
      orderType: order.orderType,
      pnl,
      commission: 0, // Could add simulated commissions
      executedAt: new Date(),
    });

    tradeId = tradeResult.insertId;

    return {
      success: true,
      orderId: tradeId,
      tradeId,
      fillPrice,
      fillQuantity: order.quantity,
      message: `Paper ${order.side} order executed: ${order.quantity} ${order.symbol} @ $${(fillPrice / 100).toFixed(2)}`,
    };
  } catch (error) {
    console.error("Paper trade execution error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Calculate P&L for a trade
 */
function calculatePnl(
  side: string,
  entryPrice: number,
  exitPrice: number,
  quantity: number
): number {
  if (side === "LONG") {
    return (exitPrice - entryPrice) * quantity;
  } else {
    return (entryPrice - exitPrice) * quantity;
  }
}

/**
 * Get all open positions for a user
 */
export async function getOpenPositions(
  userId: number
): Promise<PaperPosition[]> {
  const db = await getDb();
  if (!db) return [];

  const account = await getOrCreatePaperAccount(userId);

  return db
    .select()
    .from(paperPositions)
    .where(
      and(
        eq(paperPositions.accountId, account.id),
        eq(paperPositions.status, "open")
      )
    );
}

/**
 * Get trade history for a user
 */
export async function getPaperTradeHistory(
  userId: number,
  limit: number = 50
): Promise<PaperTrade[]> {
  const db = await getDb();
  if (!db) return [];

  const account = await getOrCreatePaperAccount(userId);

  return db
    .select()
    .from(paperTrades)
    .where(eq(paperTrades.accountId, account.id))
    .orderBy(desc(paperTrades.executedAt))
    .limit(limit);
}

/**
 * Reset paper trading account
 */
export async function resetPaperAccount(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const account = await getOrCreatePaperAccount(userId);

  // Close all positions
  await db
    .update(paperPositions)
    // @ts-expect-error TS2322
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(paperPositions.accountId, account.id));

  // Reset account
  await db
    .update(paperAccounts)
    .set({
      balance: DEFAULT_STARTING_BALANCE,
      realizedPnl: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      // @ts-expect-error TS2322
      updatedAt: new Date(),
    })
    .where(eq(paperAccounts.id, account.id));

  return true;
}

/**
 * Process a webhook signal in paper trading mode
 */
export async function processPaperWebhook(
  userId: number,
  signal: {
    strategy: string;
    symbol: string;
    direction: "Long" | "Short";
    action: "entry" | "exit";
    price: number; // in dollars
    quantity?: number;
  }
): Promise<PaperOrderResult> {
  // Convert direction and action to order side
  let side: "BUY" | "SELL";

  if (signal.action === "entry") {
    side = signal.direction === "Long" ? "BUY" : "SELL";
  } else {
    // Exit - opposite of direction
    side = signal.direction === "Long" ? "SELL" : "BUY";
  }

  return executePaperOrder({
    userId,
    symbol: signal.symbol,
    side,
    quantity: signal.quantity || 1,
    orderType: "MARKET",
    limitPrice: Math.round(signal.price * 100), // Convert to cents
  });
}
