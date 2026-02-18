/**
 * TradeStation API Integration
 *
 * Production-ready implementation for TradeStation's REST API.
 * Supports OAuth 2.0 authentication, order execution, and position management.
 *
 * API Documentation: https://api.tradestation.com/docs/
 *
 * Setup Requirements:
 * 1. Create a TradeStation API application at https://developer.tradestation.com
 * 2. Get Client ID and Client Secret
 * 3. Complete OAuth flow to get access/refresh tokens
 */

import { TradeStationCredentials } from "../encryption";

// ============================================================================
// CONFIGURATION
// ============================================================================

const TRADESTATION_ENDPOINTS = {
  auth: "https://signin.tradestation.com/oauth/token",
  api: "https://api.tradestation.com/v3",
  sim: "https://sim-api.tradestation.com/v3",
};

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface TradeStationTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  userid: string;
}

export interface TradeStationAccount {
  AccountID: string;
  AccountType: string;
  Alias: string;
  Currency: string;
  DayTradingQualified: boolean;
  OptionApprovalLevel: number;
  Status: string;
  StatusDescription: string;
}

export interface TradeStationBalance {
  AccountID: string;
  AccountType: string;
  CashBalance: number;
  BuyingPower: number;
  Equity: number;
  MarketValue: number;
  TodaysProfitLoss: number;
  UnclearedDeposit: number;
  OptionBuyingPower?: number;
  DayTradingBuyingPower?: number;
  MaintenanceRate?: number;
  Commission?: number;
}

export interface TradeStationPosition {
  AccountID: string;
  AveragePrice: number;
  AssetType: string;
  Last: number;
  Bid: number;
  Ask: number;
  ConversionRate: number;
  DayTradeRequirement: number;
  InitialRequirement: number;
  LongShort: "Long" | "Short";
  MaintenanceRequirement: number;
  MarketValue: number;
  MarkToMarketPrice: number;
  Quantity: number;
  Symbol: string;
  Timestamp: string;
  TodaysProfitLoss: number;
  TotalCost: number;
  UnrealizedProfitLoss: number;
  UnrealizedProfitLossPercent: number;
  UnrealizedProfitLossQty: number;
}

export interface TradeStationOrder {
  OrderID: string;
  AccountID: string;
  Symbol: string;
  Quantity: string;
  FilledQuantity: string;
  RemainingQuantity: string;
  OrderType: string;
  LimitPrice?: string;
  StopPrice?: string;
  Status: string;
  StatusDescription: string;
  Duration: string;
  GoodTillDate?: string;
  Legs: Array<{
    Symbol: string;
    Quantity: string;
    BuyOrSell: string;
    AssetType: string;
  }>;
  ClosedDateTime?: string;
  OpenedDateTime: string;
  FilledPrice?: string;
  CommissionFee?: string;
  UnbundledRouteFee?: string;
}

export interface TradeStationOrderRequest {
  AccountID: string;
  Symbol: string;
  Quantity: string;
  OrderType: "Market" | "Limit" | "StopMarket" | "StopLimit";
  TradeAction: "BUY" | "SELL" | "BUYTOCOVER" | "SELLSHORT";
  TimeInForce: {
    Duration: "DAY" | "GTC" | "GTD" | "IOC" | "FOK" | "OPG" | "CLO";
    Expiration?: string;
  };
  Route?: string;
  LimitPrice?: string;
  StopPrice?: string;
}

export interface TradeStationOrderResponse {
  Orders: Array<{
    OrderID: string;
    Message?: string;
    Error?: string;
  }>;
  Errors?: Array<{
    AccountID: string;
    Error: string;
    Message: string;
  }>;
}

export interface ConnectionHealth {
  connected: boolean;
  authenticated: boolean;
  tokenExpiresAt: Date | null;
  lastRefresh: Date | null;
  accountsLoaded: boolean;
  isSimulation: boolean;
  error?: string;
}

// ============================================================================
// TRADESTATION CLIENT
// ============================================================================

export class TradeStationClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiration: Date | null = null;

  private accounts: TradeStationAccount[] = [];
  private selectedAccountId: string | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private isSimulation: boolean;
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastRefresh: Date | null = null;

  constructor(isSimulation: boolean = true) {
    this.isSimulation = isSimulation;
  }

  /**
   * Get the appropriate API endpoint
   */
  private getApiUrl(): string {
    return this.isSimulation
      ? TRADESTATION_ENDPOINTS.sim
      : TRADESTATION_ENDPOINTS.api;
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${this.getApiUrl()}${endpoint}`;

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

      // Handle token expiration
      if (response.status === 401 && this.refreshToken) {
        console.log("[TradeStation] Token expired, refreshing...");
        const refreshed = await this.refreshAccessToken();
        if (refreshed && retries > 0) {
          return this.apiRequest<T>(endpoint, options, retries - 1);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `TradeStation API error ${response.status}: ${errorText}`
        );
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      clearTimeout(timeout);

      if (
        retries > 0 &&
        error instanceof Error &&
        !error.message.includes("401")
      ) {
        console.log(
          `[TradeStation] Retrying request to ${endpoint}, ${retries} attempts left`
        );
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return this.apiRequest<T>(endpoint, options, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Authenticate with TradeStation using OAuth
   * Note: Initial OAuth flow must be completed via browser redirect
   */
  async authenticate(credentials: TradeStationCredentials): Promise<{
    success: boolean;
    error?: string;
    accounts?: TradeStationAccount[];
    requiresOAuth?: boolean;
    oauthUrl?: string;
  }> {
    try {
      this.clientId = credentials.clientId;
      this.clientSecret = credentials.clientSecret;

      // If we have a refresh token, use it
      if (credentials.refreshToken) {
        this.refreshToken = credentials.refreshToken;
        const refreshed = await this.refreshAccessToken();

        if (!refreshed) {
          return {
            success: false,
            error: "Failed to refresh token. Please re-authenticate.",
            requiresOAuth: true,
            oauthUrl: this.getOAuthUrl(),
          };
        }
      } else if (credentials.accessToken) {
        // Use provided access token directly
        this.accessToken = credentials.accessToken;
        this.tokenExpiration = credentials.tokenExpiration
          ? new Date(credentials.tokenExpiration)
          : new Date(Date.now() + 20 * 60 * 1000); // Default 20 min
      } else {
        // Need to complete OAuth flow
        return {
          success: false,
          error: "OAuth authentication required",
          requiresOAuth: true,
          oauthUrl: this.getOAuthUrl(),
        };
      }

      // Load accounts
      const accounts = await this.getAccounts();
      this.accounts = accounts;

      if (accounts.length > 0) {
        this.selectedAccountId = accounts[0].AccountID;
      }

      // Schedule token refresh
      this.scheduleTokenRefresh();

      console.log(`[TradeStation] Authenticated. Accounts: ${accounts.length}`);

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      console.error("[TradeStation] Authentication failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Get OAuth authorization URL
   */
  getOAuthUrl(): string {
    if (!this.clientId) {
      throw new Error("Client ID not set");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: `${process.env.VITE_APP_URL || "https://stsdashboard.com"}/api/broker/tradestation/callback`,
      scope: "openid profile MarketData ReadAccount Trade",
      audience: "https://api.tradestation.com",
    });

    return `https://signin.tradestation.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(TRADESTATION_ENDPOINTS.auth, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: this.clientId || "",
          client_secret: this.clientSecret || "",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const data: TradeStationTokenResponse = await response.json();

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiration = new Date(Date.now() + data.expires_in * 1000);
      // userId available: data.userid
      this.lastRefresh = new Date();

      this.scheduleTokenRefresh();

      console.log("[TradeStation] Token exchange successful");

      return { success: true };
    } catch (error) {
      console.error("[TradeStation] Token exchange failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Token exchange failed",
      };
    }
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      console.warn("[TradeStation] Cannot refresh: missing credentials");
      return false;
    }

    try {
      const response = await fetch(TRADESTATION_ENDPOINTS.auth, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data: TradeStationTokenResponse = await response.json();

      this.accessToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      this.tokenExpiration = new Date(Date.now() + data.expires_in * 1000);
      this.lastRefresh = new Date();

      this.scheduleTokenRefresh();

      console.log("[TradeStation] Token refreshed successfully");
      return true;
    } catch (error) {
      console.error("[TradeStation] Token refresh failed:", error);
      return false;
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
        await this.refreshAccessToken();
      }, refreshTime);

      console.log(
        `[TradeStation] Token refresh scheduled in ${Math.round(refreshTime / 60000)} minutes`
      );
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
   * Get connection health
   */
  getHealth(): ConnectionHealth {
    return {
      connected: this.accessToken !== null,
      authenticated: this.isAuthenticated(),
      tokenExpiresAt: this.tokenExpiration,
      lastRefresh: this.lastRefresh,
      accountsLoaded: this.accounts.length > 0,
      isSimulation: this.isSimulation,
    };
  }

  /**
   * Get accounts
   */
  async getAccounts(): Promise<TradeStationAccount[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    try {
      const response = await this.apiRequest<{
        Accounts: TradeStationAccount[];
      }>("/brokerage/accounts");

      this.accounts = response.Accounts || [];
      return this.accounts;
    } catch (error) {
      console.error("[TradeStation] Failed to get accounts:", error);
      return [];
    }
  }

  /**
   * Get account balances
   */
  async getBalances(accountIds?: string[]): Promise<TradeStationBalance[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    const ids = accountIds || this.accounts.map(a => a.AccountID);
    if (ids.length === 0) return [];

    try {
      const response = await this.apiRequest<{
        Balances: TradeStationBalance[];
      }>(`/brokerage/accounts/${ids.join(",")}/balances`);

      return response.Balances || [];
    } catch (error) {
      console.error("[TradeStation] Failed to get balances:", error);
      return [];
    }
  }

  /**
   * Get positions
   */
  async getPositions(accountIds?: string[]): Promise<TradeStationPosition[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    const ids = accountIds || this.accounts.map(a => a.AccountID);
    if (ids.length === 0) return [];

    try {
      const response = await this.apiRequest<{
        Positions: TradeStationPosition[];
      }>(`/brokerage/accounts/${ids.join(",")}/positions`);

      return response.Positions || [];
    } catch (error) {
      console.error("[TradeStation] Failed to get positions:", error);
      return [];
    }
  }

  /**
   * Get orders
   */
  async getOrders(accountIds?: string[]): Promise<TradeStationOrder[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    const ids = accountIds || this.accounts.map(a => a.AccountID);
    if (ids.length === 0) return [];

    try {
      const response = await this.apiRequest<{ Orders: TradeStationOrder[] }>(
        `/brokerage/accounts/${ids.join(",")}/orders`
      );

      return response.Orders || [];
    } catch (error) {
      console.error("[TradeStation] Failed to get orders:", error);
      return [];
    }
  }

  /**
   * Place an order
   */
  async placeOrder(order: TradeStationOrderRequest): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
  }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      console.log(
        `[TradeStation] Placing order: ${order.TradeAction} ${order.Quantity} ${order.Symbol}`
      );

      const response = await this.apiRequest<TradeStationOrderResponse>(
        "/orderexecution/orders",
        {
          method: "POST",
          body: JSON.stringify(order),
        }
      );

      if (response.Errors && response.Errors.length > 0) {
        const error = response.Errors[0];
        console.error(`[TradeStation] Order rejected: ${error.Message}`);
        return {
          success: false,
          error: error.Message,
        };
      }

      if (response.Orders && response.Orders.length > 0) {
        const orderResult = response.Orders[0];

        if (orderResult.Error) {
          return {
            success: false,
            error: orderResult.Error,
          };
        }

        console.log(`[TradeStation] Order placed: ${orderResult.OrderID}`);
        return {
          success: true,
          orderId: orderResult.OrderID,
        };
      }

      return { success: false, error: "Unknown error" };
    } catch (error) {
      console.error("[TradeStation] Order placement failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Order failed",
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    orderId: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated()) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await this.apiRequest(`/orderexecution/orders/${orderId}`, {
        method: "DELETE",
      });

      console.log(`[TradeStation] Order ${orderId} cancelled`);
      return { success: true };
    } catch (error) {
      console.error("[TradeStation] Cancel order failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cancel failed",
      };
    }
  }

  /**
   * Get refresh token for storage
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
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
    this.refreshToken = null;
    this.tokenExpiration = null;
    // userId cleared
    this.accounts = [];
    this.selectedAccountId = null;

    console.log("[TradeStation] Disconnected");
  }

  /**
   * Get selected account
   */
  getSelectedAccount(): TradeStationAccount | null {
    return (
      this.accounts.find(a => a.AccountID === this.selectedAccountId) || null
    );
  }

  /**
   * Set selected account
   */
  setSelectedAccount(accountId: string): boolean {
    const account = this.accounts.find(a => a.AccountID === accountId);
    if (account) {
      this.selectedAccountId = accountId;
      return true;
    }
    return false;
  }
}

// ============================================================================
// FUTURES SYMBOL MAPPING
// ============================================================================

export const TRADESTATION_FUTURES: Record<
  string,
  { symbol: string; exchange: string; multiplier: number }
> = {
  ES: { symbol: "@ES", exchange: "CME", multiplier: 50 },
  MES: { symbol: "@MES", exchange: "CME", multiplier: 5 },
  NQ: { symbol: "@NQ", exchange: "CME", multiplier: 20 },
  MNQ: { symbol: "@MNQ", exchange: "CME", multiplier: 2 },
  CL: { symbol: "@CL", exchange: "NYMEX", multiplier: 1000 },
  MCL: { symbol: "@MCL", exchange: "NYMEX", multiplier: 100 },
  GC: { symbol: "@GC", exchange: "COMEX", multiplier: 100 },
  MGC: { symbol: "@MGC", exchange: "COMEX", multiplier: 10 },
  YM: { symbol: "@YM", exchange: "CBOT", multiplier: 5 },
  MYM: { symbol: "@MYM", exchange: "CBOT", multiplier: 0.5 },
};

// ============================================================================
// SINGLETON INSTANCE MANAGEMENT
// ============================================================================

const clientInstances = new Map<string, TradeStationClient>();

export function getTradeStationClient(
  userId: number,
  isSimulation: boolean = true
): TradeStationClient {
  const key = `${userId}-${isSimulation ? "sim" : "live"}`;

  if (!clientInstances.has(key)) {
    clientInstances.set(key, new TradeStationClient(isSimulation));
  }

  return clientInstances.get(key)!;
}

export function disconnectTradeStationClient(
  userId: number,
  isSimulation: boolean = true
): void {
  const key = `${userId}-${isSimulation ? "sim" : "live"}`;
  const client = clientInstances.get(key);

  if (client) {
    client.disconnect();
    clientInstances.delete(key);
  }
}
