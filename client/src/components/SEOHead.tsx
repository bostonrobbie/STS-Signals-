import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  noindex?: boolean;
}

/**
 * SEOHead - Dynamic meta tag management for React SPA
 * Updates document head with page-specific SEO tags
 */
export function SEOHead({
  title,
  description,
  canonical,
  ogImage = "https://stsdashboard.com/portfolio-preview.webp",
  ogType = "website",
  noindex = false,
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper to update or create meta tag
    const setMetaTag = (selector: string, attribute: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        if (selector.includes("property=")) {
          element.setAttribute(
            "property",
            selector.match(/property="([^"]+)"/)?.[1] || ""
          );
        } else if (selector.includes("name=")) {
          element.setAttribute(
            "name",
            selector.match(/name="([^"]+)"/)?.[1] || ""
          );
        }
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, value);
    };

    // Helper to update or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    // Update meta description
    setMetaTag('meta[name="description"]', "content", description);
    setMetaTag('meta[name="title"]', "content", title);

    // Update robots if noindex
    if (noindex) {
      setMetaTag('meta[name="robots"]', "content", "noindex, nofollow");
    }

    // Update Open Graph tags
    setMetaTag('meta[property="og:title"]', "content", title);
    setMetaTag('meta[property="og:description"]', "content", description);
    setMetaTag('meta[property="og:type"]', "content", ogType);
    setMetaTag('meta[property="og:image"]', "content", ogImage);
    if (canonical) {
      setMetaTag('meta[property="og:url"]', "content", canonical);
    }

    // Update Twitter Card tags
    setMetaTag('meta[name="twitter:title"]', "content", title);
    setMetaTag('meta[name="twitter:description"]', "content", description);
    setMetaTag('meta[name="twitter:image"]', "content", ogImage);

    // Update canonical URL
    if (canonical) {
      setLinkTag("canonical", canonical);
    }

    // Cleanup function to reset to defaults when component unmounts
    return () => {
      // Reset to default values on unmount (optional)
    };
  }, [title, description, canonical, ogImage, ogType, noindex]);

  return null; // This component doesn't render anything
}

// Pre-defined SEO configurations for each page
export const SEO_CONFIG = {
  home: {
    title: "STS Futures | NQ Futures Trading Signals & Performance Dashboard",
    description:
      "Systematic NQ futures trading signals backed by 15+ years of backtested data. Real-time alerts, full trade history, and professional risk analytics. $50/month, cancel anytime.",
    canonical: "https://stsdashboard.com/",
  },
  overview: {
    title: "Portfolio Overview | STS Futures Dashboard",
    description:
      "Track your NQ futures portfolio performance with equity curves, Sharpe ratio, drawdown analysis, and comprehensive risk metrics.",
    canonical: "https://stsdashboard.com/overview",
  },
  compare: {
    title: "Compare Strategies | STS Futures Dashboard",
    description:
      "Compare NQ futures trading strategies side-by-side. Analyze correlations, combined equity curves, and diversification benefits.",
    canonical: "https://stsdashboard.com/compare",
  },
  myDashboard: {
    title: "My Dashboard | STS Futures",
    description:
      "Your personalized NQ futures trading dashboard. Track subscribed strategies, monitor real-time signals, and manage your portfolio.",
    canonical: "https://stsdashboard.com/my-dashboard",
  },
  strategyDetail: (name: string, symbol: string) => ({
    title: `${name} Strategy | ${symbol} Futures Performance | STS Futures`,
    description: `Detailed performance analysis for ${name} strategy trading ${symbol} futures. View equity curve, trade history, drawdown analysis, and risk metrics.`,
    canonical: `https://stsdashboard.com/strategy/${symbol.toLowerCase()}`,
  }),
};
