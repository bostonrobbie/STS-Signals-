import { io, Socket } from "socket.io-client";
import { logger } from "./logger";

/**
 * WebSocket Client for Real-Time Notifications
 * Manages Socket.IO connection and event handling
 */

let socket: Socket | null = null;

/**
 * Initialize WebSocket connection
 */
export const initializeWebSocket = (): Socket => {
  if (socket && socket.connected) {
    logger.info("WebSocket already connected");
    return socket;
  }

  const wsUrl = process.env.REACT_APP_WS_URL || `http://localhost:3000`;

  logger.info("Initializing WebSocket connection", { url: wsUrl });

  socket = io(wsUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  // Connection events
  socket.on("connect", () => {
    logger.info("WebSocket connected", { socketId: socket?.id });
  });

  socket.on("disconnect", reason => {
    logger.warn("WebSocket disconnected", { reason });
  });

  socket.on("connect_error", error => {
    logger.error("WebSocket connection error", error);
  });

  socket.on("error", error => {
    logger.error("WebSocket error", error);
  });

  return socket;
};

/**
 * Get WebSocket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Subscribe to notifications
 */
export const subscribeToNotifications = (userId: string) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  logger.info("Subscribing to notifications", { userId });
  socket.emit("subscribe", { userId });
};

/**
 * Unsubscribe from notifications
 */
export const unsubscribeFromNotifications = (userId: string) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  logger.info("Unsubscribing from notifications", { userId });
  socket.emit("unsubscribe", { userId });
};

/**
 * Listen for trade alerts
 */
export const onTradeAlert = (callback: (data: any) => void) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.on("trade_alert", callback);
};

/**
 * Listen for strategy signals
 */
export const onStrategySignal = (callback: (data: any) => void) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.on("strategy_signal", callback);
};

/**
 * Listen for portfolio updates
 */
export const onPortfolioUpdate = (callback: (data: any) => void) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.on("portfolio_update", callback);
};

/**
 * Listen for system notifications
 */
export const onSystemNotification = (callback: (data: any) => void) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.on("system_notification", callback);
};

/**
 * Listen for generic notifications
 */
export const onNotification = (callback: (notification: any) => void) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.on("notification", callback);
};

/**
 * Remove listener
 */
export const removeListener = (event: string) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.off(event);
};

/**
 * Disconnect WebSocket
 */
export const disconnectWebSocket = () => {
  if (socket) {
    logger.info("Disconnecting WebSocket");
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit custom event
 */
export const emit = (event: string, data: any) => {
  if (!socket) {
    logger.warn("WebSocket not initialized");
    return;
  }

  socket.emit(event, data);
};

/**
 * Check if connected
 */
export const isConnected = (): boolean => {
  return socket ? socket.connected : false;
};

export default {
  initializeWebSocket,
  getSocket,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  onTradeAlert,
  onStrategySignal,
  onPortfolioUpdate,
  onSystemNotification,
  onNotification,
  removeListener,
  disconnectWebSocket,
  emit,
  isConnected,
};
