// Shared types for paper trading that can be imported by both client and server

export interface PaperOrder {
  userId: number;
  strategyId?: number;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT" | "STOP";
  limitPrice?: number; // in cents
  stopPrice?: number; // in cents
  timeInForce?: "DAY" | "GTC" | "IOC";
}

export interface PaperOrderResult {
  success: boolean;
  orderId?: number;
  tradeId?: number;
  fillPrice?: number;
  fillQuantity?: number;
  error?: string;
  message?: string;
}

export interface PaperAccountSummary {
  accountId: number;
  balance: number; // in cents
  equity: number; // balance + unrealized P&L
  unrealizedPnl: number;
  realizedPnl: number;
  openPositions: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
}

export interface PaperPosition {
  positionId: number;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  side: "LONG" | "SHORT";
}

export interface PaperTrade {
  tradeId: number;
  symbol: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  side: "LONG" | "SHORT";
  entryTime: Date;
  exitTime?: Date;
  pnl?: number;
  pnlPercent?: number;
  status: "OPEN" | "CLOSED";
}
