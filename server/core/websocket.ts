import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "./logger";
// @ts-expect-error TS2305
import { redis } from "../db";

/**
 * WebSocket Server for Real-Time Notifications
 * Handles live trade alerts, strategy signals, and system notifications
 */

export interface NotificationPayload {
  type:
    | "trade_alert"
    | "strategy_signal"
    | "system_notification"
    | "portfolio_update";
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  priority?: "low" | "normal" | "high" | "critical";
}

export interface TradeAlertPayload extends NotificationPayload {
  type: "trade_alert";
  data: {
    tradeId: number;
    strategyId: number;
    symbol: string;
    action: "entry" | "exit";
    price: number;
    quantity: number;
    multiplier?: number;
    pnl?: number;
  };
}

export interface StrategySignalPayload extends NotificationPayload {
  type: "strategy_signal";
  data: {
    strategyId: number;
    signal: "buy" | "sell" | "hold";
    strength: number; // 0-100
    reason: string;
    targetPrice?: number;
    stopLoss?: number;
  };
}

export interface PortfolioUpdatePayload extends NotificationPayload {
  type: "portfolio_update";
  data: {
    totalReturn: number;
    dailyReturn: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

// Store connected users
const connectedUsers = new Map<string, Set<string>>();

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    /**
     * Subscribe to user notifications
     */
    socket.on("subscribe", (userId: string) => {
      try {
        socket.join(`user:${userId}`);

        if (!connectedUsers.has(userId)) {
          connectedUsers.set(userId, new Set());
        }
        connectedUsers.get(userId)!.add(socket.id);

        logger.info(`User ${userId} subscribed to notifications`, {
          socketId: socket.id,
        });

        // Send welcome message
        socket.emit("subscribed", {
          message: "Successfully subscribed to notifications",
          userId,
          timestamp: new Date(),
        });
      } catch (error) {
        logger.error("Failed to subscribe to notifications", error);
        socket.emit("error", { message: "Failed to subscribe" });
      }
    });

    /**
     * Unsubscribe from user notifications
     */
    socket.on("unsubscribe", (userId: string) => {
      try {
        socket.leave(`user:${userId}`);

        const userSockets = connectedUsers.get(userId);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            connectedUsers.delete(userId);
          }
        }

        logger.info(`User ${userId} unsubscribed from notifications`, {
          socketId: socket.id,
        });
      } catch (error) {
        logger.error("Failed to unsubscribe from notifications", error);
      }
    });

    /**
     * Subscribe to strategy signals
     */
    socket.on("subscribe_strategy", (strategyId: number) => {
      try {
        socket.join(`strategy:${strategyId}`);
        logger.info(`Client subscribed to strategy ${strategyId}`, {
          socketId: socket.id,
        });
      } catch (error) {
        logger.error("Failed to subscribe to strategy", error);
      }
    });

    /**
     * Subscribe to portfolio updates
     */
    socket.on("subscribe_portfolio", (userId: string) => {
      try {
        socket.join(`portfolio:${userId}`);
        logger.info(
          `Client subscribed to portfolio updates for user ${userId}`,
          { socketId: socket.id }
        );
      } catch (error) {
        logger.error("Failed to subscribe to portfolio", error);
      }
    });

    /**
     * Ping/Pong for connection health check
     */
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date() });
    });

    /**
     * Disconnect handler
     */
    socket.on("disconnect", () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);

      // Clean up connected users
      // @ts-expect-error TS2802
      for (const [userId, sockets] of connectedUsers.entries()) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });

    /**
     * Error handler
     */
    socket.on("error", error => {
      logger.error("WebSocket error", error);
    });
  });

  return io;
};

/**
 * Send notification to user
 */
export const sendNotificationToUser = (
  io: SocketIOServer,
  userId: string,
  notification: NotificationPayload
) => {
  try {
    io.to(`user:${userId}`).emit("notification", notification);

    // Store in Redis for offline delivery
    const key = `notifications:${userId}`;
    const serialized = JSON.stringify(notification);
    redis.lpush(key, serialized);
    redis.ltrim(key, 0, 99); // Keep last 100 notifications
    redis.expire(key, 7 * 24 * 60 * 60); // 7 days

    logger.info(`Notification sent to user ${userId}`, {
      type: notification.type,
      priority: notification.priority,
    });
  } catch (error) {
    logger.error(`Failed to send notification to user ${userId}`, error);
  }
};

/**
 * Send trade alert
 */
export const sendTradeAlert = (
  io: SocketIOServer,
  userId: string,
  tradeAlert: TradeAlertPayload
) => {
  sendNotificationToUser(io, userId, tradeAlert);
};

/**
 * Send strategy signal
 */
export const sendStrategySignal = (
  io: SocketIOServer,
  strategyId: number,
  signal: StrategySignalPayload
) => {
  try {
    io.to(`strategy:${strategyId}`).emit("strategy_signal", signal);
    logger.info(`Strategy signal sent for strategy ${strategyId}`, {
      signal: signal.data.signal,
      strength: signal.data.strength,
    });
  } catch (error) {
    logger.error(
      `Failed to send strategy signal for strategy ${strategyId}`,
      error
    );
  }
};

/**
 * Send portfolio update
 */
export const sendPortfolioUpdate = (
  io: SocketIOServer,
  userId: string,
  update: PortfolioUpdatePayload
) => {
  try {
    io.to(`portfolio:${userId}`).emit("portfolio_update", update);
    logger.info(`Portfolio update sent to user ${userId}`, {
      totalReturn: update.data.totalReturn,
      winRate: update.data.winRate,
    });
  } catch (error) {
    logger.error(`Failed to send portfolio update to user ${userId}`, error);
  }
};

/**
 * Broadcast system notification
 */
export const broadcastSystemNotification = (
  io: SocketIOServer,
  notification: NotificationPayload
) => {
  try {
    io.emit("system_notification", notification);
    logger.info("System notification broadcasted", {
      message: notification.message,
    });
  } catch (error) {
    logger.error("Failed to broadcast system notification", error);
  }
};

/**
 * Get connected users count
 */
export const getConnectedUsersCount = (): number => {
  return connectedUsers.size;
};

/**
 * Get user socket count
 */
export const getUserSocketCount = (userId: string): number => {
  return connectedUsers.get(userId)?.size || 0;
};

/**
 * Get offline notifications for user
 */
export const getOfflineNotifications = async (userId: string) => {
  try {
    const key = `notifications:${userId}`;
    const notifications = await redis.lrange(key, 0, -1);
    return notifications.map((n: any) => JSON.parse(n) as NotificationPayload);
  } catch (error) {
    logger.error(
      `Failed to get offline notifications for user ${userId}`,
      error
    );
    return [];
  }
};

/**
 * Clear offline notifications
 */
export const clearOfflineNotifications = async (userId: string) => {
  try {
    const key = `notifications:${userId}`;
    await redis.del(key);
    logger.info(`Offline notifications cleared for user ${userId}`);
  } catch (error) {
    logger.error(
      `Failed to clear offline notifications for user ${userId}`,
      error
    );
  }
};

/**
 * Get WebSocket server stats
 */
export const getWebSocketStats = () => {
  return {
    connectedUsers: connectedUsers.size,
    totalConnections: Array.from(connectedUsers.values()).reduce(
      (sum, sockets) => sum + sockets.size,
      0
    ),
    timestamp: new Date(),
  };
};

export default {
  initializeWebSocket,
  sendNotificationToUser,
  sendTradeAlert,
  sendStrategySignal,
  sendPortfolioUpdate,
  broadcastSystemNotification,
  getConnectedUsersCount,
  getUserSocketCount,
  getOfflineNotifications,
  clearOfflineNotifications,
  getWebSocketStats,
};
