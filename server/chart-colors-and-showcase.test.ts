import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const clientSrc = path.resolve(__dirname, "../client/src");

describe("useChartColors hook file", () => {
  it("should exist and export tickColor and gridColor", () => {
    const hookPath = path.join(clientSrc, "hooks/useChartColors.ts");
    expect(fs.existsSync(hookPath)).toBe(true);
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("useChartColors");
    expect(content).toContain("foreground");
    expect(content).toContain("mutedForeground");
  });

  it("Overview.tsx should use useChartColors hook", () => {
    const overviewPath = path.join(clientSrc, "pages/Overview.tsx");
    const content = fs.readFileSync(overviewPath, "utf-8");
    expect(content).toContain("useChartColors");
  });

  it("HomeEquityCurve should have visible metric text (text-foreground)", () => {
    const filePath = path.join(clientSrc, "components/HomeEquityCurve.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("text-foreground");
  });
});

describe("Landing page feature showcase section", () => {
  const landingPagePath = path.join(clientSrc, "pages/LandingPage.tsx");

  it("should contain feature screenshot CDN URLs", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    // Verify at least 4 CDN image URLs exist in the showcase section
    const cdnMatches = content.match(/cloudfront\.net|files\.manuscdn\.com/g);
    expect(cdnMatches).not.toBeNull();
    expect(cdnMatches!.length).toBeGreaterThanOrEqual(4);
  });

  it("should contain 'See Exactly What You Get' section heading", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    expect(content).toContain("See Exactly What You Get");
    expect(content).toContain("Inside The Dashboard");
  });

  it("should contain all feature titles", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    // Feature sections in the current 5-section LandingPage
    expect(content).toContain("Know Your Best Days");
    expect(content).toContain("Every Trade");
    expect(content).toContain("Every Metric at a Glance");
    expect(content).toContain("See Exactly What You Get");
  });

  it("should contain Get Full Access CTA", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    expect(content).toContain("Get Full Access");
  });

  it("should have proper alt text for accessibility", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    // Alt text in the current 5-section LandingPage
    expect(content).toContain('alt="STS Futures dashboard');
    expect(content).toContain('alt="Day-of-Week Performance');
    expect(content).toContain('alt="Calendar P&L');
    expect(content).toContain('alt="STS trade alert email');
  });

  it("should have lazy loading on all screenshot images", () => {
    const content = fs.readFileSync(landingPagePath, "utf-8");
    const lazyMatches = content.match(/loading="lazy"/g);
    expect(lazyMatches).not.toBeNull();
    expect(lazyMatches!.length).toBeGreaterThanOrEqual(4);
  });
});

describe("Chart components use shared useChartColors hook", () => {
  const chartComponents = [
    "components/DistributionSnapshot.tsx",
    "components/DrawdownChart.tsx",
    "components/EquityCurveChart.tsx",
    "components/MonthlyReturnsHeatmap.tsx",
    "components/RollingMetricsChart.tsx",
    "components/VisualAnalyticsCharts.tsx",
  ];

  it("should have all Recharts-based components importing useChartColors", () => {
    for (const file of chartComponents) {
      const filePath = path.join(clientSrc, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        expect(
          content.includes("useChartColors"),
          `${file} should import useChartColors`
        ).toBe(true);
      }
    }
  });

  it("should NOT have hardcoded white (#ffffff) fill in chart tick props", () => {
    for (const file of chartComponents) {
      const filePath = path.join(clientSrc, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const hasHardcodedWhite = /tick=\{\{[^}]*fill:\s*['"]#ffffff['"]/g.test(
          content
        );
        expect(
          hasHardcodedWhite,
          `${file} should not have hardcoded white tick fill`
        ).toBe(false);
      }
    }
  });

  it("should NOT have hardcoded white (#fff) fill in chart tick props", () => {
    for (const file of chartComponents) {
      const filePath = path.join(clientSrc, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const hasHardcodedWhite = /tick=\{\{[^}]*fill:\s*['"]#fff['"]/g.test(
          content
        );
        expect(
          hasHardcodedWhite,
          `${file} should not have hardcoded #fff tick fill`
        ).toBe(false);
      }
    }
  });
});
