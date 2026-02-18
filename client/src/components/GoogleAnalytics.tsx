import { useEffect } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    gtag?: (..._args: any[]) => void;
  }
}

export function GoogleAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    // Initialize Google Analytics if not already done
    if (!window.gtag) {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX";
      document.head.appendChild(script);

      // @ts-expect-error TS2339
      window.dataLayer = window.dataLayer || [];
      // @ts-expect-error TS1252
      function gtag(...args: any[]) {
        // @ts-expect-error TS2339
        window.dataLayer?.push(arguments);
      }
      window.gtag = gtag;
      gtag("js", new Date());
      gtag("config", "G-XXXXXXXXXX", {
        page_path: location,
        anonymize_ip: true,
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
  }, [location, location]);

  // Track conversion events
  useEffect(() => {
    // Track signup completion
    if (location === "/checkout-success") {
      window.gtag?.("event", "conversion", {
        value: 99,
        currency: "USD",
        transaction_id: "trial_signup",
      });
    }

    // Track subscription upgrade
    if (location === "/checkout-success") {
      window.gtag?.("event", "purchase", {
        value: 99,
        currency: "USD",
        items: [
          {
            item_name: "Pro Subscription",
            item_category: "subscription",
            price: 99,
            quantity: 1,
          },
        ],
      });
    }
  }, [location, location]);

  return null;
}

// Helper function to track custom events
export function trackEvent(
  eventName: string,
  eventData: Record<string, any> = {}
) {
  if (window.gtag) {
    window.gtag("event", eventName, eventData);
  }
}

// Helper function to track conversions
export function trackConversion(
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

// Helper function to track form submissions
export function trackFormSubmission(formName: string) {
  if (window.gtag) {
    window.gtag("event", "form_submit", {
      form_name: formName,
      timestamp: new Date().toISOString(),
    });
  }
}
