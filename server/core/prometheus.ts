/**
 * Prometheus Metrics Integration
 * Tracks API performance, database metrics, and system health
 */

import { Counter, Histogram, Gauge, Registry } from "prom-client";

// Create a custom registry for metrics
export const metricsRegistry = new Registry();

// API Request Metrics
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [metricsRegistry],
});

export const httpRequestErrors = new Counter({
  name: "http_request_errors_total",
  help: "Total number of HTTP request errors",
  labelNames: ["method", "route", "error_type"],
  registers: [metricsRegistry],
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["query_type", "table"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

export const dbQueryTotal = new Counter({
  name: "db_queries_total",
  help: "Total number of database queries",
  labelNames: ["query_type", "table", "status"],
  registers: [metricsRegistry],
});

export const dbConnectionPoolSize = new Gauge({
  name: "db_connection_pool_size",
  help: "Current database connection pool size",
  registers: [metricsRegistry],
});

export const dbConnectionPoolUsage = new Gauge({
  name: "db_connection_pool_usage",
  help: "Number of active database connections",
  registers: [metricsRegistry],
});

export const dbSlowQueryTotal = new Counter({
  name: "db_slow_queries_total",
  help: "Total number of slow database queries (>1s)",
  labelNames: ["query_type", "table"],
  registers: [metricsRegistry],
});

// Cache Metrics
export const cacheHits = new Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

export const cacheMisses = new Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

export const cacheSize = new Gauge({
  name: "cache_size_bytes",
  help: "Current cache size in bytes",
  labelNames: ["cache_name"],
  registers: [metricsRegistry],
});

// Authentication Metrics
export const authAttempts = new Counter({
  name: "auth_attempts_total",
  help: "Total number of authentication attempts",
  labelNames: ["auth_type", "status"],
  registers: [metricsRegistry],
});

export const rateLimitExceeded = new Counter({
  name: "rate_limit_exceeded_total",
  help: "Total number of rate limit exceeded events",
  labelNames: ["endpoint", "user_id"],
  registers: [metricsRegistry],
});

// Business Metrics
export const tradesProcessed = new Counter({
  name: "trades_processed_total",
  help: "Total number of trades processed",
  labelNames: ["strategy", "source"],
  registers: [metricsRegistry],
});

export const webhooksReceived = new Counter({
  name: "webhooks_received_total",
  help: "Total number of webhooks received",
  labelNames: ["webhook_type", "status"],
  registers: [metricsRegistry],
});

export const activeUsers = new Gauge({
  name: "active_users_total",
  help: "Total number of active users",
  registers: [metricsRegistry],
});

export const activeSessions = new Gauge({
  name: "active_sessions_total",
  help: "Total number of active sessions",
  registers: [metricsRegistry],
});

// System Metrics
export const systemUptime = new Gauge({
  name: "system_uptime_seconds",
  help: "System uptime in seconds",
  registers: [metricsRegistry],
});

export const systemMemoryUsage = new Gauge({
  name: "system_memory_usage_bytes",
  help: "System memory usage in bytes",
  labelNames: ["type"],
  registers: [metricsRegistry],
});

export const systemCpuUsage = new Gauge({
  name: "system_cpu_usage_percent",
  help: "System CPU usage percentage",
  registers: [metricsRegistry],
});

/**
 * Update system metrics periodically
 */
export function startSystemMetricsCollection(): NodeJS.Timer {
  const startTime = Date.now();

  return setInterval(() => {
    // Update uptime
    systemUptime.set((Date.now() - startTime) / 1000);

    // Update memory usage
    const memUsage = process.memoryUsage();
    systemMemoryUsage.set({ type: "heap_used" }, memUsage.heapUsed);
    systemMemoryUsage.set({ type: "heap_total" }, memUsage.heapTotal);
    systemMemoryUsage.set({ type: "external" }, memUsage.external);
    systemMemoryUsage.set({ type: "rss" }, memUsage.rss);

    // CPU usage (approximate)
    const cpuUsage = process.cpuUsage();
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    systemCpuUsage.set(Math.min((totalCpuTime / 1000000) * 100, 100)); // Cap at 100%
  }, 10000); // Update every 10 seconds
}

/**
 * Helper to record HTTP request metrics
 */
export function recordHttpMetrics(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
  error?: Error
): void {
  httpRequestDuration.observe(
    { method, route, status_code: statusCode },
    duration / 1000
  );
  httpRequestTotal.inc({ method, route, status_code: statusCode });

  if (error) {
    httpRequestErrors.inc({
      method,
      route,
      error_type: error.name || "Unknown",
    });
  }
}

/**
 * Helper to record database query metrics
 */
export function recordDbMetrics(
  queryType: string,
  table: string,
  duration: number,
  status: "success" | "error" = "success"
): void {
  dbQueryDuration.observe({ query_type: queryType, table }, duration / 1000);
  dbQueryTotal.inc({ query_type: queryType, table, status });

  if (duration > 1000) {
    dbSlowQueryTotal.inc({ query_type: queryType, table });
  }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetricsText(): Promise<string> {
  return metricsRegistry.metrics();
}
