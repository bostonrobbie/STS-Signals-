/**
 * SEOStructured — JSON-LD schema helper, complements SEOHead.
 *
 * SEOHead handles <title>, meta, canonical, OpenGraph, Twitter.
 * This component emits schema.org JSON-LD blocks that LLMs and AI
 * search engines consume preferentially over free-form text:
 *   - WebPage (always)
 *   - BreadcrumbList (if crumbs passed)
 *   - FAQPage (if faqs passed)
 *   - Article (if article passed)
 *   - Product + Offer (if productOffer passed)
 *   - HowTo (if howTo passed)
 *   - Person (if person passed — E-E-A-T authority signal)
 *
 * JSON-LD blocks share a data-sts-schema attribute so navigating between
 * pages cleanly replaces the previous page's blocks.
 */
import { useEffect } from "react";

const SITE = "https://stsdashboard.com";
const BRAND = "STS Futures";

interface FAQItem {
  q: string;
  a: string;
}
interface Crumb {
  name: string;
  url: string;
}
interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

export interface SEOStructuredProps {
  path: string; // page path relative to SITE, e.g. "/pricing"
  title: string; // used as WebPage name
  description: string; // used as WebPage description
  breadcrumbs?: Crumb[];
  faqs?: FAQItem[];
  article?: {
    headline: string;
    datePublished: string;
    dateModified?: string;
    authorName?: string;
    image?: string;
  };
  productOffer?: {
    name: string;
    price: number;
    currency?: string;
    sku?: string;
  };
  howTo?: {
    name: string;
    description: string;
    steps: HowToStep[];
    totalTime?: string; // ISO 8601 duration, e.g. "PT5M"
  };
  person?: {
    name: string;
    jobTitle: string;
    description: string;
    image?: string;
    sameAs?: string[]; // social links
  };
}

function setJsonLd(id: string, blocks: object[]) {
  document
    .head
    .querySelectorAll(`script[data-sts-schema="${id}"]`)
    .forEach(el => el.remove());
  blocks.forEach((obj, i) => {
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-sts-schema", id);
    s.setAttribute("data-sts-idx", String(i));
    s.text = JSON.stringify(obj);
    document.head.appendChild(s);
  });
}

export function SEOStructured(props: SEOStructuredProps) {
  useEffect(() => {
    const url = `${SITE}${props.path}`;
    const blocks: object[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: props.title,
        description: props.description,
        isPartOf: { "@id": `${SITE}/#website` },
        inLanguage: "en-US",
      },
    ];

    if (props.breadcrumbs?.length) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: props.breadcrumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: c.url.startsWith("http") ? c.url : `${SITE}${c.url}`,
        })),
      });
    }

    if (props.faqs?.length) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: props.faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }

    if (props.article) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: props.article.headline,
        datePublished: props.article.datePublished,
        dateModified:
          props.article.dateModified || props.article.datePublished,
        author: {
          "@type": "Person",
          name: props.article.authorName || "Rob Gorham",
          url: `${SITE}/about`,
        },
        publisher: {
          "@type": "Organization",
          name: BRAND,
          logo: { "@type": "ImageObject", url: `${SITE}/favicon.svg` },
        },
        image: props.article.image || `${SITE}/portfolio-preview.webp`,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      });
    }

    if (props.productOffer) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "Product",
        name: props.productOffer.name,
        sku: props.productOffer.sku || "sts-pro-monthly",
        description: props.description,
        brand: { "@type": "Brand", name: BRAND },
        offers: {
          "@type": "Offer",
          price: props.productOffer.price,
          priceCurrency: props.productOffer.currency || "USD",
          availability: "https://schema.org/InStock",
          url,
        },
      });
    }

    if (props.howTo) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: props.howTo.name,
        description: props.howTo.description,
        totalTime: props.howTo.totalTime,
        step: props.howTo.steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
          url: s.url,
        })),
      });
    }

    if (props.person) {
      blocks.push({
        "@context": "https://schema.org",
        "@type": "Person",
        name: props.person.name,
        jobTitle: props.person.jobTitle,
        description: props.person.description,
        image: props.person.image,
        url: `${SITE}${props.path}`,
        worksFor: { "@type": "Organization", name: BRAND, url: SITE },
        sameAs: props.person.sameAs,
      });
    }

    setJsonLd("sts-page", blocks);
  }, [
    props.path,
    props.title,
    props.description,
    JSON.stringify(props.breadcrumbs || []),
    JSON.stringify(props.faqs || []),
    JSON.stringify(props.article || null),
    JSON.stringify(props.productOffer || null),
    JSON.stringify(props.howTo || null),
    JSON.stringify(props.person || null),
  ]);

  return null;
}
