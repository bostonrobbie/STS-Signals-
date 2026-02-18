/**
 * Server-Sent Events (SSE) Notification Service
 *
 * Provides real-time push notifications to connected clients when
 * new trades are executed via webhooks. This allows the dashboard
 * to update automatically without requiring manual refresh.
 */

import { Response } from "express";

// Store connected SSE clients
interface SSEClient {
  id: string;
  userId?: string;
  response: Response;
  connectedAt: Date;
}

// Global client registry
const clients: Map<string, SSEClient> = new Map();

// Trade notification payload
export interface TradeNotification {
  type: "entry" | "exit" | "test";
  strategySymbol: string;
  direction: "Long" | "Short";
  price: number;
  pnl?: number;
  tradeId?: number;
  positionId?: number;
  timestamp: Date;
  message: string;
  // Position sizing information (for user-specific alerts)
  positionSizing?: {
    baseQuantity: number; // Original signal quantity
    userQuantity: number; // Scaled quantity for user's account
    contractType: "mini" | "micro"; // Contract type
    accountValue: number; // User's account value
    scalingFactor: number; // accountValue / backtestCapital
    isLeveraged: boolean; // Whether using leveraged sizing
  };
}

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Register a new SSE client connection
 */
export function registerSSEClient(res: Response, userId?: string): string {
  const clientId = generateClientId();

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send initial connection message
  res.write(`event: connected\n`);
  res.write(
    `data: ${JSON.stringify({ clientId, message: "Connected to trade notifications" })}\n\n`
  );

  // Store client
  const client: SSEClient = {
    id: clientId,
    userId,
    response: res,
    connectedAt: new Date(),
  };
  clients.set(clientId, client);

  console.log(`[SSE] Client connected: ${clientId} (total: ${clients.size})`);

  // Handle client disconnect
  res.on("close", () => {
    clients.delete(clientId);
    console.log(
      `[SSE] Client disconnected: ${clientId} (remaining: ${clients.size})`
    );
  });

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    if (clients.has(clientId)) {
      try {
        res.write(`event: heartbeat\n`);
        res.write(
          `data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`
        );
      } catch (error) {
        // Client disconnected
        clearInterval(heartbeatInterval);
        clients.delete(clientId);
      }
    } else {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  return clientId;
}

/**
 * Broadcast a trade notification to all connected clients
 */
export function broadcastTradeNotification(
  notification: TradeNotification
): void {
  const eventData = JSON.stringify({
    ...notification,
    timestamp: notification.timestamp.toISOString(),
  });

  console.log(
    `[SSE] Broadcasting trade notification to ${clients.size} clients:`,
    notification.message
  );

  let successCount = 0;
  let failCount = 0;

  clients.forEach((client, clientId) => {
    try {
      client.response.write(`event: trade\n`);
      client.response.write(`data: ${eventData}\n\n`);
      successCount++;
    } catch (error) {
      console.error(`[SSE] Failed to send to client ${clientId}:`, error);
      clients.delete(clientId);
      failCount++;
    }
  });

  console.log(
    `[SSE] Broadcast complete: ${successCount} success, ${failCount} failed`
  );
}

/**
 * Send a notification to a specific user (by userId)
 */
export function notifyUser(
  userId: string,
  notification: TradeNotification
): void {
  const eventData = JSON.stringify({
    ...notification,
    timestamp: notification.timestamp.toISOString(),
  });

  clients.forEach((client, clientId) => {
    if (client.userId === userId) {
      try {
        client.response.write(`event: trade\n`);
        client.response.write(`data: ${eventData}\n\n`);
      } catch (error) {
        console.error(`[SSE] Failed to send to user ${userId}:`, error);
        clients.delete(clientId);
      }
    }
  });
}

/**
 * Get the number of connected clients
 */
export function getConnectedClientCount(): number {
  return clients.size;
}

/**
 * Get all connected client IDs (for debugging)
 */
export function getConnectedClients(): Array<{
  id: string;
  userId?: string;
  connectedAt: Date;
}> {
  return Array.from(clients.values()).map(c => ({
    id: c.id,
    userId: c.userId,
    connectedAt: c.connectedAt,
  }));
}
