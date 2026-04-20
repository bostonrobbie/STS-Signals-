import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  noindex?: boolean;
  keywords?: string;
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
  keywords,
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

    // Update keywords if provided
    if (keywords) {
      setMetaTag('meta[name="keywords"]', "content", keywords);
    }

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
  }, [title, description, canonical, ogImage, ogType, noindex, keywords]);

  return null; // This component doesn't render anything
}

// ─── Shared keyword bank ────────────────────────────────────────────────────
// All keywords are legitimate, descriptive, and within Google's guidelines.
// They describe what the page actually contains — no keyword stuffing.
const KEYWORDS = {
  core: "NQ futures signals, NQ futures trading, Nasdaq-100 futures signals, systematic futures trading, algo trading signals, NQ futures strategy, automated NQ alerts, intraday NQ signals, futures trading dashboard, NQ trading system",
  performance:
    "NQ futures backtest results, 15 year futures track record, +1085% NQ futures return, verified futures performance, futures Sharpe ratio, Sortino ratio futures, max drawdown NQ, futures win rate, risk-adjusted futures returns",
  subscription:
    "NQ futures signal subscription, futures trading alerts monthly, best NQ futures signal service, NQ futures signals $50, cancel anytime futures signals, futures trading membership",
  analytics:
    "futures portfolio analytics, equity curve NQ, drawdown analysis futures, day of week futures performance, calendar P&L futures, trade history NQ futures, futures risk metrics",
  comparison:
    "NQ futures vs ES futures, NQ vs MNQ signals, futures strategy comparison, best automated futures strategy, NQ trend following strategy",
  faq: "how do NQ futures signals work, what is Sharpe ratio futures, NQ futures trading for beginners, futures signal service review, how to trade NQ futures, NQ futures margin requirements, futures algo trading explained",
};

// Pre-defined SEO configurations for each page
export const SEO_CONFIG = {
  home: {
    title: "NQ Futures Trading Signals | +1,085% Over 15 Years | STS Futures",
    description:
      "Systematic NQ (Nasdaq-100) futures trading signals backed by 15+ years of verified data: +1,085% return, 45.9% win rate, Sharpe 1.05. Real-time dashboard alerts. $50/month, cancel anytime.",
    canonical: "https://stsdashboard.com/",
    keywords: `${KEYWORDS.core}, ${KEYWORDS.performance}, ${KEYWORDS.subscription}`,
  },
  pricing: {
    title: "Pricing | STS Futures NQ Signals — $50/Month",
    description:
      "Subscribe to STS Futures for $50/month. Get real-time NQ futures trading signals, 15+ years of trade history, email alerts, and full analytics dashboard access. Cancel anytime.",
    canonical: "https://stsdashboard.com/pricing",
    keywords: `${KEYWORDS.subscription}, ${KEYWORDS.core}, NQ futures signal pricing, futures dashboard subscription cost`,
  },
  overview: {
    title: "Portfolio Overview | STS Futures Dashboard",
    description:
      "Track your NQ futures portfolio performance with equity curves, Sharpe ratio, drawdown analysis, and comprehensive risk metrics.",
    canonical: "https://stsdashboard.com/overview",
    keywords: `${KEYWORDS.analytics}, ${KEYWORDS.performance}`,
  },
  compare: {
    title: "Compare NQ Futures Strategies | STS Futures Dashboard",
    description:
      "Compare NQ futures trading strategies side-by-side. Analyze correlations, combined equity curves, and diversification benefits across multiple systematic strategies.",
    canonical: "https://stsdashboard.com/compare",
    keywords: `${KEYWORDS.comparison}, ${KEYWORDS.analytics}`,
  },
  myDashboard: {
    title: "My Dashboard | STS Futures",
    description:
      "Your personalized NQ futures trading dashboard. Track subscribed strategies, monitor real-time signals, and manage your portfolio.",
    canonical: "https://stsdashboard.com/my-dashboard",
    keywords: `${KEYWORDS.core}, ${KEYWORDS.analytics}`,
  },
  qa: {
    title: "FAQ | STS Futures — NQ Futures Trading Questions Answered",
    description:
      "Frequently asked questions about STS Futures NQ trading signals, subscription plans, trade alerts, systematic trading strategies, and performance metrics.",
    canonical: "https://stsdashboard.com/qa",
    keywords: `${KEYWORDS.faq}, ${KEYWORDS.core}, ${KEYWORDS.subscription}`,
  },
  strategyDetail: (name: string, symbol: string) => ({
    title: `${name} Strategy | ${symbol} Futures Performance | STS Futures`,
    description: `Detailed performance analysis for ${name} strategy trading ${symbol} futures. View equity curve, trade history, drawdown analysis, and risk metrics.`,
    canonical: `https://stsdashboard.com/strategy/${symbol.toLowerCase()}`,
    keywords: `${symbol} futures strategy, ${name} trading signals, ${KEYWORDS.analytics}, ${KEYWORDS.performance}`,
  }),
  demo: {
    title: "Demo | See STS Futures Dashboard in Action — No Signup",
    description:
      "Walk through the STS Futures subscriber experience without signing up: real-time NQ signal dashboard, equity curve, drawdown, and the exact alert email we send when a signal fires.",
    canonical: "https://stsdashboard.com/demo",
    keywords: `NQ futures signal demo, STS Futures dashboard preview, trading signal example, NQ alert email sample, futures signal service walkthrough, ${KEYWORDS.core}`,
  },
};
