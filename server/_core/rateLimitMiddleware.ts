import { Request, Response, NextFunction } from "express";
import {
  isRateLimited,
  getRateLimitStatus,
  recordRequest,
  RATE_LIMIT_CONFIG,
} from "./monitoring";

/**
 * Get client IP from request, handling proxies
 */
function getClientIp(req: Request): string {
  // Check for forwarded headers (when behind proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
    return ips.split(",")[0].trim();
  }

  // Check for real IP header
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return typeof realIp === "string" ? realIp : realIp[0];
  }

  // Fall back to connection remote address
  return req.socket.remoteAddress || "unknown";
}

/**
 * Rate limiting middleware
 * Limits requests per IP to prevent abuse
 */
export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = getClientIp(req);
  const startTime = Date.now();

  // Skip rate limiting for health checks and in test environment
  if (
    req.path === "/api/health" ||
    req.path === "/health" ||
    process.env.NODE_ENV === "test"
  ) {
    return next();
  }

  // Check if rate limited
  if (isRateLimited(ip)) {
    const status = getRateLimitStatus(ip);

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_CONFIG.maxRequests);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetIn / 1000));
    res.setHeader("Retry-After", Math.ceil(status.resetIn / 1000));

    recordRequest(Date.now() - startTime, false);

    return res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil(status.resetIn / 1000),
    });
  }

  // Add rate limit headers
  const status = getRateLimitStatus(ip);
  res.setHeader("X-RateLimit-Limit", RATE_LIMIT_CONFIG.maxRequests);
  res.setHeader("X-RateLimit-Remaining", status.remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(status.resetIn / 1000));

  // Track response for metrics
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    recordRequest(responseTime, success);
  });

  next();
}

/**
 * Stricter rate limiting for sensitive endpoints (auth, webhooks)
 */
export function strictRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  const ip = getClientIp(req);
  const startTime = Date.now();

  // Use stricter limits for sensitive endpoints
  const strictConfig = {
    maxRequests: 20, // 20 requests per minute for sensitive endpoints
    windowMs: 60 * 1000,
  };

  // Check current count (simplified check)
  const status = getRateLimitStatus(ip);

  if (
    status.remaining <
    RATE_LIMIT_CONFIG.maxRequests - strictConfig.maxRequests
  ) {
    res.setHeader("X-RateLimit-Limit", strictConfig.maxRequests);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("Retry-After", Math.ceil(status.resetIn / 1000));

    recordRequest(Date.now() - startTime, false);

    res.status(429).json({
      error: "Too Many Requests",
      message:
        "Rate limit exceeded for sensitive endpoint. Please try again later.",
      retryAfter: Math.ceil(status.resetIn / 1000),
    });
    return;
  }

  // Track response for metrics
  res.on("finish", () => {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    recordRequest(responseTime, success);
  });

  next();
}
