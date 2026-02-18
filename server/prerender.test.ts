import { describe, it, expect } from "vitest";

/**
 * Tests for the server-side pre-rendering middleware and billing features update.
 * Validates that crawlers receive full HTML while regular users get the SPA.
 */

// ============================================================
// Pre-Rendering Middleware Tests
// ============================================================

describe("Pre-Rendering Middleware", () => {
  const BASE_URL = "http://localhost:3000";

  // Helper to fetch with a specific user agent
  async function fetchAs(path: string, userAgent: string) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "User-Agent": userAgent },
    });
    const html = await res.text();
    return { status: res.status, html };
  }

  const GOOGLEBOT_UA =
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const BINGBOT_UA =
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
  const CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  describe("Crawler detection", () => {
    it("should return pre-rendered HTML for Googlebot on /pricing", async () => {
      const { status, html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      expect(status).toBe(200);
      expect(html).toContain("<title>Pricing | STS Futures");
      expect(html).toContain('name="description"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain("application/ld+json");
    });

    it("should return pre-rendered HTML for Bingbot on /pricing", async () => {
      const { status, html } = await fetchAs("/pricing", BINGBOT_UA);
      expect(status).toBe(200);
      expect(html).toContain("<title>Pricing | STS Futures");
    });

    it("should NOT pre-render for regular Chrome browser", async () => {
      const { status, html } = await fetchAs("/pricing", CHROME_UA);
      expect(status).toBe(200);
      // Regular users get the SPA shell with the generic title
      expect(html).not.toContain("<title>Pricing | STS Futures");
      expect(html).toContain('<div id="root">');
    });
  });

  describe("Public page pre-rendering", () => {
    const publicPages = [
      { path: "/", titleContains: "STS Futures" },
      { path: "/landing", titleContains: "STS Futures" },
      { path: "/pricing", titleContains: "Pricing" },
      { path: "/terms", titleContains: "Terms of Service" },
      { path: "/privacy", titleContains: "Privacy Policy" },
      { path: "/refund-policy", titleContains: "Refund Policy" },
      { path: "/disclaimer", titleContains: "Disclaimer" },
      { path: "/risk-disclosure", titleContains: "Risk Disclosure" },
      { path: "/qa", titleContains: "Q&amp;A" },
    ];

    publicPages.forEach(({ path, titleContains }) => {
      it(`should pre-render ${path} with correct title for crawlers`, async () => {
        const { status, html } = await fetchAs(path, GOOGLEBOT_UA);
        expect(status).toBe(200);
        expect(html).toContain(titleContains);
        // All pre-rendered pages should have canonical URL
        expect(html).toContain('rel="canonical"');
        // All should have Open Graph tags
        expect(html).toContain('property="og:');
      });
    });
  });

  describe("Protected pages", () => {
    it("should NOT pre-render /strategies for crawlers (protected)", async () => {
      const { status, html } = await fetchAs("/strategies", GOOGLEBOT_UA);
      expect(status).toBe(200);
      // Protected pages should either fall through to SPA or show a minimal page
      // The key is they should NOT have rich structured data
      expect(html).not.toContain('"@type":"Product"');
    });

    it("should NOT pre-render /admin for crawlers (protected)", async () => {
      const { status, html } = await fetchAs("/admin", GOOGLEBOT_UA);
      expect(status).toBe(200);
      expect(html).toContain('<div id="root">');
    });
  });

  describe("Meta tags and structured data", () => {
    it("should include Product structured data on /pricing", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      expect(html).toContain('"@type":"Product"');
      expect(html).toContain('"price":"50"');
      expect(html).toContain('"priceCurrency":"USD"');
    });

    it("should include FAQPage structured data on /qa", async () => {
      const { html } = await fetchAs("/qa", GOOGLEBOT_UA);
      expect(html).toContain('"@type":"FAQPage"');
    });

    it("should include proper robots meta tag", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      expect(html).toContain('name="robots"');
      expect(html).toContain("index, follow");
    });

    it("should include Twitter Card meta tags", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      expect(html).toContain('name="twitter:card"');
      expect(html).toContain("summary_large_image");
    });
  });

  describe("Content quality", () => {
    it("should include meaningful body content (not empty SPA shell)", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      // Pre-rendered pages should have actual text content
      expect(html).toContain("NQ");
      expect(html).toContain("$50");
      expect(html).toContain("month");
    });

    it("should include CSS styles for basic rendering", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      expect(html).toContain("<style>");
    });

    it("should include SPA hydration script for client-side takeover", async () => {
      const { html } = await fetchAs("/pricing", GOOGLEBOT_UA);
      // Pre-rendered pages include a script to redirect non-crawler visitors
      expect(html).toContain("window.location.replace");
    });
  });
});

// ============================================================
// Billing Page Features Update Tests
// ============================================================

describe("Billing Page Features", () => {
  it("should have updated feature list (no outdated items)", async () => {
    const fs = await import("fs");
    const billingContent = fs.readFileSync(
      "/home/ubuntu/intraday-dashboard/client/src/pages/Billing.tsx",
      "utf-8"
    );

    // Should NOT contain outdated features
    expect(billingContent).not.toContain("8 Proven Intraday Strategies");
    expect(billingContent).not.toContain("Real-Time Trade Alerts via Email");

    // Should contain updated features
    expect(billingContent).toContain("NQ Futures Intraday Trading Signals");
    expect(billingContent).toContain(
      "15+ Years of Backtested Performance Data"
    );
    expect(billingContent).toContain("Real-Time Dashboard & Sound Alerts");
    expect(billingContent).toContain("Equity Curves & Drawdown Analysis");
    expect(billingContent).toContain("Calendar P&L & Trade-by-Trade History");
    expect(billingContent).toContain("Strategy Comparison Tools");
  });

  it("should have consistent features on Pricing page", async () => {
    const fs = await import("fs");
    const pricingContent = fs.readFileSync(
      "/home/ubuntu/intraday-dashboard/client/src/pages/Pricing.tsx",
      "utf-8"
    );

    // Should NOT contain outdated features
    expect(pricingContent).not.toContain("8 Proven Intraday Strategies");
    expect(pricingContent).not.toContain("Real-Time Trade Alerts via Email");
    expect(pricingContent).not.toContain("Email & dashboard notifications");
    expect(pricingContent).not.toContain("Portfolio correlation analysis");

    // Should contain updated features
    expect(pricingContent).toContain("NQ futures intraday trading signals");
    expect(pricingContent).toContain(
      "15+ years of backtested performance data"
    );
    expect(pricingContent).toContain("Real-time dashboard & sound alerts");
    expect(pricingContent).toContain("Equity curves & drawdown analysis");
    expect(pricingContent).toContain("Calendar P&L & trade-by-trade history");
  });
});
