/**
 * Server-Side Pre-Rendering Middleware for SEO
 *
 * Detects crawler/bot user agents and returns fully rendered HTML
 * with page-specific content, meta tags, and structured data.
 * Regular users continue to get the SPA experience.
 *
 * This fixes Google Search Console indexing rejections for SPA routes
 * by providing crawlers with complete, parseable HTML content.
 */
import { Request, Response, NextFunction } from "express";

// ============================================================
// Crawler Detection
// ============================================================
const CRAWLER_USER_AGENTS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "sogou",
  "exabot",
  "facebot",
  "facebookexternalhit",
  "ia_archiver",
  "linkedinbot",
  "twitterbot",
  "applebot",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "anthropic-ai",
  "ccbot",
  "seznambot",
];

function isCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(bot => ua.includes(bot));
}

// ============================================================
// Page Content Definitions
// ============================================================
interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogType?: string;
  structuredData?: object[];
  bodyContent: string;
}

const BASE_URL = "https://stsdashboard.com";

function getPageMeta(pathname: string): PageMeta | null {
  const pages: Record<string, PageMeta> = {
    "/": {
      title: "STS Futures | NQ Futures Trading Signals & Performance Dashboard",
      description:
        "Systematic NQ futures trading signals backed by 15+ years of backtested data. Real-time alerts, full trade history, and professional risk analytics. $50/month, cancel anytime.",
      canonical: `${BASE_URL}/`,
      ogType: "website",
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "STS Futures",
          alternateName: "Systematic Trading Strategies",
          url: BASE_URL,
          description:
            "Systematic NQ futures trading signals platform with 15+ years of backtested performance data and real-time alerts.",
          foundingDate: "2024",
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            availableLanguage: "English",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "STS Futures",
          url: BASE_URL,
          description:
            "Systematic NQ futures trading signals with 15+ years of backtested data and a professional analytics dashboard.",
        },
      ],
      bodyContent: `
        <header>
          <h1>STS Futures — Systematic NQ Futures Trading Signals</h1>
          <p>15+ years of backtested data. Real-time alerts. Professional analytics.</p>
        </header>
        <main>
          <section>
            <h2>Systematic Trading Algo — 15 Years of Data — Real Time Alerts</h2>
            <p>You get a dashboard showing our futures strategies' complete track record. Every single trade. Every win and loss. All the stats. No surprises.</p>
            <p><a href="${BASE_URL}/pricing">View Pricing</a> | <a href="${BASE_URL}/landing">Learn More</a></p>
          </section>
          <section>
            <h2>What You Get</h2>
            <ul>
              <li>Real-time NQ (Nasdaq-100) futures trading signals delivered on a professional web dashboard</li>
              <li>15+ years of backtested trade history with full transparency</li>
              <li>Equity curves, drawdown analysis, and risk-adjusted performance metrics</li>
              <li>Portfolio analytics including Sharpe ratio, Sortino ratio, and Calmar ratio</li>
              <li>Calendar P&amp;L view and trade-by-trade data</li>
              <li>Real-time dashboard notifications with sound alerts</li>
              <li>Position sizing calculator with risk management tools</li>
              <li>Strategy comparison tools</li>
            </ul>
          </section>
          <section>
            <h2>Frequently Asked Questions</h2>
            <dl>
              <dt>What is STS Futures?</dt>
              <dd>STS Futures is a web-based dashboard that provides systematic NQ (Nasdaq-100) futures trading signals backed by 15+ years of backtested data.</dd>
              <dt>What futures markets does STS Futures cover?</dt>
              <dd>STS Futures focuses on NQ (Nasdaq-100 E-mini) futures contracts with intraday signals.</dd>
              <dt>How much does STS Futures cost?</dt>
              <dd>$50 per month with full access to all signals, trade history, and analytics. Cancel anytime.</dd>
              <dt>How are signals delivered?</dt>
              <dd>All signals are delivered on the STS web-based dashboard in real time. No special software required.</dd>
            </dl>
          </section>
        </main>`,
    },

    "/landing": {
      title: "STS Futures | NQ Futures Trading Signals Platform",
      description:
        "Discover STS Futures — systematic NQ futures trading signals backed by 15+ years of data. Professional dashboard with real-time alerts, equity curves, and risk analytics.",
      canonical: `${BASE_URL}/landing`,
      bodyContent: `
        <header>
          <h1>STS Futures — Professional NQ Futures Trading Signals</h1>
        </header>
        <main>
          <section>
            <h2>Systematic Trading Algo — 15 Years of Data — Real Time Alerts</h2>
            <p>STS Futures provides systematic NQ (Nasdaq-100) futures trading signals backed by over 15 years of backtested data. Our professional dashboard delivers real-time alerts, complete trade history, equity curves, and risk-adjusted performance metrics.</p>
          </section>
          <section>
            <h2>Why Choose STS Futures?</h2>
            <ul>
              <li>Transparent track record with every trade documented</li>
              <li>Professional-grade analytics including Sharpe, Sortino, and Calmar ratios</li>
              <li>Real-time dashboard notifications when trades open or close</li>
              <li>$50/month — cancel anytime, no long-term commitment</li>
            </ul>
            <p><a href="${BASE_URL}/pricing">View Pricing</a></p>
          </section>
        </main>`,
    },

    "/pricing": {
      title: "Pricing | STS Futures — $50/Month NQ Trading Signals",
      description:
        "STS Futures Pro Plan: $50/month for NQ futures trading signals, 15+ years of backtested data, real-time dashboard alerts, performance analytics, and strategy comparison tools. Cancel anytime.",
      canonical: `${BASE_URL}/pricing`,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: "STS Futures Pro Plan",
          description:
            "Monthly subscription to the STS Futures dashboard providing NQ futures trading signals, 15+ years of trade history, and professional analytics.",
          image: `${BASE_URL}/portfolio-preview.webp`,
          brand: { "@type": "Brand", name: "STS Futures" },
          offers: {
            "@type": "Offer",
            name: "Pro Plan — Monthly Subscription",
            price: "50",
            priceCurrency: "USD",
            priceValidUntil: "2026-12-31",
            availability: "https://schema.org/InStock",
            url: `${BASE_URL}/pricing`,
          },
        },
      ],
      bodyContent: `
        <header>
          <h1>STS Futures Pricing</h1>
        </header>
        <main>
          <section>
            <h2>Pro Plan — $50/month</h2>
            <p>Everything you need to trade with confidence.</p>
            <ul>
              <li>NQ Futures Intraday Trading Signals</li>
              <li>15+ Years of Historical Performance Data</li>
              <li>Real-Time Dashboard &amp; Sound Alerts</li>
              <li>Position Sizing Calculator with Risk Management</li>
              <li>Detailed Performance Analytics &amp; Metrics</li>
              <li>Strategy Comparison Tools</li>
              <li>Calendar P&amp;L and Trade-by-Trade History</li>
              <li>Equity Curves &amp; Drawdown Analysis</li>
            </ul>
            <p><a href="${BASE_URL}/checkout">Get Started</a></p>
          </section>
        </main>`,
    },

    "/terms": {
      title: "Terms of Service | STS Futures",
      description:
        "Terms of Service for STS Futures. Read our terms governing the use of the STS Futures trading signals dashboard and subscription service.",
      canonical: `${BASE_URL}/terms`,
      bodyContent: `
        <header>
          <h1>Terms of Service</h1>
        </header>
        <main>
          <section>
            <h2>STS Futures Terms of Service</h2>
            <p>Welcome to STS Futures. These Terms of Service govern your use of the STS Futures website and subscription service located at stsdashboard.com.</p>
            <h3>1. Service Description</h3>
            <p>STS Futures provides a web-based dashboard displaying systematic NQ (Nasdaq-100) futures trading signals, historical performance data, and analytics tools.</p>
            <h3>2. Subscription</h3>
            <p>Access to the dashboard requires a paid subscription at $50/month. You may cancel at any time. All sales are final.</p>
            <h3>3. Disclaimer</h3>
            <p>Trading futures involves substantial risk of loss. Past performance is not indicative of future results. STS Futures does not provide financial advice.</p>
          </section>
        </main>`,
    },

    "/privacy": {
      title: "Privacy Policy | STS Futures",
      description:
        "Privacy Policy for STS Futures. Learn how we collect, use, and protect your personal information on the STS Futures trading signals platform.",
      canonical: `${BASE_URL}/privacy`,
      bodyContent: `
        <header>
          <h1>Privacy Policy</h1>
        </header>
        <main>
          <section>
            <h2>STS Futures Privacy Policy</h2>
            <p>This Privacy Policy describes how STS Futures collects, uses, and protects your personal information when you use our website at stsdashboard.com.</p>
            <h3>Information We Collect</h3>
            <p>We collect your email address and name when you create an account. Payment information is processed securely by Stripe and is never stored on our servers.</p>
            <h3>How We Use Your Information</h3>
            <p>We use your information to provide the STS Futures dashboard service, send trade notifications, and communicate important account updates.</p>
            <h3>Data Security</h3>
            <p>We implement industry-standard security measures to protect your personal information, including encrypted connections (HTTPS) and secure authentication.</p>
          </section>
        </main>`,
    },

    "/refund-policy": {
      title: "Refund Policy | STS Futures",
      description:
        "Refund Policy for STS Futures. All sales are final. Learn about our subscription cancellation and refund policies.",
      canonical: `${BASE_URL}/refund-policy`,
      bodyContent: `
        <header>
          <h1>Refund Policy</h1>
        </header>
        <main>
          <section>
            <h2>STS Futures Refund Policy</h2>
            <p>All sales are final. Due to the nature of digital trading signal services, we do not offer refunds on subscription payments.</p>
            <p>You may cancel your subscription at any time from your account settings. Your access will continue until the end of your current billing period.</p>
            <p>If you have questions about your subscription, please contact our support team.</p>
          </section>
        </main>`,
    },

    "/disclaimer": {
      title: "Disclaimer | STS Futures",
      description:
        "Legal disclaimer for STS Futures. Important information about trading risks, performance data, and the nature of our trading signals service.",
      canonical: `${BASE_URL}/disclaimer`,
      bodyContent: `
        <header>
          <h1>Disclaimer</h1>
        </header>
        <main>
          <section>
            <h2>STS Futures Disclaimer</h2>
            <p>Trading futures and options involves substantial risk of loss and is not suitable for all investors. Past performance is not necessarily indicative of future results.</p>
            <p>The information provided on STS Futures is for informational and educational purposes only. It should not be considered as financial advice, investment advice, or a recommendation to buy or sell any financial instrument.</p>
            <p>All trading signals, performance data, and analytics displayed on the STS Futures dashboard are based on backtested and/or live-tracked systematic strategies. Backtested results have inherent limitations and do not guarantee future performance.</p>
            <p>You should consult with a qualified financial advisor before making any investment decisions. STS Futures and its operators are not registered investment advisors.</p>
          </section>
        </main>`,
    },

    "/risk-disclosure": {
      title: "Risk Disclosure | STS Futures",
      description:
        "Risk Disclosure for STS Futures. Understand the risks associated with futures trading and using algorithmic trading signals.",
      canonical: `${BASE_URL}/risk-disclosure`,
      bodyContent: `
        <header>
          <h1>Risk Disclosure</h1>
        </header>
        <main>
          <section>
            <h2>STS Futures Risk Disclosure</h2>
            <p>Futures trading carries a high level of risk and may not be suitable for all investors. You could lose more than your initial investment.</p>
            <h3>Key Risks</h3>
            <ul>
              <li>Leverage Risk: Futures contracts are highly leveraged instruments. Small market movements can result in large gains or losses.</li>
              <li>Market Risk: Market conditions can change rapidly and unpredictably, leading to significant losses.</li>
              <li>Liquidity Risk: Some futures markets may have limited liquidity, making it difficult to exit positions.</li>
              <li>System Risk: Electronic trading systems are subject to failures, delays, and errors.</li>
              <li>Past Performance: Historical and backtested results do not guarantee future performance.</li>
            </ul>
            <p>Only risk capital — money you can afford to lose — should be used for trading. You should carefully consider whether futures trading is appropriate for your financial situation.</p>
          </section>
        </main>`,
    },

    "/qa": {
      title: "Q&A | STS Futures — Frequently Asked Questions",
      description:
        "Frequently asked questions about STS Futures NQ trading signals. Learn about our platform, pricing, signal delivery, and more.",
      canonical: `${BASE_URL}/qa`,
      structuredData: [
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What is STS Futures?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "STS Futures is a web-based dashboard that provides systematic NQ (Nasdaq-100) futures trading signals backed by 15+ years of backtested data.",
              },
            },
            {
              "@type": "Question",
              name: "How much does STS Futures cost?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "$50 per month with full access to all signals, trade history, and analytics. Cancel anytime.",
              },
            },
            {
              "@type": "Question",
              name: "How are signals delivered?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "All signals are delivered on the STS web-based dashboard in real time with sound alerts. No special software, Telegram, or Discord required.",
              },
            },
            {
              "@type": "Question",
              name: "Can I cancel my subscription?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, you can cancel at any time from your account settings. Access continues until the end of your billing period. All sales are final.",
              },
            },
          ],
        },
      ],
      bodyContent: `
        <header>
          <h1>Frequently Asked Questions</h1>
        </header>
        <main>
          <section>
            <h2>Common Questions About STS Futures</h2>
            <dl>
              <dt>What is STS Futures?</dt>
              <dd>STS Futures is a web-based dashboard that provides systematic NQ (Nasdaq-100) futures trading signals backed by 15+ years of backtested data.</dd>
              <dt>How much does STS Futures cost?</dt>
              <dd>$50 per month with full access to all signals, trade history, and analytics. Cancel anytime.</dd>
              <dt>How are signals delivered?</dt>
              <dd>All signals are delivered on the STS web-based dashboard in real time with sound alerts. No special software required.</dd>
              <dt>Can I cancel my subscription?</dt>
              <dd>Yes, you can cancel at any time from your account settings. Access continues until the end of your billing period. All sales are final.</dd>
              <dt>What futures markets does STS Futures cover?</dt>
              <dd>STS Futures focuses on NQ (Nasdaq-100 E-mini) futures contracts with intraday signals.</dd>
              <dt>How long has the trading data been backtested?</dt>
              <dd>The NQ futures trading strategy has been backtested using over 15 years of historical market data.</dd>
            </dl>
          </section>
        </main>`,
    },

    "/overview": {
      title: "Portfolio Overview | STS Futures Dashboard",
      description:
        "View the STS Futures portfolio overview with real-time NQ trading signals, equity curves, performance metrics, and trade history. Login required.",
      canonical: `${BASE_URL}/overview`,
      bodyContent: `
        <header>
          <h1>STS Futures — Portfolio Overview</h1>
        </header>
        <main>
          <section>
            <h2>Portfolio Overview Dashboard</h2>
            <p>The STS Futures portfolio overview provides real-time NQ futures trading signals, equity curves, drawdown analysis, and comprehensive performance metrics.</p>
            <p>Features include calendar P&amp;L, trade-by-trade history, risk-adjusted metrics (Sharpe, Sortino, Calmar ratios), and position sizing tools.</p>
            <p><a href="${BASE_URL}/pricing">Subscribe to access the full dashboard</a></p>
          </section>
        </main>`,
    },

    "/compare": {
      title: "Strategy Comparison | STS Futures",
      description:
        "Compare NQ futures trading strategies side-by-side on STS Futures. Analyze performance metrics, equity curves, and risk-adjusted returns.",
      canonical: `${BASE_URL}/compare`,
      bodyContent: `
        <header>
          <h1>Strategy Comparison</h1>
        </header>
        <main>
          <section>
            <h2>Compare NQ Futures Trading Strategies</h2>
            <p>Use the STS Futures strategy comparison tool to analyze multiple NQ futures trading strategies side-by-side. Compare equity curves, drawdown profiles, Sharpe ratios, and other risk-adjusted performance metrics.</p>
            <p><a href="${BASE_URL}/pricing">Subscribe to access strategy comparison</a></p>
          </section>
        </main>`,
    },

    "/my-dashboard": {
      title: "My Dashboard | STS Futures",
      description:
        "Your personalized STS Futures dashboard with selected strategies, combined equity curves, and customized analytics. Login required.",
      canonical: `${BASE_URL}/my-dashboard`,
      bodyContent: `
        <header>
          <h1>My Dashboard</h1>
        </header>
        <main>
          <section>
            <h2>Personalized Trading Dashboard</h2>
            <p>Your personalized STS Futures dashboard displays your selected strategies, combined equity curves, and customized analytics tailored to your trading preferences.</p>
            <p><a href="${BASE_URL}/pricing">Subscribe to access your personalized dashboard</a></p>
          </section>
        </main>`,
    },
  };

  return pages[pathname] || null;
}

// ============================================================
// HTML Template Generator
// ============================================================
function generatePrerenderedHTML(meta: PageMeta): string {
  const structuredDataScripts = (meta.structuredData || [])
    .map(
      sd => `<script type="application/ld+json">${JSON.stringify(sd)}</script>`
    )
    .join("\n    ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    
    <title>${escapeHtml(meta.title)}</title>
    <meta name="title" content="${escapeHtml(meta.title)}" />
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="googlebot" content="index, follow" />
    <meta name="bingbot" content="index, follow" />
    <link rel="canonical" href="${meta.canonical}" />
    
    <meta name="author" content="STS Futures" />
    <meta name="publisher" content="STS Futures" />
    <meta name="language" content="English" />
    <meta name="geo.region" content="US" />
    
    <!-- Open Graph -->
    <meta property="og:type" content="${meta.ogType || "website"}" />
    <meta property="og:url" content="${meta.canonical}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${BASE_URL}/portfolio-preview.webp" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="STS Futures" />
    <meta property="og:locale" content="en_US" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${meta.canonical}" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${BASE_URL}/portfolio-preview.webp" />
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    
    <!-- Structured Data -->
    ${structuredDataScripts}
    
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #fff; color: #1a1a2e; }
      header { background: #0f172a; color: #fff; padding: 2rem; text-align: center; }
      header h1 { margin: 0; font-size: 1.8rem; }
      header p { margin: 0.5rem 0 0; opacity: 0.8; }
      main { max-width: 800px; margin: 0 auto; padding: 2rem; }
      section { margin-bottom: 2rem; }
      h2 { color: #0f172a; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; }
      h3 { color: #334155; }
      ul, ol { padding-left: 1.5rem; }
      li { margin-bottom: 0.5rem; line-height: 1.6; }
      dt { font-weight: bold; margin-top: 1rem; color: #0f172a; }
      dd { margin-left: 0; margin-bottom: 1rem; line-height: 1.6; color: #475569; }
      a { color: #10b981; text-decoration: none; }
      a:hover { text-decoration: underline; }
      p { line-height: 1.7; color: #475569; }
      nav { background: #f8fafc; padding: 1rem 2rem; border-bottom: 1px solid #e2e8f0; }
      nav a { margin-right: 1.5rem; color: #334155; font-weight: 500; }
      footer { background: #0f172a; color: #94a3b8; padding: 2rem; text-align: center; margin-top: 3rem; }
      footer a { color: #10b981; }
    </style>
  </head>
  <body>
    <nav>
      <a href="${BASE_URL}/">Home</a>
      <a href="${BASE_URL}/pricing">Pricing</a>
      <a href="${BASE_URL}/qa">FAQ</a>
      <a href="${BASE_URL}/landing">About</a>
    </nav>
    ${meta.bodyContent}
    <footer>
      <p>&copy; ${new Date().getFullYear()} STS Futures. All rights reserved.</p>
      <p>
        <a href="${BASE_URL}/terms">Terms of Service</a> |
        <a href="${BASE_URL}/privacy">Privacy Policy</a> |
        <a href="${BASE_URL}/refund-policy">Refund Policy</a> |
        <a href="${BASE_URL}/disclaimer">Disclaimer</a> |
        <a href="${BASE_URL}/risk-disclosure">Risk Disclosure</a>
      </p>
      <p style="margin-top: 1rem; font-size: 0.85rem;">
        Trading futures involves substantial risk of loss. Past performance is not indicative of future results.
        STS Futures does not provide financial advice. Please read our <a href="${BASE_URL}/risk-disclosure">Risk Disclosure</a> before trading.
      </p>
    </footer>
    
    <!-- Redirect non-crawler visitors to the SPA -->
    <script>
      // This page is a pre-rendered version for search engine crawlers.
      // Regular visitors are redirected to the full SPA experience.
      if (!navigator.userAgent.match(/bot|crawl|spider|slurp|baidu|yandex|bing|google|duckduck|facebook|twitter|linkedin|apple|semrush|ahrefs|gpt|claude|anthropic|seznam/i)) {
        window.location.replace(window.location.href);
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
// Middleware Export
// ============================================================
export function prerenderMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userAgent = req.headers["user-agent"] || "";

  // Only intercept for crawlers
  if (!isCrawler(userAgent)) {
    return next();
  }

  // Only intercept GET requests for HTML pages
  if (req.method !== "GET") {
    return next();
  }

  // Skip API routes, static assets, and known file extensions
  const pathname = req.path;
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/@") ||
    pathname.includes(".") // Has file extension (e.g., .js, .css, .png)
  ) {
    return next();
  }

  const pageMeta = getPageMeta(pathname);
  if (!pageMeta) {
    return next(); // Unknown page, let SPA handle it
  }

  console.log(
    `[Prerender] Serving pre-rendered HTML for ${pathname} to ${userAgent.substring(0, 50)}`
  );

  const html = generatePrerenderedHTML(pageMeta);
  res
    .status(200)
    .set({ "Content-Type": "text/html; charset=utf-8" })
    .send(html);
}

// Export for testing
export { isCrawler, getPageMeta, generatePrerenderedHTML };
