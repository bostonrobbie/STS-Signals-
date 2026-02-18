/**
 * Tradovate OAuth Service
 * 
 * Implements OAuth 2.0 Authorization Code flow for Tradovate
 * This allows users to click "Connect to Tradovate" and authenticate
 * directly on Tradovate's website, similar to PickMyTrades
 */

import crypto from 'crypto';

// ============================================================================
// CONFIGURATION
// ============================================================================

// OAuth URLs
const TRADOVATE_OAUTH_URL = 'https://trader.tradovate.com/oauth';
const TRADOVATE_DEMO_TOKEN_URL = 'https://demo.tradovateapi.com/v1/auth/oauthtoken';
const TRADOVATE_LIVE_TOKEN_URL = 'https://live.tradovateapi.com/v1/auth/oauthtoken';
const TRADOVATE_DEMO_API_URL = 'https://demo.tradovateapi.com/v1';
const TRADOVATE_LIVE_API_URL = 'https://live.tradovateapi.com/v1';

// Get OAuth credentials from environment
const TRADOVATE_CLIENT_ID = process.env.TRADOVATE_CLIENT_ID || '';
const TRADOVATE_CLIENT_SECRET = process.env.TRADOVATE_CLIENT_SECRET || '';

// ============================================================================
// TYPES
// ============================================================================

export interface TradovateOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isLive?: boolean;
}

export interface TradovateTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  // Tradovate-specific fields
  userId?: number;
  name?: string;
  expirationTime?: string;
}

export interface TradovateOAuthState {
  userId: string;
  returnUrl: string;
  nonce: string;
  isLive: boolean;
}

// ============================================================================
// ENCRYPTION FOR STORING TOKENS
// ============================================================================

const ENCRYPTION_KEY = process.env.BROKER_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64).padEnd(64, '0'), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex'),
  });
}

export function decryptToken(encryptedData: string): string {
  try {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64).padEnd(64, '0'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[Tradovate OAuth] Failed to decrypt token:', error);
    throw new Error('Failed to decrypt token');
  }
}

// ============================================================================
// OAUTH STATE MANAGEMENT
// ============================================================================

// In-memory state store (in production, use Redis or database)
const pendingOAuthStates = new Map<string, TradovateOAuthState>();

export function generateOAuthState(userId: string, returnUrl: string, isLive: boolean): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const state: TradovateOAuthState = {
    userId,
    returnUrl,
    nonce,
    isLive,
  };
  
  // Store state for verification
  pendingOAuthStates.set(nonce, state);
  
  // Clean up old states after 10 minutes
  setTimeout(() => {
    pendingOAuthStates.delete(nonce);
  }, 10 * 60 * 1000);
  
  return nonce;
}

export function verifyOAuthState(nonce: string): TradovateOAuthState | null {
  const state = pendingOAuthStates.get(nonce);
  if (state) {
    pendingOAuthStates.delete(nonce);
    return state;
  }
  return null;
}

// ============================================================================
// OAUTH FLOW
// ============================================================================

/**
 * Generate the OAuth authorization URL that redirects user to Tradovate login
 */
export function getOAuthAuthorizationUrl(config: {
  redirectUri: string;
  state: string;
  isLive?: boolean;
}): string {
  const clientId = TRADOVATE_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('TRADOVATE_CLIENT_ID environment variable not set');
  }
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: config.redirectUri,
    state: config.state,
  });
  
  return `${TRADOVATE_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(config: {
  code: string;
  redirectUri: string;
  isLive?: boolean;
}): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: number;
  accountName?: string;
  error?: string;
}> {
  const clientId = TRADOVATE_CLIENT_ID;
  const clientSecret = TRADOVATE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Tradovate OAuth credentials not configured',
    };
  }
  
  const tokenUrl = config.isLive ? TRADOVATE_LIVE_TOKEN_URL : TRADOVATE_DEMO_TOKEN_URL;
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: config.redirectUri,
        code: config.code,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Tradovate OAuth] Token exchange failed:', errorText);
      return {
        success: false,
        error: `Token exchange failed: ${response.status}`,
      };
    }
    
    const data: TradovateTokenResponse = await response.json();
    
    // Calculate expiration time
    const expiresAt = data.expirationTime 
      ? new Date(data.expirationTime)
      : new Date(Date.now() + (data.expires_in || 3600) * 1000);
    
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      userId: data.userId,
      accountName: data.name,
    };
  } catch (error) {
    console.error('[Tradovate OAuth] Token exchange error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token exchange failed',
    };
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(config: {
  refreshToken: string;
  isLive?: boolean;
}): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}> {
  const clientId = TRADOVATE_CLIENT_ID;
  const clientSecret = TRADOVATE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return {
      success: false,
      error: 'Tradovate OAuth credentials not configured',
    };
  }
  
  const tokenUrl = config.isLive ? TRADOVATE_LIVE_TOKEN_URL : TRADOVATE_DEMO_TOKEN_URL;
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: config.refreshToken,
      }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Token refresh failed: ${response.status}`,
      };
    }
    
    const data: TradovateTokenResponse = await response.json();
    
    const expiresAt = data.expirationTime 
      ? new Date(data.expirationTime)
      : new Date(Date.now() + (data.expires_in || 3600) * 1000);
    
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
    };
  } catch (error) {
    console.error('[Tradovate OAuth] Token refresh error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}

// ============================================================================
// API CLIENT WITH OAUTH TOKEN
// ============================================================================

export class TradovateOAuthClient {
  private accessToken: string;
  private baseUrl: string;
  
  constructor(accessToken: string, isLive: boolean = false) {
    this.accessToken = accessToken;
    this.baseUrl = isLive ? TRADOVATE_LIVE_API_URL : TRADOVATE_DEMO_API_URL;
  }
  
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Tradovate API error: ${response.status} - ${errorText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get all accounts for the authenticated user
   */
  async getAccounts(): Promise<Array<{
    id: number;
    name: string;
    userId: number;
    accountType: string;
    active: boolean;
  }>> {
    return this.request('/account/list');
  }
  
  /**
   * Get positions for an account
   */
  async getPositions(accountId: number): Promise<Array<{
    id: number;
    accountId: number;
    contractId: number;
    netPos: number;
    netPrice: number;
  }>> {
    return this.request(`/position/list?accountId=${accountId}`);
  }
  
  /**
   * Get account balance and cash info
   */
  async getCashBalance(accountId: number): Promise<{
    accountId: number;
    timestamp: string;
    tradeDate: { year: number; month: number; day: number };
    cashBalance: number;
    realizedPnL: number;
    unrealizedPnL: number;
  }> {
    const balances = await this.request<any[]>(`/cashBalance/getCashBalanceSnapshot?accountId=${accountId}`);
    return balances[0];
  }
  
  /**
   * Place a market order
   */
  async placeMarketOrder(params: {
    accountId: number;
    accountSpec: string;
    symbol: string;
    action: 'Buy' | 'Sell';
    quantity: number;
  }): Promise<{
    orderId: number;
    orderStatus: string;
  }> {
    return this.request('/order/placeorder', {
      method: 'POST',
      body: JSON.stringify({
        accountId: params.accountId,
        accountSpec: params.accountSpec,
        action: params.action,
        symbol: params.symbol,
        orderQty: params.quantity,
        orderType: 'Market',
        isAutomated: true,
      }),
    });
  }
  
  /**
   * Place a limit order
   */
  async placeLimitOrder(params: {
    accountId: number;
    accountSpec: string;
    symbol: string;
    action: 'Buy' | 'Sell';
    quantity: number;
    price: number;
  }): Promise<{
    orderId: number;
    orderStatus: string;
  }> {
    return this.request('/order/placeorder', {
      method: 'POST',
      body: JSON.stringify({
        accountId: params.accountId,
        accountSpec: params.accountSpec,
        action: params.action,
        symbol: params.symbol,
        orderQty: params.quantity,
        orderType: 'Limit',
        price: params.price,
        isAutomated: true,
      }),
    });
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(orderId: number): Promise<{ commandId: number }> {
    return this.request('/order/cancelorder', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }
  
  /**
   * Get order status
   */
  async getOrder(orderId: number): Promise<{
    id: number;
    accountId: number;
    ordStatus: string;
    action: string;
    orderQty: number;
    filledQty: number;
    avgFillPrice: number;
  }> {
    return this.request(`/order/item?id=${orderId}`);
  }
  
  /**
   * Get contract details by symbol
   */
  async getContract(symbol: string): Promise<{
    id: number;
    name: string;
    contractMaturityId: number;
    status: string;
    providerTickSize: number;
  }> {
    return this.request(`/contract/find?name=${encodeURIComponent(symbol)}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if Tradovate OAuth is properly configured
 */
export function isTradovateOAuthConfigured(): boolean {
  return !!(TRADOVATE_CLIENT_ID && TRADOVATE_CLIENT_SECRET);
}

/**
 * Get the OAuth redirect URI for our application
 */
export function getTradovateRedirectUri(baseUrl: string): string {
  return `${baseUrl}/api/oauth/tradovate/callback`;
}
