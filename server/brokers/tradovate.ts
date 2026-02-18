/**
 * Tradovate Broker Integration
 *
 * Production-ready implementation for Tradovate futures trading API.
 * Supports both demo and live environments with proper authentication,
 * order execution, position management, and health monitoring.
 *
 * API Documentation: https://api.tradovate.com/v1
 */

import { TradovateCredentials } from "../encryption";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TRADOVATE_ENDPOINTS = {
  demo: {
    api: "https://demo.tradovateapi.com/v1",
    ws: "wss://demo.tradovateapi.com/v1/websocket",
    md: "wss://md.tradovateapi.com/v1/websocket",
  },
  live: {
    api: "https://live.tradovateapi.com/v1",
    ws: "wss://live.tradovateapi.com/v1/websocket",
    md: "wss://md.tradovateapi.com/v1/websocket",
  },
};

// Token refresh 5 minutes before expiration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface TradovateAuthResponse {
  accessToken: string;
  mdAccessToken: string;
  expirationTime: string;
  userId: number;
  name: string;
  errorText?: string;
  "p-ticket"?: string;
  "p-time"?: number;
  "p-captcha"?: boolean;
}

export interface TradovateAccount {
  id: number;
  name: string;
  userId: number;
  accountType: string;
  active: boolean;
  clearingHouseId: number;
  riskCategoryId: number;
  autoLiqProfileId: number;
  marginAccountType: string;
  legalStatus: string;
  archived: boolean;
  timestamp: string;
}

export interface TradovatePosition {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  tradeDate: { year: number; month: number; day: number };
  netPos: number;
  netPrice: number;
  bought: number;
  boughtValue: number;
  sold: number;
  soldValue: number;
  prevPos: number;
  prevPrice: number;
}

export interface TradovateOrder {
  id: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  action: "Buy" | "Sell";
  ordType: "Market" | "Limit" | "Stop" | "StopLimit" | "MIT" | "TrailingStop";
  orderQty: number;
  price?: number;
  stopPrice?: number;
  ordStatus: string;
  filledQty?: number;
  avgFillPrice?: number;
  text?: string;
}

export interface PlaceOrderRequest {
  accountSpec: string;
  accountId: number;
  action: "Buy" | "Sell";
  symbol: string;
  orderQty: number;
  orderType: "Market" | "Limit" | "Stop" | "StopLimit";
  price?: number;
  stopPrice?: number;
  timeInForce?: "Day" | "GTC" | "IOC" | "FOK" | "GTD";
  text?: string;
  isAutomated?: boolean;
}

export interface PlaceOrderResponse {
  orderId: number;
  orderStatus: string;
  fillPrice?: number;
  fillQuantity?: number;
  errorText?: string;
}

export interface ConnectionHealth {
  connected: boolean;
  authenticated: boolean;
  lastHeartbeat: Date | null;
  tokenExpiresAt: Date | null;
  accountsLoaded: boolean;
  error?: string;
}

// ============================================================================
// TRADOVATE CLIENT
// ============================================================================

export class TradovateClient {
  private accessToken: string | null = null;
  private tokenExpiration: Date | null = null;
  private userId: number | null = null;
  private accounts: TradovateAccount[] = [];
  private isDemo: boolean;
  private lastHeartbeat: Date | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private credentials: TradovateCredentials | null = null;

  constructor(isDemo: boolean = true) {
    this.isDemo = isDemo;
  }

  /**
   * Get the appropriate API endpoint
   */
  private getEndpoints() {
    return this.isDemo ? TRADOVATE_ENDPOINTS.demo : TRADOVATE_ENDPOINTS.live;
  }

  /**
   * Generate a unique device ID for this session
   */
  private generateDeviceId(): string {
    return `manus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Make an authenticated API request with retry logic
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${this.getEndpoints().api}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeout);

      if (
        retries > 0 &&
        error instanceof Error &&
        !error.message.includes("401")
      ) {
        console.log(
          `[Tradovate] Retrying request to ${endpoint}, ${retries} attempts left`
        );
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return this.apiRequest<T>(endpoint, options, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Authenticate with Tradovate
   */
  async authenticate(credentials: TradovateCredentials): Promise<{
    success: boolean;
    error?: string;
    userId?: number;
    accounts?: TradovateAccount[];
  }> {
    try {
      console.log(
        `[Tradovate] Authenticating user: ${credentials.username} (${this.isDemo ? "demo" : "live"})`
      );

      const authBody = {
        name: credentials.username,
        password: credentials.password,
        appId: credentials.appId || "STS-Futures-Dashboard",
        appVersion: credentials.appVersion || "1.0.0",
        cid: credentials.cid,
        sec: credentials.sec,
        deviceId: credentials.deviceId || this.generateDeviceId(),
      };

      const response = await this.apiRequest<TradovateAuthResponse>(
        "/auth/accesstokenrequest",
        {
          method: "POST",
          body: JSON.stringify(authBody),
        }
      );

      if (response.errorText) {
        console.error(`[Tradovate] Auth error: ${response.errorText}`);
        return { success: false, error: response.errorText };
      }

      // Handle 2FA if required
      if (response["p-ticket"]) {
        console.log("[Tradovate] 2FA required - p-ticket received");
        return {
          success: false,
          error:
            "Two-factor authentication required. Please complete 2FA in Tradovate app.",
        };
      }

      // Store tokens
      this.accessToken = response.accessToken;
      // mdAccessToken available for market data WebSocket
      this.tokenExpiration = new Date(response.expirationTime);
      this.userId = response.userId;
      this.credentials = credentials;
      this.lastHeartbeat = new Date();

      // Schedule token refresh
      this.scheduleTokenRefresh();

      // Load accounts
      const accounts = await this.getAccounts();
      this.accounts = accounts;

      console.log(
        `[Tradovate] Authenticated successfully. User ID: ${this.userId}, Accounts: ${accounts.length}`
      );

      return {
        success: true,
        userId: this.userId,
        accounts,
      };
    } catch (error) {
      console.error("[Tradovate] Authentication failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenExpiration) return;

    const refreshTime =
      this.tokenExpiration.getTime() - Date.now() - TOKEN_REFRESH_BUFFER_MS;

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshToken();
      }, refreshTime);

      console.log(
        `[Tradovate] Token refresh scheduled in ${Math.round(refreshTime / 60000)} minutes`
      );
    }
  }

  /**
   * Refresh the access token
   */
  async refreshToken(): Promise<boolean> {
    if (!this.accessToken) {
      console.warn("[Tradovate] Cannot refresh: no existing token");
      return false;
    }

    try {
      const response = await this.apiRequest<TradovateAuthResponse>(
        "/auth/renewaccesstoken",
        { method: "POST" }
      );

      if (response.errorText) {
        throw new Error(response.errorText);
      }

      this.accessToken = response.accessToken;
      // mdAccessToken available for market data WebSocket
      this.tokenExpiration = new Date(response.expirationTime);
      this.lastHeartbeat = new Date();

      this.scheduleTokenRefresh();

      console.log("[Tradovate] Token refreshed successfully");
      return true;
    } catch (error) {
      console.error("[Tradovate] Token refresh failed:", error);

      // Try to re-authenticate with stored credentials
      if (this.credentials) {
        console.log("[Tradovate] Attempting re-authentication...");
        const result = await this.authenticate(this.credentials);
        return result.success;
      }

      return false;
    }
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    if (!this.accessToken || !this.tokenExpiration) {
      return false;
    }
    return this.tokenExpiration > new Date();
  }

  /**
   * Get connection health status
   */
  getHealth(): ConnectionHealth {
    return {
      connected: this.accessToken !== null,
      authenticated: this.isAuthenticated(),
      lastHeartbeat: this.lastHeartbeat,
      tokenExpiresAt: this.tokenExpiration,
      accountsLoaded: this.accounts.length > 0,
    };
  }

  /**
   * Get accounts
   */
  async getAccounts(): Promise<TradovateAccount[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    try {
      const accounts =
        await this.apiRequest<TradovateAccount[]>("/account/list");
      this.accounts = accounts;
      return accounts;
    } catch (error) {
      console.error("[Tradovate] Failed to get accounts:", error);
      return [];
    }
  }

  /**
   * Get account balance and cash info
   */
  async getAccountBalance(accountId: number): Promise<{
    cashBalance: number;
    realizedPnL: number;
    unrealizedPnL: number;
    marginUsed: number;
    availableMargin: number;
  } | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await this.apiRequest<{
        accountId: number;
        cashBalance: number;
        realizedPnL: number;
        openPnL: number;
        marginUsed: number;
        netLiq: number;
      }>(`/cashBalance/getCashBalanceSnapshot?accountId=${accountId}`);

      return {
        cashBalance: response.cashBalance,
        realizedPnL: response.realizedPnL,
        unrealizedPnL: response.openPnL,
        marginUsed: response.marginUsed,
        availableMargin: response.netLiq - response.marginUsed,
      };
    } catch (error) {
      console.error("[Tradovate] Failed to get account balance:", error);
      return null;
    }
  }

  /**
   * Get positions for an account
   */
  async getPositions(accountId: number): Promise<TradovatePosition[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    try {
      return await this.apiRequest<TradovatePosition[]>(
        `/position/list?accountId=${accountId}`
      );
    } catch (error) {
      console.error("[Tradovate] Failed to get positions:", error);
      return [];
    }
  }

  /**
   * Get open orders for an account
   */
  async getOrders(accountId: number): Promise<TradovateOrder[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    try {
      return await this.apiRequest<TradovateOrder[]>(
        `/order/list?accountId=${accountId}`
      );
    } catch (error) {
      console.error("[Tradovate] Failed to get orders:", error);
      return [];
    }
  }

  /**
   * Place an order
   */
  async placeOrder(order: PlaceOrderRequest): Promise<PlaceOrderResponse> {
    if (!this.isAuthenticated()) {
      return {
        orderId: 0,
        orderStatus: "Rejected",
        errorText: "Not authenticated",
      };
    }

    try {
      console.log(
        `[Tradovate] Placing order: ${order.action} ${order.orderQty} ${order.symbol}`
      );

      const orderBody = {
        accountSpec: order.accountSpec,
        accountId: order.accountId,
        action: order.action,
        symbol: order.symbol,
        orderQty: order.orderQty,
        orderType: order.orderType,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce || "Day",
        text: order.text || "STS Dashboard Auto-Trade",
        isAutomated: true,
      };

      const response = await this.apiRequest<{
        orderId: number;
        ordStatus: string;
        avgFillPrice?: number;
        filledQty?: number;
        errorText?: string;
      }>("/order/placeorder", {
        method: "POST",
        body: JSON.stringify(orderBody),
      });

      if (response.errorText) {
        console.error(`[Tradovate] Order rejected: ${response.errorText}`);
        return {
          orderId: response.orderId || 0,
          orderStatus: "Rejected",
          errorText: response.errorText,
        };
      }

      console.log(
        `[Tradovate] Order placed: ID ${response.orderId}, Status: ${response.ordStatus}`
      );

      return {
        orderId: response.orderId,
        orderStatus: response.ordStatus,
        fillPrice: response.avgFillPrice,
        fillQuantity: response.filledQty,
      };
    } catch (error) {
      console.error("[Tradovate] Order placement failed:", error);
      return {
        orderId: 0,
        orderStatus: "Error",
        errorText: error instanceof Error ? error.message : "Order failed",
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    orderId: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await this.apiRequest("/order/cancelorder", {
        method: "POST",
        body: JSON.stringify({ orderId }),
      });

      console.log(`[Tradovate] Order ${orderId} cancelled`);
      return { success: true };
    } catch (error) {
      console.error("[Tradovate] Cancel order failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cancel failed",
      };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(orderId: number): Promise<TradovateOrder | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      return await this.apiRequest<TradovateOrder>(`/order/item?id=${orderId}`);
    } catch (error) {
      console.error("[Tradovate] Failed to get order status:", error);
      return null;
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.accessToken = null;
    // mdAccessToken cleared
    this.tokenExpiration = null;
    this.userId = null;
    this.accounts = [];
    this.credentials = null;

    console.log("[Tradovate] Disconnected");
  }

  /**
   * Get stored accounts
   */
  getStoredAccounts(): TradovateAccount[] {
    return this.accounts;
  }

  /**
   * Get primary account (first active account)
   */
  getPrimaryAccount(): TradovateAccount | null {
    return this.accounts.find(a => a.active) || this.accounts[0] || null;
  }
}

// ============================================================================
// SYMBOL MAPPING
// ============================================================================

export const FUTURES_SYMBOLS: Record<
  string,
  { tradovate: string; multiplier: number; tickSize: number }
> = {
  // E-mini S&P 500
  ES: { tradovate: "ES", multiplier: 50, tickSize: 0.25 },
  MES: { tradovate: "MES", multiplier: 5, tickSize: 0.25 },

  // E-mini Nasdaq
  NQ: { tradovate: "NQ", multiplier: 20, tickSize: 0.25 },
  MNQ: { tradovate: "MNQ", multiplier: 2, tickSize: 0.25 },

  // Crude Oil
  CL: { tradovate: "CL", multiplier: 1000, tickSize: 0.01 },
  MCL: { tradovate: "MCL", multiplier: 100, tickSize: 0.01 },

  // Gold
  GC: { tradovate: "GC", multiplier: 100, tickSize: 0.1 },
  MGC: { tradovate: "MGC", multiplier: 10, tickSize: 0.1 },

  // E-mini Dow
  YM: { tradovate: "YM", multiplier: 5, tickSize: 1.0 },
  MYM: { tradovate: "MYM", multiplier: 0.5, tickSize: 1.0 },

  // Bitcoin
  BTC: { tradovate: "BTC", multiplier: 5, tickSize: 5.0 },
  MBT: { tradovate: "MBT", multiplier: 0.1, tickSize: 5.0 },
};

/**
 * Get the front month contract symbol
 */
export function getFrontMonthContract(baseSymbol: string): string {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear() % 100;

  // Quarterly months: H (Mar), M (Jun), U (Sep), Z (Dec)
  const quarterlyMonths = ["H", "M", "U", "Z"];
  const quarterIndex = Math.floor((month + 2) / 3) % 4;
  const monthCode = quarterlyMonths[quarterIndex];

  // Adjust year if we're rolling to next year's contract
  const contractYear = month >= 11 && quarterIndex === 0 ? year + 1 : year;

  return `${baseSymbol}${monthCode}${contractYear}`;
}

// ============================================================================
// SINGLETON INSTANCE MANAGEMENT
// ============================================================================

const clientInstances = new Map<string, TradovateClient>();

export function getTradovateClient(
  userId: number,
  isDemo: boolean = true
): TradovateClient {
  const key = `${userId}-${isDemo ? "demo" : "live"}`;

  if (!clientInstances.has(key)) {
    clientInstances.set(key, new TradovateClient(isDemo));
  }

  return clientInstances.get(key)!;
}

export function disconnectTradovateClient(
  userId: number,
  isDemo: boolean = true
): void {
  const key = `${userId}-${isDemo ? "demo" : "live"}`;
  const client = clientInstances.get(key);

  if (client) {
    client.disconnect();
    clientInstances.delete(key);
  }
}
