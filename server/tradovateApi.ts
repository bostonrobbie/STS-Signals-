/**
 * Tradovate API Service
 * 
 * Complete implementation for Tradovate broker integration
 * Handles authentication, order placement, and account management
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TRADOVATE_DEMO_URL = 'https://demo.tradovateapi.com/v1';
const TRADOVATE_LIVE_URL = 'https://live.tradovateapi.com/v1';

// Default app credentials (users will use their own Tradovate credentials)
const DEFAULT_APP_ID = 'IntraDayStrategies';
const DEFAULT_APP_VERSION = '1.0';
const DEFAULT_CID = 8; // Client ID for API access
const DEFAULT_SEC = 'f03741b6-f634-48d6-9308-c8fb871150c2'; // Public secret for demo

// ============================================================================
// TYPES
// ============================================================================

export interface TradovateCredentials {
  username: string;
  password: string;
  isLive?: boolean; // true for live trading, false for demo
}

export interface TradovateAuthResponse {
  accessToken: string;
  expirationTime: string;
  userId: number;
  name: string;
  passwordExpirationTime?: string;
  errorText?: string;
  p_ticket?: string; // For 2FA
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

export interface TradovateContract {
  id: number;
  name: string;
  contractMaturityId: number;
  status: string;
  providerTickSize: number;
}

export interface TradovateOrderRequest {
  accountSpec: string; // Account name
  accountId: number;
  action: 'Buy' | 'Sell';
  symbol: string;
  orderQty: number;
  orderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit' | 'TrailingStop' | 'MIT';
  price?: number; // For limit orders
  stopPrice?: number; // For stop orders
  timeInForce?: 'Day' | 'GTC' | 'IOC' | 'FOK' | 'GTD' | 'OPG';
  isAutomated?: boolean;
  customTag50?: string; // Custom identifier
}

export interface TradovateOrderResponse {
  orderId: number;
  accountId: number;
  contractId: number;
  timestamp: string;
  action: string;
  ordStatus: string;
  executionProviderId: number;
  ocoId?: number;
  parentId?: number;
  linkedId?: number;
  admin: boolean;
}

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const ENCRYPTION_KEY = process.env.BROKER_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptCredentials(credentials: TradovateCredentials): string {
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

export function decryptCredentials(encryptedData: string): TradovateCredentials {
  const { iv, encrypted, authTag } = JSON.parse(encryptedData);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

// ============================================================================
// TRADOVATE API CLIENT
// ============================================================================

export class TradovateApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private userId: number | null = null;
  private credentials: TradovateCredentials | null = null;
  
  constructor(isLive: boolean = false) {
    this.baseUrl = isLive ? TRADOVATE_LIVE_URL : TRADOVATE_DEMO_URL;
  }
  
  /**
   * Generate a unique device ID for this user session
   */
  private generateDeviceId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Authenticate with Tradovate API
   */
  async authenticate(credentials: TradovateCredentials): Promise<{
    success: boolean;
    error?: string;
    userId?: number;
    requires2FA?: boolean;
    p_ticket?: string;
  }> {
    try {
      const body = {
        name: credentials.username,
        password: credentials.password,
        appId: DEFAULT_APP_ID,
        appVersion: DEFAULT_APP_VERSION,
        cid: DEFAULT_CID,
        sec: DEFAULT_SEC,
        deviceId: this.generateDeviceId(),
      };
      
      const response = await fetch(`${this.baseUrl}/auth/accesstokenrequest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      const data: TradovateAuthResponse = await response.json();
      
      // Check for 2FA requirement
      if (data.p_ticket) {
        return {
          success: false,
          requires2FA: true,
          p_ticket: data.p_ticket,
          error: 'Two-factor authentication required',
        };
      }
      
      // Check for errors
      if (data.errorText) {
        return {
          success: false,
          error: data.errorText,
        };
      }
      
      // Store authentication data
      this.accessToken = data.accessToken;
      this.tokenExpiry = new Date(data.expirationTime);
      this.userId = data.userId;
      this.credentials = credentials;
      
      return {
        success: true,
        userId: data.userId,
      };
    } catch (error) {
      console.error('[Tradovate] Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }
  
  /**
   * Complete 2FA authentication
   */
  async complete2FA(p_ticket: string, code: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/oauthtoken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          p_ticket,
          code,
        }),
      });
      
      const data: TradovateAuthResponse = await response.json();
      
      if (data.errorText) {
        return { success: false, error: data.errorText };
      }
      
      this.accessToken = data.accessToken;
      this.tokenExpiry = new Date(data.expirationTime);
      this.userId = data.userId;
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '2FA verification failed',
      };
    }
  }
  
  /**
   * Check if token is still valid
   */
  isAuthenticated(): boolean {
    if (!this.accessToken || !this.tokenExpiry) return false;
    return new Date() < this.tokenExpiry;
  }
  
  /**
   * Get the authenticated user's ID
   */
  getUserId(): number | null {
    return this.userId;
  }
  
  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    
    if (this.credentials) {
      const result = await this.authenticate(this.credentials);
      return result.success;
    }
    
    return false;
  }
  
  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: object
  ): Promise<T> {
    if (!await this.refreshTokenIfNeeded()) {
      throw new Error('Not authenticated');
    }
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get all accounts for the authenticated user
   */
  async getAccounts(): Promise<TradovateAccount[]> {
    return this.apiRequest<TradovateAccount[]>('GET', '/account/list');
  }
  
  /**
   * Get positions for an account
   */
  async getPositions(accountId: number): Promise<TradovatePosition[]> {
    return this.apiRequest<TradovatePosition[]>('GET', `/position/list?accountId=${accountId}`);
  }
  
  /**
   * Find a contract by symbol
   */
  async findContract(symbol: string): Promise<TradovateContract | null> {
    try {
      const result = await this.apiRequest<TradovateContract>('GET', `/contract/find?name=${symbol}`);
      return result;
    } catch {
      return null;
    }
  }
  
  /**
   * Place an order
   */
  async placeOrder(order: TradovateOrderRequest): Promise<{
    success: boolean;
    orderId?: number;
    error?: string;
  }> {
    try {
      const result = await this.apiRequest<TradovateOrderResponse>('POST', '/order/placeorder', order);
      
      return {
        success: true,
        orderId: result.orderId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Order placement failed',
      };
    }
  }
  
  /**
   * Place a market order (simplified)
   */
  async placeMarketOrder(
    accountId: number,
    accountSpec: string,
    symbol: string,
    action: 'Buy' | 'Sell',
    quantity: number
  ): Promise<{ success: boolean; orderId?: number; error?: string }> {
    return this.placeOrder({
      accountId,
      accountSpec,
      symbol,
      action,
      orderQty: quantity,
      orderType: 'Market',
      timeInForce: 'Day',
      isAutomated: true,
      customTag50: 'IntraDayStrategies',
    });
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.apiRequest('POST', '/order/cancelorder', { orderId });
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
  async getOrderStatus(orderId: number): Promise<{
    status: string;
    fillPrice?: number;
    fillQty?: number;
  }> {
    try {
      const result = await this.apiRequest<any>('GET', `/order/item?id=${orderId}`);
      return {
        status: result.ordStatus,
        fillPrice: result.avgPx,
        fillQty: result.cumQty,
      };
    } catch {
      return { status: 'unknown' };
    }
  }
  
  /**
   * Disconnect and clear credentials
   */
  disconnect(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.userId = null;
    this.credentials = null;
  }
}

// ============================================================================
// SYMBOL MAPPING
// ============================================================================

/**
 * Map our strategy symbols to Tradovate contract symbols
 */
export const SYMBOL_MAP: Record<string, string> = {
  'ES': 'ESZ4', // E-mini S&P 500 (update expiry as needed)
  'NQ': 'NQZ4', // E-mini Nasdaq
  'CL': 'CLF5', // Crude Oil
  'GC': 'GCG5', // Gold
  'YM': 'YMZ4', // E-mini Dow
  'BTC': 'BTCZ4', // Bitcoin futures
  // Add more mappings as needed
};

/**
 * Get the current front-month contract symbol for a market
 */
export function getTradovateSymbol(market: string): string {
  return SYMBOL_MAP[market] || market;
}
