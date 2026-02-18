/**
 * Broker Service Framework
 *
 * This module provides the foundation for connecting to trading brokers
 * (Tradovate, IBKR, Fidelity, Alpaca) and executing trades based on webhook signals.
 *
 * Current Status: Framework only - no live trading implemented yet
 */

import { getDb } from "./db";
import {
  brokerConnections,
  routingRules,
  executionLogs,
} from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { encrypt, decrypt } from "./utils/encryption";

// ============================================================================
// TYPES
// ============================================================================

export type BrokerType = "tradovate" | "ibkr" | "tradestation";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface BrokerCredentials {
  apiKey?: string;
  apiSecret?: string;
  username?: string;
  password?: string;
  accountId?: string;
}

export interface OrderRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  orderType: "market" | "limit";
  price?: number; // Required for limit orders
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  fillPrice?: number;
  fillQuantity?: number;
  error?: string;
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  accountType: string;
  balance?: number;
  buyingPower?: number;
}

// ============================================================================
// BROKER INTERFACE
// ============================================================================

/**
 * Abstract interface that all broker implementations must follow
 */
export interface IBrokerService {
  readonly brokerType: BrokerType;

  // Connection management
  connect(
    credentials: BrokerCredentials
  ): Promise<{ success: boolean; error?: string }>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Account operations
  getAccountInfo(): Promise<AccountInfo | null>;

  // Order operations (not implemented yet - framework only)
  placeOrder(order: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }>;
  getOrderStatus(
    orderId: string
  ): Promise<{ status: string; fillPrice?: number; fillQuantity?: number }>;
}

// ============================================================================
// TRADOVATE SERVICE (Framework)
// ============================================================================

export class TradovateService implements IBrokerService {
  readonly brokerType: BrokerType = "tradovate";
  private connected = false;
  private accountId: string | null = null;

  /**
   * Connect to Tradovate API
   *
   * Tradovate uses OAuth2 authentication:
   * 1. User authenticates via Tradovate login
   * 2. We receive access token and refresh token
   * 3. Access token used for API calls
   *
   * For now, this is a placeholder that simulates connection
   */
  async connect(
    credentials: BrokerCredentials
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement actual Tradovate OAuth flow
      // https://api.tradovate.com/v1/auth/accesstokenrequest

      console.log("[Tradovate] Attempting connection...");

      // Validate required credentials
      if (!credentials.username || !credentials.password) {
        return { success: false, error: "Username and password required" };
      }

      // Simulate connection (replace with actual API call)
      // In production, this would:
      // 1. POST to https://demo.tradovateapi.com/v1/auth/accesstokenrequest
      // 2. Store the access token and refresh token
      // 3. Set up token refresh timer

      this.connected = true;
      this.accountId = credentials.accountId || null;

      console.log("[Tradovate] Connection established (simulated)");
      return { success: true };
    } catch (error) {
      console.error("[Tradovate] Connection failed:", error);
      return { success: false, error: String(error) };
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.accountId = null;
    console.log("[Tradovate] Disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    if (!this.connected) return null;

    // TODO: Implement actual account info fetch
    // GET https://demo.tradovateapi.com/v1/account/list

    return {
      accountId: this.accountId || "demo-account",
      accountName: "Tradovate Demo",
      accountType: "demo",
      balance: 100000,
      buyingPower: 100000,
    };
  }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    if (!this.connected) {
      return { success: false, error: "Not connected to Tradovate" };
    }

    // TODO: Implement actual order placement
    // POST https://demo.tradovateapi.com/v1/order/placeorder

    console.log("[Tradovate] Order placement not implemented yet:", order);
    return {
      success: false,
      error: "Order execution not implemented - signal logged only",
    };
  }

  async cancelOrder(
    orderId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) {
      return { success: false, error: "Not connected to Tradovate" };
    }

    // TODO: Implement actual order cancellation
    console.log("[Tradovate] Order cancellation not implemented:", orderId);
    return { success: false, error: "Not implemented" };
  }

  async getOrderStatus(
    _orderId: string
  ): Promise<{ status: string; fillPrice?: number; fillQuantity?: number }> {
    // TODO: Implement actual order status check
    return { status: "unknown" };
  }
}

// ============================================================================
// IBKR SERVICE (Framework)
// ============================================================================

export class IBKRService implements IBrokerService {
  readonly brokerType: BrokerType = "ibkr";
  private connected = false;

  /**
   * Connect to Interactive Brokers
   *
   * IBKR uses the Client Portal API or TWS API:
   * - Client Portal: REST API, requires gateway running
   * - TWS API: Socket-based, requires TWS or IB Gateway
   *
   * For now, this is a placeholder
   */
  async connect(
    _credentials: BrokerCredentials
  ): Promise<{ success: boolean; error?: string }> {
    console.log("[IBKR] Connection not implemented yet");
    return { success: false, error: "IBKR integration coming soon" };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    return null;
  }

  async placeOrder(_order: OrderRequest): Promise<OrderResult> {
    return { success: false, error: "IBKR integration not implemented" };
  }

  async cancelOrder(
    _orderId: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Not implemented" };
  }

  async getOrderStatus(_orderId: string): Promise<{ status: string }> {
    return { status: "unknown" };
  }
}

// ============================================================================
// TRADESTATION SERVICE (Placeholder - To be implemented)
// ============================================================================

export class TradeStationService implements IBrokerService {
  readonly brokerType: BrokerType = "tradestation";
  private connected = false;

  async connect(
    _credentials: BrokerCredentials
  ): Promise<{ success: boolean; error?: string }> {
    console.log("[TradeStation] Connection not available - coming soon");
    return { success: false, error: "TradeStation integration coming soon" };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    return null;
  }

  async placeOrder(_order: OrderRequest): Promise<OrderResult> {
    return { success: false, error: "TradeStation integration not available" };
  }

  async cancelOrder(
    _orderId: string
  ): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Not implemented" };
  }

  async getOrderStatus(_orderId: string): Promise<{ status: string }> {
    return { status: "unknown" };
  }
}

// ============================================================================
// BROKER FACTORY
// ============================================================================

export function createBrokerService(brokerType: BrokerType): IBrokerService {
  switch (brokerType) {
    case "tradovate":
      return new TradovateService();
    case "ibkr":
      return new IBKRService();
    case "tradestation":
      return new TradeStationService();

    default:
      throw new Error(`Unknown broker type: ${brokerType}`);
  }
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

export async function getBrokerConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(brokerConnections)
    .where(eq(brokerConnections.userId, userId));
}

export async function getBrokerConnection(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(brokerConnections)
    .where(eq(brokerConnections.id, id));
  return results[0] || null;
}

export async function createBrokerConnection(data: {
  userId: number;
  broker: BrokerType;
  name: string;
  accountId?: string;
  accountName?: string;
  accountType?: string;
  credentials?: BrokerCredentials;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Encrypt credentials if provided
  let encryptedCredentials: string | undefined;
  if (data.credentials) {
    try {
      encryptedCredentials = encrypt(JSON.stringify(data.credentials));
    } catch (error) {
      console.error("[BrokerService] Failed to encrypt credentials:", error);
      throw new Error("Failed to securely store credentials");
    }
  }

  // @ts-expect-error TS2769
  const result = await db.insert(brokerConnections).values({
    userId: data.userId,
    broker: data.broker,
    name: data.name,
    status: "disconnected",
    accountId: data.accountId,
    accountName: data.accountName,
    accountType: data.accountType,
    encryptedCredentials,
  });
  return result;
}

export async function updateBrokerConnectionStatus(
  id: number,
  status: ConnectionStatus,
  error?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(brokerConnections)
    .set({
      status,
      lastError: error || null,
      // @ts-expect-error TS2322
      lastConnectedAt: status === "connected" ? new Date() : undefined,
    })
    .where(eq(brokerConnections.id, id));
}

export async function deleteBrokerConnection(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(brokerConnections).where(eq(brokerConnections.id, id));
}

/**
 * Retrieve and decrypt credentials for a broker connection
 * Returns null if no credentials are stored or decryption fails
 */
export async function getDecryptedCredentials(
  connectionId: number
): Promise<BrokerCredentials | null> {
  const connection = await getBrokerConnection(connectionId);
  if (!connection?.encryptedCredentials) {
    return null;
  }

  try {
    const decrypted = decrypt(connection.encryptedCredentials);
    return JSON.parse(decrypted) as BrokerCredentials;
  } catch (error) {
    console.error("[BrokerService] Failed to decrypt credentials:", error);
    return null;
  }
}

/**
 * Update encrypted credentials for an existing broker connection
 */
export async function updateBrokerCredentials(
  connectionId: number,
  credentials: BrokerCredentials
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const encryptedCredentials = encrypt(JSON.stringify(credentials));
    await db
      .update(brokerConnections)
      .set({ encryptedCredentials })
      .where(eq(brokerConnections.id, connectionId));
    return true;
  } catch (error) {
    console.error("[BrokerService] Failed to update credentials:", error);
    return false;
  }
}

export async function getRoutingRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(routingRules)
    .where(eq(routingRules.userId, userId))
    .orderBy(desc(routingRules.priority));
}

export async function getExecutionLogs(webhookLogId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (webhookLogId) {
    return db
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.webhookLogId, webhookLogId))
      .orderBy(desc(executionLogs.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(executionLogs)
    .orderBy(desc(executionLogs.createdAt))
    .limit(limit);
}

export async function createExecutionLog(data: {
  webhookLogId: number;
  routingRuleId?: number;
  brokerConnectionId: number;
  orderType?: string;
  side?: string;
  symbol?: string;
  quantity?: number;
  price?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(executionLogs).values({
    webhookLogId: data.webhookLogId,
    routingRuleId: data.routingRuleId,
    brokerConnectionId: data.brokerConnectionId,
    status: "pending",
    orderType: data.orderType,
    side: data.side,
    symbol: data.symbol,
    quantity: data.quantity,
    price: data.price,
  });
  return result;
}
