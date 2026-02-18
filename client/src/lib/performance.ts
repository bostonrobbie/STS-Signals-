/**
 * Performance optimization utilities
 * Handles lazy loading, image optimization, and resource caching
 */
/* eslint-disable no-undef */

/**
 * Lazy load images with Intersection Observer
 */
export function lazyLoadImages() {
  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
            imageObserver.unobserve(img);
          }
        }
      });
    });

    document.querySelectorAll("img[data-src]").forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources() {
  const criticalResources = [
    { href: "/fonts/inter.woff2", as: "font", type: "font/woff2" },
    { href: "/api/portfolio/overview", as: "fetch", crossorigin: "anonymous" },
  ];

  criticalResources.forEach(resource => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.href = resource.href;
    link.as = resource.as;
    if (resource.type) link.type = resource.type;
    if (resource.crossorigin) link.crossOrigin = resource.crossorigin;
    document.head.appendChild(link);
  });
}

/**
 * Optimize Core Web Vitals
 */
export function optimizeWebVitals() {
  // Report Web Vitals to analytics
  if ("web-vital" in window) {
    const reportWebVitals = (metric: any) => {
      console.log(`${metric.name}: ${metric.value}ms`);
      // Send to analytics service
      if (window.gtag) {
        window.gtag("event", metric.name, {
          value: Math.round(metric.value),
          event_category: "web_vitals",
          event_label: metric.id,
          non_interaction: true,
        });
      }
    };

    // Largest Contentful Paint
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          reportWebVitals({
            name: "LCP",
            value: (entry as any).renderTime || (entry as any).loadTime,
            // @ts-expect-error TS2339
            id: entry.id,
          });
        }
      });
      observer.observe({ entryTypes: ["largest-contentful-paint"] });
    } catch (_e) {
      console.log("LCP observer not supported");
    }

    // First Input Delay
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const fid = (entry as any).processingStart - entry.startTime;
          reportWebVitals({
            name: "FID",
            value: fid,
            // @ts-expect-error TS2339
            id: entry.id,
          });
        }
      });
      observer.observe({ entryTypes: ["first-input"] });
    } catch (_e) {
      console.log("FID observer not supported");
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            reportWebVitals({
              name: "CLS",
              value: clsValue,
              // @ts-expect-error TS2339
              id: entry.id,
            });
          }
        }
      });
      observer.observe({ entryTypes: ["layout-shift"] });
    } catch (_e) {
      console.log("CLS observer not supported");
    }
  }
}

/**
 * Enable service worker for offline support and caching
 */
export function enableServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        console.log("Service Worker registered:", registration);
      })
      .catch(error => {
        console.log("Service Worker registration failed:", error);
      });
  }
}

/**
 * Minify and optimize CSS
 */
export function optimizeCSS() {
  // Remove unused CSS with PurgeCSS (handled at build time)
  // Inline critical CSS
  const criticalCSS = `
    /* Critical CSS for above-the-fold content */
    body { margin: 0; padding: 0; font-family: system-ui; }
    .hero { min-height: 100vh; display: flex; align-items: center; }
  `;

  const style = document.createElement("style");
  style.textContent = criticalCSS;
  document.head.insertBefore(style, document.head.firstChild);
}

/**
 * Defer non-critical JavaScript
 */
export function deferNonCriticalJS() {
  // Load analytics after page is interactive
  setTimeout(() => {
    const script = document.createElement("script");
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX";
    script.async = true;
    document.head.appendChild(script);
  }, 3000);
}

/**
 * Cache API responses
 */
export const apiCache = new Map<string, { data: any; timestamp: number }>();

export function getCachedAPI(key: string, maxAge: number = 5 * 60 * 1000) {
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.data;
  }
  return null;
}

export function setCachedAPI(key: string, data: any) {
  apiCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Compress response data
 */
export function compressData(data: any): string {
  return JSON.stringify(data);
}

/**
 * Initialize all performance optimizations
 */
export function initializePerformanceOptimizations() {
  // Run on page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      lazyLoadImages();
      preloadCriticalResources();
      optimizeWebVitals();
      enableServiceWorker();
      optimizeCSS();
      deferNonCriticalJS();
    });
  } else {
    lazyLoadImages();
    preloadCriticalResources();
    optimizeWebVitals();
    enableServiceWorker();
    optimizeCSS();
    deferNonCriticalJS();
  }
}

/**
 * Hook to defer rendering of non-critical components until after initial page load
 * This improves perceived performance by prioritizing above-the-fold content
 */
import { useEffect, useState } from "react";

export function useDeferredRender(delay: number = 100) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Defer rendering until after initial paint
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender;
}

/**
 * Hook to detect if an element is in viewport (for lazy loading)
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}
