import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * SEO Routes Tests
 * Verify that the curated robots.txt and sitemap.xml files exist and contain
 * correct content that will be served by the Express routes.
 */

const CLIENT_PUBLIC = path.resolve(__dirname, "..", "client", "public");

describe("SEO Static Files", () => {
  describe("robots.txt", () => {
    const robotsPath = path.join(CLIENT_PUBLIC, "robots.txt");

    it("file exists in client/public", () => {
      expect(fs.existsSync(robotsPath)).toBe(true);
    });

    it("contains AI crawler directives for GPTBot", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("User-agent: GPTBot");
      expect(content).toContain("Allow: /");
    });

    it("contains AI crawler directives for anthropic-ai", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("User-agent: anthropic-ai");
    });

    it("contains AI crawler directives for PerplexityBot", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("User-agent: PerplexityBot");
    });

    it("contains AI crawler directives for Google-Extended", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("User-agent: Google-Extended");
    });

    it("blocks /api/ and /admin for all crawlers", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain("Disallow: /api/");
      expect(content).toContain("Disallow: /admin");
    });

    it("references stsdashboard.com sitemap", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).toContain(
        "Sitemap: https://stsdashboard.com/sitemap.xml"
      );
    });

    it("does NOT contain manus.space references", () => {
      const content = fs.readFileSync(robotsPath, "utf-8");
      expect(content).not.toContain("manus.space");
    });
  });

  describe("sitemap.xml", () => {
    const sitemapPath = path.join(CLIENT_PUBLIC, "sitemap.xml");

    it("file exists in client/public", () => {
      expect(fs.existsSync(sitemapPath)).toBe(true);
    });

    it("contains only stsdashboard.com URLs", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      const locMatches = content.match(/<loc>(.*?)<\/loc>/g) || [];
      expect(locMatches.length).toBeGreaterThan(0);
      locMatches.forEach(loc => {
        expect(loc).toContain("stsdashboard.com");
        expect(loc).not.toContain("manus.space");
      });
    });

    it("includes homepage with priority 1.0", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).toContain("<loc>https://stsdashboard.com/</loc>");
      expect(content).toContain("<priority>1.0</priority>");
    });

    it("includes pricing page", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).toContain("<loc>https://stsdashboard.com/pricing</loc>");
    });

    it("does NOT include admin pages", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).not.toContain("/admin</loc>");
    });

    it("does NOT include checkout pages", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).not.toContain("/checkout</loc>");
      expect(content).not.toContain("/checkout/success</loc>");
    });

    it("does NOT include broker-setup page", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).not.toContain("/broker-setup</loc>");
    });

    it("does NOT include login/signup pages", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      expect(content).not.toContain("/login</loc>");
      expect(content).not.toContain("/password-login</loc>");
      expect(content).not.toContain("/password-signup</loc>");
    });

    it("has 7 or fewer curated URLs (not auto-generated 26+)", () => {
      const content = fs.readFileSync(sitemapPath, "utf-8");
      const locMatches = content.match(/<loc>/g) || [];
      expect(locMatches.length).toBeLessThanOrEqual(7);
      expect(locMatches.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("llms.txt", () => {
    const llmsPath = path.join(CLIENT_PUBLIC, "llms.txt");

    it("file exists in client/public", () => {
      expect(fs.existsSync(llmsPath)).toBe(true);
    });

    it("contains NQ-focused content", () => {
      const content = fs.readFileSync(llmsPath, "utf-8");
      expect(content).toContain("NQ");
      expect(content).toContain("Nasdaq-100");
    });

    it("contains correct pricing ($50/month)", () => {
      const content = fs.readFileSync(llmsPath, "utf-8");
      expect(content).toContain("$50/month");
    });

    it("does NOT claim free trial", () => {
      const content = fs.readFileSync(llmsPath, "utf-8");
      expect(content).toContain("No free trial");
    });

    it("references stsdashboard.com", () => {
      const content = fs.readFileSync(llmsPath, "utf-8");
      expect(content).toContain("stsdashboard.com");
    });
  });

  describe("ai.txt", () => {
    const aiPath = path.join(CLIENT_PUBLIC, "ai.txt");

    it("file exists in client/public", () => {
      expect(fs.existsSync(aiPath)).toBe(true);
    });

    it("contains NQ-focused content", () => {
      const content = fs.readFileSync(aiPath, "utf-8");
      expect(content).toContain("NQ");
    });

    it("references stsdashboard.com", () => {
      const content = fs.readFileSync(aiPath, "utf-8");
      expect(content).toContain("stsdashboard.com");
    });
  });
});
