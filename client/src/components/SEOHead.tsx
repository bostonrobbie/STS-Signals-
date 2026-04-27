import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  /**
   * "website" for marketing pages, "article" for guides/blog posts,
   * "product" for paid offerings.
   */
  ogType?: "website" | "article" | "product";
  noindex?: boolean;
  keywords?: string;
  /**
   * Twitter Card type. "summary" (small image) is fine for FAQs and
   * legal pages; "summary_large_image" is preferred for content pages
   * with a meaningful OG image. Defaults to "summary_large_image".
   */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
  /** Optional published date (ISO 8601) — used when ogType="article". */
  articlePublishedTime?: string;
  /** Optional modified date — used when ogType="article". */
  articleModifiedTime?: string;
  /** Optional author name — used when ogType="article". */
  articleAuthor?: string;
  /** Topical section/category — used when ogType="article". */
  articleSection?: string;
}

/**
 * SEOHead — dynamic meta tag management for the React SPA.
 *
 * Responsible for: <title>, description, keywords, robots, canonical,
 * Open Graph (og:*), Twitter Card (twitter:*), article-* tags when
 * ogType="article", plus site-wide brand tags (og:site_name, og:locale).
 *
 * Pre-render middleware on the server injects breadcrumb + page-type
 * structured-data so that search-engine crawlers receive complete HTML
 * even when JS is disabled. Client-side this component still updates
 * the head for in-app navigation and for crawlers that DO execute JS.
 */
export function SEOHead({
  title,
  description,
  canonical,
  ogImage = "https://stsdashboard.com/portfolio-preview.webp",
  ogType = "website",
  noindex = false,
  keywords,
  twitterCard = "summary_large_image",
  articlePublishedTime,
  articleModifiedTime,
  articleAuthor,
  articleSection,
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title;

    // Helper to upsert a meta tag matched by selector.
    const setMetaTag = (
      selector: string,
      attribute: string,
      value: string | undefined
    ) => {
      if (value === undefined || value === null) return;
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        const propMatch = selector.match(/property="([^"]+)"/);
        const nameMatch = selector.match(/name="([^"]+)"/);
        if (propMatch) element.setAttribute("property", propMatch[1]);
        else if (nameMatch) element.setAttribute("name", nameMatch[1]);
        document.head.appendChild(element);
      }
      element.setAttribute(attribute, value);
    };

    // Remove a meta tag if present (used for switching away from
    // article-only fields when navigating to non-article pages).
    const removeMetaTag = (selector: string) => {
      const el = document.querySelector(selector);
      if (el) el.remove();
    };

    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    // ── Core meta ─────────────────────────────────────────────────
    setMetaTag('meta[name="description"]', "content", description);
    setMetaTag('meta[name="title"]', "content", title);
    if (keywords) {
      setMetaTag('meta[name="keywords"]', "content", keywords);
    }

    // Robots
    setMetaTag(
      'meta[name="robots"]',
      "content",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
    );
    setMetaTag(
      'meta[name="googlebot"]',
      "content",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"
    );

    // ── Open Graph ────────────────────────────────────────────────
    setMetaTag('meta[property="og:title"]', "content", title);
    setMetaTag('meta[property="og:description"]', "content", description);
    setMetaTag('meta[property="og:type"]', "content", ogType);
    setMetaTag('meta[property="og:image"]', "content", ogImage);
    setMetaTag(
      'meta[property="og:image:alt"]',
      "content",
      `${title} — STS Futures`
    );
    setMetaTag('meta[property="og:image:width"]', "content", "1200");
    setMetaTag('meta[property="og:image:height"]', "content", "630");
    setMetaTag('meta[property="og:site_name"]', "content", "STS Futures");
    setMetaTag('meta[property="og:locale"]', "content", "en_US");
    if (canonical) {
      setMetaTag('meta[property="og:url"]', "content", canonical);
    }

    // Article-only OG fields. Set when ogType="article", remove
    // otherwise so stale tags don't linger across navigations.
    if (ogType === "article") {
      setMetaTag(
        'meta[property="article:published_time"]',
        "content",
        articlePublishedTime
      );
      setMetaTag(
        'meta[property="article:modified_time"]',
        "content",
        articleModifiedTime ?? articlePublishedTime
      );
      setMetaTag(
        'meta[property="article:author"]',
        "content",
        articleAuthor ?? "Rob Gorham"
      );
      setMetaTag(
        'meta[property="article:section"]',
        "content",
        articleSection
      );
      setMetaTag(
        'meta[property="article:publisher"]',
        "content",
        "STS Futures"
      );
    } else {
      removeMetaTag('meta[property="article:published_time"]');
      removeMetaTag('meta[property="article:modified_time"]');
      removeMetaTag('meta[property="article:author"]');
      removeMetaTag('meta[property="article:section"]');
      removeMetaTag('meta[property="article:publisher"]');
    }

    // ── Twitter Card ──────────────────────────────────────────────
    setMetaTag('meta[name="twitter:card"]', "content", twitterCard);
    setMetaTag('meta[name="twitter:title"]', "content", title);
    setMetaTag('meta[name="twitter:description"]', "content", description);
    setMetaTag('meta[name="twitter:image"]', "content", ogImage);
    setMetaTag(
      'meta[name="twitter:image:alt"]',
      "content",
      `${title} — STS Futures`
    );
    // No twitter:site/twitter:creator handles are set yet — when an
    // official @STSFutures Twitter exists, add them.

    // ── Canonical link ────────────────────────────────────────────
    if (canonical) {
      setLinkTag("canonical", canonical);
    }

    // No cleanup-on-unmount; the next page mount will overwrite.
  }, [
    title,
    description,
    canonical,
    ogImage,
    ogType,
    noindex,
    keywords,
    twitterCard,
    articlePublishedTime,
    articleModifiedTime,
    articleAuthor,
    articleSection,
  ]);

  return null; // No DOM render; this component is side-effect only.
}

// ─── Shared keyword bank ────────────────────────────────────────────────────
// All keywords describe what the page actually contains — no keyword stuffing.
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
  status: {
    title: "System Status | STS Futures",
    description:
      "Live status of STS Futures — dashboard, API, database, real-time notifications, and email service. Updated every 30 seconds.",
    canonical: "https://stsdashboard.com/status",
    keywords:
      "STS Futures status, STS Futures uptime, STS Futures service status, is STS Futures down, NQ signal service status",
  },
  // ── Legal pages ──────────────────────────────────────────────────────
  terms: {
    title: "Terms of Service | STS Futures",
    description:
      "Terms of service for STS Futures NQ trading signal subscription. Acceptance of terms, description of service, account responsibilities, and limitation of liability.",
    canonical: "https://stsdashboard.com/terms",
    keywords:
      "STS Futures terms of service, futures signal terms, NQ trading service terms",
  },
  privacy: {
    title: "Privacy Policy | STS Futures",
    description:
      "Privacy policy for STS Futures. What data we collect, how we use it, third-party services, and subscriber rights under GDPR and CCPA.",
    canonical: "https://stsdashboard.com/privacy",
    keywords:
      "STS Futures privacy policy, futures signal service privacy, NQ trading data policy",
  },
  refund: {
    title: "Cancellation & Refund Policy | STS Futures",
    description:
      "STS Futures cancellation and refund policy: cancel any time from account settings, all sales final, no refunds for partial billing periods.",
    canonical: "https://stsdashboard.com/refund-policy",
    keywords:
      "STS Futures refund policy, cancel STS Futures, futures signal subscription cancellation",
  },
  disclaimer: {
    title: "Disclaimer | STS Futures",
    description:
      "STS Futures disclaimer. The platform provides systematic NQ futures signals for informational purposes only — not personalized financial advice.",
    canonical: "https://stsdashboard.com/disclaimer",
    keywords:
      "STS Futures disclaimer, futures trading disclaimer, NQ signal service disclaimer",
  },
  riskDisclosure: {
    title: "Risk Disclosure | STS Futures",
    description:
      "Required risk disclosure for STS Futures NQ trading signal subscribers. Trading futures involves substantial risk of loss; past performance is not indicative of future results.",
    canonical: "https://stsdashboard.com/risk-disclosure",
    keywords:
      "futures trading risk disclosure, NQ futures risk, futures signal risk warning",
  },
  // ── Auth pages — these should never be indexed ───────────────────────
  login: {
    title: "Sign In | STS Futures",
    description: "Sign in to your STS Futures account.",
    canonical: "https://stsdashboard.com/login",
    keywords: "",
    noindex: true,
  },
  signup: {
    title: "Create Account | STS Futures",
    description: "Create your STS Futures account.",
    canonical: "https://stsdashboard.com/password-signup",
    keywords: "",
    noindex: true,
  },
  forgotPassword: {
    title: "Forgot Password | STS Futures",
    description: "Reset your STS Futures account password.",
    canonical: "https://stsdashboard.com/forgot-password",
    keywords: "",
    noindex: true,
  },
  demo: {
    title: "Demo | See STS Futures Dashboard in Action — No Signup",
    description:
      "Walk through the STS Futures subscriber experience without signing up: real-time NQ signal dashboard, equity curve, drawdown, and the exact alert email we send when a signal fires.",
    canonical: "https://stsdashboard.com/demo",
    keywords: `NQ futures signal demo, STS Futures dashboard preview, trading signal example, NQ alert email sample, futures signal service walkthrough, ${KEYWORDS.core}`,
  },
  gettingStarted: {
    title: "Getting Started — Your First Week with STS Futures",
    description:
      "Step-by-step guide for new STS Futures subscribers: account setup, first signal, position sizing, paper trading, and what to expect in your first week of NQ futures signals.",
    canonical: "https://stsdashboard.com/getting-started",
    keywords:
      "STS Futures setup, first NQ signal, getting started futures signals, NQ futures first trade, futures signal service onboarding, what to do after subscribing STS",
  },
  riskManagementGuide: {
    title: "Risk Management for NQ Futures Signals — Position Sizing Guide",
    description:
      "Practical risk-management guide for NQ futures signal subscribers: position sizing, drawdown survival, account-to-contract mapping, when to skip a signal, and stop-loss strategies for systematic NQ trading.",
    canonical: "https://stsdashboard.com/guides/risk-management",
    keywords:
      "NQ futures position sizing, futures risk management, futures drawdown survival, NQ contract sizing, 1% rule futures, NQ position size calculator, futures stop loss strategy, futures account size",
  },
  vsTopstep: {
    title: "STS Futures vs Topstep — Signal Service vs Funded Account",
    description:
      "Honest comparison of STS Futures (NQ signal service, $50/month, your own broker) and Topstep (funded-account challenge, profit split). Which is right for you depends on capital, goals, and risk tolerance.",
    canonical: "https://stsdashboard.com/vs/topstep",
    keywords:
      "STS Futures vs Topstep, Topstep alternative, NQ futures signals vs prop firm, funded account vs signal service, Topstep profit split, NQ trading signal service comparison",
  },
  vsCannon: {
    title: "STS Futures vs Cannon Trading — Signals vs Broker-Bundled Algos",
    description:
      "STS Futures (signals delivered to any broker, $50/month) vs Cannon Trading's broker-bundled systematic products. Decouple your signal source from your broker to keep both choices flexible.",
    canonical: "https://stsdashboard.com/vs/cannon",
    keywords:
      "STS Futures vs Cannon Trading, Cannon Trading alternative, broker-independent NQ signals, futures signal service vs broker algos, NQ trading signals any broker",
  },
};
