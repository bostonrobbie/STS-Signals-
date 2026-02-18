/**
 * Broker Health Monitoring Service
 *
 * Provides unified health monitoring across all broker connections.
 * Tracks connection status, authentication state, and alerts on issues.
 */

import { TradovateClient } from "./tradovate";
import { IBKRClient, ConnectionHealth as IBKRHealth } from "./ibkr";
import { TradeStationClient } from "./tradestation";

// ============================================================================
// TYPES
// ============================================================================

export type BrokerType = "tradovate" | "ibkr" | "tradestation";

export interface BrokerConnectionStatus {
  broker: BrokerType;
  connectionId: string;
  name: string;
  status: "connected" | "disconnected" | "error" | "authenticating" | "expired";
  authenticated: boolean;
  lastCheck: Date;
  lastSuccessfulConnection: Date | null;
  accountCount: number;
  accounts: string[];
  error?: string;
  tokenExpiresAt?: Date;
  requiresReauth?: boolean;
  healthScore: number; // 0-100
  details: Record<string, unknown>;
}

export interface HealthReport {
  timestamp: Date;
  overallStatus: "healthy" | "degraded" | "unhealthy";
  healthScore: number; // 0-100
  connections: BrokerConnectionStatus[];
  alerts: HealthAlert[];
  recommendations: string[];
}

export interface HealthAlert {
  severity: "info" | "warning" | "error" | "critical";
  broker: BrokerType;
  connectionId: string;
  message: string;
  timestamp: Date;
  actionRequired: boolean;
}

// ============================================================================
// HEALTH MONITOR
// ============================================================================

export class BrokerHealthMonitor {
  private connections: Map<
    string,
    {
      broker: BrokerType;
      name: string;
      client: TradovateClient | IBKRClient | TradeStationClient;
      lastStatus: BrokerConnectionStatus | null;
    }
  > = new Map();

  private alerts: HealthAlert[] = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60000; // 1 minute
  private readonly MAX_ALERTS = 100;

  /**
   * Register a broker connection for monitoring
   */
  registerConnection(
    connectionId: string,
    broker: BrokerType,
    name: string,
    client: TradovateClient | IBKRClient | TradeStationClient
  ): void {
    this.connections.set(connectionId, {
      broker,
      name,
      client,
      lastStatus: null,
    });

    console.log(
      `[HealthMonitor] Registered ${broker} connection: ${name} (${connectionId})`
    );
  }

  /**
   * Unregister a broker connection
   */
  unregisterConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    console.log(`[HealthMonitor] Unregistered connection: ${connectionId}`);
  }

  /**
   * Start automatic health monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkAllConnections();
    }, this.CHECK_INTERVAL_MS);

    // Perform initial check
    this.checkAllConnections();

    console.log("[HealthMonitor] Started monitoring");
  }

  /**
   * Stop automatic health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    console.log("[HealthMonitor] Stopped monitoring");
  }

  /**
   * Check all registered connections
   */
  async checkAllConnections(): Promise<void> {
    for (const [connectionId, connection] of Array.from(
      this.connections.entries()
    )) {
      try {
        const status = await this.checkConnection(connectionId);
        connection.lastStatus = status;

        // Generate alerts based on status
        this.processStatusAlerts(status);
      } catch (error) {
        console.error(`[HealthMonitor] Error checking ${connectionId}:`, error);
      }
    }
  }

  /**
   * Check a specific connection
   */
  async checkConnection(connectionId: string): Promise<BrokerConnectionStatus> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const { broker, name, client } = connection;
    const now = new Date();

    try {
      let status: BrokerConnectionStatus;

      switch (broker) {
        case "tradovate": {
          const tradovateClient = client as TradovateClient;
          const health = tradovateClient.getHealth();
          const accounts = tradovateClient.getStoredAccounts();

          status = {
            broker,
            connectionId,
            name,
            status: this.determineStatus(
              health.connected,
              health.authenticated,
              health.tokenExpiresAt
            ),
            authenticated: health.authenticated,
            lastCheck: now,
            lastSuccessfulConnection: health.lastHeartbeat,
            accountCount: accounts.length,
            accounts: accounts.map(a => a.name),
            tokenExpiresAt: health.tokenExpiresAt || undefined,
            requiresReauth: !health.authenticated && health.connected,
            healthScore: this.calculateHealthScore(
              health.connected,
              health.authenticated,
              health.tokenExpiresAt
            ),
            details: {
              accountsLoaded: health.accountsLoaded,
            },
          };
          break;
        }

        case "ibkr": {
          const ibkrClient = client as IBKRClient;
          const health = ibkrClient.getHealth();

          status = {
            broker,
            connectionId,
            name,
            status: health ? this.determineIBKRStatus(health) : "disconnected",
            authenticated: health?.authenticated || false,
            lastCheck: now,
            lastSuccessfulConnection: health?.lastCheck || null,
            accountCount: health?.accounts.length || 0,
            accounts: health?.accounts || [],
            error: health?.message,
            requiresReauth: health?.gatewayRunning && !health?.authenticated,
            healthScore: health ? this.calculateIBKRHealthScore(health) : 0,
            details: {
              gatewayRunning: health?.gatewayRunning,
              competing: health?.competing,
              serverName: health?.serverName,
              serverVersion: health?.serverVersion,
            },
          };
          break;
        }

        case "tradestation": {
          const tsClient = client as TradeStationClient;
          const health = tsClient.getHealth();
          const accounts = await tsClient.getAccounts();

          status = {
            broker,
            connectionId,
            name,
            status: this.determineStatus(
              health.connected,
              health.authenticated,
              health.tokenExpiresAt
            ),
            authenticated: health.authenticated,
            lastCheck: now,
            lastSuccessfulConnection: health.lastRefresh,
            accountCount: accounts.length,
            accounts: accounts.map(a => a.AccountID),
            tokenExpiresAt: health.tokenExpiresAt || undefined,
            requiresReauth: !health.authenticated,
            healthScore: this.calculateHealthScore(
              health.connected,
              health.authenticated,
              health.tokenExpiresAt
            ),
            details: {
              isSimulation: health.isSimulation,
              accountsLoaded: health.accountsLoaded,
            },
          };
          break;
        }

        default:
          status = {
            broker,
            connectionId,
            name,
            status: "disconnected",
            authenticated: false,
            lastCheck: now,
            lastSuccessfulConnection: null,
            accountCount: 0,
            accounts: [],
            healthScore: 0,
            details: {},
          };
      }

      return status;
    } catch (error) {
      return {
        broker,
        connectionId,
        name,
        status: "error",
        authenticated: false,
        lastCheck: now,
        lastSuccessfulConnection:
          connection.lastStatus?.lastSuccessfulConnection || null,
        accountCount: 0,
        accounts: [],
        error: error instanceof Error ? error.message : "Unknown error",
        healthScore: 0,
        details: {},
      };
    }
  }

  /**
   * Determine connection status
   */
  private determineStatus(
    connected: boolean,
    authenticated: boolean,
    tokenExpires: Date | null
  ): BrokerConnectionStatus["status"] {
    if (!connected) return "disconnected";
    if (!authenticated) return "authenticating";

    if (tokenExpires) {
      const expiresIn = tokenExpires.getTime() - Date.now();
      if (expiresIn < 0) return "expired";
      if (expiresIn < 5 * 60 * 1000) return "error"; // Less than 5 min
    }

    return "connected";
  }

  /**
   * Determine IBKR-specific status
   */
  private determineIBKRStatus(
    health: IBKRHealth
  ): BrokerConnectionStatus["status"] {
    if (!health.gatewayRunning) return "disconnected";
    if (!health.authenticated) return "authenticating";
    if (health.competing) return "error";
    return "connected";
  }

  /**
   * Calculate health score (0-100)
   */
  private calculateHealthScore(
    connected: boolean,
    authenticated: boolean,
    tokenExpires: Date | null
  ): number {
    let score = 0;

    if (connected) score += 30;
    if (authenticated) score += 50;

    if (tokenExpires) {
      const expiresIn = tokenExpires.getTime() - Date.now();
      const hoursRemaining = expiresIn / (60 * 60 * 1000);

      if (hoursRemaining > 12) score += 20;
      else if (hoursRemaining > 1) score += 15;
      else if (hoursRemaining > 0) score += 5;
    } else if (authenticated) {
      score += 20; // No token expiration tracking
    }

    return score;
  }

  /**
   * Calculate IBKR-specific health score
   */
  private calculateIBKRHealthScore(health: IBKRHealth): number {
    let score = 0;

    if (health.gatewayRunning) score += 30;
    if (health.authenticated) score += 40;
    if (health.connected) score += 20;
    if (!health.competing) score += 10;

    return score;
  }

  /**
   * Process status and generate alerts
   */
  private processStatusAlerts(status: BrokerConnectionStatus): void {
    const now = new Date();

    // Token expiration warning
    if (status.tokenExpiresAt) {
      const expiresIn = status.tokenExpiresAt.getTime() - now.getTime();
      const hoursRemaining = expiresIn / (60 * 60 * 1000);

      if (hoursRemaining < 0) {
        this.addAlert({
          severity: "critical",
          broker: status.broker,
          connectionId: status.connectionId,
          message: `${status.name} token has expired. Re-authentication required.`,
          timestamp: now,
          actionRequired: true,
        });
      } else if (hoursRemaining < 1) {
        this.addAlert({
          severity: "warning",
          broker: status.broker,
          connectionId: status.connectionId,
          message: `${status.name} token expires in ${Math.round(hoursRemaining * 60)} minutes.`,
          timestamp: now,
          actionRequired: true,
        });
      }
    }

    // Connection issues
    if (status.status === "disconnected") {
      this.addAlert({
        severity: "error",
        broker: status.broker,
        connectionId: status.connectionId,
        message: `${status.name} is disconnected.`,
        timestamp: now,
        actionRequired: true,
      });
    }

    // Authentication required
    if (status.requiresReauth) {
      this.addAlert({
        severity: "warning",
        broker: status.broker,
        connectionId: status.connectionId,
        message: `${status.name} requires re-authentication.`,
        timestamp: now,
        actionRequired: true,
      });
    }
  }

  /**
   * Add an alert
   */
  private addAlert(alert: HealthAlert): void {
    // Check for duplicate recent alerts
    const recentDuplicate = this.alerts.find(
      a =>
        a.broker === alert.broker &&
        a.connectionId === alert.connectionId &&
        a.message === alert.message &&
        now.getTime() - a.timestamp.getTime() < 5 * 60 * 1000 // Within 5 minutes
    );

    if (!recentDuplicate) {
      this.alerts.unshift(alert);

      // Trim old alerts
      if (this.alerts.length > this.MAX_ALERTS) {
        this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
      }
    }
  }

  /**
   * Get current health report
   */
  async getHealthReport(): Promise<HealthReport> {
    const now = new Date();
    const connections: BrokerConnectionStatus[] = [];

    for (const connectionId of Array.from(this.connections.keys())) {
      const status = await this.checkConnection(connectionId);
      connections.push(status);
    }

    // Calculate overall health
    const avgScore =
      connections.length > 0
        ? connections.reduce((sum, c) => sum + c.healthScore, 0) /
          connections.length
        : 0;

    const overallStatus: HealthReport["overallStatus"] =
      avgScore >= 80 ? "healthy" : avgScore >= 50 ? "degraded" : "unhealthy";

    // Generate recommendations
    const recommendations: string[] = [];

    for (const conn of connections) {
      if (conn.status === "disconnected") {
        recommendations.push(`Reconnect ${conn.name} (${conn.broker})`);
      }
      if (conn.requiresReauth) {
        recommendations.push(`Re-authenticate ${conn.name} (${conn.broker})`);
      }
      if (conn.tokenExpiresAt) {
        const hoursRemaining =
          (conn.tokenExpiresAt.getTime() - now.getTime()) / (60 * 60 * 1000);
        if (hoursRemaining < 6 && hoursRemaining > 0) {
          recommendations.push(
            `Refresh ${conn.name} token soon (expires in ${Math.round(hoursRemaining)} hours)`
          );
        }
      }
    }

    return {
      timestamp: now,
      overallStatus,
      healthScore: Math.round(avgScore),
      connections,
      alerts: this.alerts.slice(0, 20), // Last 20 alerts
      recommendations,
    };
  }

  /**
   * Get alerts for a specific connection
   */
  getConnectionAlerts(connectionId: string): HealthAlert[] {
    return this.alerts.filter(a => a.connectionId === connectionId);
  }

  /**
   * Clear alerts for a connection
   */
  clearConnectionAlerts(connectionId: string): void {
    this.alerts = this.alerts.filter(a => a.connectionId !== connectionId);
  }

  /**
   * Get all registered connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

// Create a variable to hold the current time for alert deduplication
const now = new Date();

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let healthMonitorInstance: BrokerHealthMonitor | null = null;

export function getHealthMonitor(): BrokerHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new BrokerHealthMonitor();
  }
  return healthMonitorInstance;
}

export function shutdownHealthMonitor(): void {
  if (healthMonitorInstance) {
    healthMonitorInstance.stopMonitoring();
    healthMonitorInstance = null;
  }
}
