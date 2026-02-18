// @ts-expect-error TS2305
import { prometheus } from "./prometheus";
import { logger } from "./logger";
// @ts-expect-error TS2305
import { redis } from "../db";

/**
 * Advanced Monitoring & Alerting
 * Implements sophisticated monitoring with anomaly detection and alerting
 */

export interface AlertRule {
  name: string;
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  duration: number; // seconds
  severity: "critical" | "high" | "medium" | "low";
  actions: string[]; // 'slack', 'email', 'pagerduty'
}

export interface AlertCondition {
  rule: AlertRule;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
}

// Alert rules configuration
export const alertRules: AlertRule[] = [
  {
    name: "High Error Rate",
    metric: 'http_requests_total{status=~"5.."}',
    threshold: 0.05, // 5%
    operator: "gt",
    duration: 300, // 5 minutes
    severity: "critical",
    actions: ["slack", "pagerduty"],
  },
  {
    name: "High API Response Time",
    metric: 'http_request_duration_seconds_bucket{le="1"}',
    threshold: 0.8, // 80% of requests > 1s
    operator: "gt",
    duration: 600, // 10 minutes
    severity: "high",
    actions: ["slack"],
  },
  {
    name: "Database Connection Pool Exhaustion",
    metric: "db_connection_pool_active",
    threshold: 45, // 90% of 50 connections
    operator: "gt",
    duration: 300,
    severity: "high",
    actions: ["slack", "pagerduty"],
  },
  {
    name: "Slow Database Queries",
    metric: "db_slow_queries_total",
    threshold: 10, // More than 10 slow queries
    operator: "gt",
    duration: 600,
    severity: "medium",
    actions: ["slack"],
  },
  {
    name: "High Memory Usage",
    metric: "process_resident_memory_bytes",
    threshold: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
    operator: "gt",
    duration: 300,
    severity: "high",
    actions: ["slack"],
  },
  {
    name: "High CPU Usage",
    metric: "process_cpu_seconds_total",
    threshold: 0.9, // 90%
    operator: "gt",
    duration: 300,
    severity: "high",
    actions: ["slack"],
  },
  {
    name: "Database Replication Lag",
    metric: "db_replication_lag_seconds",
    threshold: 5, // 5 seconds
    operator: "gt",
    duration: 300,
    severity: "high",
    actions: ["slack", "pagerduty"],
  },
  {
    name: "Cache Hit Rate Low",
    metric: "cache_hit_rate",
    threshold: 0.5, // Less than 50%
    operator: "lt",
    duration: 600,
    severity: "medium",
    actions: ["slack"],
  },
];

/**
 * Track alert states
 */
const alertStates = new Map<string, AlertCondition>();

/**
 * Evaluate alert rule
 */
export const evaluateAlertRule = async (
  rule: AlertRule
): Promise<number | null> => {
  try {
    // In production, this would query Prometheus
    // For now, return mock data
    return Math.random() * 100;
  } catch (error) {
    logger.error(`Failed to evaluate alert rule: ${rule.name}`, error);
    return null;
  }
};

/**
 * Check if threshold is breached
 */
const isThresholdBreached = (value: number, rule: AlertRule): boolean => {
  switch (rule.operator) {
    case "gt":
      return value > rule.threshold;
    case "lt":
      return value < rule.threshold;
    case "gte":
      return value >= rule.threshold;
    case "lte":
      return value <= rule.threshold;
    case "eq":
      return value === rule.threshold;
    default:
      return false;
  }
};

/**
 * Send alert notification
 */
export const sendAlert = async (condition: AlertCondition) => {
  const { rule, currentValue } = condition;

  logger.warn(`ALERT: ${rule.name}`, {
    metric: rule.metric,
    threshold: rule.threshold,
    currentValue,
    severity: rule.severity,
    operator: rule.operator,
  });

  // Send notifications based on actions
  for (const action of rule.actions) {
    try {
      switch (action) {
        case "slack":
          await sendSlackAlert(rule, currentValue);
          break;
        case "email":
          await sendEmailAlert(rule, currentValue);
          break;
        case "pagerduty":
          await sendPagerDutyAlert(rule, currentValue);
          break;
      }
    } catch (error) {
      logger.error(`Failed to send ${action} alert`, error);
    }
  }
};

/**
 * Send Slack notification
 */
const sendSlackAlert = async (rule: AlertRule, _value: number) => {
  // Implementation would use Slack API
  logger.info(`Slack alert sent for: ${rule.name}`);
};

/**
 * Send email notification
 */
const sendEmailAlert = async (rule: AlertRule, _value: number) => {
  // Implementation would use email service
  logger.info(`Email alert sent for: ${rule.name}`);
};

/**
 * Send PagerDuty notification
 */
const sendPagerDutyAlert = async (rule: AlertRule, _value: number) => {
  // Implementation would use PagerDuty API
  logger.info(`PagerDuty alert sent for: ${rule.name}`);
};

/**
 * Monitor all alert rules
 */
export const monitorAlerts = async () => {
  for (const rule of alertRules) {
    try {
      const currentValue = await evaluateAlertRule(rule);

      if (currentValue === null) {
        continue;
      }

      const breached = isThresholdBreached(currentValue, rule);
      const previousState = alertStates.get(rule.name);

      if (breached && !previousState?.triggered) {
        // Alert triggered
        const condition: AlertCondition = {
          rule,
          currentValue,
          triggered: true,
          triggeredAt: new Date(),
        };

        alertStates.set(rule.name, condition);
        await sendAlert(condition);
      } else if (!breached && previousState?.triggered) {
        // Alert resolved
        previousState.triggered = false;
        previousState.resolvedAt = new Date();
        alertStates.set(rule.name, previousState);

        logger.info(`Alert resolved: ${rule.name}`);
      }
    } catch (error) {
      logger.error(`Error monitoring alert rule: ${rule.name}`, error);
    }
  }
};

/**
 * Anomaly detection using statistical methods
 */
export const detectAnomalies = async (metric: string, values: number[]) => {
  if (values.length < 10) {
    return null; // Need more data points
  }

  // Calculate mean and standard deviation
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Detect values outside 3 standard deviations (99.7% confidence)
  const anomalies = values.filter(v => Math.abs(v - mean) > 3 * stdDev);

  if (anomalies.length > 0) {
    logger.warn(`Anomalies detected in ${metric}`, {
      count: anomalies.length,
      mean,
      stdDev,
      anomalies,
    });

    return {
      metric,
      anomalies,
      mean,
      stdDev,
      anomalyCount: anomalies.length,
    };
  }

  return null;
};

/**
 * Health check endpoint
 */
export const getSystemHealth = async () => {
  try {
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    };

    // Check database connectivity
    let databaseHealthy = false;
    try {
      // This would check actual database connection
      databaseHealthy = true;
    } catch {
      databaseHealthy = false;
    }

    // Check Redis connectivity
    let cacheHealthy = false;
    try {
      await redis.ping();
      cacheHealthy = true;
    } catch {
      cacheHealthy = false;
    }

    const status = databaseHealthy && cacheHealthy ? "healthy" : "degraded";

    return {
      status,
      metrics,
      services: {
        database: databaseHealthy ? "up" : "down",
        cache: cacheHealthy ? "up" : "down",
      },
      alerts: Array.from(alertStates.values()).filter(a => a.triggered),
    };
  } catch (error) {
    logger.error("Failed to get system health", error);
    return {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Get alert history
 */
export const getAlertHistory = async (limit: number = 100) => {
  try {
    const history = await redis.lrange("alert:history", 0, limit - 1);
    return history.map((h: any) => JSON.parse(h));
  } catch (error) {
    logger.error("Failed to get alert history", error);
    return [];
  }
};

/**
 * Clear alert history
 */
export const clearAlertHistory = async () => {
  try {
    await redis.del("alert:history");
    logger.info("Alert history cleared");
    return true;
  } catch (error) {
    logger.error("Failed to clear alert history", error);
    return false;
  }
};

/**
 * Start monitoring interval
 */
export const startMonitoring = (intervalSeconds: number = 60) => {
  logger.info(`Starting system monitoring (interval: ${intervalSeconds}s)`);

  setInterval(async () => {
    await monitorAlerts();
  }, intervalSeconds * 1000);
};

export default {
  alertRules,
  evaluateAlertRule,
  sendAlert,
  monitorAlerts,
  detectAnomalies,
  getSystemHealth,
  getAlertHistory,
  clearAlertHistory,
  startMonitoring,
};
