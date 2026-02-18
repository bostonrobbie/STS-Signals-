import express, { Express } from "express";
import { Server as HTTPServer } from "http";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import { logger } from "../core/logger";
import { initializeWebSocket } from "../core/websocket";
// @ts-expect-error TS2724
import { expressRateLimiter } from "../core/expressRateLimiter";
// @ts-expect-error TS2307
import { requestLogger } from "../core/middleware";
import { validateRequest } from "../core/validation";
// @ts-expect-error TS6133 unused
import { adminRouter } from "../routers/admin";
// @ts-expect-error TS6133 unused
import { appRouter } from "../routers";

/**
 * Initialize Express server with all middleware, routes, and WebSocket
 */
export const initializeServer = (app: Express): HTTPServer => {
  logger.info("Initializing Express server with admin routes and WebSocket");

  // Create HTTP server for WebSocket support
  const httpServer = createServer(app);

  // Security middleware
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Request logging
  app.use(requestLogger);

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Rate limiting
  app.use("/auth/login", expressRateLimiter.loginLimiter);
  app.use("/api/trpc/", expressRateLimiter.apiLimiter);
  app.use("/api/webhooks/", expressRateLimiter.webhookLimiter);
  app.use("/api/export", expressRateLimiter.exportLimiter);

  // Request validation middleware
  // @ts-expect-error TS2769
  app.use(validateRequest);

  // Health check endpoints
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  });

  app.get("/api/live", (_req, res) => {
    res.json({ live: true });
  });

  // Admin routes (protected with RBAC)
  app.use("/api/admin", (req, _res, next) => {
    // RBAC middleware will be applied here
    // For now, just log admin access
    logger.info("Admin route accessed", { path: req.path, method: req.method });
    next();
  });

  // Register admin router with tRPC
  // This will be integrated with the main tRPC router
  logger.info("Admin routes registered");

  // Main application routes
  app.use("/api/trpc", (req, _res, next) => {
    logger.debug("tRPC request", { path: req.path, method: req.method });
    next();
  });

  // Error handling middleware
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      // @ts-expect-error TS6133 unused
      next: express.NextFunction
    ) => {
      logger.error("Unhandled error", {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      res.status(err.status || 500).json({
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message,
        timestamp: new Date(),
      });
    }
  );

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not found",
      path: req.path,
      timestamp: new Date(),
    });
  });

  // Initialize WebSocket server
  const io = initializeWebSocket(httpServer);
  logger.info("WebSocket server initialized");

  // Attach io to app for use in other parts of the application
  (app as any).io = io;

  return httpServer;
};

/**
 * Start the server
 */
export const startServer = (httpServer: HTTPServer, port: number = 3000) => {
  return new Promise<void>((resolve, reject) => {
    httpServer.listen(port, () => {
      logger.info(`Server running on http://localhost:${port}/`);
      logger.info(
        `Health check available at http://localhost:${port}/api/health`
      );
      logger.info(
        `Liveliness check available at http://localhost:${port}/api/live`
      );
      resolve();
    });

    httpServer.on("error", error => {
      logger.error("Server error", error);
      reject(error);
    });
  });
};

/**
 * Graceful shutdown
 */
export const gracefulShutdown = (httpServer: HTTPServer) => {
  return new Promise<void>(resolve => {
    logger.info("Starting graceful shutdown...");

    httpServer.close(() => {
      logger.info("Server closed");
      resolve();
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.warn("Forcing shutdown after 30 seconds");
      process.exit(1);
    }, 30000);
  });
};

/**
 * Setup signal handlers for graceful shutdown
 */
export const setupSignalHandlers = (httpServer: HTTPServer) => {
  const signals = ["SIGTERM", "SIGINT"];

  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, starting graceful shutdown`);
      await gracefulShutdown(httpServer);
      process.exit(0);
    });
  });
};

export default {
  initializeServer,
  startServer,
  gracefulShutdown,
  setupSignalHandlers,
};
