/**
 * Structured-data (JSON-LD) infrastructure.
 *
 * Renders schema.org JSON-LD in the document head so search engines and
 * AI crawlers can extract rich, machine-readable facts about each page.
 *
 * Multiple StructuredData blocks per page are SUPPORTED — each block
 * gets a unique `data-schema-id` so we don't overwrite each other. This
 * is important: a page like /getting-started typically wants
 * BreadcrumbList + HowTo + WebPage all at once.
 *
 * On unmount, the script is removed so navigating away doesn't leak
 * stale schemas onto the next page.
 *
 * Usage:
 *   <StructuredData id="org" data={organizationSchema} />
 *   <StructuredData id="product" data={productSchema} />
 *   <StructuredData id="bc" data={breadcrumbSchema([...])} />
 */

import { useEffect } from "react";

interface StructuredDataProps {
  /** Unique within the page. Lets multiple JSON-LD blocks coexist. */
  id: string;
  data: Record<string, any>;
}

export function StructuredData({ id, data }: StructuredDataProps) {
  useEffect(() => {
    const selector = `script[type="application/ld+json"][data-schema-id="${id}"]`;
    let script = document.querySelector(selector) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.setAttribute("type", "application/ld+json");
      script.setAttribute("data-schema-id", id);
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);

    return () => {
      const stale = document.querySelector(selector);
      if (stale) stale.remove();
    };
  }, [id, data]);

  return null;
}

// ─── Reusable canonical schemas ────────────────────────────────────────

const BASE_URL = "https://stsdashboard.com";
const ORG_NAME = "STS Futures";
const ORG_LEGAL_NAME = "STS Futures";
const ORG_LOGO = `${BASE_URL}/icon-512x512.png`;
const ORG_FOUNDER = "Rob Gorham";

/**
 * Organization schema — emit on every page (site-wide).
 *
 * Includes contactPoint, logo, founder, sameAs (social profiles).
 */
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: ORG_NAME,
  legalName: ORG_LEGAL_NAME,
  url: BASE_URL,
  logo: ORG_LOGO,
  description:
    "Systematic NQ (Nasdaq-100 E-mini) futures trading signals platform with 15+ years of backtested performance data and real-time alerts.",
  founder: {
    "@type": "Person",
    name: ORG_FOUNDER,
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      email: "support@stsfutures.com",
      availableLanguage: ["English"],
      areaServed: "Worldwide",
    },
  ],
  // sameAs entries should be added when social profiles exist.
  sameAs: [],
};

/**
 * WebSite schema with SitelinksSearchBox potential.
 * Emit on the homepage only.
 */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: ORG_NAME,
  url: BASE_URL,
  description:
    "Systematic NQ futures trading signals — real-time dashboard, 15-year backtested track record, $50/month.",
  publisher: {
    "@type": "Organization",
    name: ORG_NAME,
    logo: ORG_LOGO,
  },
  // No SearchAction yet — we don't have a site-wide search endpoint.
  // When one ships, add: potentialAction: { "@type": "SearchAction", ... }
};

/**
 * Subscription product schema — for /pricing.
 *
 * SoftwareApplication with FinanceApplication subcategory and a single
 * monthly Offer. priceValidUntil is set 1 year out.
 */
export const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "STS Futures Trading Dashboard",
  applicationCategory: "FinanceApplication",
  applicationSubCategory: "Trading Signals",
  operatingSystem: "Any (web-based)",
  description:
    "Web-based dashboard for NQ (Nasdaq-100 E-mini) futures trading signals with 15+ years of backtested data, real-time alerts, and professional risk analytics.",
  url: `${BASE_URL}/pricing`,
  publisher: {
    "@type": "Organization",
    name: ORG_NAME,
    logo: ORG_LOGO,
  },
  offers: [
    {
      "@type": "Offer",
      name: "STS Futures Pro Plan",
      price: "50",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "50",
        priceCurrency: "USD",
        billingDuration: "P1M",
        unitText: "month",
      },
      availability: "https://schema.org/InStock",
      url: `${BASE_URL}/pricing`,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    },
  ],
  // Don't include aggregateRating until we have real customer reviews.
};

/**
 * FAQ schema — for /faq.
 * Stays in sync with the FAQ.tsx page content.
 */
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is STS Futures?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STS Futures is a systematic NQ (Nasdaq-100 E-mini) futures trading signals platform. It provides real-time intraday trade alerts generated by a rules-based algorithm with a verified 15-year backtest spanning 2011–2026. Subscribers get full access to the web dashboard, trade history, equity curves, and risk analytics.",
      },
    },
    {
      "@type": "Question",
      name: "How much does STS Futures cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STS Futures is $50 per month with full access to all signals, trade history, and analytics. Cancel anytime. All sales are final. There is no free trial.",
      },
    },
    {
      "@type": "Question",
      name: "How are signals delivered?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Signals are delivered through (1) the STS Futures web dashboard with real-time updates and (2) email notifications subscribers can enable in their account preferences. No third-party software, Telegram, or Discord required.",
      },
    },
    {
      "@type": "Question",
      name: "What markets does STS Futures cover?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STS Futures focuses exclusively on NQ (Nasdaq-100 E-mini) futures contracts traded on the CME. The strategy is intraday — all positions are entered and exited within the same trading session.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel my subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, cancel anytime from your account settings. Access continues until the end of your current billing period. All sales are final — no refunds for partial billing periods.",
      },
    },
  ],
};

// ─── Schema builders (per-page helpers) ────────────────────────────────

/**
 * BreadcrumbList — emit on every interior page.
 *
 * Pass a flat array of { name, url } from root → current page.
 * Example:
 *   breadcrumbSchema([
 *     { name: "Home", url: "https://stsdashboard.com/" },
 *     { name: "Guides", url: "https://stsdashboard.com/guides" },
 *     { name: "Risk Management", url: "https://stsdashboard.com/guides/risk-management" },
 *   ])
 */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Article — for long-form content like /guides/risk-management.
 *
 * Use when the page is primarily a single piece of writing with an
 * author + publish date (think blog posts, guides).
 */
export interface ArticleInput {
  headline: string;
  description: string;
  url: string;
  /** ISO 8601 date string (YYYY-MM-DD or full ISO) */
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  /** URL of the OG image */
  image?: string;
  /** "TechArticle", "NewsArticle", "Blog", default "Article" */
  type?: "Article" | "TechArticle" | "NewsArticle" | "BlogPosting";
}

export function articleSchema(input: ArticleInput) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "Article",
    headline: input.headline,
    description: input.description,
    url: input.url,
    image: input.image ? [input.image] : undefined,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      "@type": "Person",
      name: input.authorName ?? ORG_FOUNDER,
    },
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: { "@type": "ImageObject", url: ORG_LOGO },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
  };
}

/**
 * HowTo — for step-by-step pages like /getting-started.
 *
 * Each step has a name + text; optional image per step.
 */
export interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

export interface HowToInput {
  name: string;
  description: string;
  url: string;
  /** ISO duration like "PT25M" for 25 minutes */
  totalTime?: string;
  steps: HowToStep[];
  image?: string;
}

export function howToSchema(input: HowToInput) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url: input.url,
    totalTime: input.totalTime,
    image: input.image,
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      url: s.url,
    })),
  };
}

/**
 * ItemList — for comparison pages or any ordered list of named things.
 *
 * Used by /vs/* pages to declare each row of the comparison.
 */
export function itemListSchema(
  name: string,
  items: { name: string; url?: string; description?: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
      description: it.description,
    })),
  };
}

/**
 * WebPage — generic per-page wrapper. Useful when no more specific
 * type fits but you still want a typed page entity.
 */
export interface WebPageInput {
  name: string;
  description: string;
  url: string;
  /** "AboutPage", "ContactPage", "CollectionPage", "ItemPage", default "WebPage" */
  type?: "WebPage" | "AboutPage" | "ContactPage" | "CollectionPage" | "ItemPage";
  breadcrumb?: ReturnType<typeof breadcrumbSchema>;
}

export function webPageSchema(input: WebPageInput) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: { "@type": "WebSite", name: ORG_NAME, url: BASE_URL },
    breadcrumb: input.breadcrumb,
    publisher: {
      "@type": "Organization",
      name: ORG_NAME,
      logo: ORG_LOGO,
    },
  };
}
