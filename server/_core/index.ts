import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer, type Server } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import authRouter from "../auth.simple";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite, closeVite } from "./vite";
import { seoRouter } from "../seoRoutes";
import {
  registerSSEClient,
  getConnectedClientCount,
} from "../sseNotifications";
import stripeWebhookRouter from "../stripe/stripeWebhook";
import tradingviewWebhookRouter from "../tradingviewWebhook";
import { securityHeadersMiddleware } from "./securityMiddleware";
import { prerenderMiddleware } from "../prerenderMiddleware";
import {
  initSentry,
  sentryRequestHandler,
  sentryErrorHandler,
  flushSentry,
} from "./sentry";
import { getHealthStatus } from "./monitoring";
import {
  rateLimitMiddleware,
  strictRateLimitMiddleware,
} from "./rateLimitMiddleware";
import {
  configureServerTimeouts,
  requestTimeoutMiddleware,
  keepAliveMiddleware,
  connectionErrorMiddleware,
  waitForActiveRequests,
  getActiveRequestCount,
} from "./connectionMiddleware";
import { startKillSwitchMonitor } from "../services/killSwitchMonitor";
import { reapExpiredFingerprints } from "./commsGuard";

// Server state tracking
let httpServer: Server | null = null;
let isShuttingDown = false;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Enhanced health check endpoint handler with database metrics
async function healthCheckHandler(
  _req: express.Request,
  res: express.Response
) {
  try {
    const healthStatus = await getHealthStatus();

    // Override status if shutting down
    if (isShuttingDown) {
      healthStatus.status = "unhealthy";
    }

    const statusCode =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
          ? 200
          : 503;

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    console.error("[Health Check] Error:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Failed to retrieve health status",
    });
  }
}

// Simple health check for load balancers (minimal overhead)
function livelinessCheckHandler(_req: express.Request, res: express.Response) {
  if (isShuttingDown) {
    res.status(503).send("shutting_down");
  } else {
    res.status(200).send("ok");
  }
}

async function startServer() {
  // Initialize Sentry before anything else
  initSentry();

  // Start the kill-switch health monitor so if OUTBOUND_COMMS_ENABLED
  // is left off for >60 minutes we surface a warning to admin UI and
  // log it loudly every 10 minutes. See services/killSwitchMonitor.ts.
  startKillSwitchMonitor();

  // Sweep expired signal-fingerprint rows once on boot, then every 6h.
  // Keeps the signal_fingerprints table from growing unboundedly.
  // No-op if DB not reachable / table missing.
  reapExpiredFingerprints().catch(() => {
    /* swallowed — commsGuard logs internally */
  });
  const fingerprintReaper = setInterval(
    () => {
      reapExpiredFingerprints().catch(() => {
        /* swallowed */
      });
    },
    6 * 60 * 60 * 1000
  );
  if (typeof fingerprintReaper.unref === "function") fingerprintReaper.unref();

  const app = express();
  httpServer = createServer(app);

  // Configure server timeouts for better connection handling
  configureServerTimeouts(httpServer);

  // Sentry request handler must be first
  app.use(sentryRequestHandler());

  // Apply keep-alive headers for persistent connections
  app.use(keepAliveMiddleware);

  // Apply request timeout middleware (30 second default)
  app.use(requestTimeoutMiddleware(30000));

  // Apply security headers to all responses
  app.use(securityHeadersMiddleware);

  // CORS configuration for mobile app and cross-origin requests
  app.use(
    cors({
      origin: [
        /\.manus\.computer$/, // All Manus dev subdomains
        /\.manus\.space$/, // All Manus production subdomains
        /\.manusvm\.computer$/, // Manus VM subdomains
        "http://localhost:8081", // Expo local development
        "http://localhost:19006", // Expo web
        "http://localhost:3000", // Local web development
        "exp://localhost:8081", // Expo Go
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
  );

  // SEO routes - serve curated robots.txt and sitemap.xml before any other middleware
  // This overrides the auto-generated versions from the hosting infrastructure
  app.use(seoRouter);

  // Health check endpoints (before rate limiting and body parser for minimal overhead)
  app.get("/api/health", healthCheckHandler);
  app.get("/health", healthCheckHandler);
  app.get("/api/live", livelinessCheckHandler);
  app.get("/live", livelinessCheckHandler);

  // Apply rate limiting to API routes (after health checks)
  app.use("/api/trpc", rateLimitMiddleware);

  // Stricter rate limiting for sensitive endpoints
  app.use("/api/webhook", strictRateLimitMiddleware);
  app.use("/api/oauth", strictRateLimitMiddleware);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Simple email-based auth endpoints
  app.use("/api/auth", authRouter);

  // TradingView webhook endpoints (mounted at /api/webhook to match UI display)
  app.use("/api/webhook", tradingviewWebhookRouter);

  // SSE endpoint for real-time trade notifications
  app.get("/api/notifications/stream", (req, res) => {
    try {
      console.log(
        "[SSE] New client connection request from:",
        req.headers.origin
      );

      // Set CORS headers explicitly for SSE
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }

      const userId = (req as any).user?.id; // Optional: get user ID from session
      console.log("[SSE] User ID:", userId || "anonymous");
      registerSSEClient(res, userId);
    } catch (error) {
      console.error("[SSE] Failed to register client:", error);
      res.status(500).json({ error: "Failed to establish SSE connection" });
    }
  });

  // SSE status endpoint
  app.get("/api/notifications/status", (_req, res) => {
    res.json({
      connectedClients: getConnectedClientCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // Stripe webhook (must be before json body parser for raw body access)
  app.use("/api/stripe/webhook", stripeWebhookRouter);

  // tRPC API with error handling
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ error, path }) => {
        // Log errors but don't crash the server
        console.error(`[tRPC Error] ${path}:`, error.message);
      },
    })
  );

  // Pre-render middleware for SEO crawlers (before Vite/static serving)
  // Serves fully rendered HTML to search engine bots for better indexing
  app.use(prerenderMiddleware);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    try {
      await setupVite(app, httpServer);
    } catch (viteError) {
      console.error(
        "[Vite] Setup failed, falling back to static serving:",
        viteError
      );
      serveStatic(app);
    }
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Connection error middleware - handles connection-specific errors
  app.use(connectionErrorMiddleware);

  // Global error handler for uncaught errors in routes
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[Server Error]", err.message);

      // Don't crash on WebSocket/HMR errors
      if (err.message?.includes("websocket") || err.message?.includes("HMR")) {
        res.status(200).end();
        return;
      }

      res.status(500).json({
        error: "Internal Server Error",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "An unexpected error occurred",
      });
    }
  );

  // Sentry error handler must be after all routes
  app.use(sentryErrorHandler());

  httpServer.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(
      `Health check available at http://localhost:${port}/api/health`
    );
    console.log(
      `Liveliness check available at http://localhost:${port}/api/live`
    );
  });

  // Handle server errors
  httpServer.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use`);
    } else {
      console.error("[Server Error]", error);
    }
  });

  // Handle WebSocket upgrade errors gracefully
  httpServer.on("upgrade", (_request, socket) => {
    socket.on("error", err => {
      // Silently handle WebSocket errors (common in proxy environments)
      console.debug(
        "[WebSocket] Connection error (expected in proxy):",
        err.message
      );
    });
  });

  // Graceful shutdown handlers
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`${signal} received, initiating graceful shutdown...`);
    console.log(`Active requests: ${getActiveRequestCount()}`);

    // Wait for active requests to complete (max 10 seconds)
    await waitForActiveRequests(10000);

    // Stop accepting new connections
    if (httpServer) {
      httpServer.close(async () => {
        console.log("HTTP server closed");

        // Close Vite dev server if running
        await closeVite();

        // Flush Sentry events
        await flushSentry();

        console.log("Graceful shutdown complete");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  // Handle uncaught exceptions without crashing
  process.on("uncaughtException", error => {
    console.error("[Uncaught Exception]", error);
    // Don't exit for non-fatal errors
    if (
      error.message?.includes("ECONNRESET") ||
      error.message?.includes("websocket") ||
      error.message?.includes("socket hang up")
    ) {
      console.log("[Recovery] Non-fatal error, continuing...");
      return;
    }
    // For fatal errors, initiate graceful shutdown
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, _promise) => {
    console.error("[Unhandled Rejection]", reason);
    // Log but don't crash for network-related rejections
    if (
      reason instanceof Error &&
      (reason.message?.includes("ECONNRESET") ||
        reason.message?.includes("websocket") ||
        reason.message?.includes("fetch"))
    ) {
      console.log("[Recovery] Network error, continuing...");
      return;
    }
  });
}

startServer().catch(error => {
  console.error("[Server] Failed to start:", error);
  process.exit(1);
});
