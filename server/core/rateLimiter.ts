/**
 * Rate Limiting Middleware
 * Protects against abuse and ensures fair resource allocation
 */

import { Request, Response, NextFunction } from "express";
import { rateLimitExceeded } from "./prometheus";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string;
  statusCode?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      statusCode: 429,
      message: "Too many requests, please try again later.",
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req: Request) => req.ip || "unknown",
      ...config,
    };

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Middleware function
   */
  middleware() {
    // @ts-expect-error TS7030
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator!(req);
      const now = Date.now();

      // Get or create store entry
      if (!this.store[key]) {
        this.store[key] = { count: 0, resetTime: now + this.config.windowMs };
      }

      const entry = this.store[key]!;

      // Reset if window has passed
      if (now > entry.resetTime) {
        entry.count = 0;
        entry.resetTime = now + this.config.windowMs;
      }

      // Increment counter
      entry.count++;

      // Set rate limit headers
      res.setHeader("RateLimit-Limit", this.config.max);
      res.setHeader(
        "RateLimit-Remaining",
        Math.max(0, this.config.max - entry.count)
      );
      res.setHeader("RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

      // Check if limit exceeded
      if (entry.count > this.config.max) {
        rateLimitExceeded.inc({
          endpoint: req.path,
          user_id: req.user?.id?.toString() || "anonymous",
        });

        return res.status(this.config.statusCode!).json({
          error: this.config.message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        });
      }

      next();
    };
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key]!.resetTime < now) {
        delete this.store[key];
      }
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    delete this.store[key];
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.store = {};
  }

  /**
   * Get current status for a key
   */
  getStatus(key: string) {
    const entry = this.store[key];
    if (!entry) {
      return { count: 0, remaining: this.config.max, resetTime: null };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.config.max - entry.count),
      resetTime: new Date(entry.resetTime),
    };
  }
}

/**
 * Create rate limiters for different endpoints
 */
export const createRateLimiters = () => ({
  login: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: "Too many login attempts, please try again after 15 minutes.",
    keyGenerator: (req: Request) => `${req.ip}:${req.body?.email || "unknown"}`,
  }),

  api: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests
    message: "Too many API requests, please try again later.",
    keyGenerator: (req: Request) =>
      req.user?.id?.toString() || req.ip || "unknown",
  }),

  webhook: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // 1000 requests
    message: "Webhook rate limit exceeded.",
    keyGenerator: (req: Request) => req.ip || "unknown",
  }),

  publicApi: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: "Public API rate limit exceeded.",
    keyGenerator: (req: Request) => req.ip || "unknown",
  }),

  export: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
    message: "Export limit exceeded, please try again later.",
    keyGenerator: (req: Request) =>
      req.user?.id?.toString() || req.ip || "unknown",
  }),
});

/**
 * Global rate limiter instance
 */
export let rateLimiters: ReturnType<typeof createRateLimiters>;

/**
 * Initialize rate limiters
 */
export function initializeRateLimiters(): void {
  rateLimiters = createRateLimiters();
}

/**
 * Get rate limiter middleware for an endpoint
 */
export function getRateLimiterMiddleware(
  type: keyof ReturnType<typeof createRateLimiters>
) {
  if (!rateLimiters) {
    initializeRateLimiters();
  }
  return rateLimiters[type].middleware();
}

/**
 * Manual rate limit check (for non-middleware use)
 */
export function checkRateLimit(
  key: string,
  limiter: InstanceType<typeof RateLimiter>
): { allowed: boolean; remaining: number; resetTime?: Date } {
  const status = limiter.getStatus(key);
  return {
    allowed: status.remaining > 0,
    remaining: status.remaining,
    resetTime: status.resetTime || undefined,
  };
}
