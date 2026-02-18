import { eq, and, gte, lte, inArray, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  InsertUser,
  users,
  strategies,
  trades,
  benchmarks,
  webhookLogs,
  InsertWebhookLog,
  openPositions,
  InsertOpenPosition,
  OpenPosition,
  notificationPreferences,
  strategyNotificationSettings,
  InsertNotificationPreference,
  NotificationPreference,
  StrategyNotificationSetting,
  stagingTrades,
  StagingTrade,
  contactMessages,
  contactResponses,
  ContactMessage,
  InsertContactMessage,
  ContactResponse,
  InsertContactResponse,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Create connection pool with resilience options
      // Scaled to 50 connections to support hundreds of concurrent users
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 50, // Increased from 10 for better concurrency
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000, // 10 seconds
        idleTimeout: 60000, // Close idle connections after 60 seconds
      });
      _db = drizzle(_pool as any);
      console.log("[Database] Connection pool created successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

// Get the connection pool for transaction support
export function getPool(): mysql.Pool | null {
  return _pool;
}

// Reset the database connection (useful for recovery from connection errors)
export async function resetDbConnection() {
  if (_pool) {
    try {
      await _pool.end();
    } catch (e) {
      console.warn("[Database] Error closing pool:", e);
    }
  }
  _db = null;
  _pool = null;
  console.log("[Database] Connection reset, will reconnect on next query");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  // Retry logic for transient database connection errors
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot upsert user: database not available");
      return;
    }

    try {
      const values: InsertUser = {
        openId: user.openId,
        email: user.email || "", // email is required
      };
      const updateSet: Record<string, unknown> = {};

      const textFields = ["name", "email", "loginMethod"] as const;
      type TextField = (typeof textFields)[number];

      const assignNullable = (field: TextField) => {
        const value = user[field];
        if (value === undefined) return;
        const normalized = value ?? null;
        values[field] = normalized as any;
        updateSet[field] = normalized;
      };

      textFields.forEach(assignNullable);

      if (user.lastSignedIn !== undefined) {
        values.lastSignedIn = user.lastSignedIn;
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      if (user.role !== undefined) {
        values.role = user.role;
        updateSet.role = user.role;
      } else if (user.openId === ENV.ownerOpenId) {
        values.role = "admin";
        updateSet.role = "admin";
      }

      if (!values.lastSignedIn) {
        values.lastSignedIn = new Date().toISOString();
      }

      if (Object.keys(updateSet).length === 0) {
        updateSet.lastSignedIn = new Date();
      }

      await db.insert(users).values(values).onDuplicateKeyUpdate({
        set: updateSet,
      });
      return; // Success, exit retry loop
    } catch (error) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRetryable =
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ECONNREFUSED");

      if (isRetryable && attempt < maxRetries) {
        console.warn(
          `[Database] Upsert user failed (attempt ${attempt}/${maxRetries}), resetting connection and retrying in ${attempt * 500}ms...`
        );
        await resetDbConnection(); // Reset connection pool on transient errors
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      } else {
        console.error("[Database] Failed to upsert user:", error);
        throw error;
      }
    }
  }

  // If we get here, all retries failed
  console.error("[Database] All retry attempts failed for upsert user");
  throw lastError;
}

export async function getUserByOpenId(openId: string) {
  // Retry logic for transient database connection errors
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get user: database not available");
      return undefined;
    }

    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.openId, openId))
        .limit(1);
      return result.length > 0 ? result[0] : undefined;
    } catch (error) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRetryable =
        errorMessage.includes("ECONNRESET") ||
        errorMessage.includes("ETIMEDOUT") ||
        errorMessage.includes("ECONNREFUSED");

      if (isRetryable && attempt < maxRetries) {
        console.warn(
          `[Database] Get user failed (attempt ${attempt}/${maxRetries}), resetting connection and retrying in ${attempt * 500}ms...`
        );
        await resetDbConnection(); // Reset connection pool on transient errors
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      } else {
        console.error("[Database] Failed to get user by openId:", error);
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Update user onboarding status
 */
export async function updateUserOnboarding(userId: number, completed: boolean) {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Database] Cannot update user onboarding: database not available"
    );
    return;
  }

  await db
    .update(users)
    .set({ onboardingCompleted: completed ? 1 : 0 })
    .where(eq(users.id, userId));
}

/**
 * Dismiss user onboarding permanently
 */
export async function dismissUserOnboarding(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Database] Cannot dismiss user onboarding: database not available"
    );
    return;
  }

  await db
    .update(users)
    .set({ onboardingDismissed: 1 })
    .where(eq(users.id, userId));
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get user by remember token (for persistent sessions)
 */
export async function getUserByRememberToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.rememberToken, token))
    .limit(1);

  const user = result[0];
  if (!user) return null;

  // Check if token is expired
  if (user.rememberTokenExpiresAt) {
    const expiresAt = new Date(user.rememberTokenExpiresAt);
    if (expiresAt < new Date()) {
      console.log("[Auth] Remember token expired for user:", user.id);
      return null;
    }
  }

  return user;
}

/**
 * Update user starting capital
 */
export async function updateUserStartingCapital(
  userId: number,
  startingCapital: number
) {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Database] Cannot update user starting capital: database not available"
    );
    return;
  }

  await db.update(users).set({ startingCapital }).where(eq(users.id, userId));
}

/**
 * Update user preferences (starting capital and contract size)
 */
export async function updateUserPreferences(
  userId: number,
  preferences: {
    startingCapital?: number;
    contractSize?: "mini" | "micro";
    themePreference?: "light" | "dark";
  }
) {
  const db = await getDb();
  if (!db) {
    console.warn(
      "[Database] Cannot update user preferences: database not available"
    );
    return;
  }

  const updateData: {
    startingCapital?: number;
    contractSize?: "mini" | "micro";
    themePreference?: "light" | "dark";
  } = {};
  if (preferences.startingCapital !== undefined) {
    updateData.startingCapital = preferences.startingCapital;
  }
  if (preferences.contractSize !== undefined) {
    updateData.contractSize = preferences.contractSize;
  }
  if (preferences.themePreference !== undefined) {
    updateData.themePreference = preferences.themePreference;
  }

  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData).where(eq(users.id, userId));
  }
}

/**
 * Get user preferences (starting capital and contract size)
 */
export async function getUserPreferences(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      startingCapital: 100000,
      contractSize: "micro" as const,
      themePreference: "light" as const,
    };
  }

  const result = await db
    .select({
      startingCapital: users.startingCapital,
      contractSize: users.contractSize,
      themePreference: users.themePreference,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (result.length > 0) {
    return {
      startingCapital: result[0].startingCapital,
      contractSize: result[0].contractSize,
      themePreference: result[0].themePreference || "light",
    };
  }

  return {
    startingCapital: 100000,
    contractSize: "micro" as const,
    themePreference: "light" as const,
  };
}

/**
 * Get all strategies
 */
export async function getAllStrategies() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(strategies)
    .where(eq(strategies.active, 1))
    .orderBy(strategies.id);
}

/**
 * Get strategy by ID
 */
export async function getStrategyById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Get all trades for specific strategies with optional date and source filtering
 */
export async function getTrades(params: {
  strategyIds?: number[];
  startDate?: Date;
  endDate?: Date;
  source?: "csv_import" | "webhook" | "manual" | "all";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  if (params.strategyIds && params.strategyIds.length > 0) {
    conditions.push(inArray(trades.strategyId, params.strategyIds));
  }

  if (params.startDate) {
    conditions.push(gte(trades.exitDate, params.startDate.toISOString()));
  }

  if (params.endDate) {
    conditions.push(lte(trades.exitDate, params.endDate.toISOString()));
  }

  // Filter by source if specified (and not 'all')
  if (params.source && params.source !== "all") {
    conditions.push(eq(trades.source, params.source));
  }

  const result =
    conditions.length === 0
      ? await db.select().from(trades)
      : await db
          .select()
          .from(trades)
          .where(and(...conditions));

  // Convert string dates to Date objects
  const converted = result.map(trade => ({
    ...trade,
    entryDate:
      typeof trade.entryDate === "string"
        ? new Date(trade.entryDate)
        : trade.entryDate,
    exitDate:
      typeof trade.exitDate === "string"
        ? new Date(trade.exitDate)
        : trade.exitDate,
  }));
  if (converted.length > 0) {
    console.log(
      "[DB] getTrades converted",
      converted.length,
      "trades. First trade exitDate type:",
      typeof converted[0].exitDate,
      "value:",
      converted[0].exitDate
    );
  }
  return converted;
}

/**
 * Get benchmark data with optional date and symbol filtering
 */
export async function getBenchmarkData(params?: {
  startDate?: Date;
  endDate?: Date;
  symbol?: string; // SPY, QQQ, IWM, GLD - defaults to SPY
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];

  // Default to SPY if no symbol specified (backwards compatible)
  const symbol = params?.symbol || "SPY";
  conditions.push(eq(benchmarks.symbol, symbol));

  if (params?.startDate) {
    conditions.push(gte(benchmarks.date, params.startDate.toISOString()));
  }

  if (params?.endDate) {
    conditions.push(lte(benchmarks.date, params.endDate.toISOString()));
  }

  const results = await db
    .select()
    .from(benchmarks)
    .where(and(...conditions))
    .orderBy(benchmarks.date);

  // Convert dates from strings to Date objects
  return results.map(row => ({
    ...row,
    date: typeof row.date === "string" ? new Date(row.date) : row.date,
  }));
}

/**
 * Get all available benchmark symbols
 */
export async function getAvailableBenchmarks(): Promise<string[]> {
  const db = await getDb();
  if (!db) return ["SPY"];

  const result = await db
    .selectDistinct({ symbol: benchmarks.symbol })
    .from(benchmarks);

  return result.map(r => r.symbol);
}

/**
 * Insert benchmark data (for seeding)
 */
export async function insertBenchmarkData(
  data: {
    symbol: string;
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }[]
) {
  const db = await getDb();
  if (!db) return;

  // Insert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize).map(d => ({
      ...d,
      date: d.date instanceof Date ? d.date.toISOString() : d.date,
    }));
    await db.insert(benchmarks).values(batch);
  }
}

/**
 * Insert a new trade (for webhook ingestion)
 */
export async function insertTrade(trade: {
  strategyId: number;
  entryDate: string;
  exitDate: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  commission: number;
  isTest?: boolean;
  source?: "csv_import" | "webhook" | "manual";
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // CRITICAL: Force isTest=true in test environment to prevent dashboard pollution
  const isTestEnv =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const tradeData = {
    ...trade,
    isTest: isTestEnv ? 1 : trade.isTest ? 1 : 0,
  };

  const result = await db.insert(trades).values(tradeData);
  return result;
}

/**
 * Strategy cache for webhook processing
 * Reduces database lookups for frequently accessed strategies
 */
interface CachedStrategy {
  strategy: { id: number; symbol: string; name: string };
  timestamp: number;
}
const strategyCache = new Map<string, CachedStrategy>();
const STRATEGY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get strategy by symbol (for webhook processing)
 * Uses caching to reduce database lookups
 */
export async function getStrategyBySymbol(symbol: string) {
  // Check cache first
  const cached = strategyCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < STRATEGY_CACHE_TTL) {
    return cached.strategy;
  }

  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(strategies)
    .where(eq(strategies.symbol, symbol))
    .limit(1);
  const strategy = result.length > 0 ? result[0] : null;

  // Cache the result (even null to avoid repeated lookups for invalid symbols)
  if (strategy) {
    strategyCache.set(symbol, { strategy, timestamp: Date.now() });
  }

  return strategy;
}

/**
 * Clear the strategy cache (call after strategy updates)
 */
export function clearStrategyCache() {
  strategyCache.clear();
}

/**
 * Insert a webhook log entry
 */
export async function insertWebhookLog(log: InsertWebhookLog) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // CRITICAL: Force isTest=true in test environment to prevent dashboard pollution
  const isTestEnv =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const logData = {
    ...log,
    isTest: isTestEnv ? 1 : log.isTest ? 1 : 0,
  };
  const result = await db.insert(webhookLogs).values(logData as any);
  return result;
}

/**
 * Update a webhook log entry
 */
export async function updateWebhookLog(
  id: number,
  updates: Partial<InsertWebhookLog>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.update(webhookLogs).set(updates).where(eq(webhookLogs.id, id));
}

/**
 * Get recent webhook logs for display
 */
export async function getWebhookLogs(
  params?:
    | {
        status?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        includeTest?: boolean; // Set to true to include test data
      }
    | number
) {
  const db = await getDb();
  if (!db) return [];

  // Handle legacy call with just limit number
  if (typeof params === "number") {
    return await db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.isTest, 0)) // Exclude test data by default
      .orderBy(desc(webhookLogs.createdAt))
      .limit(params);
  }

  const {
    status,
    startDate,
    endDate,
    limit = 100,
    includeTest = false,
  } = params || {};

  const conditions = [];

  // Exclude test data unless explicitly requested
  if (!includeTest) {
    conditions.push(eq(webhookLogs.isTest, 0));
  }

  if (status) {
    conditions.push(eq(webhookLogs.status, status as any));
  }
  if (startDate) {
    conditions.push(gte(webhookLogs.createdAt, startDate.toISOString()));
  }
  if (endDate) {
    conditions.push(lte(webhookLogs.createdAt, endDate.toISOString()));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(webhookLogs)
      .where(and(...conditions))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit);
  }

  return await db
    .select()
    .from(webhookLogs)
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit);
}

/**
 * Check if a trade already exists (for duplicate detection)
 */
export async function checkDuplicateTrade(params: {
  strategyId: number;
  entryDate: string;
  exitDate: string;
  direction: string;
}) {
  const db = await getDb();
  if (!db) return false;

  // Check for trades with same strategy, entry date, exit date, and direction
  // Allow 1 minute tolerance for timestamp matching
  const entryDateObj = new Date(params.entryDate);
  const exitDateObj = new Date(params.exitDate);
  const entryStart = new Date(entryDateObj.getTime() - 60000).toISOString();
  const entryEnd = new Date(entryDateObj.getTime() + 60000).toISOString();
  const exitStart = new Date(exitDateObj.getTime() - 60000).toISOString();
  const exitEnd = new Date(exitDateObj.getTime() + 60000).toISOString();

  const result = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.strategyId, params.strategyId),
        eq(trades.direction, params.direction),
        gte(trades.entryDate, entryStart),
        lte(trades.entryDate, entryEnd),
        gte(trades.exitDate, exitStart),
        lte(trades.exitDate, exitEnd)
      )
    )
    .limit(1);

  return result.length > 0;
}

/**
 * Get the inserted trade ID (for linking webhook log to trade)
 */
export async function getLastInsertedTradeId(strategyId: number) {
  const db = await getDb();
  if (!db) return null;

  // Get the most recent trade for this strategy
  const result = await db
    .select({ id: trades.id })
    .from(trades)
    .where(eq(trades.strategyId, strategyId))
    .orderBy(desc(trades.id))
    .limit(1);

  return result.length > 0 ? result[0].id : null;
}

/**
 * Delete a specific webhook log entry
 */
export async function deleteWebhookLog(logId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(webhookLogs).where(eq(webhookLogs.id, logId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete webhook log:", error);
    return false;
  }
}

/**
 * Delete all webhook logs (admin function)
 */
export async function deleteAllWebhookLogs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Count before deleting using SQL count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs);
    const count = countResult[0]?.count ?? 0;

    if (count === 0) {
      console.log("[Database] No webhook logs to delete");
      return 0;
    }

    // Delete all logs
    await db.delete(webhookLogs);
    console.log(`[Database] Deleted ${count} webhook logs`);
    return count;
  } catch (error) {
    console.error("[Database] Failed to delete all webhook logs:", error);
    throw error; // Re-throw to let the caller handle it
  }
}

// In-memory webhook settings (can be moved to database if persistence needed)
let webhookSettings = {
  paused: false,
};

/**
 * Get webhook processing settings
 */
export async function getWebhookSettings(): Promise<{ paused: boolean }> {
  return webhookSettings;
}

/**
 * Update webhook processing settings
 */
export async function updateWebhookSettings(
  updates: Partial<{ paused: boolean }>
): Promise<void> {
  webhookSettings = { ...webhookSettings, ...updates };
}

/**
 * Delete a specific trade (admin function for removing test trades)
 */
export async function deleteTrade(tradeId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(trades).where(eq(trades.id, tradeId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete trade:", error);
    return false;
  }
}

/**
 * Delete trades by IDs (admin function for bulk removal)
 */
export async function deleteTradesByIds(tradeIds: number[]): Promise<number> {
  const db = await getDb();
  if (!db || tradeIds.length === 0) return 0;

  try {
    await db.delete(trades).where(inArray(trades.id, tradeIds));
    return tradeIds.length;
  } catch (error) {
    console.error("[Database] Failed to delete trades:", error);
    return 0;
  }
}

/**
 * Delete all trades for a strategy (for overwrite functionality)
 */
export async function deleteTradesByStrategy(
  strategyId: number
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    // Count before deleting
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(eq(trades.strategyId, strategyId));
    const count = countResult[0]?.count ?? 0;

    if (count === 0) {
      return 0;
    }

    await db.delete(trades).where(eq(trades.strategyId, strategyId));
    console.log(
      `[Database] Deleted ${count} trades for strategy ${strategyId}`
    );
    return count;
  } catch (error) {
    console.error("[Database] Failed to delete trades for strategy:", error);
    throw error;
  }
}

/**
 * Bulk insert trades (for CSV upload)
 */
export async function bulkInsertTrades(
  tradesToInsert: Array<{
    strategyId: number;
    entryDate: Date;
    exitDate: Date;
    direction: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    commission: number;
  }>
): Promise<number> {
  const db = await getDb();
  if (!db || tradesToInsert.length === 0) return 0;

  try {
    // Insert in batches of 100 to avoid query size limits
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < tradesToInsert.length; i += batchSize) {
      const batch = tradesToInsert.slice(i, i + batchSize).map(trade => ({
        ...trade,
        entryDate: trade.entryDate.toISOString(),
        exitDate: trade.exitDate.toISOString(),
      }));
      await db.insert(trades).values(batch);
      inserted += batch.length;
    }

    console.log(`[Database] Bulk inserted ${inserted} trades`);
    return inserted;
  } catch (error) {
    console.error("[Database] Failed to bulk insert trades:", error);
    throw error;
  }
}

/**
 * Upload trades with overwrite option
 * If overwrite is true, deletes all existing trades for the strategy first
 */
export async function uploadTradesForStrategy(
  strategyId: number,
  tradesToUpload: Array<{
    entryDate: Date;
    exitDate: Date;
    direction: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    commission: number;
  }>,
  overwrite: boolean = false
): Promise<{ deleted: number; inserted: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let deleted = 0;

  // Delete existing trades if overwrite is enabled
  if (overwrite) {
    deleted = await deleteTradesByStrategy(strategyId);
  }

  // Add strategyId to each trade
  const tradesWithStrategy = tradesToUpload.map(t => ({
    ...t,
    strategyId,
  }));

  // Insert new trades
  const inserted = await bulkInsertTrades(tradesWithStrategy);

  return { deleted, inserted };
}

// ============================================
// Open Positions Management (Persistent Trade Tracking)
// ============================================

/**
 * Create a new open position when an entry signal is received
 */
export async function createOpenPosition(
  position: InsertOpenPosition
): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // CRITICAL: Force isTest=true in test environment to prevent dashboard pollution
  const isTestEnv =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  const positionData = {
    ...position,
    isTest: isTestEnv ? 1 : (position.isTest ?? 0),
  };

  try {
    const result = await db.insert(openPositions).values(positionData);
    // MySQL returns insertId in the result
    const insertId = (result as any)[0]?.insertId || (result as any).insertId;
    return insertId || null;
  } catch (error) {
    console.error("[Database] Failed to create open position:", error);
    throw error;
  }
}

/**
 * Get open position for a strategy (there should only be one open position per strategy at a time)
 * @param strategySymbol - The strategy symbol to look up
 * @param options - Optional settings
 * @param options.excludeTest - If true, excludes test positions from the search (default: false)
 */
export async function getOpenPositionByStrategy(
  strategySymbol: string,
  options?: { excludeTest?: boolean }
): Promise<OpenPosition | null> {
  const db = await getDb();
  if (!db) return null;

  const conditions = [
    eq(openPositions.strategySymbol, strategySymbol),
    eq(openPositions.status, "open"),
  ];

  // If excludeTest is true, only return non-test positions
  if (options?.excludeTest) {
    conditions.push(eq(openPositions.isTest, 0));
  }

  const result = await db
    .select()
    .from(openPositions)
    .where(and(...conditions))
    .orderBy(desc(openPositions.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get open position by ID
 */
export async function getOpenPositionById(
  id: number
): Promise<OpenPosition | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(openPositions)
    .where(eq(openPositions.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all open positions (for dashboard display)
 * @param includeTest - Set to true to include test data (default: false)
 */
export async function getAllOpenPositions(
  includeTest: boolean = false
): Promise<OpenPosition[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(openPositions.status, "open")];
  if (!includeTest) {
    conditions.push(eq(openPositions.isTest, 0));
  }

  return await db
    .select()
    .from(openPositions)
    .where(and(...conditions))
    .orderBy(desc(openPositions.entryTime));
}

/**
 * Get all positions (open and recently closed) for dashboard
 * @param limit - Maximum number of positions to return
 * @param includeTest - Set to true to include test data (default: false)
 */
export async function getRecentPositions(
  limit: number = 50,
  includeTest: boolean = false
): Promise<OpenPosition[]> {
  const db = await getDb();
  if (!db) return [];

  if (!includeTest) {
    return await db
      .select()
      .from(openPositions)
      .where(eq(openPositions.isTest, 0))
      .orderBy(desc(openPositions.updatedAt))
      .limit(limit);
  }

  return await db
    .select()
    .from(openPositions)
    .orderBy(desc(openPositions.updatedAt))
    .limit(limit);
}

/**
 * Close an open position when an exit signal is received
 */
export async function closeOpenPosition(
  positionId: number,
  exitData: {
    exitPrice: number;
    exitTime: string;
    exitWebhookLogId?: number;
    pnl: number;
    tradeId?: number;
  }
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(openPositions)
      .set({
        status: "closed",
        exitPrice: exitData.exitPrice,
        exitTime: exitData.exitTime,
        exitWebhookLogId: exitData.exitWebhookLogId,
        pnl: exitData.pnl,
        tradeId: exitData.tradeId,
      })
      .where(eq(openPositions.id, positionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to close open position:", error);
    return false;
  }
}

/**
 * Delete an open position (admin function)
 */
export async function deleteOpenPosition(positionId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(openPositions).where(eq(openPositions.id, positionId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete open position:", error);
    return false;
  }
}

/**
 * Clear all open positions for a strategy (admin function)
 */
export async function clearOpenPositionsForStrategy(
  strategySymbol: string
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .delete(openPositions)
      .where(eq(openPositions.strategySymbol, strategySymbol));
    return (result as any).affectedRows || 0;
  } catch (error) {
    console.error("[Database] Failed to clear open positions:", error);
    return 0;
  }
}

/**
 * Get position counts by status for dashboard stats
 * Excludes test data by default
 * @param includeTest - Set to true to include test data (default: false)
 */
export async function getPositionStats(includeTest: boolean = false): Promise<{
  open: number;
  closedToday: number;
  totalPnlToday: number;
}> {
  const db = await getDb();
  if (!db) return { open: 0, closedToday: 0, totalPnlToday: 0 };

  try {
    // Get open positions count (excluding test data)
    const openConditions = [eq(openPositions.status, "open")];
    if (!includeTest) {
      openConditions.push(eq(openPositions.isTest, 0));
    }

    const openResult = await db
      .select()
      .from(openPositions)
      .where(and(...openConditions));

    // Get today's closed positions (excluding test data)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closedConditions = [
      eq(openPositions.status, "closed"),
      gte(openPositions.exitTime!, today.toISOString()),
    ];
    if (!includeTest) {
      closedConditions.push(eq(openPositions.isTest, 0));
    }

    const closedResult = await db
      .select()
      .from(openPositions)
      .where(and(...closedConditions));

    // Calculate total P&L for today
    const totalPnlToday = closedResult.reduce(
      (sum, pos) => sum + (pos.pnl || 0),
      0
    );

    return {
      open: openResult.length,
      closedToday: closedResult.length,
      totalPnlToday,
    };
  } catch (error) {
    console.error("[Database] Failed to get position stats:", error);
    return { open: 0, closedToday: 0, totalPnlToday: 0 };
  }
}

// ============================================================================
// Notification Preferences Functions
// ============================================================================

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(
  userId: number
): Promise<NotificationPreference | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  return result[0] || null;
}

/**
 * Create or update notification preferences for a user
 */
export async function upsertNotificationPreferences(
  userId: number,
  prefs: Partial<InsertNotificationPreference>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await getNotificationPreferences(userId);

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({ ...prefs, updatedAt: new Date().toISOString() })
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      globalMute: prefs.globalMute ? 1 : 0,
      muteTradeExecuted: prefs.muteTradeExecuted ? 1 : 0,
      muteTradeError: prefs.muteTradeError ? 1 : 0,
      mutePositionOpened: prefs.mutePositionOpened ? 1 : 0,
      mutePositionClosed: prefs.mutePositionClosed ? 1 : 0,
      muteWebhookFailed: prefs.muteWebhookFailed ? 1 : 0,
      muteDailyDigest: prefs.muteDailyDigest ? 1 : 0,
      emailEnabled:
        prefs.emailEnabled != null ? (prefs.emailEnabled ? 1 : 0) : 1,
      emailAddress: prefs.emailAddress,
      inAppEnabled:
        prefs.inAppEnabled != null ? (prefs.inAppEnabled ? 1 : 0) : 1,
      soundEnabled:
        prefs.soundEnabled != null ? (prefs.soundEnabled ? 1 : 0) : 1,
    });
  }
}

/**
 * Get strategy notification settings for a user
 */
export async function getStrategyNotificationSettings(
  userId: number
): Promise<StrategyNotificationSetting[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(strategyNotificationSettings)
    .where(eq(strategyNotificationSettings.userId, userId));
}

/**
 * Get notification setting for a specific strategy
 */
export async function getStrategyNotificationSetting(
  userId: number,
  strategyId: number
): Promise<StrategyNotificationSetting | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(strategyNotificationSettings)
    .where(
      and(
        eq(strategyNotificationSettings.userId, userId),
        eq(strategyNotificationSettings.strategyId, strategyId)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Update notification setting for a specific strategy
 */
export async function upsertStrategyNotificationSetting(
  userId: number,
  strategyId: number,
  settings: { emailEnabled?: boolean; pushEnabled?: boolean }
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await getStrategyNotificationSetting(userId, strategyId);

  if (existing) {
    await db
      .update(strategyNotificationSettings)
      .set({
        emailEnabled: settings.emailEnabled !== false ? 1 : 0,
        pushEnabled: settings.pushEnabled !== false ? 1 : 0,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(strategyNotificationSettings.userId, userId),
          eq(strategyNotificationSettings.strategyId, strategyId)
        )
      );
  } else {
    await db.insert(strategyNotificationSettings).values({
      userId,
      strategyId,
      emailEnabled: settings.emailEnabled !== false ? 1 : 0,
      pushEnabled: settings.pushEnabled !== false ? 1 : 0,
    });
  }
}

/**
 * Check if notifications are enabled for a user and strategy
 * Returns true if notifications should be sent based on type and mute settings
 */
export async function shouldSendNotification(
  userId: number,
  strategyId: number,
  type:
    | "trade_executed"
    | "trade_error"
    | "position_opened"
    | "position_closed"
    | "webhook_failed"
    | "daily_digest"
): Promise<{ email: boolean; inApp: boolean }> {
  const prefs = await getNotificationPreferences(userId);
  const strategySettings = await getStrategyNotificationSetting(
    userId,
    strategyId
  );

  // Default to enabled if no preferences set
  if (!prefs) {
    return { email: true, inApp: true };
  }

  // Check global mute
  if (prefs.globalMute) {
    return { email: false, inApp: false };
  }

  // Check type-specific mute settings
  let typeMuted = false;
  switch (type) {
    case "trade_executed":
      typeMuted = !!prefs.muteTradeExecuted;
      break;
    case "trade_error":
      typeMuted = !!prefs.muteTradeError;
      break;
    case "position_opened":
      typeMuted = !!prefs.mutePositionOpened;
      break;
    case "position_closed":
      typeMuted = !!prefs.mutePositionClosed;
      break;
    case "webhook_failed":
      typeMuted = !!prefs.muteWebhookFailed;
      break;
    case "daily_digest":
      typeMuted = !!prefs.muteDailyDigest;
      break;
  }

  if (typeMuted) {
    return { email: false, inApp: false };
  }

  // Check strategy-specific settings (default to enabled if not set)
  const strategyEmailEnabled = !!(strategySettings?.emailEnabled ?? true);
  const strategyPushEnabled = !!(strategySettings?.pushEnabled ?? true);

  return {
    email: !!prefs.emailEnabled && strategyEmailEnabled,
    inApp: !!prefs.inAppEnabled && strategyPushEnabled,
  };
}

/**
 * Get all strategies with their notification settings for a user
 */
export async function getStrategiesWithNotificationSettings(
  userId: number
): Promise<
  Array<{
    id: number;
    symbol: string;
    name: string;
    emailEnabled: boolean;
    pushEnabled: boolean;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const allStrategies = await db
    .select()
    .from(strategies)
    .where(eq(strategies.active, 1));
  const userSettings = await getStrategyNotificationSettings(userId);

  // Create a map of strategy settings
  const settingsMap = new Map(userSettings.map(s => [s.strategyId, s]));

  return allStrategies.map(strategy => ({
    id: strategy.id,
    symbol: strategy.symbol,
    name: strategy.name,
    emailEnabled: !!(settingsMap.get(strategy.id)?.emailEnabled ?? true),
    pushEnabled: !!(settingsMap.get(strategy.id)?.pushEnabled ?? true),
  }));
}

// ============================================================================
// Staging Trades Functions (Webhook Review Workflow)
// ============================================================================

/**
 * Create a new staging trade from a webhook
 */
export async function createStagingTrade(trade: {
  webhookLogId: number;
  strategyId: number;
  strategySymbol: string;
  entryDate: Date;
  exitDate?: Date;
  direction: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  pnl?: number;
  pnlPercent?: number;
  commission?: number;
  isOpen?: boolean;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(stagingTrades).values({
      webhookLogId: trade.webhookLogId,
      strategyId: trade.strategyId,
      strategySymbol: trade.strategySymbol,
      entryDate: trade.entryDate,
      exitDate: trade.exitDate || null,
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice || null,
      quantity: trade.quantity,
      pnl: trade.pnl || null,
      pnlPercent: trade.pnlPercent || null,
      commission: trade.commission || 0,
      isOpen: (trade.isOpen ?? !trade.exitDate) ? 1 : 0,
      status: "pending" as const,
    } as any);

    // Get the inserted ID
    const insertedId = (result as any)[0]?.insertId;
    return insertedId || null;
  } catch (error) {
    console.error("[Database] Failed to create staging trade:", error);
    return null;
  }
}

/**
 * Get all staging trades with optional filters
 */
export async function getStagingTrades(params?: {
  status?: "pending" | "approved" | "rejected" | "edited";
  strategyId?: number;
  isOpen?: boolean;
  limit?: number;
}): Promise<StagingTrade[]> {
  const db = await getDb();
  if (!db) return [];

  const { status, strategyId, isOpen, limit = 100 } = params || {};

  const conditions = [];
  if (status) {
    conditions.push(eq(stagingTrades.status, status));
  }
  if (strategyId !== undefined) {
    conditions.push(eq(stagingTrades.strategyId, strategyId));
  }
  if (isOpen !== undefined) {
    conditions.push(eq(stagingTrades.isOpen, isOpen ? 1 : 0));
  }

  if (conditions.length > 0) {
    return await db
      .select()
      .from(stagingTrades)
      .where(and(...conditions))
      .orderBy(desc(stagingTrades.createdAt))
      .limit(limit);
  }

  return await db
    .select()
    .from(stagingTrades)
    .orderBy(desc(stagingTrades.createdAt))
    .limit(limit);
}

/**
 * Get a single staging trade by ID
 */
export async function getStagingTradeById(
  id: number
): Promise<StagingTrade | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(stagingTrades)
    .where(eq(stagingTrades.id, id))
    .limit(1);

  return result[0] || null;
}

/**
 * Approve a staging trade and move it to production
 */
export async function approveStagingTrade(
  stagingTradeId: number,
  reviewedBy: number,
  reviewNotes?: string
): Promise<{ success: boolean; productionTradeId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get the staging trade
    const stagingTrade = await getStagingTradeById(stagingTradeId);
    if (!stagingTrade) {
      return { success: false, error: "Staging trade not found" };
    }

    if (stagingTrade.status !== "pending" && stagingTrade.status !== "edited") {
      return {
        success: false,
        error: `Cannot approve trade with status: ${stagingTrade.status}`,
      };
    }

    // Only approve closed trades (with exit data)
    if (
      stagingTrade.isOpen ||
      !stagingTrade.exitDate ||
      !stagingTrade.exitPrice
    ) {
      return {
        success: false,
        error: "Cannot approve open positions. Wait for exit signal.",
      };
    }

    // Insert into production trades table
    const insertResult = await db.insert(trades).values({
      strategyId: stagingTrade.strategyId,
      entryDate: stagingTrade.entryDate,
      exitDate: stagingTrade.exitDate,
      direction: stagingTrade.direction,
      entryPrice: stagingTrade.entryPrice,
      exitPrice: stagingTrade.exitPrice,
      quantity: stagingTrade.quantity,
      pnl: stagingTrade.pnl || 0,
      pnlPercent: stagingTrade.pnlPercent || 0,
      commission: stagingTrade.commission,
    });

    const productionTradeId = (insertResult as any)[0]?.insertId;

    // Update staging trade status
    await db
      .update(stagingTrades)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
        productionTradeId,
      })
      .where(eq(stagingTrades.id, stagingTradeId));

    console.log(
      `[Database] Approved staging trade ${stagingTradeId} -> production trade ${productionTradeId}`
    );
    return { success: true, productionTradeId };
  } catch (error) {
    console.error("[Database] Failed to approve staging trade:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reject a staging trade
 */
export async function rejectStagingTrade(
  stagingTradeId: number,
  reviewedBy: number,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const stagingTrade = await getStagingTradeById(stagingTradeId);
    if (!stagingTrade) {
      return { success: false, error: "Staging trade not found" };
    }

    await db
      .update(stagingTrades)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
      })
      .where(eq(stagingTrades.id, stagingTradeId));

    console.log(`[Database] Rejected staging trade ${stagingTradeId}`);
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to reject staging trade:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Edit a staging trade (for corrections before approval)
 */
export async function editStagingTrade(
  stagingTradeId: number,
  reviewedBy: number,
  updates: {
    entryDate?: Date;
    exitDate?: Date;
    direction?: string;
    entryPrice?: number;
    exitPrice?: number;
    quantity?: number;
    pnl?: number;
    pnlPercent?: number;
    commission?: number;
  },
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    const stagingTrade = await getStagingTradeById(stagingTradeId);
    if (!stagingTrade) {
      return { success: false, error: "Staging trade not found" };
    }

    // Store original values before edit
    const originalPayload = JSON.stringify({
      entryDate: stagingTrade.entryDate,
      exitDate: stagingTrade.exitDate,
      direction: stagingTrade.direction,
      entryPrice: stagingTrade.entryPrice,
      exitPrice: stagingTrade.exitPrice,
      quantity: stagingTrade.quantity,
      pnl: stagingTrade.pnl,
      pnlPercent: stagingTrade.pnlPercent,
      commission: stagingTrade.commission,
    });

    await db
      .update(stagingTrades)
      .set({
        ...updates,
        entryDate:
          updates.entryDate instanceof Date
            ? updates.entryDate.toISOString()
            : updates.entryDate,
        exitDate:
          updates.exitDate instanceof Date
            ? updates.exitDate.toISOString()
            : updates.exitDate,
        status: "edited" as const,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        reviewNotes,
        originalPayload: stagingTrade.originalPayload || originalPayload,
        isOpen: updates.exitDate ? 0 : stagingTrade.isOpen,
      } as any)
      .where(eq(stagingTrades.id, stagingTradeId));

    console.log(`[Database] Edited staging trade ${stagingTradeId}`);
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to edit staging trade:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a staging trade permanently
 */
export async function deleteStagingTrade(
  stagingTradeId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(stagingTrades).where(eq(stagingTrades.id, stagingTradeId));
    console.log(`[Database] Deleted staging trade ${stagingTradeId}`);
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete staging trade:", error);
    return false;
  }
}

/**
 * Get staging trade statistics
 */
export async function getStagingTradeStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  edited: number;
  openPositions: number;
}> {
  const db = await getDb();
  if (!db)
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      edited: 0,
      openPositions: 0,
    };

  try {
    const allTrades = await db.select().from(stagingTrades);

    return {
      pending: allTrades.filter(t => t.status === "pending").length,
      approved: allTrades.filter(t => t.status === "approved").length,
      rejected: allTrades.filter(t => t.status === "rejected").length,
      edited: allTrades.filter(t => t.status === "edited").length,
      openPositions: allTrades.filter(t => t.isOpen).length,
    };
  } catch (error) {
    console.error("[Database] Failed to get staging trade stats:", error);
    return {
      pending: 0,
      approved: 0,
      rejected: 0,
      edited: 0,
      openPositions: 0,
    };
  }
}

/**
 * Update staging trade when exit signal is received
 */
export async function updateStagingTradeExit(
  strategySymbol: string,
  direction: string,
  exitData: {
    exitDate: Date;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
  }
): Promise<{ success: boolean; stagingTradeId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Find the open staging trade for this strategy and direction
    const openTrades = await db
      .select()
      .from(stagingTrades)
      .where(
        and(
          eq(stagingTrades.strategySymbol, strategySymbol),
          eq(stagingTrades.direction, direction),
          eq(stagingTrades.isOpen, 1),
          eq(stagingTrades.status, "pending")
        )
      )
      .orderBy(desc(stagingTrades.createdAt))
      .limit(1);

    if (openTrades.length === 0) {
      return {
        success: false,
        error: "No open staging trade found for this strategy",
      };
    }

    const openTrade = openTrades[0];

    // Update with exit data
    await db
      .update(stagingTrades)
      .set({
        exitDate:
          exitData.exitDate instanceof Date
            ? exitData.exitDate.toISOString()
            : exitData.exitDate,
        exitPrice: exitData.exitPrice,
        pnl: exitData.pnl,
        pnlPercent: exitData.pnlPercent,
        isOpen: 0,
      })
      .where(eq(stagingTrades.id, openTrade.id));

    console.log(
      `[Database] Updated staging trade ${openTrade.id} with exit data`
    );
    return { success: true, stagingTradeId: openTrade.id };
  } catch (error) {
    console.error("[Database] Failed to update staging trade exit:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// Test Data Cleanup Functions
// ============================================================================

/**
 * Delete all test data from webhook_logs table
 * Only deletes records where isTest = true
 */
export async function deleteTestWebhookLogs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs)
      .where(eq(webhookLogs.isTest, 1));
    const count = countResult[0]?.count ?? 0;

    if (count === 0) return 0;

    await db.delete(webhookLogs).where(eq(webhookLogs.isTest, 1));
    console.log(`[Database] Deleted ${count} test webhook logs`);
    return count;
  } catch (error) {
    console.error("[Database] Failed to delete test webhook logs:", error);
    return 0;
  }
}

/**
 * Delete all test data from trades table
 * Only deletes records where isTest = true
 */
export async function deleteTestTrades(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(eq(trades.isTest, 1));
    const count = countResult[0]?.count ?? 0;

    if (count === 0) return 0;

    await db.delete(trades).where(eq(trades.isTest, 1));
    console.log(`[Database] Deleted ${count} test trades`);
    return count;
  } catch (error) {
    console.error("[Database] Failed to delete test trades:", error);
    return 0;
  }
}

/**
 * Delete all test data from open_positions table
 * Only deletes records where isTest = true
 */
export async function deleteTestOpenPositions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(openPositions)
      .where(eq(openPositions.isTest, 1));
    const count = countResult[0]?.count ?? 0;

    if (count === 0) return 0;

    await db.delete(openPositions).where(eq(openPositions.isTest, 1));
    console.log(`[Database] Deleted ${count} test open positions`);
    return count;
  } catch (error) {
    console.error("[Database] Failed to delete test open positions:", error);
    return 0;
  }
}

/**
 * Delete all test data from all tables
 * Comprehensive cleanup for test isolation
 */
export async function deleteAllTestData(): Promise<{
  webhookLogs: number;
  trades: number;
  openPositions: number;
  total: number;
}> {
  const webhookLogs = await deleteTestWebhookLogs();
  const trades = await deleteTestTrades();
  const openPositions = await deleteTestOpenPositions();

  return {
    webhookLogs,
    trades,
    openPositions,
    total: webhookLogs + trades + openPositions,
  };
}

/**
 * Get count of test data in all tables
 * Useful for monitoring test data accumulation
 */
export async function getTestDataCounts(): Promise<{
  webhookLogs: number;
  trades: number;
  openPositions: number;
  total: number;
}> {
  const db = await getDb();
  if (!db) return { webhookLogs: 0, trades: 0, openPositions: 0, total: 0 };

  const [wlCount, tCount, opCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs)
      .where(eq(webhookLogs.isTest, 1)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(trades)
      .where(eq(trades.isTest, 1)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(openPositions)
      .where(eq(openPositions.isTest, 1)),
  ]);

  const webhookLogsCount = wlCount[0]?.count ?? 0;
  const tradesCount = tCount[0]?.count ?? 0;
  const openPositionsCount = opCount[0]?.count ?? 0;

  return {
    webhookLogs: webhookLogsCount,
    trades: tradesCount,
    openPositions: openPositionsCount,
    total: webhookLogsCount + tradesCount + openPositionsCount,
  };
}

// ============================================================================
// Contact Messages Functions
// ============================================================================

/**
 * Create a new contact message
 */
export async function createContactMessage(
  message: Omit<InsertContactMessage, "id" | "createdAt" | "updatedAt">
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(contactMessages).values(message);
    const insertedId = (result as any)[0]?.insertId;
    console.log(`[Database] Created contact message ${insertedId}`);
    return insertedId || null;
  } catch (error) {
    console.error("[Database] Failed to create contact message:", error);
    return null;
  }
}

/**
 * Get all contact messages with optional filters
 */
export async function getContactMessages(params?: {
  status?: ContactMessage["status"];
  category?: ContactMessage["category"];
  limit?: number;
  offset?: number;
}): Promise<ContactMessage[]> {
  const db = await getDb();
  if (!db) return [];

  const { status, category, limit = 50, offset = 0 } = params || {};

  try {
    const conditions = [];
    if (status) {
      conditions.push(eq(contactMessages.status, status));
    }
    if (category) {
      conditions.push(eq(contactMessages.category, category));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(contactMessages)
        .where(and(...conditions))
        .orderBy(desc(contactMessages.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return await db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.error("[Database] Failed to get contact messages:", error);
    return [];
  }
}

/**
 * Get a single contact message by ID
 */
export async function getContactMessageById(
  id: number
): Promise<ContactMessage | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(contactMessages)
      .where(eq(contactMessages.id, id))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get contact message:", error);
    return null;
  }
}

/**
 * Update a contact message
 */
export async function updateContactMessage(
  id: number,
  updates: Partial<InsertContactMessage>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(contactMessages)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(contactMessages.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update contact message:", error);
    return false;
  }
}

/**
 * Get contact message statistics
 */
export async function getContactMessageStats(): Promise<{
  new: number;
  read: number;
  inProgress: number;
  awaitingResponse: number;
  resolved: number;
  closed: number;
  total: number;
}> {
  const db = await getDb();
  if (!db)
    return {
      new: 0,
      read: 0,
      inProgress: 0,
      awaitingResponse: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    };

  try {
    const allMessages = await db.select().from(contactMessages);

    return {
      new: allMessages.filter(m => m.status === "new").length,
      read: allMessages.filter(m => m.status === "read").length,
      inProgress: allMessages.filter(m => m.status === "in_progress").length,
      awaitingResponse: allMessages.filter(
        m => m.status === "awaiting_response"
      ).length,
      resolved: allMessages.filter(m => m.status === "resolved").length,
      closed: allMessages.filter(m => m.status === "closed").length,
      total: allMessages.length,
    };
  } catch (error) {
    console.error("[Database] Failed to get contact message stats:", error);
    return {
      new: 0,
      read: 0,
      inProgress: 0,
      awaitingResponse: 0,
      resolved: 0,
      closed: 0,
      total: 0,
    };
  }
}

// ============================================================================
// Contact Responses Functions
// ============================================================================

/**
 * Create a new contact response
 */
export async function createContactResponse(
  response: Omit<InsertContactResponse, "id" | "createdAt">
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(contactResponses).values(response);
    const insertedId = (result as any)[0]?.insertId;
    console.log(`[Database] Created contact response ${insertedId}`);
    return insertedId || null;
  } catch (error) {
    console.error("[Database] Failed to create contact response:", error);
    return null;
  }
}

/**
 * Get responses for a contact message
 */
export async function getContactResponses(
  messageId: number
): Promise<ContactResponse[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(contactResponses)
      .where(eq(contactResponses.messageId, messageId))
      .orderBy(desc(contactResponses.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get contact responses:", error);
    return [];
  }
}

/**
 * Get a single contact response by ID
 */
export async function getContactResponseById(
  id: number
): Promise<ContactResponse | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(contactResponses)
      .where(eq(contactResponses.id, id))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get contact response:", error);
    return null;
  }
}

/**
 * Update a contact response (for approval workflow)
 */
export async function updateContactResponse(
  id: number,
  updates: Partial<InsertContactResponse>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(contactResponses)
      .set(updates)
      .where(eq(contactResponses.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to update contact response:", error);
    return false;
  }
}

/**
 * Approve a contact response
 */
export async function approveContactResponse(
  responseId: number,
  approvedBy: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(contactResponses)
      .set({
        approvedBy,
        approvedAt: new Date().toISOString(),
        deliveryStatus: "approved",
      })
      .where(eq(contactResponses.id, responseId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to approve contact response:", error);
    return false;
  }
}

/**
 * Mark a contact response as sent
 */
export async function markContactResponseSent(
  responseId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(contactResponses)
      .set({
        sentAt: new Date().toISOString(),
        deliveryStatus: "sent",
      })
      .where(eq(contactResponses.id, responseId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to mark contact response as sent:", error);
    return false;
  }
}
