import { useEffect } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    gtag?: (..._args: any[]) => void;
    dataLayer?: any[];
  }
}

const GA_MEASUREMENT_ID = "G-LVFVPLWCVP";

export function GoogleAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    // Initialize Google Analytics if not already done
    if (!window.gtag) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      const gtag = function (..._args: any[]) {
        window.dataLayer!.push(arguments);
      };
      window.gtag = gtag as any;
      gtag("js", new Date());
      gtag("config", GA_MEASUREMENT_ID, {
        page_path: location,
        anonymize_ip: true,
        send_page_view: false, // We send page views manually below
      });
    }
  }, []);

  // Track page views on location change
  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location,
        page_title: document.title,
      });
    }
  }, [location]);

  // Track conversion events
  useEffect(() => {
    if (location === "/checkout-success") {
      window.gtag?.("event", "purchase", {
        value: 50,
        currency: "USD",
        items: [
          {
            item_name: "STS Pro Subscription",
            item_category: "subscription",
            price: 50,
            quantity: 1,
          },
        ],
      });
    }
  }, [location]);

  return null;
}

// Track custom events
export function trackGAEvent(
  eventName: string,
  eventData: Record<string, any> = {}
) {
  if (window.gtag) {
    window.gtag("event", eventName, eventData);
  }
}

// Track conversions (e.g. checkout completed)
export function trackGAConversion(
  value: number,
  currency: string = "USD",
  transactionId?: string
) {
  if (window.gtag) {
    window.gtag("event", "conversion", {
      value,
      currency,
      transaction_id: transactionId || `conversion_${Date.now()}`,
    });
  }
}

// Track CTA button clicks
export function trackGACTAClick(location: string, label: string) {
  if (window.gtag) {
    window.gtag("event", "cta_click", {
      cta_location: location,
      cta_label: label,
    });
  }
}

// Track form submissions
export function trackFormSubmission(formName: string) {
  if (window.gtag) {
    window.gtag("event", "form_submit", {
      form_name: formName,
      timestamp: new Date().toISOString(),
    });
  }
}

// Track sign-up events
export function trackGASignUp(method: string = "email") {
  if (window.gtag) {
    window.gtag("event", "sign_up", {
      method,
    });
  }
}

// Track login events
export function trackGALogin(method: string = "email") {
  if (window.gtag) {
    window.gtag("event", "login", {
      method,
    });
  }
}
