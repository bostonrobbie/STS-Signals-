import { getPool } from "../db";

// Server start time for uptime calculation
// const serverStartTime = Date.now(); // Available if needed

// Request metrics tracking
interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  responseTimes: number[];
  requestsPerMinute: number[];
  lastMinuteTimestamp: number;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  avgResponseTime: 0,
  responseTimes: [],
  requestsPerMinute: [],
  lastMinuteTimestamp: Date.now(),
};

// Rate limiting tracking
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blocked: boolean;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Rate limit configuration
export const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 100, // Max requests per window
  blockDuration: 60 * 1000, // Block for 1 minute after exceeding limit
};

/**
 * Record a request for metrics tracking
 */
export function recordRequest(responseTime: number, success: boolean) {
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }

  // Track response times (keep last 1000)
  metrics.responseTimes.push(responseTime);
  if (metrics.responseTimes.length > 1000) {
    metrics.responseTimes.shift();
  }

  // Calculate average response time
  metrics.avgResponseTime =
    metrics.responseTimes.reduce((a, b) => a + b, 0) /
    metrics.responseTimes.length;

  // Track requests per minute
  const now = Date.now();
  if (now - metrics.lastMinuteTimestamp >= 60000) {
    metrics.requestsPerMinute.push(metrics.totalRequests);
    if (metrics.requestsPerMinute.length > 60) {
      metrics.requestsPerMinute.shift();
    }
    metrics.lastMinuteTimestamp = now;
  }
}

/**
 * Check if an IP is rate limited
 */
export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry) {
    rateLimitMap.set(ip, {
      count: 1,
      firstRequest: now,
      blocked: false,
    });
    return false;
  }

  // Check if blocked
  if (entry.blocked) {
    if (now - entry.firstRequest > RATE_LIMIT_CONFIG.blockDuration) {
      // Unblock after duration
      rateLimitMap.set(ip, {
        count: 1,
        firstRequest: now,
        blocked: false,
      });
      return false;
    }
    return true;
  }

  // Check if window expired
  if (now - entry.firstRequest > RATE_LIMIT_CONFIG.windowMs) {
    rateLimitMap.set(ip, {
      count: 1,
      firstRequest: now,
      blocked: false,
    });
    return false;
  }

  // Increment count
  entry.count++;

  // Check if exceeded limit
  if (entry.count > RATE_LIMIT_CONFIG.maxRequests) {
    entry.blocked = true;
    entry.firstRequest = now; // Reset for block duration
    return true;
  }

  return false;
}

/**
 * Get rate limit status for an IP
 */
export function getRateLimitStatus(ip: string): {
  remaining: number;
  resetIn: number;
  blocked: boolean;
} {
  const entry = rateLimitMap.get(ip);
  const now = Date.now();

  if (!entry) {
    return {
      remaining: RATE_LIMIT_CONFIG.maxRequests,
      resetIn: RATE_LIMIT_CONFIG.windowMs,
      blocked: false,
    };
  }

  if (entry.blocked) {
    return {
      remaining: 0,
      resetIn: Math.max(
        0,
        RATE_LIMIT_CONFIG.blockDuration - (now - entry.firstRequest)
      ),
      blocked: true,
    };
  }

  return {
    remaining: Math.max(0, RATE_LIMIT_CONFIG.maxRequests - entry.count),
    resetIn: Math.max(
      0,
      RATE_LIMIT_CONFIG.windowMs - (now - entry.firstRequest)
    ),
    blocked: false,
  };
}

/**
 * Get database connection pool metrics
 */
export async function getDbPoolMetrics(): Promise<{
  connected: boolean;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  connectionLimit: number;
} | null> {
  const pool = getPool();

  if (!pool) {
    return null;
  }

  try {
    // mysql2 pool exposes these properties
    const poolInfo = (pool as any).pool;

    return {
      connected: true,
      activeConnections: poolInfo?._allConnections?.length || 0,
      idleConnections: poolInfo?._freeConnections?.length || 0,
      totalConnections: poolInfo?._allConnections?.length || 0,
      waitingRequests: poolInfo?._connectionQueue?.length || 0,
      connectionLimit: 10, // From our config
    };
  } catch (error) {
    console.error("[Monitoring] Failed to get pool metrics:", error);
    return {
      connected: false,
      activeConnections: 0,
      idleConnections: 0,
      totalConnections: 0,
      waitingRequests: 0,
      connectionLimit: 10,
    };
  }
}

/**
 * Get comprehensive health status
 */
export async function getHealthStatus(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  uptimeFormatted: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    heapUsedPercent: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  database: {
    connected: boolean;
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    waitingRequests: number;
    connectionLimit: number;
  } | null;
  requests: {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    avgResponseTime: number;
    p95ResponseTime: number;
  };
  environment: string;
}> {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime();
  const dbMetrics = await getDbPoolMetrics();

  // Calculate percentiles
  const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
  const p95Index = Math.floor(sortedTimes.length * 0.95);
  const p95ResponseTime = sortedTimes[p95Index] || 0;

  // Determine health status
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check memory usage (>90% is unhealthy, >80% is degraded)
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  if (heapUsedPercent > 90) {
    status = "unhealthy";
  } else if (heapUsedPercent > 80) {
    status = "degraded";
  }

  // Check database connection
  if (!dbMetrics?.connected) {
    status = "unhealthy";
  }

  // Check error rate (>10% is degraded, >25% is unhealthy)
  const successRate =
    metrics.totalRequests > 0
      ? (metrics.successfulRequests / metrics.totalRequests) * 100
      : 100;
  if (successRate < 75) {
    status = "unhealthy";
  } else if (successRate < 90) {
    status = status === "healthy" ? "degraded" : status;
  }

  // Format uptime
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime,
    uptimeFormatted,
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      heapUsedPercent: Math.round(heapUsedPercent * 100) / 100,
      external: memoryUsage.external,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    database: dbMetrics,
    requests: {
      total: metrics.totalRequests,
      successful: metrics.successfulRequests,
      failed: metrics.failedRequests,
      successRate: Math.round(successRate * 100) / 100,
      avgResponseTime: Math.round(metrics.avgResponseTime * 100) / 100,
      p95ResponseTime: Math.round(p95ResponseTime * 100) / 100,
    },
    environment: process.env.NODE_ENV || "development",
  };
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  const maxAge = RATE_LIMIT_CONFIG.windowMs + RATE_LIMIT_CONFIG.blockDuration;

  const entries = Array.from(rateLimitMap.entries());
  for (const [ip, entry] of entries) {
    if (now - entry.firstRequest > maxAge) {
      rateLimitMap.delete(ip);
    }
  }
}

// Clean up rate limits every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
