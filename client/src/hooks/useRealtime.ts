import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

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
  | 'notification'
  | 'connected'
  | 'ping';

export interface RealtimeEvent {
  type: RealtimeEventType;
  timestamp: number;
  data: Record<string, unknown>;
  userId?: number;
  clientId?: string;
}

interface UseRealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  showToasts?: boolean;
  autoReconnect?: boolean;
  reconnectDelay?: number;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    onEvent,
    onConnect,
    onDisconnect,
    showToasts = true,
    autoReconnect = true,
    reconnectDelay = 3000,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource('/api/realtime/events');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        onConnect?.();
        if (showToasts) {
          toast.success('Real-time updates connected');
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data: RealtimeEvent = JSON.parse(event.data);
          setLastEvent(data);
          setEvents(prev => [...prev.slice(-99), data]); // Keep last 100 events
          onEvent?.(data);

          // Handle specific event types with toasts
          if (showToasts && data.type !== 'ping' && data.type !== 'connected') {
            handleEventToast(data);
          }
        } catch (error) {
          console.error('[SSE] Failed to parse event:', error);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource.close();
        onDisconnect?.();

        if (autoReconnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to connect:', error);
    }
  }, [onEvent, onConnect, onDisconnect, showToasts, autoReconnect, reconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setLastEvent(null);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    events,
    connect,
    disconnect,
    clearEvents,
  };
}

function handleEventToast(event: RealtimeEvent) {
  switch (event.type) {
    case 'trade_executed':
      const trade = event.data as { strategySymbol?: string; pnl?: number; direction?: string };
      const pnl = trade.pnl ?? 0;
      const pnlFormatted = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
      toast.success(`Trade executed: ${trade.strategySymbol} ${trade.direction} (${pnlFormatted})`);
      break;

    case 'trade_error':
      const errorData = event.data as { error?: string; strategySymbol?: string };
      toast.error(`Trade error: ${errorData.strategySymbol} - ${errorData.error}`);
      break;

    case 'position_opened':
      const openPos = event.data as { strategySymbol?: string; direction?: string; entryPrice?: number };
      toast.info(`Position opened: ${openPos.strategySymbol} ${openPos.direction} @ ${openPos.entryPrice}`);
      break;

    case 'position_closed':
      const closePos = event.data as { strategySymbol?: string; pnl?: number };
      const closePnl = closePos.pnl ?? 0;
      toast.info(`Position closed: ${closePos.strategySymbol} (${closePnl >= 0 ? '+' : ''}$${closePnl.toFixed(2)})`);
      break;

    case 'webhook_received':
      const webhook = event.data as { strategySymbol?: string; action?: string };
      toast.info(`Webhook received: ${webhook.strategySymbol} ${webhook.action}`);
      break;

    case 'webhook_failed':
      const failedWebhook = event.data as { strategySymbol?: string; error?: string; willRetry?: boolean };
      toast.error(`Webhook failed: ${failedWebhook.strategySymbol} - ${failedWebhook.error}${failedWebhook.willRetry ? ' (will retry)' : ''}`);
      break;

    case 'notification':
      const notification = event.data as { title?: string; message?: string };
      toast(notification.title, { description: notification.message });
      break;
  }
}

// Hook for subscribing to specific event types
export function useRealtimeEvent(
  eventType: RealtimeEventType | RealtimeEventType[],
  callback: (event: RealtimeEvent) => void
) {
  const types = Array.isArray(eventType) ? eventType : [eventType];

  useRealtime({
    showToasts: false,
    onEvent: (event) => {
      if (types.includes(event.type)) {
        callback(event);
      }
    },
  });
}
