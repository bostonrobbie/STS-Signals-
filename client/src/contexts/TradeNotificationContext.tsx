import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

// Trade notification from SSE
export interface TradeNotification {
  type: "entry" | "exit" | "test";
  strategySymbol: string;
  direction: "Long" | "Short";
  price: number;
  pnl?: number;
  tradeId?: number;
  positionId?: number;
  timestamp: string;
  message: string;
}

interface TradeNotificationContextType {
  isConnected: boolean;
  notifications: TradeNotification[];
  latestNotification: TradeNotification | null;
  unreadCount: number;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const TradeNotificationContext =
  createContext<TradeNotificationContextType | null>(null);

// Audio notification sound (simple beep)
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Hz
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log("[Notification] Audio not available:", e);
  }
};

export function TradeNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<TradeNotification[]>([]);
  const [latestNotification, setLatestNotification] =
    useState<TradeNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("tradeNotificationSound");
    return saved !== "false"; // Default to true
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem("tradeNotificationSound", soundEnabled.toString());
  }, [soundEnabled]);

  // Connect to SSE endpoint
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const baseUrl = window.location.origin;
    const eventSource = new EventSource(`${baseUrl}/api/notifications/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("[SSE] Connected to trade notifications");
      setIsConnected(true);
    };

    eventSource.onerror = error => {
      console.error("[SSE] Connection error:", error);
      setIsConnected(false);
      eventSource.close();

      // Reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("[SSE] Attempting to reconnect...");
        connect();
      }, 5000);
    };

    // Handle connection event
    eventSource.addEventListener("connected", event => {
      const data = JSON.parse(event.data);
      console.log("[SSE] Connection confirmed:", data);
    });

    // Handle heartbeat
    eventSource.addEventListener("heartbeat", () => {
      // Keep-alive, no action needed
    });

    // Handle trade notifications
    eventSource.addEventListener("trade", event => {
      const notification: TradeNotification = JSON.parse(event.data);
      console.log("[SSE] Trade notification received:", notification);

      // Add to notifications list
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
      setLatestNotification(notification);
      setUnreadCount(prev => prev + 1);

      // Play sound if enabled
      if (soundEnabled) {
        playNotificationSound();
      }

      // Show toast notification
      const isProfit = notification.pnl !== undefined && notification.pnl >= 0;
      const title =
        notification.type === "entry"
          ? `📈 New ${notification.direction} Entry`
          : isProfit
            ? "✅ Trade Closed (Profit)"
            : "❌ Trade Closed (Loss)";

      if (notification.type === "exit" && !isProfit) {
        toast.error(title, {
          description: notification.message,
          duration: 10000,
        });
      } else {
        toast.success(title, {
          description: notification.message,
          duration: 10000,
        });
      }
    });

    return eventSource;
  }, [soundEnabled]);

  // Get user to check if they're a paid member
  const { user } = useAuth();

  // Check if user is a paying subscriber
  const isPaidMember =
    user?.subscriptionTier === "pro" ||
    user?.subscriptionTier === "premium" ||
    // @ts-expect-error TS2339
    user?.subscriptionStatus === "active" ||
    user?.role === "admin";

  // Connect on mount only for paid members
  useEffect(() => {
    // Only connect to SSE for paid members
    if (!isPaidMember) {
      setIsConnected(false);
      return;
    }

    const eventSource = connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect, isPaidMember]);

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setLatestNotification(null);
    setUnreadCount(0);
  }, []);

  return (
    <TradeNotificationContext.Provider
      value={{
        isConnected,
        notifications,
        latestNotification,
        unreadCount,
        markAllAsRead,
        clearNotifications,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
    </TradeNotificationContext.Provider>
  );
}

export function useTradeNotifications() {
  const context = useContext(TradeNotificationContext);
  if (!context) {
    throw new Error(
      "useTradeNotifications must be used within a TradeNotificationProvider"
    );
  }
  return context;
}
