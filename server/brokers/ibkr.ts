/**
 * Interactive Brokers (IBKR) Client Portal Gateway Integration
 *
 * This module provides integration with IBKR's Client Portal Gateway API.
 * The gateway must be running locally or on a server accessible to this application.
 *
 * Setup Requirements:
 * 1. Download Client Portal Gateway from IBKR
 * 2. Run the gateway (java -jar clientportal.gw.jar)
 * 3. Login via browser at https://localhost:5000
 * 4. Gateway maintains session for API access
 *
 * API Documentation: https://www.interactivebrokers.com/api/doc.html
 */

import { IBKRCredentials } from "../encryption";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_GATEWAY_HOST = "localhost:5000";
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const HEALTH_CHECK_INTERVAL_MS = 60000; // Check every minute

// ============================================================================
// TYPES
// ============================================================================

export interface IBKRAccount {
  id: string;
  accountId: string;
  accountVan: string;
  accountTitle: string;
  displayName: string;
  accountAlias: string | null;
  accountStatus: number;
  currency: string;
  type: string;
  tradingType: string;
  faclient: boolean;
  clearingStatus: string;
  covestor: boolean;
  parent: {
    mmc: string[];
    accountId: string;
    isMParent: boolean;
    isMChild: boolean;
    isMultiplex: boolean;
  };
  desc: string;
}

export interface IBKRPosition {
  acctId: string;
  conid: number;
  contractDesc: string;
  position: number;
  mktPrice: number;
  mktValue: number;
  currency: string;
  avgCost: number;
  avgPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  exchs: string | null;
  expiry: string | null;
  putOrCall: string | null;
  multiplier: number;
  strike: number;
  exerciseStyle: string | null;
  conExchMap: string[];
  assetClass: string;
  undConid: number;
}

export interface IBKROrder {
  acct: string;
  conid: number;
  orderDesc: string;
  description1: string;
  ticker: string;
  secType: string;
  listingExchange: string;
  remainingQuantity: number;
  filledQuantity: number;
  companyName: string;
  status: string;
  origOrderType: string;
  supportsTaxOpt: string;
  lastExecutionTime: string;
  orderType: string;
  order_ref: string;
  side: string;
  timeInForce: string;
  price: number;
  bgColor: string;
  fgColor: string;
}

export interface IBKROrderRequest {
  acctId: string;
  conid: number;
  secType: string;
  cOID?: string;
  parentId?: string;
  orderType: "MKT" | "LMT" | "STP" | "STP_LIMIT" | "MIDPRICE";
  listingExchange?: string;
  isSingleGroup?: boolean;
  outsideRTH?: boolean;
  price?: number;
  auxPrice?: number;
  side: "BUY" | "SELL";
  ticker: string;
  tif: "GTC" | "OPG" | "DAY" | "IOC";
  referrer?: string;
  quantity: number;
  useAdaptive?: boolean;
}

export interface IBKROrderResponse {
  order_id: string;
  order_status: string;
  encrypt_message?: string;
  local_order_id?: string;
}

export interface ConnectionHealth {
  gatewayRunning: boolean;
  authenticated: boolean;
  competing: boolean;
  connected: boolean;
  message: string;
  serverName: string;
  serverVersion: string;
  lastCheck: Date;
  accounts: string[];
}

// ============================================================================
// IBKR CLIENT
// ============================================================================

export class IBKRClient {
  private gatewayHost: string;
  private authenticated: boolean = false;
  private accounts: IBKRAccount[] = [];
  private selectedAccountId: string | null = null;

  private healthCheckTimer: NodeJS.Timeout | null = null;
  private health: ConnectionHealth | null = null;

  constructor(gatewayHost: string = DEFAULT_GATEWAY_HOST) {
    this.gatewayHost = gatewayHost;
  }

  /**
   * Get the gateway base URL
   */
  private getBaseUrl(): string {
    return `https://${this.gatewayHost}/v1/api`;
  }

  /**
   * Make an API request to the gateway
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${this.getBaseUrl()}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
        // IBKR gateway uses self-signed certs in dev
        // @ts-ignore - Node.js specific option
        rejectUnauthorized: false,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IBKR API error ${response.status}: ${errorText}`);
      }

      const text = await response.text();
      return text ? JSON.parse(text) : ({} as T);
    } catch (error) {
      clearTimeout(timeout);

      if (retries > 0 && error instanceof Error) {
        // Don't retry auth errors
        if (error.message.includes("401") || error.message.includes("403")) {
          throw error;
        }

        console.log(
          `[IBKR] Retrying request to ${endpoint}, ${retries} attempts left`
        );
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        return this.apiRequest<T>(endpoint, options, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Check gateway authentication status
   */
  async checkAuthStatus(): Promise<{
    authenticated: boolean;
    competing: boolean;
    connected: boolean;
    message: string;
    serverName?: string;
    serverVersion?: string;
  }> {
    try {
      const response = await this.apiRequest<{
        authenticated: boolean;
        competing: boolean;
        connected: boolean;
        message: string;
        MAC?: string;
        serverInfo?: {
          serverName: string;
          serverVersion: string;
        };
      }>("/iserver/auth/status", { method: "POST" });

      return {
        authenticated: response.authenticated,
        competing: response.competing,
        connected: response.connected,
        message: response.message,
        serverName: response.serverInfo?.serverName,
        serverVersion: response.serverInfo?.serverVersion,
      };
    } catch (error) {
      console.error("[IBKR] Auth status check failed:", error);
      return {
        authenticated: false,
        competing: false,
        connected: false,
        message:
          error instanceof Error ? error.message : "Gateway not reachable",
      };
    }
  }

  /**
   * Initialize connection to IBKR gateway
   * Note: User must have already logged into the gateway via browser
   */
  async connect(credentials: IBKRCredentials): Promise<{
    success: boolean;
    error?: string;
    accounts?: IBKRAccount[];
  }> {
    try {
      // Update gateway host if provided
      if (credentials.gatewayHost) {
        this.gatewayHost = credentials.gatewayHost;
      }

      console.log(`[IBKR] Connecting to gateway at ${this.gatewayHost}`);

      // Check authentication status
      const authStatus = await this.checkAuthStatus();

      if (!authStatus.authenticated) {
        return {
          success: false,
          error: `Gateway not authenticated. Please login at https://${this.gatewayHost}. Status: ${authStatus.message}`,
        };
      }

      if (authStatus.competing) {
        console.warn("[IBKR] Competing session detected");
      }

      this.authenticated = true;

      // Get accounts
      const accounts = await this.getAccounts();
      this.accounts = accounts;

      // Select account if specified
      if (credentials.accountId) {
        const account = accounts.find(
          a => a.accountId === credentials.accountId
        );
        if (account) {
          this.selectedAccountId = account.accountId;
        } else {
          console.warn(
            `[IBKR] Specified account ${credentials.accountId} not found`
          );
        }
      } else if (accounts.length > 0) {
        this.selectedAccountId = accounts[0].accountId;
      }

      // Start health check timer
      this.startHealthCheck();

      console.log(
        `[IBKR] Connected successfully. Accounts: ${accounts.length}`
      );

      return {
        success: true,
        accounts,
      };
    } catch (error) {
      console.error("[IBKR] Connection failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const authStatus = await this.checkAuthStatus();

      this.health = {
        gatewayRunning: true,
        authenticated: authStatus.authenticated,
        competing: authStatus.competing,
        connected: authStatus.connected,
        message: authStatus.message,
        serverName: authStatus.serverName || "",
        serverVersion: authStatus.serverVersion || "",
        lastCheck: new Date(),
        accounts: this.accounts.map(a => a.accountId),
      };

      this.authenticated = authStatus.authenticated;

      // Tickle the session to keep it alive
      if (this.authenticated) {
        await this.apiRequest("/tickle", { method: "POST" }).catch(() => {});
      }
    } catch (error) {
      this.health = {
        gatewayRunning: false,
        authenticated: false,
        competing: false,
        connected: false,
        message: error instanceof Error ? error.message : "Health check failed",
        serverName: "",
        serverVersion: "",
        lastCheck: new Date(),
        accounts: [],
      };
      this.authenticated = false;
    }
  }

  /**
   * Get connection health
   */
  getHealth(): ConnectionHealth | null {
    return this.health;
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.authenticated;
  }

  /**
   * Get accounts
   */
  async getAccounts(): Promise<IBKRAccount[]> {
    try {
      const response = await this.apiRequest<{ accounts: string[] }>(
        "/portfolio/accounts"
      );

      // Get detailed account info
      const accounts: IBKRAccount[] = [];
      for (const accountId of response.accounts || []) {
        try {
          const accountInfo = await this.apiRequest<IBKRAccount>(
            `/portfolio/${accountId}/meta`
          );
          accounts.push(accountInfo);
        } catch {
          // Create basic account object if meta fails
          accounts.push({
            id: accountId,
            accountId,
            accountVan: accountId,
            accountTitle: accountId,
            displayName: accountId,
            accountAlias: null,
            accountStatus: 1,
            currency: "USD",
            type: "INDIVIDUAL",
            tradingType: "STKNOPT",
            faclient: false,
            clearingStatus: "O",
            covestor: false,
            parent: {
              mmc: [],
              accountId: "",
              isMParent: false,
              isMChild: false,
              isMultiplex: false,
            },
            desc: accountId,
          });
        }
      }

      this.accounts = accounts;
      return accounts;
    } catch (error) {
      console.error("[IBKR] Failed to get accounts:", error);
      return [];
    }
  }

  /**
   * Get positions for an account
   */
  async getPositions(accountId?: string): Promise<IBKRPosition[]> {
    const acctId = accountId || this.selectedAccountId;
    if (!acctId) {
      console.warn("[IBKR] No account selected");
      return [];
    }

    try {
      const response = await this.apiRequest<{ [key: string]: IBKRPosition[] }>(
        `/portfolio/${acctId}/positions/0`
      );

      return Object.values(response).flat();
    } catch (error) {
      console.error("[IBKR] Failed to get positions:", error);
      return [];
    }
  }

  /**
   * Get open orders
   */
  async getOrders(): Promise<IBKROrder[]> {
    try {
      const response = await this.apiRequest<{ orders: IBKROrder[] }>(
        "/iserver/account/orders"
      );

      return response.orders || [];
    } catch (error) {
      console.error("[IBKR] Failed to get orders:", error);
      return [];
    }
  }

  /**
   * Search for a contract by symbol
   */
  async searchContract(symbol: string): Promise<{
    conid: number;
    symbol: string;
    secType: string;
    exchange: string;
  } | null> {
    try {
      const response = await this.apiRequest<
        Array<{
          conid: number;
          symbol: string;
          secType: string;
          listingExchange: string;
          description: string;
        }>
      >(
        `/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}&secType=FUT`
      );

      if (response.length > 0) {
        return {
          conid: response[0].conid,
          symbol: response[0].symbol,
          secType: response[0].secType,
          exchange: response[0].listingExchange,
        };
      }

      return null;
    } catch (error) {
      console.error("[IBKR] Contract search failed:", error);
      return null;
    }
  }

  /**
   * Place an order
   */
  async placeOrder(order: IBKROrderRequest): Promise<{
    success: boolean;
    orderId?: string;
    orderStatus?: string;
    error?: string;
    requiresConfirmation?: boolean;
    confirmationMessage?: string;
  }> {
    if (!this.authenticated) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      console.log(
        `[IBKR] Placing order: ${order.side} ${order.quantity} ${order.ticker}`
      );

      // Place the order
      const response = await this.apiRequest<IBKROrderResponse[]>(
        `/iserver/account/${order.acctId}/orders`,
        {
          method: "POST",
          body: JSON.stringify({ orders: [order] }),
        }
      );

      if (!response || response.length === 0) {
        return { success: false, error: "No response from order placement" };
      }

      const orderResponse = response[0];

      // Check if order requires confirmation (common for futures)
      if (orderResponse.encrypt_message) {
        return {
          success: false,
          requiresConfirmation: true,
          confirmationMessage: orderResponse.encrypt_message,
        };
      }

      console.log(
        `[IBKR] Order placed: ${orderResponse.order_id}, Status: ${orderResponse.order_status}`
      );

      return {
        success: true,
        orderId: orderResponse.order_id,
        orderStatus: orderResponse.order_status,
      };
    } catch (error) {
      console.error("[IBKR] Order placement failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Order failed",
      };
    }
  }

  /**
   * Confirm an order that requires confirmation
   */
  async confirmOrder(
    orderId: string,
    confirmed: boolean = true
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.apiRequest(`/iserver/reply/${orderId}`, {
        method: "POST",
        body: JSON.stringify({ confirmed }),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Confirmation failed",
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(
    accountId: string,
    orderId: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.apiRequest(`/iserver/account/${accountId}/order/${orderId}`, {
        method: "DELETE",
      });

      console.log(`[IBKR] Order ${orderId} cancelled`);
      return { success: true };
    } catch (error) {
      console.error("[IBKR] Cancel order failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cancel failed",
      };
    }
  }

  /**
   * Get account balance/summary
   */
  async getAccountSummary(accountId?: string): Promise<{
    netLiquidation: number;
    totalCashValue: number;
    buyingPower: number;
    grossPositionValue: number;
    maintMarginReq: number;
    availableFunds: number;
  } | null> {
    const acctId = accountId || this.selectedAccountId;
    if (!acctId) return null;

    try {
      const response = await this.apiRequest<{
        [key: string]: { amount: number };
      }>(`/portfolio/${acctId}/summary`);

      return {
        netLiquidation: response.netliquidation?.amount || 0,
        totalCashValue: response.totalcashvalue?.amount || 0,
        buyingPower: response.buyingpower?.amount || 0,
        grossPositionValue: response.grosspositionvalue?.amount || 0,
        maintMarginReq: response.maintmarginreq?.amount || 0,
        availableFunds: response.availablefunds?.amount || 0,
      };
    } catch (error) {
      console.error("[IBKR] Failed to get account summary:", error);
      return null;
    }
  }

  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.authenticated = false;
    this.accounts = [];
    this.selectedAccountId = null;
    this.health = null;

    console.log("[IBKR] Disconnected");
  }

  /**
   * Get selected account
   */
  getSelectedAccount(): IBKRAccount | null {
    return (
      this.accounts.find(a => a.accountId === this.selectedAccountId) || null
    );
  }

  /**
   * Set selected account
   */
  setSelectedAccount(accountId: string): boolean {
    const account = this.accounts.find(a => a.accountId === accountId);
    if (account) {
      this.selectedAccountId = accountId;
      return true;
    }
    return false;
  }
}

// ============================================================================
// FUTURES CONTRACT MAPPING
// ============================================================================

export const IBKR_FUTURES_CONTRACTS: Record<
  string,
  { symbol: string; exchange: string; multiplier: number }
> = {
  ES: { symbol: "ES", exchange: "CME", multiplier: 50 },
  MES: { symbol: "MES", exchange: "CME", multiplier: 5 },
  NQ: { symbol: "NQ", exchange: "CME", multiplier: 20 },
  MNQ: { symbol: "MNQ", exchange: "CME", multiplier: 2 },
  CL: { symbol: "CL", exchange: "NYMEX", multiplier: 1000 },
  MCL: { symbol: "MCL", exchange: "NYMEX", multiplier: 100 },
  GC: { symbol: "GC", exchange: "COMEX", multiplier: 100 },
  MGC: { symbol: "MGC", exchange: "COMEX", multiplier: 10 },
  YM: { symbol: "YM", exchange: "CBOT", multiplier: 5 },
  MYM: { symbol: "MYM", exchange: "CBOT", multiplier: 0.5 },
};

// ============================================================================
// SINGLETON INSTANCE MANAGEMENT
// ============================================================================

const clientInstances = new Map<string, IBKRClient>();

export function getIBKRClient(
  userId: number,
  gatewayHost?: string
): IBKRClient {
  const key = `${userId}`;

  if (!clientInstances.has(key)) {
    clientInstances.set(key, new IBKRClient(gatewayHost));
  }

  return clientInstances.get(key)!;
}

export function disconnectIBKRClient(userId: number): void {
  const key = `${userId}`;
  const client = clientInstances.get(key);

  if (client) {
    client.disconnect();
    clientInstances.delete(key);
  }
}
