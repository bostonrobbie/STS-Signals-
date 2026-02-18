import React, { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp,
} from "lucide-react";
import { cn } from "../lib/utils";
import { formatNYTime } from "@/lib/timezone";

/**
 * Notification Center Component
 * Displays real-time notifications with WebSocket support
 */

export interface Notification {
  id: string;
  type:
    | "trade_alert"
    | "strategy_signal"
    | "portfolio_update"
    | "system_notification";
  title: string;
  message: string;
  priority?: "low" | "normal" | "high" | "critical";
  timestamp: Date;
  read: boolean;
  data?: Record<string, any>;
}

interface NotificationCenterProps {
  onNotificationReceived?: (notification: Notification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  onNotificationReceived,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Connect to WebSocket and listen for notifications
  useEffect(() => {
    // This will be connected to the actual WebSocket server
    // For now, this is a placeholder implementation

    // @ts-expect-error TS6133 unused
    const _handleNotification = (notification: Notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
      setUnreadCount(prev => prev + 1);

      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }

      // Auto-dismiss low priority notifications after 5 seconds
      if (notification.priority === "low") {
        setTimeout(() => {
          dismissNotification(notification.id);
        }, 5000);
      }
    };

    // WebSocket connection would go here
    // socket.on('notification', handleNotification);

    return () => {
      // Cleanup WebSocket listener
    };
  }, [onNotificationReceived]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const getNotificationIcon = (
    type: Notification["type"],
    priority?: string
  ) => {
    switch (type) {
      case "trade_alert":
        return <TrendingUp className="w-4 h-4" />;
      case "strategy_signal":
        return <Info className="w-4 h-4" />;
      case "portfolio_update":
        return <CheckCircle className="w-4 h-4" />;
      case "system_notification":
        return priority === "critical" ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Info className="w-4 h-4" />
        );
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (
    // @ts-expect-error TS6133 unused
    type: Notification["type"],
    priority?: string
  ) => {
    if (priority === "critical") return "bg-red-50 border-red-200";
    if (priority === "high") return "bg-orange-50 border-orange-200";
    if (priority === "normal") return "bg-blue-50 border-blue-200";
    return "bg-slate-50 border-slate-200";
  };

  const getIconColor = (_type: Notification["type"], priority?: string) => {
    if (priority === "critical") return "text-red-600";
    if (priority === "high") return "text-orange-600";
    if (priority === "normal") return "text-blue-600";
    return "text-slate-600";
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 border-l-4 cursor-pointer hover:bg-slate-50 transition-colors",
                      getNotificationColor(
                        notification.type,
                        notification.priority
                      ),
                      !notification.read ? "bg-opacity-100" : "bg-opacity-50"
                    )}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1",
                          getIconColor(notification.type, notification.priority)
                        )}
                      >
                        {getNotificationIcon(
                          notification.type,
                          notification.priority
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">
                          {notification.title}
                        </p>
                        <p className="text-slate-600 text-sm mt-1 line-clamp-2">
                          {notification.message}
                        </p>

                        {notification.data && (
                          <div className="mt-2 text-xs text-slate-500 space-y-1">
                            {notification.type === "trade_alert" &&
                              notification.data.symbol && (
                                <p>
                                  <span className="font-medium">
                                    {notification.data.symbol}
                                  </span>
                                  {" @ "}
                                  <span className="font-medium">
                                    ${notification.data.price}
                                  </span>
                                </p>
                              )}
                            {notification.type === "strategy_signal" &&
                              notification.data.signal && (
                                <p>
                                  Signal:{" "}
                                  <span className="font-medium">
                                    {notification.data.signal.toUpperCase()}
                                  </span>
                                  {" (Strength: "}
                                  <span className="font-medium">
                                    {notification.data.strength}%
                                  </span>
                                  {")"}
                                </p>
                              )}
                          </div>
                        )}

                        <p className="text-xs text-slate-500 mt-2">
                          {formatNYTime(notification.timestamp)} ET
                        </p>
                      </div>

                      <button
                        onClick={e => {
                          e.stopPropagation();
                          dismissNotification(notification.id);
                        }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 text-center">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
