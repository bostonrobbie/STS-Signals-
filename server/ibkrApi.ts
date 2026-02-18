/**
 * Interactive Brokers (IBKR) API Service
 * 
 * Implementation for IBKR broker integration using Client Portal API
 * Note: IBKR requires more complex OAuth setup for third-party apps
 * This implementation supports direct credential-based access
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

// IBKR Client Portal API endpoints
const IBKR_GATEWAY_URL = 'https://localhost:5000/v1/api'; // Local gateway
const IBKR_PAPER_URL = 'https://localhost:5000/v1/api'; // Paper trading

// For production third-party access (requires OAuth registration)
const IBKR_API_URL = 'https://api.ibkr.com/v1/api';

// ============================================================================
// TYPES
// ============================================================================

export interface IBKRCredentials {
  username: string;
  password?: string;
  // For OAuth flow
  accessToken?: string;
  refreshToken?: string;
  // For API key access
  apiKey?: string;
  apiSecret?: string;
  // Account settings
  accountId?: string;
  isPaper?: boolean; // true for paper trading
}

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
  model: string;
  time: number;
  chineseName: string | null;
  allExchanges: string;
  listingExchange: string;
  countryCode: string;
  name: string;
  lastTradingDay: string | null;
  group: string | null;
  sector: string | null;
  sectorGroup: string | null;
  ticker: string;
  type: string;
  undComp: string;
  undSym: string;
  fullName: string;
  pageSize: number;
}

export interface IBKROrderRequest {
  acctId: string;
  conid: number;
  secType?: string; // 'STK', 'FUT', 'OPT', etc.
  cOID?: string; // Client Order ID
  orderType: 'MKT' | 'LMT' | 'STP' | 'STP_LIMIT' | 'MIDPRICE';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number; // For limit orders
  auxPrice?: number; // For stop orders
  tif?: 'GTC' | 'OPG' | 'DAY' | 'IOC';
  outsideRTH?: boolean;
  listingExchange?: string;
}

export interface IBKROrderResponse {
  order_id: string;
  order_status: string;
  encrypt_message?: string;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ENCRYPTION_KEY = process.env.BROKER_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptIBKRCredentials(credentials: IBKRCredentials): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  });
}

export function decryptIBKRCredentials(encryptedData: string): IBKRCredentials {
  const { iv, encrypted, authTag } = JSON.parse(encryptedData);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// ============================================================================
// IBKR API CLIENT
// ============================================================================

export class IBKRApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private accountId: string | null = null;
  private sessionValid: boolean = false;
  
  constructor(isPaper: boolean = true) {
    // For now, use local gateway URL
    // In production, would use IBKR_API_URL with OAuth
    this.baseUrl = isPaper ? IBKR_PAPER_URL : IBKR_GATEWAY_URL;
  }
  
  /**
   * Authenticate with IBKR
   * 
   * Note: IBKR authentication is complex:
   * - For local gateway: User runs gateway and authenticates there
   * - For OAuth: Requires third-party app registration with IBKR
   * 
   * This implementation supports credential storage for when
   * the gateway is running locally
   */
  async authenticate(credentials: IBKRCredentials): Promise<{
    success: boolean;
    error?: string;
    accounts?: IBKRAccount[];
  }> {
    try {
      // Store credentials for potential re-authentication
      this.accountId = credentials.accountId || null;
      
      // If using OAuth token
      if (credentials.accessToken) {
        this.accessToken = credentials.accessToken;
        this.baseUrl = IBKR_API_URL;
      }
      
      // Try to validate the session by getting accounts
      const accounts = await this.getAccounts();
      
      if (accounts && accounts.length > 0) {
        this.sessionValid = true;
        if (!this.accountId) {
          this.accountId = accounts[0].accountId;
        }
        return { success: true, accounts };
      }
      
      return { 
        success: false, 
        error: 'Could not connect to IBKR. Please ensure the Client Portal Gateway is running and authenticated.' 
      };
    } catch (error) {
      console.error('[IBKR] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }
  
  /**
   * Check if session is valid
   */
  isAuthenticated(): boolean {
    return this.sessionValid;
  }
  
  /**
   * Make API request to IBKR
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body?: object
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    
    const options: RequestInit = {
      method,
      headers,
      // IBKR gateway uses self-signed certs in development
      // @ts-ignore - Node.js specific option
      rejectUnauthorized: false,
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`IBKR API request failed: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get all accounts
   */
  async getAccounts(): Promise<IBKRAccount[]> {
    try {
      const result = await this.apiRequest<{ accounts: string[] }>('GET', '/portfolio/accounts');
      
      // Get detailed account info
      const accounts: IBKRAccount[] = [];
      for (const accountId of result.accounts || []) {
        try {
          const accountInfo = await this.apiRequest<IBKRAccount>(
            'GET', 
            `/portfolio/${accountId}/meta`
          );
          accounts.push(accountInfo);
        } catch {
          // Account meta might not be available
          accounts.push({
            id: accountId,
            accountId,
            accountVan: accountId,
            accountTitle: accountId,
            displayName: accountId,
            accountAlias: null,
            accountStatus: 1,
            currency: 'USD',
            type: 'INDIVIDUAL',
            tradingType: 'STKNOPT',
            faclient: false,
            clearingStatus: 'O',
            covestor: false,
            parent: {
              mmc: [],
              accountId: '',
              isMParent: false,
              isMChild: false,
              isMultiplex: false,
            },
            desc: accountId,
          });
        }
      }
      
      return accounts;
    } catch (error) {
      console.error('[IBKR] Failed to get accounts:', error);
      return [];
    }
  }
  
  /**
   * Get positions for an account
   */
  async getPositions(accountId?: string): Promise<IBKRPosition[]> {
    const acctId = accountId || this.accountId;
    if (!acctId) throw new Error('No account ID specified');
    
    return this.apiRequest<IBKRPosition[]>('GET', `/portfolio/${acctId}/positions/0`);
  }
  
  /**
   * Search for a contract by symbol
   */
  async searchContract(symbol: string, secType: string = 'FUT'): Promise<{
    conid: number;
    symbol: string;
    secType: string;
    exchange: string;
  } | null> {
    try {
      const results = await this.apiRequest<any[]>(
        'GET',
        `/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}&secType=${secType}`
      );
      
      if (results && results.length > 0) {
        return {
          conid: results[0].conid,
          symbol: results[0].symbol,
          secType: results[0].secType,
          exchange: results[0].exchange,
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Place an order
   */
  async placeOrder(order: IBKROrderRequest): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
    requiresConfirmation?: boolean;
    confirmationId?: string;
  }> {
    try {
      const acctId = order.acctId || this.accountId;
      if (!acctId) {
        return { success: false, error: 'No account ID specified' };
      }
      
      const orderPayload = {
        orders: [{
          acctId,
          conid: order.conid,
          secType: order.secType || 'FUT',
          cOID: order.cOID || `IDS_${Date.now()}`,
          orderType: order.orderType,
          side: order.side,
          quantity: order.quantity,
          price: order.price,
          auxPrice: order.auxPrice,
          tif: order.tif || 'DAY',
          outsideRTH: order.outsideRTH || false,
          listingExchange: order.listingExchange,
        }],
      };
      
      const result = await this.apiRequest<IBKROrderResponse[]>(
        'POST',
        `/iserver/account/${acctId}/orders`,
        orderPayload
      );
      
      if (result && result.length > 0) {
        const orderResult = result[0];
        
        // Check if order requires confirmation (IBKR precautionary messages)
        if (orderResult.encrypt_message) {
          return {
            success: false,
            requiresConfirmation: true,
            confirmationId: orderResult.order_id,
            error: 'Order requires confirmation',
          };
        }
        
        return {
          success: true,
          orderId: orderResult.order_id,
        };
      }
      
      return { success: false, error: 'No response from IBKR' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order placement failed',
      };
    }
  }
  
  /**
   * Confirm an order (for orders that require confirmation)
   */
  async confirmOrder(orderId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const acctId = this.accountId;
      if (!acctId) {
        return { success: false, error: 'No account ID specified' };
      }
      
      await this.apiRequest(
        'POST',
        `/iserver/reply/${orderId}`,
        { confirmed: true }
      );
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order confirmation failed',
      };
    }
  }
  
  /**
   * Place a market order (simplified)
   */
  async placeMarketOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    secType: string = 'FUT'
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // First, find the contract
    const contract = await this.searchContract(symbol, secType);
    if (!contract) {
      return { success: false, error: `Contract not found: ${symbol}` };
    }
    
    return this.placeOrder({
      acctId: this.accountId || '',
      conid: contract.conid,
      secType,
      orderType: 'MKT',
      side,
      quantity,
      tif: 'DAY',
    });
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const acctId = this.accountId;
      if (!acctId) {
        return { success: false, error: 'No account ID specified' };
      }
      
      await this.apiRequest('DELETE', `/iserver/account/${acctId}/order/${orderId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order cancellation failed',
      };
    }
  }
  
  /**
   * Get order status
   */
  async getOrderStatus(orderId: string): Promise<{
    status: string;
    fillPrice?: number;
    fillQty?: number;
  }> {
    try {
      const orders = await this.apiRequest<any[]>('GET', '/iserver/account/orders');
      const order = orders?.find(o => o.orderId === orderId);
      
      if (order) {
        return {
          status: order.status,
          fillPrice: order.avgPrice,
          fillQty: order.filledQuantity,
        };
      }
      
      return { status: 'unknown' };
    } catch {
      return { status: 'unknown' };
    }
  }
  
  /**
   * Disconnect
   */
  disconnect(): void {
    this.accessToken = null;
    this.accountId = null;
    // Clear stored state
    this.sessionValid = false;
  }
  
  /**
   * Keep session alive (IBKR requires periodic tickle)
   */
  async tickle(): Promise<boolean> {
    try {
      await this.apiRequest('POST', '/tickle');
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// SYMBOL MAPPING FOR IBKR
// ============================================================================

/**
 * Map our strategy symbols to IBKR contract symbols
 */
export const IBKR_SYMBOL_MAP: Record<string, { symbol: string; secType: string; exchange: string }> = {
  'ES': { symbol: 'ES', secType: 'FUT', exchange: 'CME' },
  'NQ': { symbol: 'NQ', secType: 'FUT', exchange: 'CME' },
  'CL': { symbol: 'CL', secType: 'FUT', exchange: 'NYMEX' },
  'GC': { symbol: 'GC', secType: 'FUT', exchange: 'COMEX' },
  'YM': { symbol: 'YM', secType: 'FUT', exchange: 'CBOT' },
  'BTC': { symbol: 'BRR', secType: 'FUT', exchange: 'CME' }, // Bitcoin futures
};

/**
 * Get IBKR symbol info for a market
 */
export function getIBKRSymbol(market: string): { symbol: string; secType: string; exchange: string } | null {
  return IBKR_SYMBOL_MAP[market] || null;
}
