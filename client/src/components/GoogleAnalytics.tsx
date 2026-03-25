import { useEffect } from "react";
import { useLocation } from "wouter";

declare global {
  interface Window {
    gtag?: (..._args: any[]) => void;
    dataLayer?: any[];
  }
}

const GA_MEASUREMENT_ID = "G-LVFVPLWCVP";

// ─── Funnel step definitions ────────────────────────────────────────────────
// These map directly to the GA4 Funnel Exploration report steps.
// Step 1: landing_view  → user lands on homepage
// Step 2: pricing_view  → user visits /pricing
// Step 3: checkout_start → user clicks "Subscribe Now" (begin_checkout)
// Step 4: sign_up       → user creates account after payment
// Step 5: purchase      → checkout success page reached
export const FUNNEL_STEPS = {
  LANDING_VIEW: "landing_view",
  PRICING_VIEW: "pricing_view",
  CHECKOUT_START: "begin_checkout",
  SIGN_UP: "sign_up",
  PURCHASE: "purchase",
} as const;

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
        // GA4 enhanced measurement: track scroll depth, outbound clicks, site search
        enhanced_measurement: {
          scroll_threshold: 90,
          outbound_click: true,
        },
      });
    }
  }, []);

  // Track page views on location change + funnel steps per page
  useEffect(() => {
    if (!window.gtag) return;

    // Standard page view
    window.gtag("event", "page_view", {
      page_path: location,
      page_title: document.title,
    });

    // Funnel step: pricing page view
    if (location === "/pricing") {
      window.gtag("event", FUNNEL_STEPS.PRICING_VIEW, {
        page_path: location,
        funnel_step: 2,
        funnel_step_name: "Pricing Page Viewed",
      });
    }

    // Funnel step: checkout success = purchase completed
    if (location === "/checkout/success" || location === "/checkout-success") {
      window.gtag("event", FUNNEL_STEPS.PURCHASE, {
        value: 50,
        currency: "USD",
        funnel_step: 5,
        funnel_step_name: "Purchase Completed",
        items: [
          {
            item_id: "pro_monthly",
            item_name: "STS Pro Subscription",
            item_category: "subscription",
            price: 50,
            quantity: 1,
          },
        ],
      });
      // Also fire conversion event for Google Ads
      window.gtag("event", "conversion", {
        value: 50,
        currency: "USD",
        transaction_id: `sts_${Date.now()}`,
      });
    }
  }, [location]);

  return null;
}

// ─── Funnel step tracker ─────────────────────────────────────────────────────
// Call this to manually push a funnel step event from any component.
// GA4 Funnel Exploration will use these events to build the conversion funnel.
export function trackFunnelStep(
  step: keyof typeof FUNNEL_STEPS,
  extraData: Record<string, any> = {}
) {
  if (!window.gtag) return;
  const stepIndex = Object.keys(FUNNEL_STEPS).indexOf(step) + 1;
  window.gtag("event", FUNNEL_STEPS[step], {
    funnel_step: stepIndex,
    funnel_step_name: step.replace(/_/g, " ").toLowerCase(),
    ...extraData,
  });
}

// ─── Generic event tracker ───────────────────────────────────────────────────
export function trackGAEvent(
  eventName: string,
  eventData: Record<string, any> = {}
) {
  if (window.gtag) {
    window.gtag("event", eventName, eventData);
  }
}

// ─── Conversion tracker ──────────────────────────────────────────────────────
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

// ─── CTA click tracker ───────────────────────────────────────────────────────
export function trackGACTAClick(ctaLocation: string, label: string) {
  if (window.gtag) {
    window.gtag("event", "cta_click", {
      cta_location: ctaLocation,
      cta_label: label,
    });
  }
}

// ─── Form submission tracker ─────────────────────────────────────────────────
export function trackFormSubmission(formName: string) {
  if (window.gtag) {
    window.gtag("event", "form_submit", {
      form_name: formName,
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── Sign-up tracker ─────────────────────────────────────────────────────────
export function trackGASignUp(method: string = "email") {
  if (window.gtag) {
    window.gtag("event", FUNNEL_STEPS.SIGN_UP, {
      method,
      funnel_step: 4,
      funnel_step_name: "Account Created",
    });
  }
}

// ─── Login tracker ───────────────────────────────────────────────────────────
export function trackGALogin(method: string = "email") {
  if (window.gtag) {
    window.gtag("event", "login", {
      method,
    });
  }
}
