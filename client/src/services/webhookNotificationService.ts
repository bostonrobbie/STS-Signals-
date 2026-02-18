import { toast } from "sonner";

export interface WebhookNotification {
  id: string;
  type: "stripe" | "tradingview" | "system";
  severity: "info" | "warning" | "error" | "critical";
  title: string;
  message: string;
  timestamp: Date;
  action?: {
    label: string;
    onClick: () => void;
  };
}

class WebhookNotificationService {
  private notifications: Map<string, WebhookNotification> = new Map();
  private listeners: Set<(notification: WebhookNotification) => void> =
    new Set();
  private soundEnabled = true;
  private desktopNotificationsEnabled = true;

  /**
   * Initialize the notification service
   */
  init() {
    // Request desktop notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      const NotificationAPI = window.Notification as any;
      if (NotificationAPI.permission === "default") {
        NotificationAPI.requestPermission();
      }
    }
  }

  /**
   * Subscribe to notifications
   */
  subscribe(listener: (notification: WebhookNotification) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit a notification
   */
  emit(notification: WebhookNotification) {
    this.notifications.set(notification.id, notification);
    this.listeners.forEach(listener => listener(notification));

    // Show toast notification
    this.showToast(notification);

    // Show desktop notification
    if (this.desktopNotificationsEnabled) {
      this.showDesktopNotification(notification);
    }

    // Play sound
    if (this.soundEnabled) {
      this.playSound(notification.severity);
    }
  }

  /**
   * Handle Stripe payment event
   */
  handleStripePayment(event: any) {
    const notification: WebhookNotification = {
      id: `stripe-${event.id}`,
      type: "stripe",
      severity: event.status === "succeeded" ? "info" : "error",
      title: "Stripe Payment",
      message:
        event.status === "succeeded"
          ? `Payment of $${(event.amount / 100).toFixed(2)} ${event.currency.toUpperCase()} received`
          : `Payment failed: ${event.failure_message || "Unknown error"}`,
      timestamp: new Date(event.created * 1000),
      action:
        event.status === "succeeded"
          ? {
              label: "View Receipt",
              onClick: () => {
                // Navigate to billing page
                window.location.href = "/billing";
              },
            }
          : undefined,
    };

    this.emit(notification);
  }

  /**
   * Handle TradingView signal
   */
  handleTradingViewSignal(event: any) {
    const isBuy = event.action?.toLowerCase() === "buy";
    const notification: WebhookNotification = {
      id: `tradingview-${event.id}`,
      type: "tradingview",
      severity: isBuy ? "info" : "warning",
      title: `${isBuy ? "BUY" : "SELL"} Signal - ${event.symbol}`,
      message: `${event.strategy || "Strategy"}: ${event.reason || "New signal received"}`,
      timestamp: new Date(),
      action: {
        label: "View Dashboard",
        onClick: () => {
          window.location.href = "/my-dashboard";
        },
      },
    };

    this.emit(notification);
  }

  /**
   * Handle system alert
   */
  handleSystemAlert(alert: {
    severity: "info" | "warning" | "error" | "critical";
    title: string;
    message: string;
  }) {
    const notification: WebhookNotification = {
      id: `system-${Date.now()}`,
      type: "system",
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      timestamp: new Date(),
    };

    this.emit(notification);
  }

  /**
   * Show toast notification
   */
  private showToast(notification: WebhookNotification) {
    const toastFn =
      {
        critical: toast.error,
        error: toast.error,
        warning: toast.warning,
        info: toast.info,
      }[notification.severity] || toast.info;

    toastFn(notification.title, {
      description: notification.message,
      action: notification.action
        ? {
            label: notification.action.label,
            onClick: notification.action.onClick,
          }
        : undefined,
    });
  }

  /**
   * Show desktop notification
   */
  private showDesktopNotification(notification: WebhookNotification) {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const NotificationAPI = window.Notification as any;
    if (NotificationAPI.permission !== "granted") {
      return;
    }

    const icon = this.getNotificationIcon(notification.type);
    new NotificationAPI(notification.title, {
      body: notification.message,
      icon,
      tag: notification.id,
      requireInteraction: notification.severity === "critical",
    });
  }

  /**
   * Play sound based on severity
   */
  private playSound(severity: string) {
    if (typeof window === "undefined") return;

    try {
      // Create audio context
      const AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Set frequency based on severity
      const frequencies: Record<string, number> = {
        critical: 1000, // High frequency for critical
        error: 800, // Medium-high for error
        warning: 600, // Medium for warning
        info: 400, // Low for info
      };

      oscillator.frequency.value = frequencies[severity] || 400;
      oscillator.type = "sine";

      // Set duration
      const duration = severity === "critical" ? 0.5 : 0.2;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (_error) {
      // Silently fail if audio context is not available
      console.debug("Audio notification not available");
    }
  }

  /**
   * Get notification icon
   */
  private getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      stripe: "💳",
      tradingview: "⚡",
      system: "🔔",
    };
    return icons[type] || "🔔";
  }

  /**
   * Toggle sound
   */
  toggleSound(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  /**
   * Toggle desktop notifications
   */
  toggleDesktopNotifications(enabled: boolean) {
    this.desktopNotificationsEnabled = enabled;
  }

  /**
   * Get all notifications
   */
  getNotifications(): WebhookNotification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Clear notification
   */
  clearNotification(id: string) {
    this.notifications.delete(id);
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    this.notifications.clear();
  }
}

// Export singleton instance
export const webhookNotificationService = new WebhookNotificationService();
