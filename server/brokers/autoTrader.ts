/**
 * Automated Trading Execution Service
 *
 * Handles automated trade execution based on strategy signals.
 * Supports multiple brokers with failover and retry logic.
 */

import { TradovateClient } from "./tradovate";
import { IBKRClient } from "./ibkr";
import { TradeStationClient } from "./tradestation";

// Futures symbol mapping for each broker
const TRADOVATE_FUTURES: Record<string, { symbol: string }> = {
  ES: { symbol: "ESH5" }, // E-mini S&P 500
  NQ: { symbol: "NQH5" }, // E-mini Nasdaq
  CL: { symbol: "CLH5" }, // Crude Oil
  GC: { symbol: "GCJ5" }, // Gold
  BTC: { symbol: "BTCH5" }, // Bitcoin
  YM: { symbol: "YMH5" }, // E-mini Dow
};

const IBKR_FUTURES: Record<string, { symbol: string }> = {
  ES: { symbol: "495512552" },
  NQ: { symbol: "495512566" },
  CL: { symbol: "495512580" },
  GC: { symbol: "495512594" },
  BTC: { symbol: "495512608" },
};

const TRADESTATION_FUTURES: Record<string, { symbol: string }> = {
  ES: { symbol: "@ES" },
  NQ: { symbol: "@NQ" },
  CL: { symbol: "@CL" },
  GC: { symbol: "@GC" },
  BTC: { symbol: "@BTC" },
  YM: { symbol: "@YM" },
};

// ============================================================================
// TYPES
// ============================================================================

export type BrokerType = "tradovate" | "ibkr" | "tradestation";

export interface TradeSignal {
  id: string;
  strategyId: number;
  strategyName: string;
  symbol: string; // e.g., "ES", "NQ", "CL"
  action: "BUY" | "SELL";
  quantity: number;
  orderType: "MARKET" | "LIMIT" | "STOP";
  limitPrice?: number;
  stopPrice?: number;
  timestamp: Date;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  broker: BrokerType;
  filledPrice?: number;
  filledQuantity?: number;
  commission?: number;
  error?: string;
  timestamp: Date;
  retryCount: number;
}

export interface ExecutionConfig {
  maxRetries: number;
  retryDelayMs: number;
  failoverEnabled: boolean;
  brokerPriority: BrokerType[];
  maxSlippagePercent: number;
  requireConfirmation: boolean;
  paperTradingOnly: boolean;
}

export interface BrokerConnection {
  broker: BrokerType;
  client: TradovateClient | IBKRClient | TradeStationClient;
  isConnected: boolean;
  isPaper: boolean;
  priority: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ExecutionConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  failoverEnabled: true,
  brokerPriority: ["tradovate", "ibkr", "tradestation"],
  maxSlippagePercent: 0.5,
  requireConfirmation: false,
  paperTradingOnly: true, // Safety default
};

// ============================================================================
// AUTO TRADER SERVICE
// ============================================================================

export class AutoTrader {
  private connections: Map<BrokerType, BrokerConnection> = new Map();
  private config: ExecutionConfig;
  private executionLog: ExecutionResult[] = [];
  private isRunning: boolean = false;
  private signalQueue: TradeSignal[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a broker connection
   */
  registerBroker(
    broker: BrokerType,
    client: TradovateClient | IBKRClient | TradeStationClient,
    isPaper: boolean = true
  ): void {
    const priority = this.config.brokerPriority.indexOf(broker);

    this.connections.set(broker, {
      broker,
      client,
      isConnected: false,
      isPaper,
      priority: priority >= 0 ? priority : 999,
    });

    console.log(
      `[AutoTrader] Registered ${broker} (${isPaper ? "paper" : "live"})`
    );
  }

  /**
   * Unregister a broker connection
   */
  unregisterBroker(broker: BrokerType): void {
    this.connections.delete(broker);
    console.log(`[AutoTrader] Unregistered ${broker}`);
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(broker: BrokerType, isConnected: boolean): void {
    const connection = this.connections.get(broker);
    if (connection) {
      connection.isConnected = isConnected;
    }
  }

  /**
   * Get available brokers sorted by priority
   */
  private getAvailableBrokers(): BrokerConnection[] {
    return Array.from(this.connections.values())
      .filter(c => c.isConnected)
      .filter(c => !this.config.paperTradingOnly || c.isPaper)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Map symbol to broker-specific format
   */
  private mapSymbol(symbol: string, broker: BrokerType): string {
    switch (broker) {
      case "tradovate":
        return TRADOVATE_FUTURES[symbol]?.symbol || symbol;
      case "ibkr":
        return IBKR_FUTURES[symbol]?.symbol || symbol;
      case "tradestation":
        return TRADESTATION_FUTURES[symbol]?.symbol || symbol;
      default:
        return symbol;
    }
  }

  /**
   * Execute a trade signal
   */
  async executeSignal(signal: TradeSignal): Promise<ExecutionResult> {
    const startTime = new Date();
    let lastError: string | undefined;
    let retryCount = 0;

    // Get available brokers
    const availableBrokers = this.getAvailableBrokers();

    if (availableBrokers.length === 0) {
      return {
        success: false,
        broker: this.config.brokerPriority[0] || "tradovate",
        error: "No connected brokers available",
        timestamp: startTime,
        retryCount: 0,
      };
    }

    // Try each broker in priority order
    for (const connection of availableBrokers) {
      const brokerSymbol = this.mapSymbol(signal.symbol, connection.broker);

      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        try {
          const result = await this.executeTrade(
            connection,
            signal,
            brokerSymbol
          );

          if (result.success) {
            const executionResult: ExecutionResult = {
              ...result,
              broker: connection.broker,
              timestamp: new Date(),
              retryCount,
            };

            this.executionLog.push(executionResult);
            console.log(
              `[AutoTrader] Trade executed: ${signal.action} ${signal.quantity} ${signal.symbol} via ${connection.broker}`
            );

            return executionResult;
          }

          lastError = result.error;
          retryCount++;

          // Wait before retry
          if (attempt < this.config.maxRetries) {
            await this.delay(this.config.retryDelayMs * (attempt + 1));
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Unknown error";
          retryCount++;

          if (attempt < this.config.maxRetries) {
            await this.delay(this.config.retryDelayMs * (attempt + 1));
          }
        }
      }

      // If failover is disabled, don't try other brokers
      if (!this.config.failoverEnabled) {
        break;
      }

      console.log(
        `[AutoTrader] Failover: ${connection.broker} failed, trying next broker`
      );
    }

    // All brokers failed
    const failedResult: ExecutionResult = {
      success: false,
      broker: availableBrokers[0]?.broker || "tradovate",
      error: lastError || "All execution attempts failed",
      timestamp: new Date(),
      retryCount,
    };

    this.executionLog.push(failedResult);
    return failedResult;
  }

  /**
   * Execute trade on a specific broker
   */
  private async executeTrade(
    connection: BrokerConnection,
    signal: TradeSignal,
    brokerSymbol: string
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    switch (connection.broker) {
      case "tradovate": {
        const client = connection.client as TradovateClient;
        const result = await client.placeOrder({
          accountSpec: "", // Will be filled by client
          accountId: 0, // Will be filled by client
          symbol: brokerSymbol,
          action: signal.action === "BUY" ? "Buy" : "Sell",
          orderQty: signal.quantity,
          orderType:
            signal.orderType === "MARKET"
              ? "Market"
              : signal.orderType === "LIMIT"
                ? "Limit"
                : "Stop",
          price: signal.limitPrice,
          stopPrice: signal.stopPrice,
        });
        return {
          success: result.orderId !== undefined,
          orderId: result.orderId?.toString(),
          error: result.errorText,
        };
      }

      case "ibkr": {
        const client = connection.client as IBKRClient;
        return client.placeOrder({
          acctId: "", // Will be filled by client
          conid: parseInt(brokerSymbol) || 0,
          secType: "FUT",
          ticker: signal.symbol,
          orderType:
            signal.orderType === "MARKET"
              ? "MKT"
              : signal.orderType === "LIMIT"
                ? "LMT"
                : "STP",
          side: signal.action,
          quantity: signal.quantity,
          price: signal.limitPrice,
          auxPrice: signal.stopPrice,
          tif: "DAY",
        });
      }

      case "tradestation": {
        const client = connection.client as TradeStationClient;
        const selectedAccount = client.getSelectedAccount();

        if (!selectedAccount) {
          return { success: false, error: "No account selected" };
        }

        return client.placeOrder({
          AccountID: selectedAccount.AccountID,
          Symbol: brokerSymbol,
          Quantity: signal.quantity.toString(),
          OrderType:
            signal.orderType === "MARKET"
              ? "Market"
              : signal.orderType === "LIMIT"
                ? "Limit"
                : "StopMarket",
          TradeAction: signal.action,
          TimeInForce: { Duration: "DAY" },
          LimitPrice: signal.limitPrice?.toString(),
          StopPrice: signal.stopPrice?.toString(),
        });
      }

      default:
        return {
          success: false,
          error: `Unsupported broker: ${connection.broker}`,
        };
    }
  }

  /**
   * Queue a signal for execution
   */
  queueSignal(signal: TradeSignal): void {
    this.signalQueue.push(signal);
    console.log(
      `[AutoTrader] Signal queued: ${signal.action} ${signal.quantity} ${signal.symbol}`
    );
  }

  /**
   * Start processing signal queue
   */
  start(): void {
    if (this.isRunning) {
      console.log("[AutoTrader] Already running");
      return;
    }

    this.isRunning = true;
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, 1000);

    console.log("[AutoTrader] Started");
  }

  /**
   * Stop processing signal queue
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log("[AutoTrader] Stopped");
  }

  /**
   * Process queued signals
   */
  private async processQueue(): Promise<void> {
    if (this.signalQueue.length === 0) {
      return;
    }

    const signal = this.signalQueue.shift();
    if (signal) {
      await this.executeSignal(signal);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): ExecutionResult[] {
    return this.executionLog.slice(-limit);
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    averageRetries: number;
    byBroker: Record<BrokerType, { total: number; success: number }>;
  } {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(e => e.success).length;
    const failed = total - successful;
    const totalRetries = this.executionLog.reduce(
      (sum, e) => sum + e.retryCount,
      0
    );

    const byBroker: Record<BrokerType, { total: number; success: number }> = {
      tradovate: { total: 0, success: 0 },
      ibkr: { total: 0, success: 0 },
      tradestation: { total: 0, success: 0 },
    };

    for (const execution of this.executionLog) {
      byBroker[execution.broker].total++;
      if (execution.success) {
        byBroker[execution.broker].success++;
      }
    }

    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageRetries: total > 0 ? totalRetries / total : 0,
      byBroker,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ExecutionConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("[AutoTrader] Configuration updated");
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionConfig {
    return { ...this.config };
  }

  /**
   * Check if auto trader is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.signalQueue.length;
  }

  /**
   * Clear execution log
   */
  clearHistory(): void {
    this.executionLog = [];
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let autoTraderInstance: AutoTrader | null = null;

export function getAutoTrader(): AutoTrader {
  if (!autoTraderInstance) {
    autoTraderInstance = new AutoTrader();
  }
  return autoTraderInstance;
}

export function shutdownAutoTrader(): void {
  if (autoTraderInstance) {
    autoTraderInstance.stop();
    autoTraderInstance = null;
  }
}
