/**
 * Google Analytics Integration Tests
 * Verifies the GA4 integration is correctly wired up in the codebase
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "..");

function readClientFile(relativePath: string): string {
  return readFileSync(
    resolve(projectRoot, "client/src", relativePath),
    "utf-8"
  );
}

function readRootFile(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf-8");
}

describe("Google Analytics Integration", () => {
  describe("GoogleAnalytics component", () => {
    it("uses the correct GA4 Measurement ID G-LVFVPLWCVP", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("G-LVFVPLWCVP");
      expect(content).not.toContain("G-XXXXXXXXXX");
    });

    it("stores the Measurement ID in a named constant", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain('const GA_MEASUREMENT_ID = "G-LVFVPLWCVP"');
    });

    it("loads the gtag script dynamically", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("googletagmanager.com/gtag/js");
      expect(content).toContain("GA_MEASUREMENT_ID");
    });

    it("tracks page views on location change", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain('"page_view"');
      expect(content).toContain("page_path");
    });

    it("tracks purchase event on checkout success", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain('"purchase"');
      expect(content).toContain("/checkout-success");
    });

    it("exports trackGAEvent helper", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("export function trackGAEvent");
    });

    it("exports trackGACTAClick helper", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("export function trackGACTAClick");
    });

    it("exports trackGAConversion helper", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("export function trackGAConversion");
    });

    it("exports trackGASignUp helper", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("export function trackGASignUp");
    });

    it("exports trackGALogin helper", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("export function trackGALogin");
    });

    it("has anonymize_ip enabled for GDPR compliance", () => {
      const content = readClientFile("components/GoogleAnalytics.tsx");
      expect(content).toContain("anonymize_ip: true");
    });
  });

  describe("App.tsx integration", () => {
    it("imports GoogleAnalytics component", () => {
      const content = readClientFile("App.tsx");
      expect(content).toContain("import { GoogleAnalytics }");
      expect(content).toContain("GoogleAnalytics");
    });

    it("renders GoogleAnalytics component in the app tree", () => {
      const content = readClientFile("App.tsx");
      expect(content).toContain("<GoogleAnalytics />");
    });
  });

  describe("Manus Analytics (Umami) integration", () => {
    it("uses correct Umami script URL with /script.js suffix", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain("/script.js");
      expect(content).not.toContain('/umami"');
    });

    it("has VITE_ANALYTICS_WEBSITE_ID configured", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain("data-website-id");
      expect(content).toContain("VITE_ANALYTICS_WEBSITE_ID");
    });

    it("has VITE_ANALYTICS_ENDPOINT configured", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain("VITE_ANALYTICS_ENDPOINT");
    });
  });

  describe("performance.ts cleanup", () => {
    it("does not have duplicate GA script loader with placeholder ID", () => {
      const content = readClientFile("lib/performance.ts");
      expect(content).not.toContain("G-XXXXXXXXXX");
    });

    it("references the correct GA Measurement ID in comments", () => {
      const content = readClientFile("lib/performance.ts");
      expect(content).toContain("G-LVFVPLWCVP");
    });
  });

  describe("SEO and structured data", () => {
    it("has Google Search Console verification meta tag", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain("google-site-verification");
    });

    it("has JSON-LD structured data for WebSite schema", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain('"@type": "WebSite"');
    });

    it("has JSON-LD structured data for SoftwareApplication schema", () => {
      const content = readRootFile("client/index.html");
      expect(content).toContain('"@type": "SoftwareApplication"');
    });
  });

  describe("Custom analytics pipeline", () => {
    it("initAnalytics is called in App.tsx on mount", () => {
      const content = readClientFile("App.tsx");
      expect(content).toContain("initAnalytics()");
    });

    it("captureTrafficSource is called in App.tsx on mount", () => {
      const content = readClientFile("App.tsx");
      expect(content).toContain("captureTrafficSource()");
    });
  });
});
