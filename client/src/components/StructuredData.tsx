import { useEffect } from "react";

interface StructuredDataProps {
  data: Record<string, any>;
}

export function StructuredData({ data }: StructuredDataProps) {
  useEffect(() => {
    // Create or update script tag with JSON-LD
    let script = document.querySelector('script[type="application/ld+json"]');
    if (!script) {
      script = document.createElement("script");
      script.setAttribute("type", "application/ld+json");
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }, [data]);

  return null;
}

// Organization schema
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "STS Futures",
  description:
    "Systematic NQ futures trading signals platform with 15+ years of backtested performance data.",
  url: "https://stsdashboard.com",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "Customer Support",
    availableLanguage: "English",
  },
};

// FAQ Schema - matches actual FAQ content on landing page
export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is STS Futures?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STS Futures provides systematic NQ (Nasdaq-100) futures trading signals with real-time alerts and 15+ years of backtested data on a professional web dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "How much does STS Futures cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "STS Futures costs $50 per month with full access to all signals, trade history, and analytics. You can cancel anytime. All sales are final.",
      },
    },
    {
      "@type": "Question",
      name: "How are signals delivered?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All signals are delivered on the STS web-based dashboard in real time. No special software, Telegram, or Discord is required. Just log in from any web browser.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel my subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, you can cancel your subscription at any time from your account settings. Your access continues until the end of your current billing period.",
      },
    },
  ],
};

// Product/Service Schema - no fabricated ratings or reviews
export const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "STS Futures Trading Dashboard",
  description:
    "Web-based dashboard for NQ futures trading signals with 15+ years of backtested data, real-time alerts, and professional risk analytics.",
  applicationCategory: "FinanceApplication",
  offers: {
    "@type": "Offer",
    price: "50",
    priceCurrency: "USD",
    priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  },
  operatingSystem: "Web",
  requirements: "Modern web browser",
};

// Breadcrumb Schema
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
