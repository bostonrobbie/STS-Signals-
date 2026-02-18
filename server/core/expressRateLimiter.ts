// @ts-ignore - Missing type declarations
import rateLimit from "express-rate-limit";
// @ts-ignore - Missing type declarations
import RedisStore from "rate-limit-redis";
// @ts-expect-error TS2305
import { redis } from "../db";
// @ts-ignore - Missing type declarations
import { logger } from "./logger";

/**
 * Express Rate Limiting Middleware
 * Protects API endpoints from abuse and ensures fair resource allocation
 */

// Rate limiting configurations
export const rateLimitConfigs = {
  // Login attempts - strict limit
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: "Too many login attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // General API endpoints - moderate limit
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: "Too many API requests, please slow down",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Webhook endpoints - high limit
  webhook: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requests per minute
    message: "Webhook rate limit exceeded",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Export endpoints - strict limit
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: "Export limit exceeded, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Analytics endpoints - moderate limit
  analytics: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 requests per 5 minutes
    message: "Analytics query limit exceeded",
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * Create rate limiter with Redis store for distributed systems
 */
const createRedisLimiter = (config: any) => {
  try {
    return rateLimit({
      store: new RedisStore({
        client: redis,
        prefix: `rate-limit:${config.windowMs}:`,
      }),
      windowMs: config.windowMs,
      max: config.max,
      message: config.message,
      standardHeaders: config.standardHeaders,
      legacyHeaders: config.legacyHeaders,
      skip: (req: any) => {
        // Skip rate limiting for health checks
        if (req.path === "/api/health" || req.path === "/api/live") {
          return true;
        }
        return false;
      },
      keyGenerator: (req: any) => {
        // Use user ID if authenticated, otherwise use IP
        if (req.user?.id) {
          return `user:${req.user.id}`;
        }
        return req.ip || req.socket.remoteAddress || "unknown";
      },
      handler: (req: any, res: any) => {
        logger.warn("Rate limit exceeded", {
          ip: req.ip,
          path: req.path,
          userId: req.user?.id,
          limit: config.max,
          window: config.windowMs,
        });
        res.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: config.message,
            retryAfter: res.getHeader("Retry-After"),
          },
        });
      },
    });
  } catch (error) {
    logger.error("Failed to create Redis rate limiter", error);
    // Fallback to memory store if Redis is unavailable
    return createMemoryLimiter(config);
  }
};

/**
 * Create rate limiter with memory store (fallback)
 */
const createMemoryLimiter = (config: any) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    skip: (req: any) => {
      if (req.path === "/api/health" || req.path === "/api/live") {
        return true;
      }
      return false;
    },
    keyGenerator: (req: any) => {
      if (req.user?.id) {
        return `user:${req.user.id}`;
      }
      return req.ip || req.socket.remoteAddress || "unknown";
    },
    handler: (req: any, res: any) => {
      logger.warn("Rate limit exceeded (memory store)", {
        ip: req.ip,
        path: req.path,
        userId: req.user?.id,
      });
      res.status(429).json({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: config.message,
        },
      });
    },
  });
};

// Create rate limiters for different endpoints
export const loginLimiter = createRedisLimiter(rateLimitConfigs.login);
export const apiLimiter = createRedisLimiter(rateLimitConfigs.api);
export const webhookLimiter = createRedisLimiter(rateLimitConfigs.webhook);
export const exportLimiter = createRedisLimiter(rateLimitConfigs.export);
export const analyticsLimiter = createRedisLimiter(rateLimitConfigs.analytics);

/**
 * Custom rate limiter for specific endpoints
 */
export const createCustomLimiter = (
  windowMs: number,
  max: number,
  prefix: string
) => {
  return createRedisLimiter({
    windowMs,
    max,
    message: `Rate limit exceeded for ${prefix}`,
    standardHeaders: true,
    legacyHeaders: false,
  });
};

/**
 * Rate limit monitoring middleware
 * Logs rate limit usage for analytics
 */
export const rateLimitMonitoring = (req: any, res: any, next: any) => {
  const remaining = res.getHeader("RateLimit-Remaining");
  const limit = res.getHeader("RateLimit-Limit");
  const reset = res.getHeader("RateLimit-Reset");

  if (remaining && limit) {
    const percentUsed = ((limit - remaining) / limit) * 100;

    // Log if usage is high
    if (percentUsed > 80) {
      logger.warn("High rate limit usage", {
        endpoint: req.path,
        userId: req.user?.id,
        ip: req.ip,
        percentUsed: percentUsed.toFixed(2),
        remaining,
        limit,
        resetTime: new Date(parseInt(reset) * 1000).toISOString(),
      });
    }

    // Collect metrics
    if ((global as any).prometheus) {
      (global as any).prometheus.recordRateLimitUsage({
        endpoint: req.path,
        remaining: parseInt(remaining),
        limit: parseInt(limit),
      });
    }
  }

  next();
};

/**
 * Rate limit status endpoint
 * Returns current rate limit status for authenticated user
 */
export const getRateLimitStatus = (_req: any, res: any) => {
  const remaining = res.getHeader("RateLimit-Remaining");
  const limit = res.getHeader("RateLimit-Limit");
  const reset = res.getHeader("RateLimit-Reset");

  res.json({
    rateLimit: {
      limit: parseInt(limit) || null,
      remaining: parseInt(remaining) || null,
      reset: reset ? new Date(parseInt(reset) * 1000).toISOString() : null,
      percentUsed:
        remaining && limit
          ? (((limit - remaining) / limit) * 100).toFixed(2)
          : null,
    },
  });
};

/**
 * Reset rate limit for a specific user (admin only)
 */
export const resetRateLimit = async (req: any, res: any) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: {
        code: "MISSING_PARAMETER",
        message: "userId is required",
      },
    });
  }

  try {
    // Clear all rate limit keys for this user
    const pattern = `rate-limit:*:user:${userId}`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info("Rate limit reset for user", {
        userId,
        keysDeleted: keys.length,
      });
    }

    res.json({
      success: true,
      message: `Rate limit reset for user ${userId}`,
      keysDeleted: keys.length,
    });
  } catch (error) {
    logger.error("Failed to reset rate limit", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reset rate limit",
      },
    });
  }
};

/**
 * Get rate limit statistics
 */
export const getRateLimitStats = async (_req: any, res: any) => {
  try {
    const patterns = [
      "rate-limit:*:user:*",
      "rate-limit:*:*.*.*.*", // IP addresses
    ];

    const allKeys = [];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      allKeys.push(...keys);
    }

    const stats = {
      totalLimitedKeys: allKeys.length,
      byType: {
        users: 0,
        ips: 0,
      },
    };

    allKeys.forEach(key => {
      if (key.includes("user:")) {
        stats.byType.users++;
      } else {
        stats.byType.ips++;
      }
    });

    res.json(stats);
  } catch (error) {
    logger.error("Failed to get rate limit stats", error);
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get rate limit statistics",
      },
    });
  }
};

export default {
  loginLimiter,
  apiLimiter,
  webhookLimiter,
  exportLimiter,
  analyticsLimiter,
  createCustomLimiter,
  rateLimitMonitoring,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimitStats,
};
