/**
 * Analytics and Conversion Tracking Utility
 *
 * Tracks user interactions for conversion optimization.
 * Uses Umami analytics (already configured) with custom events.
 */

// Declare umami global for TypeScript
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Track a custom analytics event
 */
export function trackEvent(
  eventName: string,
  eventData?: Record<string, unknown>
) {
  try {
    // Umami tracking
    if (window.umami) {
      window.umami.track(eventName, eventData);
    }

    // Console log in development for debugging
    if (import.meta.env.DEV) {
      console.log("[Analytics]", eventName, eventData);
    }
  } catch (error) {
    // Silently fail - analytics should never break the app
    console.warn("[Analytics] Failed to track event:", error);
  }
}

// Pre-defined conversion events
export const ConversionEvents = {
  // CTA Clicks
  HERO_CTA_CLICK: "hero_cta_click",
  PRICING_CTA_CLICK: "pricing_cta_click",
  NAV_CTA_CLICK: "nav_cta_click",
  FOOTER_CTA_CLICK: "footer_cta_click",

  // Page Sections Viewed
  PRICING_SECTION_VIEW: "pricing_section_view",
  FEATURES_SECTION_VIEW: "features_section_view",
  COMPARISON_SECTION_VIEW: "comparison_section_view",
  FAQ_SECTION_VIEW: "faq_section_view",

  // User Actions
  FAQ_EXPAND: "faq_expand",
  CONTRACT_SIZE_TOGGLE: "contract_size_toggle",
  SCREENSHOT_EXPAND: "screenshot_expand",

  // Conversion Funnel
  SIGNUP_START: "signup_start",
  SIGNUP_COMPLETE: "signup_complete",
  TRIAL_START: "trial_start",
  SUBSCRIPTION_START: "subscription_start",
  SUBSCRIPTION_COMPLETE: "subscription_complete",

  // Engagement
  SCROLL_DEPTH_25: "scroll_depth_25",
  SCROLL_DEPTH_50: "scroll_depth_50",
  SCROLL_DEPTH_75: "scroll_depth_75",
  SCROLL_DEPTH_100: "scroll_depth_100",
  TIME_ON_PAGE_30S: "time_on_page_30s",
  TIME_ON_PAGE_60S: "time_on_page_60s",
  TIME_ON_PAGE_120S: "time_on_page_120s",
} as const;

/**
 * Track CTA button click
 */
export function trackCTAClick(
  location: "hero" | "pricing" | "nav" | "footer",
  buttonText?: string
) {
  const eventMap = {
    hero: ConversionEvents.HERO_CTA_CLICK,
    pricing: ConversionEvents.PRICING_CTA_CLICK,
    nav: ConversionEvents.NAV_CTA_CLICK,
    footer: ConversionEvents.FOOTER_CTA_CLICK,
  };

  trackEvent(eventMap[location], { button_text: buttonText, location });
}

/**
 * Track section view (for scroll tracking)
 */
export function trackSectionView(
  section: "pricing" | "features" | "comparison" | "faq"
) {
  const eventMap = {
    pricing: ConversionEvents.PRICING_SECTION_VIEW,
    features: ConversionEvents.FEATURES_SECTION_VIEW,
    comparison: ConversionEvents.COMPARISON_SECTION_VIEW,
    faq: ConversionEvents.FAQ_SECTION_VIEW,
  };

  trackEvent(eventMap[section]);
}

/**
 * Track scroll depth
 */
export function trackScrollDepth(depth: 25 | 50 | 75 | 100) {
  const eventMap = {
    25: ConversionEvents.SCROLL_DEPTH_25,
    50: ConversionEvents.SCROLL_DEPTH_50,
    75: ConversionEvents.SCROLL_DEPTH_75,
    100: ConversionEvents.SCROLL_DEPTH_100,
  };

  trackEvent(eventMap[depth]);
}

/**
 * Track time on page
 */
export function trackTimeOnPage(seconds: 30 | 60 | 120) {
  const eventMap = {
    30: ConversionEvents.TIME_ON_PAGE_30S,
    60: ConversionEvents.TIME_ON_PAGE_60S,
    120: ConversionEvents.TIME_ON_PAGE_120S,
  };

  trackEvent(eventMap[seconds]);
}

/**
 * Hook to track scroll depth automatically
 */
export function useScrollTracking() {
  const trackedDepths = new Set<number>();

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);

    [25, 50, 75, 100].forEach(depth => {
      if (scrollPercent >= depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth);
        trackScrollDepth(depth as 25 | 50 | 75 | 100);
      }
    });
  };

  return { handleScroll };
}

/**
 * Initialize time-on-page tracking
 */
export function initTimeTracking() {
  const trackedTimes = new Set<number>();

  [30, 60, 120].forEach(seconds => {
    setTimeout(() => {
      if (!trackedTimes.has(seconds)) {
        trackedTimes.add(seconds);
        trackTimeOnPage(seconds as 30 | 60 | 120);
      }
    }, seconds * 1000);
  });
}
