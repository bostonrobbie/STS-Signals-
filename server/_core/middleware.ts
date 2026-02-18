import express from "express";
import { logger } from "../core/logger";
import {
  loginLimiter,
  apiLimiter,
  webhookLimiter,
  exportLimiter,
  analyticsLimiter,
  rateLimitMonitoring,
} from "../core/expressRateLimiter";

/**
 * Express Middleware Configuration
 * Applies rate limiting, security headers, and monitoring to all routes
 */

/**
 * Apply global middleware to Express app
 */
export const applyMiddleware = (app: express.Application) => {
  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );
    next();
  });

  // CORS configuration
  // @ts-expect-error TS7030
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
      "http://localhost:3001",
    ];

    if (allowedOrigins.includes(origin || "")) {
      // @ts-expect-error TS2345
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS, PATCH"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userId: (req as any).user?.id,
      });
    });

    next();
  });

  // Apply rate limiting to specific routes
  app.post("/api/auth/login", loginLimiter);
  app.post("/api/auth/register", loginLimiter);

  // API endpoints rate limiting
  app.use("/api/trpc", apiLimiter);

  // Webhook endpoints rate limiting
  app.use("/api/webhooks", webhookLimiter);

  // Export endpoints rate limiting
  app.post("/api/export", exportLimiter);
  app.get("/api/export/:id", exportLimiter);

  // Analytics endpoints rate limiting
  app.use("/api/analytics", analyticsLimiter);

  // Rate limit monitoring
  app.use(rateLimitMonitoring);

  logger.info("Middleware applied successfully");
};

/**
 * Error handling middleware
 */
// @ts-expect-error TS7030
export const errorHandler = (
  err: any,
  req: express.Request,
  res: express.Response,
  // @ts-expect-error TS6133 unused
  next: express.NextFunction
) => {
  logger.error("Request error", {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err.status === 429) {
    return res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    });
  }

  if (err.status === 401) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  if (err.status === 403) {
    return res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Access denied",
      },
    });
  }

  res.status(err.status || 500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    },
  });
};

/**
 * 404 handler
 */
export const notFoundHandler = (
  req: express.Request,
  res: express.Response
) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.path} not found`,
    },
  });
};

export default {
  applyMiddleware,
  errorHandler,
  notFoundHandler,
};
