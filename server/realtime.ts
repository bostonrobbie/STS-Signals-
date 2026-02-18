/**
 * Real-time Events Service
 * Server-Sent Events (SSE) for live dashboard updates
 */

import { Router, Request, Response } from 'express';
import { EventEmitter } from 'events';

// Event types
export type RealtimeEventType = 
  | 'trade_executed'
  | 'trade_error'
  | 'position_opened'
  | 'position_closed'
  | 'webhook_received'
  | 'webhook_processed'
  | 'webhook_failed'
  | 'retry_scheduled'
  | 'retry_completed'
  | 'notification';

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: number;
  data: Record<string, unknown>;
  userId?: number;
}

// Global event emitter for broadcasting events
class RealtimeEventEmitter extends EventEmitter {
  private static instance: RealtimeEventEmitter;

  private constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent SSE connections
  }

  static getInstance(): RealtimeEventEmitter {
    if (!RealtimeEventEmitter.instance) {
      RealtimeEventEmitter.instance = new RealtimeEventEmitter();
    }
    return RealtimeEventEmitter.instance;
  }
}

export const realtimeEmitter = RealtimeEventEmitter.getInstance();

// Connected clients tracking
interface SSEClient {
  id: string;
  userId: number | null;
  response: Response;
  connectedAt: Date;
}

const clients: Map<string, SSEClient> = new Map();

/**
 * Broadcast an event to all connected clients
 */
export function broadcastEvent(event: RealtimeEvent): void {
  const eventData = JSON.stringify(event);
  const message = `data: ${eventData}\n\n`;

  clients.forEach((client) => {
    // If event has a userId, only send to that user
    if (event.userId && client.userId !== event.userId) {
      return;
    }

    try {
      client.response.write(message);
    } catch (error) {
      console.error(`[SSE] Error sending to client ${client.id}:`, error);
      clients.delete(client.id);
    }
  });

  // Also emit on the event emitter for internal listeners
  realtimeEmitter.emit('event', event);
}

/**
 * Broadcast a trade execution event
 */
export function broadcastTradeExecuted(trade: {
  id: number;
  strategyId: number;
  strategySymbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  quantity: number;
}, userId?: number): void {
  broadcastEvent({
    type: 'trade_executed',
    timestamp: Date.now(),
    data: trade,
    userId,
  });
}

/**
 * Broadcast a position opened event
 */
export function broadcastPositionOpened(position: {
  strategyId: number;
  strategySymbol: string;
  direction: string;
  entryPrice: number;
  quantity: number;
}, userId?: number): void {
  broadcastEvent({
    type: 'position_opened',
    timestamp: Date.now(),
    data: position,
    userId,
  });
}

/**
 * Broadcast a position closed event
 */
export function broadcastPositionClosed(position: {
  strategyId: number;
  strategySymbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
}, userId?: number): void {
  broadcastEvent({
    type: 'position_closed',
    timestamp: Date.now(),
    data: position,
    userId,
  });
}

/**
 * Broadcast a webhook received event
 */
export function broadcastWebhookReceived(webhook: {
  correlationId: string;
  strategySymbol: string;
  action: string;
}): void {
  broadcastEvent({
    type: 'webhook_received',
    timestamp: Date.now(),
    data: webhook,
  });
}

/**
 * Broadcast a webhook processed event
 */
export function broadcastWebhookProcessed(webhook: {
  correlationId: string;
  strategySymbol: string;
  success: boolean;
  message?: string;
}): void {
  broadcastEvent({
    type: 'webhook_processed',
    timestamp: Date.now(),
    data: webhook,
  });
}

/**
 * Broadcast a webhook failed event
 */
export function broadcastWebhookFailed(webhook: {
  correlationId: string;
  strategySymbol: string;
  error: string;
  willRetry: boolean;
}): void {
  broadcastEvent({
    type: 'webhook_failed',
    timestamp: Date.now(),
    data: webhook,
  });
}

/**
 * Broadcast a notification event
 */
export function broadcastNotification(notification: {
  id: number;
  type: string;
  title: string;
  message: string;
}, userId: number): void {
  broadcastEvent({
    type: 'notification',
    timestamp: Date.now(),
    data: notification,
    userId,
  });
}

/**
 * Get connected client count
 */
export function getConnectedClientCount(): number {
  return clients.size;
}

/**
 * Get connected clients info
 */
export function getConnectedClients(): Array<{
  id: string;
  userId: number | null;
  connectedAt: Date;
}> {
  return Array.from(clients.values()).map(client => ({
    id: client.id,
    userId: client.userId,
    connectedAt: client.connectedAt,
  }));
}

/**
 * Create the SSE router
 */
export function createRealtimeRouter(): Router {
  const router = Router();

  // SSE endpoint
  router.get('/events', (req: Request, res: Response) => {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Generate client ID
    const clientId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get user ID from session if available
    const userId = (req as any).user?.id || null;

    // Register client
    const client: SSEClient = {
      id: clientId,
      userId,
      response: res,
      connectedAt: new Date(),
    };
    clients.set(clientId, client);

    console.log(`[SSE] Client ${clientId} connected (user: ${userId || 'anonymous'}). Total clients: ${clients.size}`);

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() })}\n\n`);

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
      } catch (error) {
        clearInterval(pingInterval);
        clients.delete(clientId);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
      clients.delete(clientId);
      console.log(`[SSE] Client ${clientId} disconnected. Total clients: ${clients.size}`);
    });
  });

  // Status endpoint
  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      connectedClients: clients.size,
      clients: getConnectedClients(),
    });
  });

  return router;
}

/**
 * Send a test event (for debugging)
 */
export function sendTestEvent(): void {
  broadcastEvent({
    type: 'notification',
    timestamp: Date.now(),
    data: {
      id: 0,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification from the server.',
    },
  });
}
