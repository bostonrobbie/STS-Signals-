/**
 * Connection Middleware
 *
 * Provides robust connection handling with:
 * - Request timeout management
 * - Keep-alive configuration
 * - Connection state tracking
 * - Graceful request termination
 */

import type { Request, Response, NextFunction } from "express";
import type { Server } from "http";

// Default timeout values
const DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds
const DEFAULT_KEEP_ALIVE_TIMEOUT = 65000; // 65 seconds (longer than typical load balancer timeout)
const DEFAULT_HEADERS_TIMEOUT = 60000; // 60 seconds

// Track active requests for graceful shutdown
const activeRequests = new Set<Request>();

/**
 * Configure server timeouts for better connection handling
 */
export function configureServerTimeouts(server: Server): void {
  // Keep-alive timeout - how long to keep idle connections open
  server.keepAliveTimeout = DEFAULT_KEEP_ALIVE_TIMEOUT;

  // Headers timeout - how long to wait for headers
  server.headersTimeout = DEFAULT_HEADERS_TIMEOUT;

  // Max header size (16KB default is usually fine)
  server.maxHeadersCount = 100;

  console.log(
    `[Server] Timeouts configured: keepAlive=${DEFAULT_KEEP_ALIVE_TIMEOUT}ms, headers=${DEFAULT_HEADERS_TIMEOUT}ms`
  );
}

/**
 * Request timeout middleware
 * Ensures requests don't hang indefinitely
 */
export function requestTimeoutMiddleware(
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Track active request
    activeRequests.add(req);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        console.warn(
          `[Timeout] Request timed out after ${timeoutMs}ms: ${req.method} ${req.url}`
        );
        res.status(408).json({
          error: "Request Timeout",
          message: "The request took too long to process. Please try again.",
          code: "REQUEST_TIMEOUT",
        });
      }
    }, timeoutMs);

    // Clean up on response finish
    const cleanup = () => {
      clearTimeout(timeoutId);
      activeRequests.delete(req);
    };

    res.on("finish", cleanup);
    res.on("close", cleanup);

    next();
  };
}

/**
 * Connection keep-alive middleware
 * Adds proper headers for persistent connections
 */
export function keepAliveMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  // Set keep-alive header for HTTP/1.1
  res.setHeader("Connection", "keep-alive");
  res.setHeader(
    "Keep-Alive",
    `timeout=${Math.floor(DEFAULT_KEEP_ALIVE_TIMEOUT / 1000)}`
  );

  next();
}

/**
 * Request tracking middleware for graceful shutdown
 */
export function requestTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  activeRequests.add(req);

  const cleanup = () => {
    activeRequests.delete(req);
  };

  res.on("finish", cleanup);
  res.on("close", cleanup);

  next();
}

/**
 * Get count of active requests
 */
export function getActiveRequestCount(): number {
  return activeRequests.size;
}

/**
 * Wait for all active requests to complete (with timeout)
 */
export async function waitForActiveRequests(
  maxWaitMs: number = 10000
): Promise<void> {
  const startTime = Date.now();

  while (activeRequests.size > 0 && Date.now() - startTime < maxWaitMs) {
    console.log(
      `[Shutdown] Waiting for ${activeRequests.size} active request(s)...`
    );
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (activeRequests.size > 0) {
    console.warn(
      `[Shutdown] ${activeRequests.size} request(s) still active after timeout`
    );
  }
}

/**
 * Error recovery middleware
 * Catches and handles various connection errors gracefully
 */
export function connectionErrorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Handle specific connection errors
  const errorMessage = err.message?.toLowerCase() || "";

  if (
    errorMessage.includes("econnreset") ||
    errorMessage.includes("socket hang up") ||
    errorMessage.includes("connection reset")
  ) {
    console.debug(`[Connection] Client disconnected: ${req.method} ${req.url}`);
    // Don't send response - client is already gone
    return;
  }

  if (errorMessage.includes("etimedout") || errorMessage.includes("timeout")) {
    console.warn(`[Connection] Timeout error: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({
        error: "Request Timeout",
        message: "The connection timed out. Please try again.",
        code: "CONNECTION_TIMEOUT",
      });
    }
    return;
  }

  // Pass other errors to next handler
  next(err);
}

/**
 * CORS preflight handling for better connection reliability
 */
export function corsPreflightMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Handle preflight requests quickly
  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
    res.status(204).end();
    return;
  }

  next();
}
