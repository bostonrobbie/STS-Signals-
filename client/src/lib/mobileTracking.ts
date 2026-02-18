/**
 * Mobile Conversion Tracking
 * Tracks payment method usage, conversion rates, and mobile-specific metrics
 */

export interface MobileConversionEvent {
  eventType:
    | "checkout_initiated"
    | "payment_method_selected"
    | "payment_completed"
    | "payment_failed"
    | "checkout_abandoned";
  paymentMethod?: "card" | "apple_pay" | "google_pay";
  deviceType: "mobile" | "tablet" | "desktop";
  timestamp: number;
  sessionId: string;
  userId?: string;
  amount?: number;
  currency?: string;
  errorMessage?: string;
}

class MobileConversionTracker {
  private sessionId: string;
  private events: MobileConversionEvent[] = [];
  private analyticsEndpoint: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.analyticsEndpoint =
      import.meta.env.VITE_ANALYTICS_ENDPOINT || "/api/analytics";
  }

  /**
   * Detect device type based on viewport width
   */
  private getDeviceType(): "mobile" | "tablet" | "desktop" {
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track checkout initiation
   */
  trackCheckoutInitiated(userId?: string) {
    const event: MobileConversionEvent = {
      eventType: "checkout_initiated",
      deviceType: this.getDeviceType(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId,
    };
    this.events.push(event);
    this.sendEvent(event);
  }

  /**
   * Track payment method selection
   */
  trackPaymentMethodSelected(
    paymentMethod: "card" | "apple_pay" | "google_pay",
    userId?: string
  ) {
    const event: MobileConversionEvent = {
      eventType: "payment_method_selected",
      paymentMethod,
      deviceType: this.getDeviceType(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId,
    };
    this.events.push(event);
    this.sendEvent(event);
  }

  /**
   * Track successful payment
   */
  trackPaymentCompleted(
    paymentMethod: "card" | "apple_pay" | "google_pay",
    amount: number,
    currency: string = "USD",
    userId?: string
  ) {
    const event: MobileConversionEvent = {
      eventType: "payment_completed",
      paymentMethod,
      amount,
      currency,
      deviceType: this.getDeviceType(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId,
    };
    this.events.push(event);
    this.sendEvent(event);
  }

  /**
   * Track payment failure
   */
  trackPaymentFailed(
    paymentMethod: "card" | "apple_pay" | "google_pay",
    errorMessage: string,
    userId?: string
  ) {
    const event: MobileConversionEvent = {
      eventType: "payment_failed",
      paymentMethod,
      errorMessage,
      deviceType: this.getDeviceType(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId,
    };
    this.events.push(event);
    this.sendEvent(event);
  }

  /**
   * Track checkout abandonment
   */
  trackCheckoutAbandoned(userId?: string) {
    const event: MobileConversionEvent = {
      eventType: "checkout_abandoned",
      deviceType: this.getDeviceType(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId,
    };
    this.events.push(event);
    this.sendEvent(event);
  }

  /**
   * Send event to analytics endpoint
   */
  private sendEvent(event: MobileConversionEvent) {
    // Send asynchronously to avoid blocking user interaction
    navigator.sendBeacon(
      `${this.analyticsEndpoint}/mobile-conversion`,
      JSON.stringify(event)
    );
  }

  /**
   * Get all tracked events for current session
   */
  getSessionEvents(): MobileConversionEvent[] {
    return [...this.events];
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }
}

// Export singleton instance
export const mobileTracker = new MobileConversionTracker();
