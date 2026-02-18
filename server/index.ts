import "dotenv/config";
import { logger } from "./core/logger";
import {
  initializeServer,
  startServer,
  setupSignalHandlers,
} from "./_core/serverInit";
import express from "express";

/**
 * Main server entry point
 * Initializes and starts the Express server with all middleware, routes, and WebSocket
 */

const main = async () => {
  try {
    logger.info("Starting Intraday Strategies Dashboard server...");
    logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(
      `Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`
    );

    // Create Express app
    const app = express();

    // Initialize server with all middleware, routes, and WebSocket
    const httpServer = initializeServer(app);

    // Setup signal handlers for graceful shutdown
    setupSignalHandlers(httpServer);

    // Start server
    const port = parseInt(process.env.PORT || "3000", 10);
    await startServer(httpServer, port);

    logger.info("✅ Server started successfully");
    logger.info(`📊 Admin Dashboard: http://localhost:${port}/admin`);
    logger.info(`🔔 Notifications: WebSocket enabled`);
    logger.info(
      `📈 Monitoring: Prometheus metrics available at http://localhost:${port}/metrics`
    );
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
};

// Run the main function
main();
