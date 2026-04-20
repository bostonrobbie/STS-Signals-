/**
 * TradingView Webhook Processing Service - Enhanced with Persistent Position Tracking
 *
 * Handles incoming webhook notifications from TradingView alerts,
 * validates the payload, processes trades, and updates the database.
 *
 * NEW: Uses database-backed open positions for reliable entry/exit tracking
 * that persists across server restarts.
 *
 * TradingView Webhook Format (Enhanced):
 * {
 *   "symbol": "ESTrend",
 *   "date": "{{timenow}}",
 *   "data": "{{strategy.order.action}}",
 *   "position": "{{strategy.market_position}}",  // NEW: "long", "short", or "flat"
 *   "quantity": 1,
 *   "price": "{{close}}",
 *   "token": "your_secret_token",
 *   "signalType": "entry" | "exit"  // NEW: Explicit signal type (optional)
 * }
 */

import {
  getStrategyBySymbol,
  insertWebhookLog,
  updateWebhookLog,
  insertTrade,
  checkDuplicateTrade,
  getLastInsertedTradeId,
  deleteWebhookLog,
  deleteAllWebhookLogs,
  getWebhookSettings,
  updateWebhookSettings,
  // New position tracking functions
  createOpenPosition,
  getOpenPositionByStrategy,
  closeOpenPosition,
  getAllOpenPositions,
  getRecentPositions,
  getPositionStats,
} from "./db";
import { InsertWebhookLog, InsertOpenPosition } from "../drizzle/schema";
import { notifyOwnerAsync } from "./_core/notification";
import { broadcastTradeNotification } from "./sseNotifications";
import { decideSubscriberNotify } from "./_core/commsGuard";
import {
  calculateUserPositionSize,
  calculatePositionSize,
  BACKTEST_STARTING_CAPITAL,
} from "./positionSizingService";
import * as subscriptionService from "./subscriptionService";
import { cache } from "./cache";

// TradingView payload format (enhanced with position tracking)
export interface TradingViewPayload {
  symbol: string; // Strategy/instrument symbol (e.g., "BTCUSD", "ES", "NQ")
  date: string; // Timestamp from {{timenow}}
  data: string; // Action from {{strategy.order.action}} - "buy", "sell", "exit", etc.
  quantity: number; // Number of contracts
  price: string | number; // Price from {{close}} or {{strategy.order.price}}
  token?: string; // Secret token for authentication
  multiple_accounts?: Array<{
    // Optional multi-account support
    account: string;
    quantity: number;
  }>;
  // Additional fields that may be sent
  direction?: string; // "Long" or "Short" (optional, can be inferred from data)
  entryPrice?: number; // Entry price for closed trades
  entryTime?: string; // Entry timestamp for closed trades
  pnl?: number; // P&L if provided by TradingView
  strategy?: string; // Strategy name (alternative to symbol)
  comment?: string; // Additional trade comment
  quantityMultiplier?: number; // Multiplier for quantity (e.g., 2 = double the signal quantity)
  isTest?: boolean; // Flag to indicate test webhook (won't create trades)
  // NEW: Enhanced position tracking fields
  position?: string; // From {{strategy.market_position}} - "long", "short", "flat"
  signalType?: string; // Explicit signal type: "entry", "exit", "scale_in", "scale_out"
  prevPosition?: string; // Previous position state (for detecting transitions)
}

// Internal normalized payload after parsing
export interface NormalizedPayload {
  strategySymbol: string;
  action: "entry" | "exit" | "buy" | "sell";
  direction: "Long" | "Short";
  price: number;
  quantity: number;
  timestamp: Date;
  entryPrice?: number;
  entryTime?: Date;
  pnl?: number;
  token?: string;
  // NEW: Enhanced fields
  signalType: "entry" | "exit"; // Determined signal type
  marketPosition: "long" | "short" | "flat"; // Current market position
  isTest: boolean; // Whether this is a test webhook
}

export interface WebhookResult {
  success: boolean;
  logId: number;
  tradeId?: number;
  positionId?: number; // NEW: Link to open position
  message: string;
  error?: string;
  processingTimeMs?: number;
  signalType?: "entry" | "exit"; // NEW: What type of signal was processed
}

// Validation errors
export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}

// Strategy symbol mapping (TradingView symbols to database symbols)
// Currently only NQ Trend strategies are active
const SYMBOL_MAPPING: Record<string, string> = {
  // NQ (E-mini Nasdaq) - Primary active strategies
  NQ: "NQTrend",
  "NQ1!": "NQTrend",
  NQ_TREND: "NQTrend",
  NQTREND: "NQTrend",
  MNQ: "NQTrend", // Micro NQ maps to same strategy
  "MNQ1!": "NQTrend",
  // NQ Leveraged variant
  NQ_LEV: "NQTrendLeveraged",
  NQLEV: "NQTrendLeveraged",
  NQ_LEVERAGED: "NQTrendLeveraged",
  NQTRENDLEVERAGED: "NQTrendLeveraged",
  NQTRENDLEV: "NQTrendLeveraged",
  // Legacy mappings (archived strategies - kept for reference)
  // ES: "ESTrend", // Archived
  // CL: "CLTrend", // Archived
  // BTC: "BTCTrend", // Archived
  // GC: "GCTrend", // Archived
  // YM: "YMORB", // Archived
};

/**
 * Map TradingView symbol to database strategy symbol
 */
export function mapSymbolToStrategy(symbol: string): string {
  // Try direct mapping first
  const upperSymbol = symbol.toUpperCase().trim();
  if (SYMBOL_MAPPING[upperSymbol]) {
    return SYMBOL_MAPPING[upperSymbol];
  }

  // Try partial match (e.g., "ESH2024" -> "ES")
  for (const [key, value] of Object.entries(SYMBOL_MAPPING)) {
    if (upperSymbol.startsWith(key)) {
      return value;
    }
  }

  // Return original if no mapping found
  return symbol;
}

/**
 * Determine signal type from payload
 * Priority: explicit signalType > position change > action inference
 */
function determineSignalType(
  payload: Record<string, unknown>
): "entry" | "exit" {
  // 1. Check explicit signalType field
  if (payload.signalType && typeof payload.signalType === "string") {
    const st = payload.signalType.toLowerCase().trim();
    if (st === "entry" || st === "open" || st === "enter") return "entry";
    if (st === "exit" || st === "close" || st === "flat") return "exit";
  }

  // 2. Check market position (from {{strategy.market_position}})
  if (payload.position && typeof payload.position === "string") {
    const pos = payload.position.toLowerCase().trim();
    // "flat" means no position = exit signal
    if (pos === "flat") return "exit";
    // "long" or "short" with no previous position = entry
    // This is a new position being opened
  }

  // 3. Infer from action/data field
  const action = (payload.data || payload.action) as string;
  if (action && typeof action === "string") {
    const actionLower = action.toLowerCase().trim();
    // Exit-related actions
    if (
      actionLower.includes("exit") ||
      actionLower.includes("close") ||
      actionLower === "flat"
    ) {
      return "exit";
    }
    // Entry-related actions (buy/sell are entries)
    if (
      actionLower === "buy" ||
      actionLower === "sell" ||
      actionLower === "long" ||
      actionLower === "short" ||
      actionLower.includes("entry")
    ) {
      return "entry";
    }
  }

  // Default to entry if we can't determine
  return "entry";
}

/**
 * Determine market position from payload
 */
function determineMarketPosition(
  payload: Record<string, unknown>
): "long" | "short" | "flat" {
  // Check explicit position field first
  if (payload.position && typeof payload.position === "string") {
    const pos = payload.position.toLowerCase().trim();
    if (pos === "long") return "long";
    if (pos === "short") return "short";
    if (pos === "flat" || pos === "none" || pos === "") return "flat";
  }

  // Infer from direction
  if (payload.direction && typeof payload.direction === "string") {
    const dir = payload.direction.toLowerCase().trim();
    if (dir === "long") return "long";
    if (dir === "short") return "short";
  }

  // Infer from action
  const action = (payload.data || payload.action) as string;
  if (action && typeof action === "string") {
    const actionLower = action.toLowerCase().trim();
    if (
      actionLower === "buy" ||
      actionLower === "long" ||
      actionLower.includes("entry_long")
    ) {
      return "long";
    }
    if (
      actionLower === "sell" ||
      actionLower === "short" ||
      actionLower.includes("entry_short")
    ) {
      return "short";
    }
    if (
      actionLower.includes("exit") ||
      actionLower === "flat" ||
      actionLower === "close"
    ) {
      return "flat";
    }
  }

  return "flat";
}

/**
 * Validate and normalize the incoming webhook payload
 */
export function validatePayload(payload: unknown): NormalizedPayload {
  if (!payload || typeof payload !== "object") {
    throw new WebhookValidationError("Invalid payload: expected JSON object");
  }

  const p = payload as Record<string, unknown>;

  // Get strategy symbol (try multiple field names)
  const rawSymbol = p.symbol || p.strategy;
  if (!rawSymbol || typeof rawSymbol !== "string") {
    throw new WebhookValidationError(
      'Missing or invalid "symbol" or "strategy" field'
    );
  }
  const strategySymbol = mapSymbolToStrategy(rawSymbol);

  // Get action/data (try multiple field names)
  const rawAction = p.data || p.action;
  if (!rawAction || typeof rawAction !== "string") {
    throw new WebhookValidationError(
      'Missing or invalid "data" or "action" field'
    );
  }

  // Determine signal type and market position
  const signalType = determineSignalType(p);
  const marketPosition = determineMarketPosition(p);

  // Normalize action
  const actionLower = rawAction.toString().toLowerCase().trim();
  let action: "entry" | "exit" | "buy" | "sell";
  let direction: "Long" | "Short";

  // Action aliases for common variations
  const LONG_ACTIONS = [
    "buy",
    "long",
    "entry_long",
    "entry",
    "enter",
    "open",
    "open_long",
  ];
  const SHORT_ACTIONS = ["sell", "short", "entry_short", "open_short"];
  const EXIT_ACTIONS = [
    "exit",
    "close",
    "exit_long",
    "exit_short",
    "flat",
    "close_long",
    "close_short",
    "cover",
  ];

  if (LONG_ACTIONS.includes(actionLower)) {
    action = "buy";
    direction = "Long";
  } else if (SHORT_ACTIONS.includes(actionLower)) {
    action = "sell";
    direction = "Short";
  } else if (EXIT_ACTIONS.includes(actionLower)) {
    action = "exit";
    // For exits, try to get direction from explicit field or infer from action
    if (actionLower === "exit_long") {
      direction = "Long";
    } else if (actionLower === "exit_short") {
      direction = "Short";
    } else {
      // Try to get from direction field
      const dirField = p.direction || p.comment;
      if (dirField && typeof dirField === "string") {
        direction = dirField.toLowerCase().includes("long") ? "Long" : "Short";
      } else {
        direction = "Long"; // Default
      }
    }
  } else {
    throw new WebhookValidationError(
      `Unknown action: "${rawAction}". ` +
        `Use "buy" or "long" for long entries, "sell" or "short" for short entries, ` +
        `or "exit"/"close"/"flat" to close positions. ` +
        `Also accepted: entry, enter, open, cover.`
    );
  }

  // Override direction if explicitly provided
  // Handle TradingView's market_position values: "long", "short", "flat"
  if (p.direction && typeof p.direction === "string") {
    const dirLower = p.direction.toLowerCase().trim();
    if (dirLower === "long" || dirLower === "Long") direction = "Long";
    else if (dirLower === "short" || dirLower === "Short") direction = "Short";
    // "flat" means no position - for exit signals this is expected
  }

  // Get price
  let price: number;
  if (p.price !== undefined) {
    price = typeof p.price === "string" ? parseFloat(p.price) : Number(p.price);
    if (isNaN(price)) {
      throw new WebhookValidationError(
        'Invalid "price" field: must be a number'
      );
    }
  } else {
    throw new WebhookValidationError('Missing "price" field');
  }

  // Get quantity (default to 1) and apply multiplier if provided
  let quantity = 1;
  if (p.quantity !== undefined) {
    quantity =
      typeof p.quantity === "string"
        ? parseInt(p.quantity, 10)
        : Number(p.quantity);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1; // Default to 1 if invalid
    }
  }

  // Apply quantity multiplier if provided (e.g., user wants 2x the signal quantity)
  if (
    p.quantityMultiplier &&
    typeof p.quantityMultiplier === "number" &&
    p.quantityMultiplier > 0
  ) {
    quantity = Math.round(quantity * p.quantityMultiplier);
  }

  // Get timestamp
  let timestamp: Date;
  if (p.date && typeof p.date === "string") {
    timestamp = parseTimestamp(p.date);
  } else if (p.timestamp && typeof p.timestamp === "string") {
    timestamp = parseTimestamp(p.timestamp);
  } else {
    timestamp = new Date(); // Use current time if not provided
  }

  // Get entry data for exit trades
  let entryPrice: number | undefined;
  let entryTime: Date | undefined;

  if (p.entryPrice !== undefined) {
    // Ignore unresolved TradingView template variables like "{{strategy.position_avg_price}}"
    const entryPriceStr = String(p.entryPrice);
    if (!entryPriceStr.includes("{{")) {
      entryPrice =
        typeof p.entryPrice === "string"
          ? parseFloat(p.entryPrice)
          : Number(p.entryPrice);
      // Set to undefined if NaN
      if (isNaN(entryPrice)) {
        entryPrice = undefined;
      }
    }
  }

  if (p.entryTime && typeof p.entryTime === "string") {
    entryTime = parseTimestamp(p.entryTime);
  }

  // Get P&L if provided
  let pnl: number | undefined;
  if (p.pnl !== undefined) {
    // Ignore unresolved TradingView template variables like "{{strategy.order.profit}}"
    const pnlStr = String(p.pnl);
    if (!pnlStr.includes("{{")) {
      pnl = typeof p.pnl === "string" ? parseFloat(p.pnl) : Number(p.pnl);
      // Set to undefined if NaN so we calculate it ourselves
      if (isNaN(pnl)) {
        pnl = undefined;
      }
    }
  }

  // Check if this is a test webhook (won't create trades in database)
  // SAFEGUARD: ESTrend is used by the test suite and must ALWAYS be marked as test
  // Only NQ strategies are production-approved for customer-facing feeds
  const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];
  const isNonProductionStrategy = !PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
    strategySymbol.toUpperCase().startsWith(prefix)
  );
  const isTest =
    p.isTest === true ||
    p.isTest === "true" ||
    (typeof p.comment === "string" &&
      p.comment.toLowerCase().includes("test")) ||
    (typeof p.symbol === "string" && p.symbol.toLowerCase().includes("test")) ||
    isNonProductionStrategy; // Auto-mark non-NQ strategies as test data

  return {
    strategySymbol,
    action,
    direction,
    price,
    quantity,
    timestamp,
    entryPrice,
    entryTime,
    pnl,
    token: typeof p.token === "string" ? p.token : undefined,
    signalType,
    marketPosition,
    isTest,
  };
}

/**
 * Parse timestamp from various formats
 */
export function parseTimestamp(timestamp: string): Date {
  // Try ISO format first
  let date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try TradingView format: "2024-01-15 14:30:00"
  date = new Date(timestamp.replace(" ", "T") + "Z");
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try TradingView timenow format: "2024.01.15 14:30:00"
  const dotFormat = timestamp.replace(/\./g, "-").replace(" ", "T") + "Z";
  date = new Date(dotFormat);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try Unix timestamp (seconds)
  const unixSeconds = parseInt(timestamp, 10);
  if (!isNaN(unixSeconds) && unixSeconds > 1000000000) {
    return new Date(unixSeconds * 1000);
  }

  // Try Unix timestamp (milliseconds)
  if (!isNaN(unixSeconds) && unixSeconds > 1000000000000) {
    return new Date(unixSeconds);
  }

  throw new WebhookValidationError(`Invalid timestamp format: ${timestamp}`);
}

/**
 * Format duration between two dates in human-readable format
 */
function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const hours = diffHours % 24;
    return `${diffDays}d ${hours}h`;
  } else if (diffHours > 0) {
    const mins = diffMins % 60;
    return `${diffHours}h ${mins}m`;
  } else {
    return `${diffMins}m`;
  }
}

/**
 * Contract point values for futures instruments
 * These are the dollar values per point movement for MINI contracts
 */
export const CONTRACT_POINT_VALUES: Record<string, number> = {
  ES: 50, // E-mini S&P 500: $50 per point
  NQ: 20, // E-mini Nasdaq 100: $20 per point
  CL: 1000, // Crude Oil: $1000 per point (actually per barrel)
  BTC: 5, // Bitcoin futures: $5 per point (CME Micro BTC is $5/point)
  GC: 100, // Gold: $100 per point
  YM: 5, // E-mini Dow: $5 per point
  RTY: 50, // E-mini Russell 2000: $50 per point
  MES: 5, // Micro E-mini S&P 500: $5 per point
  MNQ: 2, // Micro E-mini Nasdaq: $2 per point
  MCL: 100, // Micro Crude Oil: $100 per point
  MGC: 10, // Micro Gold: $10 per point
  MYM: 0.5, // Micro E-mini Dow: $0.50 per point
};

/**
 * Get the contract point value for a market
 * @param market Market symbol (e.g., "ES", "NQ", "CL")
 * @returns Point value in dollars, defaults to 1 if unknown
 */
export function getContractPointValue(
  market: string | null | undefined
): number {
  if (!market) return 1;
  // Try exact match first
  if (CONTRACT_POINT_VALUES[market]) {
    return CONTRACT_POINT_VALUES[market];
  }
  // Try to find market in strategy symbol (e.g., "ESTrend" -> "ES")
  for (const [key, value] of Object.entries(CONTRACT_POINT_VALUES)) {
    if (market.toUpperCase().startsWith(key)) {
      return value;
    }
  }
  return 1; // Default to 1:1 if unknown
}

/**
 * Calculate P&L based on entry/exit prices, direction, and contract specifications
 * @param direction "Long" or "Short"
 * @param entryPrice Entry price in dollars
 * @param exitPrice Exit price in dollars
 * @param quantity Number of contracts
 * @param market Market symbol for point value lookup (optional)
 * @returns P&L in dollars
 */
export function calculatePnL(
  direction: string,
  entryPrice: number,
  exitPrice: number,
  quantity: number = 1,
  market?: string | null
): number {
  const pointValue = getContractPointValue(market);
  const priceDiff =
    direction === "Long" ? exitPrice - entryPrice : entryPrice - exitPrice;

  return priceDiff * quantity * pointValue;
}

/**
 * Process a TradingView webhook notification
 * Enhanced with persistent position tracking
 */
export async function processWebhook(
  rawPayload: unknown,
  ipAddress?: string
): Promise<WebhookResult> {
  const startTime = Date.now();
  let logId: number | null = null;

  try {
    // Check if webhook processing is paused
    const settings = await getWebhookSettings();
    if (settings?.paused) {
      return {
        success: false,
        logId: 0,
        message: "Webhook processing is paused",
        error: "PAUSED",
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Step 1: Create initial log entry
    // Check if this is a test webhook - check payload flag, IP address patterns, and test environment
    const payloadIsTest =
      typeof rawPayload === "object" &&
      rawPayload !== null &&
      ((rawPayload as any).isTest === true ||
        (rawPayload as any).isTest === "true");
    const ipIsTest = !!(
      ipAddress &&
      (ipAddress === "test-simulator" ||
        ipAddress === "::1" ||
        ipAddress === "127.0.0.1" ||
        ipAddress === "localhost" ||
        ipAddress.startsWith("192.168.") ||
        ipAddress.startsWith("10."))
    );
    const isTestWebhook =
      payloadIsTest || (ipIsTest && process.env.NODE_ENV === "test");

    const logEntry: InsertWebhookLog = {
      payload: JSON.stringify(rawPayload),
      status: "pending",
      ipAddress: ipAddress || null,
      isTest: isTestWebhook ? 1 : 0,
    };

    const logResult = await insertWebhookLog(logEntry);
    // Get the inserted ID - MySQL returns insertId in the result
    logId = (logResult as any)[0]?.insertId || (logResult as any).insertId;

    if (!logId) {
      throw new Error("Failed to create webhook log entry");
    }

    // Step 2: Validate payload
    const payload = validatePayload(rawPayload);

    // OPTIMIZATION: Combine updates into single DB call
    await updateWebhookLog(logId, {
      status: "processing",
      strategySymbol: payload.strategySymbol,
    });

    // Step 3: Validate token if configured (skip for internal admin-authenticated calls)
    const expectedToken = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
    const isInternalSimulation =
      (rawPayload as Record<string, unknown>)?._internalSimulation === true;

    // Skip token validation for internal simulation calls (already admin-authenticated via tRPC)
    if (
      !isInternalSimulation &&
      expectedToken &&
      payload.token !== expectedToken
    ) {
      throw new WebhookValidationError(
        "Invalid or missing authentication token"
      );
    }

    // Step 4: Find strategy in database
    const strategy = await getStrategyBySymbol(payload.strategySymbol);
    if (!strategy) {
      throw new WebhookValidationError(
        `Unknown strategy: ${payload.strategySymbol}`
      );
    }

    // OPTIMIZATION: Update will happen in final success/failure update

    // Step 5: Determine if this is an entry or exit signal
    const isEntrySignal =
      payload.signalType === "entry" ||
      ((payload.action === "buy" || payload.action === "sell") &&
        payload.marketPosition !== "flat");

    const isExitSignal =
      payload.signalType === "exit" ||
      payload.action === "exit" ||
      payload.marketPosition === "flat";

    // Step 6: Handle based on signal type
    if (isEntrySignal && !isExitSignal) {
      // ENTRY SIGNAL: Create a new open position
      return await handleEntrySignal(logId, payload, strategy, startTime);
    } else if (isExitSignal) {
      // EXIT SIGNAL: Close the open position and create trade
      return await handleExitSignal(logId, payload, strategy, startTime);
    } else {
      // Ambiguous signal - try to determine from existing positions
      // For real signals, only check real positions
      const existingPosition = await getOpenPositionByStrategy(
        payload.strategySymbol,
        { excludeTest: !payload.isTest }
      );

      if (existingPosition) {
        // We have an open position, treat this as an exit
        return await handleExitSignal(logId, payload, strategy, startTime);
      } else {
        // No open position, treat this as an entry
        return await handleEntrySignal(logId, payload, strategy, startTime);
      }
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const processingTimeMs = Date.now() - startTime;

    // Update log with error
    if (logId) {
      await updateWebhookLog(logId, {
        status: "failed",
        errorMessage,
        processingTimeMs,
      });
    }

    // Try to determine signalType even on error for consistent response structure
    let signalType: "entry" | "exit" | undefined;
    try {
      const payload = rawPayload as Record<string, unknown>;
      const action =
        typeof payload.data === "string" ? payload.data.toLowerCase() : "";
      if (["exit", "close", "flat", "cover"].some(a => action.includes(a))) {
        signalType = "exit";
      } else if (
        ["buy", "sell", "long", "short", "entry", "enter", "open"].some(a =>
          action.includes(a)
        )
      ) {
        signalType = "entry";
      }
    } catch {
      // Ignore errors in signal type detection
    }

    return {
      success: false,
      logId: logId || 0,
      message: "Webhook processing failed",
      error: errorMessage,
      processingTimeMs,
      signalType,
    };
  }
}

/**
 * Handle an entry signal - create a new open position
 */
async function handleEntrySignal(
  logId: number,
  payload: NormalizedPayload,
  strategy: { id: number; symbol: string },
  startTime: number
): Promise<WebhookResult> {
  const processingTimeMs = Date.now() - startTime;

  // Check if there's already an open position for this strategy
  // For real signals, we only check for real open positions (exclude test positions)
  // For test signals, we check all positions including test ones
  const existingPosition = await getOpenPositionByStrategy(
    payload.strategySymbol,
    { excludeTest: !payload.isTest }
  );

  if (existingPosition) {
    // Check if this is an opposite direction signal (which means close the existing position)
    // e.g., if we have a Short position and receive a "buy" signal, it's closing the short
    const isOppositeDirection =
      (existingPosition.direction === "Short" &&
        payload.direction === "Long") ||
      (existingPosition.direction === "Long" && payload.direction === "Short");

    if (isOppositeDirection) {
      // This is actually an exit signal - the opposite direction closes the existing position
      // Create a modified payload that treats this as an exit
      const exitPayload: NormalizedPayload = {
        ...payload,
        direction: existingPosition.direction as "Long" | "Short", // Use the original position's direction
        signalType: "exit",
        action: "exit",
      };

      // Route to exit handler instead
      return await handleExitSignal(logId, exitPayload, strategy, startTime);
    }

    // Same direction - this is a true duplicate (trying to enter same direction twice)
    await updateWebhookLog(logId, {
      status: "duplicate",
      direction: payload.direction,
      entryPrice: Math.round(payload.price * 100),
      entryTime: payload.timestamp.toISOString(),
      processingTimeMs,
      errorMessage: `Position already open for ${payload.strategySymbol} (ID: ${existingPosition.id})`,
    });

    return {
      success: false,
      logId,
      positionId: existingPosition.id,
      message: `Position already open for ${payload.strategySymbol}. Send an exit signal first to close the existing position, or if you want to add to your position, use signalType: "scale_in" in your webhook payload.`,
      error: "POSITION_EXISTS",
      processingTimeMs,
      signalType: "entry",
    };
  }

  // Create new open position
  const newPosition: InsertOpenPosition = {
    strategyId: strategy.id,
    strategySymbol: payload.strategySymbol,
    direction: payload.direction,
    entryPrice: Math.round(payload.price * 100),
    quantity: payload.quantity,
    entryTime: payload.timestamp.toISOString(),
    entryWebhookLogId: logId,
    status: "open",
    isTest: payload.isTest ? 1 : 0,
  };

  const positionId = await createOpenPosition(newPosition);

  // Update webhook log with success
  // OPTIMIZATION: Include strategyId in final update
  await updateWebhookLog(logId, {
    status: "success",
    strategyId: strategy.id,
    direction: payload.direction,
    entryPrice: Math.round(payload.price * 100),
    entryTime: payload.timestamp.toISOString(),
    processingTimeMs,
  });

  // Send async notification for entry signal (non-blocking) - skip for test webhooks
  // OPTIMIZATION: Move all notifications to background (no await) to reduce latency
  // SAFEGUARD: Also skip notifications for non-production strategies (e.g., ESTrend)
  const PRODUCTION_PREFIXES = ["NQ"];
  const isProductionStrategy = PRODUCTION_PREFIXES.some(prefix =>
    payload.strategySymbol.toUpperCase().startsWith(prefix)
  );

  // SAFETY-NET: central comms-guard. Blocks email+SSE if:
  //   (a) OUTBOUND_COMMS_ENABLED env is false,
  //   (b) strategy symbol starts with TEST-/STAGING-/DEV-/SANDBOX-,
  //   (c) payload.isTest is true, OR
  //   (d) same signal fingerprint fired in the last 60s (prevents
  //       the "test env fires then retry fires again" double-alert
  //       incident pattern).
  const commsDecision = decideSubscriberNotify({
    strategySymbol: payload.strategySymbol,
    direction: payload.direction,
    signalType: "entry",
    price: payload.price,
    timestamp: payload.timestamp,
    isTest: payload.isTest,
  });
  if (!commsDecision.allowed) {
    console.log(
      `[Webhook] Entry notifications suppressed for ${payload.strategySymbol} — ${commsDecision.reason}`
    );
  }

  if (commsDecision.allowed && isProductionStrategy) {
    // Fire and forget - don't await
    Promise.resolve().then(async () => {
      try {
        const subscribedUsers =
          await subscriptionService.getStrategySubscribers(strategy.id);

        let positionSizingInfo = "";
        if (subscribedUsers.length > 0) {
          const exampleSizes = [50000, 100000, 200000];
          const sizingExamples = exampleSizes
            .map(accountValue => {
              const sizing = calculateUserPositionSize(
                {
                  accountValue,
                  useLeveraged: true,
                  quantityMultiplier: "1",
                  maxPositionSize: null,
                },
                "micro",
                "NQ"
              );
              return `$${(accountValue / 1000).toFixed(0)}K → ${sizing.recommendedMicroContracts} micro`;
            })
            .join(" | ");
          positionSizingInfo = `\n\n**Position Sizing (Leveraged):**\n${sizingExamples}`;
        }

        notifyOwnerAsync({
          title: `📈 ${payload.direction} Entry: ${payload.strategySymbol}`,
          content:
            `New ${payload.direction.toLowerCase()} position opened\n\n` +
            `**Strategy:** ${payload.strategySymbol}\n` +
            `**Direction:** ${payload.direction}\n` +
            `**Entry Price:** $${payload.price.toFixed(2)}\n` +
            `**Base Quantity:** ${payload.quantity} contract${payload.quantity !== 1 ? "s" : ""}\n` +
            `**Time:** ${payload.timestamp.toLocaleString()}` +
            positionSizingInfo,
        });
      } catch (err) {
        console.error("[Webhook] Background notification error:", err);
      }
    });

    // Fire and forget - SSE broadcast
    Promise.resolve().then(() => {
      try {
        const basePositionSize = calculatePositionSize(
          {
            accountValue: BACKTEST_STARTING_CAPITAL,
            useLeveraged: false,
            contractType: "mini",
            baseQuantity: payload.quantity,
          },
          "NQ"
        );

        broadcastTradeNotification({
          type: "entry",
          strategySymbol: payload.strategySymbol,
          direction: payload.direction,
          price: payload.price,
          positionId: positionId || undefined,
          timestamp: payload.timestamp,
          message: `New ${payload.direction} entry: ${payload.strategySymbol} @ $${payload.price.toFixed(2)}`,
          positionSizing: {
            baseQuantity: payload.quantity,
            userQuantity: basePositionSize.recommendedMiniContracts,
            contractType: "mini",
            accountValue: BACKTEST_STARTING_CAPITAL,
            scalingFactor: 1.0,
            isLeveraged: false,
          },
        });
      } catch (err) {
        console.error("[Webhook] Background SSE broadcast error:", err);
      }
    });
  }

  return {
    success: true,
    logId,
    positionId: positionId || undefined,
    message: `Entry signal logged: ${payload.strategySymbol} ${payload.direction} @ $${payload.price.toFixed(2)}`,
    processingTimeMs,
    signalType: "entry",
  };
}

/**
 * Handle an exit signal - close open position and create trade
 */
async function handleExitSignal(
  logId: number,
  payload: NormalizedPayload,
  strategy: { id: number; symbol: string },
  startTime: number
): Promise<WebhookResult> {
  // Trial check removed - no free trial system exists

  // Find the open position for this strategy
  // For real signals, we only look for real open positions (exclude test positions)
  // For test signals, we look for test positions
  const openPosition = await getOpenPositionByStrategy(payload.strategySymbol, {
    excludeTest: !payload.isTest,
  });

  if (!openPosition) {
    // No open position found - can't process exit
    const processingTimeMs = Date.now() - startTime;

    await updateWebhookLog(logId, {
      status: "failed",
      direction: payload.direction,
      exitPrice: Math.round(payload.price * 100),
      exitTime: payload.timestamp.toISOString(),
      processingTimeMs,
      errorMessage: "Exit signal received but no matching open position found",
    });

    return {
      success: false,
      logId,
      message:
        "No open position found for this strategy. Send an entry signal (buy/long or sell/short) first before sending an exit signal.",
      error: "NO_OPEN_POSITION",
      processingTimeMs: Date.now() - startTime,
      signalType: "exit",
    };
  }

  // Get entry data from open position
  const entryPrice = openPosition.entryPrice / 100; // Convert from cents
  const entryTime = openPosition.entryTime;
  const direction = openPosition.direction;
  const quantity = openPosition.quantity;

  // Check for duplicate trades
  const isDuplicate = await checkDuplicateTrade({
    strategyId: strategy.id,
    entryDate: entryTime,
    exitDate: payload.timestamp.toISOString(),
    direction,
  });

  if (isDuplicate) {
    const processingTimeMs = Date.now() - startTime;

    await updateWebhookLog(logId, {
      status: "duplicate",
      direction,
      entryPrice: openPosition.entryPrice,
      exitPrice: Math.round(payload.price * 100),
      entryTime,
      exitTime: payload.timestamp.toISOString(),
      processingTimeMs,
      errorMessage: "Duplicate trade detected",
    });

    return {
      success: false,
      logId,
      positionId: openPosition.id,
      message:
        "This trade appears to be a duplicate (same entry/exit times and direction). If this is intentional, add a unique timestamp or comment field to differentiate signals.",
      error: "DUPLICATE",
      processingTimeMs,
      signalType: "exit",
    };
  }

  // Calculate P&L with proper contract multiplier
  // Use the strategy symbol to look up the market's point value
  const pnlDollars =
    payload.pnl !== undefined
      ? payload.pnl
      : calculatePnL(
          direction,
          entryPrice,
          payload.price,
          quantity,
          payload.strategySymbol
        );

  // Convert to cents for database storage
  const pnlCents = Math.round(pnlDollars * 100);
  const entryPriceCents = openPosition.entryPrice;
  const exitPriceCents = Math.round(payload.price * 100);

  // Calculate P&L percentage (based on entry price)
  const pnlPercent = Math.round((pnlDollars / entryPrice) * 10000);

  // Skip trade insertion for test webhooks
  if (payload.isTest) {
    const processingTimeMs = Date.now() - startTime;

    await updateWebhookLog(logId, {
      status: "success",
      direction,
      entryPrice: entryPriceCents,
      exitPrice: exitPriceCents,
      pnl: pnlCents,
      entryTime,
      exitTime: payload.timestamp.toISOString(),
      processingTimeMs,
      errorMessage: "Test webhook - trade not saved to database",
    });

    // Close the open position without creating a trade
    await closeOpenPosition(openPosition.id, {
      exitPrice: exitPriceCents,
      exitTime: payload.timestamp.toISOString(),
      exitWebhookLogId: logId,
      pnl: pnlCents,
    });

    return {
      success: true,
      logId,
      positionId: openPosition.id,
      message: `Test exit signal processed (trade not saved): ${payload.strategySymbol} ${direction} closed at $${payload.price.toFixed(2)} (P&L: $${pnlDollars.toFixed(2)})`,
      processingTimeMs,
      signalType: "exit",
    };
  }

  // Insert trade record
  await insertTrade({
    strategyId: strategy.id,
    entryDate: entryTime,
    exitDate: payload.timestamp.toISOString(),
    direction,
    entryPrice: entryPriceCents,
    exitPrice: exitPriceCents,
    quantity,
    pnl: pnlCents,
    pnlPercent,
    commission: 0,
    isTest: payload.isTest,
    source: "webhook",
  });

  // Invalidate portfolio caches after new trade
  cache.invalidatePortfolio();

  // Trial alert consumption removed - no free trial system exists

  // Get the trade ID
  const tradeId = await getLastInsertedTradeId(strategy.id);

  // Close the open position
  await closeOpenPosition(openPosition.id, {
    exitPrice: exitPriceCents,
    exitTime: payload.timestamp.toISOString(),
    exitWebhookLogId: logId,
    pnl: pnlCents,
    tradeId: tradeId || undefined,
  });

  // Update webhook log with success
  const processingTimeMs = Date.now() - startTime;

  // OPTIMIZATION: Include strategyId in final update
  await updateWebhookLog(logId, {
    status: "success",
    strategyId: strategy.id,
    tradeId: tradeId || undefined,
    direction,
    entryPrice: entryPriceCents,
    exitPrice: exitPriceCents,
    pnl: pnlCents,
    entryTime,
    exitTime: payload.timestamp.toISOString(),
    processingTimeMs,
  });

  // Send async notification for exit signal with P&L (non-blocking) - skip for test webhooks
  // OPTIMIZATION: Move all notifications to background (no await) to reduce latency
  // SAFEGUARD: Also skip notifications for non-production strategies (e.g., ESTrend)
  const EXIT_PRODUCTION_PREFIXES = ["NQ"];
  const isExitProductionStrategy = EXIT_PRODUCTION_PREFIXES.some(prefix =>
    payload.strategySymbol.toUpperCase().startsWith(prefix)
  );

  // SAFETY-NET: same central guard as the entry path. Catches
  // kill-switch + test-prefix + dedupe.
  const exitCommsDecision = decideSubscriberNotify({
    strategySymbol: payload.strategySymbol,
    direction,
    signalType: "exit",
    price: payload.price,
    timestamp: payload.timestamp,
    isTest: payload.isTest,
  });
  if (!exitCommsDecision.allowed) {
    console.log(
      `[Webhook] Exit notifications suppressed for ${payload.strategySymbol} — ${exitCommsDecision.reason}`
    );
  }

  if (exitCommsDecision.allowed && isExitProductionStrategy) {
    // Fire and forget - don't await
    Promise.resolve().then(() => {
      try {
        const pnlEmoji = pnlDollars >= 0 ? "✅" : "❌";
        const pnlSign = pnlDollars >= 0 ? "+" : "";

        notifyOwnerAsync({
          title: `${pnlEmoji} Trade Closed: ${payload.strategySymbol} ${pnlSign}$${pnlDollars.toFixed(2)}`,
          content:
            `Position closed with ${pnlDollars >= 0 ? "profit" : "loss"}\n\n` +
            `**Strategy:** ${payload.strategySymbol}\n` +
            `**Direction:** ${direction}\n` +
            `**Entry Price:** $${entryPrice.toFixed(2)}\n` +
            `**Exit Price:** $${payload.price.toFixed(2)}\n` +
            `**P&L:** ${pnlSign}$${pnlDollars.toFixed(2)}\n` +
            `**Quantity:** ${quantity} contract${quantity !== 1 ? "s" : ""}\n` +
            `**Duration:** ${formatDuration(new Date(entryTime), payload.timestamp)}`,
        });
      } catch (err) {
        console.error("[Webhook] Background notification error:", err);
      }
    });

    // Fire and forget - SSE broadcast
    Promise.resolve().then(() => {
      try {
        const basePositionSize = calculatePositionSize(
          {
            accountValue: BACKTEST_STARTING_CAPITAL,
            useLeveraged: false,
            contractType: "mini",
            baseQuantity: quantity,
          },
          "NQ"
        );

        broadcastTradeNotification({
          type: "exit",
          strategySymbol: payload.strategySymbol,
          direction: direction as "Long" | "Short",
          price: payload.price,
          pnl: pnlDollars,
          tradeId: tradeId || undefined,
          positionId: openPosition.id,
          timestamp: payload.timestamp,
          message: `Trade closed: ${payload.strategySymbol} ${direction} ${pnlDollars >= 0 ? "+" : ""}$${pnlDollars.toFixed(2)}`,
          positionSizing: {
            baseQuantity: quantity,
            userQuantity: basePositionSize.recommendedMiniContracts,
            contractType: "mini",
            accountValue: BACKTEST_STARTING_CAPITAL,
            scalingFactor: 1.0,
            isLeveraged: false,
          },
        });
      } catch (err) {
        console.error("[Webhook] Background SSE broadcast error:", err);
      }
    });
  }

  return {
    success: true,
    logId,
    tradeId: tradeId || undefined,
    positionId: openPosition.id,
    message: `Trade closed: ${payload.strategySymbol} ${direction} ${pnlDollars >= 0 ? "+" : ""}$${pnlDollars.toFixed(2)}`,
    processingTimeMs,
    signalType: "exit",
  };
}

/**
 * Generate the webhook URL for TradingView
 */
export function getWebhookUrl(baseUrl: string): string {
  return `${baseUrl}/api/webhook/tradingview`;
}

/**
 * Generate the TradingView alert message template for a strategy (Enhanced)
 *
 * Position Sizing Notes:
 * - The webhook receives the base quantity from TradingView
 * - User-specific position sizing is calculated server-side based on:
 *   - User's accountValue setting
 *   - useLeveraged flag (% equity scaling vs fixed)
 *   - contractType preference (mini vs micro)
 * - The calculated position size is included in alert notifications
 */
export function getAlertMessageTemplate(
  strategySymbol: string,
  token?: string
): string {
  const template: Record<string, unknown> = {
    symbol: strategySymbol,
    date: "{{timenow}}",
    data: "{{strategy.order.action}}",
    position: "{{strategy.market_position}}", // Track position state: "long", "short", "flat"
    quantity: "{{strategy.order.contracts}}", // Base quantity from strategy
    price: "{{close}}",
    // Note: User-specific position sizing is calculated server-side
    // based on accountValue and useLeveraged settings
  };

  if (token) {
    template.token = token;
  }

  return JSON.stringify(template, null, 2);
}

/**
 * Generate entry-specific alert template
 */
export function getEntryAlertTemplate(
  strategySymbol: string,
  token?: string
): string {
  const template: Record<string, unknown> = {
    symbol: strategySymbol,
    signalType: "entry",
    date: "{{timenow}}",
    data: "{{strategy.order.action}}",
    direction: "{{strategy.market_position}}",
    quantity: "{{strategy.order.contracts}}",
    price: "{{strategy.order.price}}",
  };

  if (token) {
    template.token = token;
  }

  return JSON.stringify(template, null, 2);
}

/**
 * Generate exit-specific alert template
 */
export function getExitAlertTemplate(
  strategySymbol: string,
  token?: string
): string {
  const template: Record<string, unknown> = {
    symbol: strategySymbol,
    signalType: "exit",
    date: "{{timenow}}",
    data: "exit",
    position: "flat",
    quantity: "{{strategy.order.contracts}}",
    price: "{{strategy.order.price}}",
  };

  if (token) {
    template.token = token;
  }

  return JSON.stringify(template, null, 2);
}

/**
 * Get all available strategy templates (Enhanced with entry/exit templates)
 */
export function getAllStrategyTemplates(token?: string): Array<{
  symbol: string;
  name: string;
  template: string;
  entryTemplate: string;
  exitTemplate: string;
}> {
  const strategies = [
    { symbol: "ESTrend", name: "ES Trend Following" },
    { symbol: "ESORB", name: "ES Opening Range Breakout" },
    { symbol: "NQTrend", name: "NQ Trend Following" },
    { symbol: "NQORB", name: "NQ Opening Range Breakout" },
    { symbol: "CLTrend", name: "CL Trend Following" },
    { symbol: "BTCTrend", name: "BTC Trend Following" },
    { symbol: "GCTrend", name: "GC Trend Following" },
    { symbol: "YMORB", name: "YM Opening Range Breakout" },
  ];

  return strategies.map(s => ({
    ...s,
    template: getAlertMessageTemplate(s.symbol, token),
    entryTemplate: getEntryAlertTemplate(s.symbol, token),
    exitTemplate: getExitAlertTemplate(s.symbol, token),
  }));
}

/**
 * Admin functions for webhook management
 */
export async function clearWebhookLogs(): Promise<{ deleted: number }> {
  const deleted = await deleteAllWebhookLogs();
  return { deleted };
}

export async function removeWebhookLog(logId: number): Promise<boolean> {
  return await deleteWebhookLog(logId);
}

export async function pauseWebhookProcessing(): Promise<void> {
  await updateWebhookSettings({ paused: true });
}

export async function resumeWebhookProcessing(): Promise<void> {
  await updateWebhookSettings({ paused: false });
}

export async function isWebhookProcessingPaused(): Promise<boolean> {
  const settings = await getWebhookSettings();
  return settings?.paused ?? false;
}

/**
 * Get open positions for dashboard display
 */
export async function getOpenPositionsForDashboard() {
  return await getAllOpenPositions();
}

/**
 * Get recent positions (open + closed) for activity feed
 */
export async function getRecentPositionsForDashboard(limit: number = 50) {
  return await getRecentPositions(limit);
}

/**
 * Get position statistics for dashboard
 */
export async function getPositionStatsForDashboard() {
  return await getPositionStats();
}
