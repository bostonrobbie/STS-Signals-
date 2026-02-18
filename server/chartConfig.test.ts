import { describe, it, expect } from "vitest";
import {
  BREAKPOINTS,
  CHART_HEIGHTS,
  CHART_MARGINS,
  MIN_DIMENSIONS,
  getChartHeight,
  validateChartDimensions,
  getTotalChartHeight,
  STRATEGY_COLORS,
} from "../client/src/lib/chartConfig";

describe("Chart Configuration", () => {
  describe("BREAKPOINTS", () => {
    it("should have standard Tailwind breakpoints", () => {
      expect(BREAKPOINTS.sm).toBe(640);
      expect(BREAKPOINTS.md).toBe(768);
      expect(BREAKPOINTS.lg).toBe(1024);
      expect(BREAKPOINTS.xl).toBe(1280);
    });

    it("should have breakpoints in ascending order", () => {
      expect(BREAKPOINTS.sm).toBeLessThan(BREAKPOINTS.md);
      expect(BREAKPOINTS.md).toBeLessThan(BREAKPOINTS.lg);
      expect(BREAKPOINTS.lg).toBeLessThan(BREAKPOINTS.xl);
    });
  });

  describe("CHART_HEIGHTS", () => {
    it("should have strategiesOverview heights that increase with breakpoint", () => {
      const heights = CHART_HEIGHTS.strategiesOverview;
      expect(heights.mobile).toBeLessThan(heights.sm);
      expect(heights.sm).toBeLessThan(heights.md);
      expect(heights.md).toBeLessThan(heights.lg);
    });

    it("should have all heights above minimum", () => {
      Object.values(CHART_HEIGHTS).forEach(config => {
        expect(config.mobile).toBeGreaterThanOrEqual(
          MIN_DIMENSIONS.chartHeight
        );
        expect(config.sm).toBeGreaterThanOrEqual(MIN_DIMENSIONS.chartHeight);
        expect(config.md).toBeGreaterThanOrEqual(MIN_DIMENSIONS.chartHeight);
        expect(config.lg).toBeGreaterThanOrEqual(MIN_DIMENSIONS.chartHeight);
      });
    });

    it("should have reasonable mobile heights (not too small for touch)", () => {
      // Mobile charts should be at least 200px for usability
      Object.values(CHART_HEIGHTS).forEach(config => {
        expect(config.mobile).toBeGreaterThanOrEqual(200);
      });
    });

    it("should have strategiesOverview mobile height of 280px", () => {
      // This is the specific fix for the reported issue
      expect(CHART_HEIGHTS.strategiesOverview.mobile).toBe(280);
    });
  });

  describe("CHART_MARGINS", () => {
    it("should have non-negative top and right margins", () => {
      Object.values(CHART_MARGINS).forEach(margin => {
        expect(margin.top).toBeGreaterThanOrEqual(0);
        expect(margin.right).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have bottom margin for axis labels and brush", () => {
      // Bottom margin should accommodate axis labels
      Object.values(CHART_MARGINS).forEach(margin => {
        expect(margin.bottom).toBeGreaterThanOrEqual(20);
      });
    });

    it("should have withBrush bottom margin accommodate brush height", () => {
      // Brush is 30px, so bottom margin should be at least that
      expect(CHART_MARGINS.withBrush.bottom).toBeGreaterThanOrEqual(30);
    });
  });

  describe("MIN_DIMENSIONS", () => {
    it("should have reasonable minimum chart height", () => {
      expect(MIN_DIMENSIONS.chartHeight).toBeGreaterThanOrEqual(150);
      expect(MIN_DIMENSIONS.chartHeight).toBeLessThanOrEqual(300);
    });

    it("should have reasonable minimum chart width", () => {
      // Should fit on smallest mobile screens (320px - padding)
      expect(MIN_DIMENSIONS.chartWidth).toBeLessThanOrEqual(300);
      expect(MIN_DIMENSIONS.chartWidth).toBeGreaterThanOrEqual(200);
    });

    it("should have brush height matching Recharts default", () => {
      expect(MIN_DIMENSIONS.brushHeight).toBe(30);
    });
  });

  describe("getChartHeight", () => {
    it("should return mobile height for small viewports", () => {
      expect(getChartHeight("strategiesOverview", 320)).toBe(280);
      expect(getChartHeight("strategiesOverview", 639)).toBe(280);
    });

    it("should return sm height for sm breakpoint", () => {
      expect(getChartHeight("strategiesOverview", 640)).toBe(320);
      expect(getChartHeight("strategiesOverview", 767)).toBe(320);
    });

    it("should return md height for md breakpoint", () => {
      expect(getChartHeight("strategiesOverview", 768)).toBe(380);
      expect(getChartHeight("strategiesOverview", 1023)).toBe(380);
    });

    it("should return lg height for lg breakpoint and above", () => {
      expect(getChartHeight("strategiesOverview", 1024)).toBe(420);
      expect(getChartHeight("strategiesOverview", 1920)).toBe(420);
    });

    it("should work for all chart types", () => {
      const viewportWidth = 800;
      expect(getChartHeight("strategiesOverview", viewportWidth)).toBe(380);
      expect(getChartHeight("dashboardOverview", viewportWidth)).toBe(300);
      expect(getChartHeight("strategyDetail", viewportWidth)).toBe(350);
      expect(getChartHeight("fullscreen", viewportWidth)).toBe(600);
    });
  });

  describe("validateChartDimensions", () => {
    it("should pass for valid dimensions", () => {
      const result = validateChartDimensions(400, 300);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail for height below minimum", () => {
      const result = validateChartDimensions(400, 150);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("height");
    });

    it("should fail for width below minimum", () => {
      const result = validateChartDimensions(200, 300);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("width");
    });

    it("should fail for both dimensions below minimum", () => {
      const result = validateChartDimensions(200, 150);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should pass for exact minimum dimensions", () => {
      const result = validateChartDimensions(
        MIN_DIMENSIONS.chartWidth,
        MIN_DIMENSIONS.chartHeight
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("getTotalChartHeight", () => {
    it("should add legend height to chart height", () => {
      const chartHeight = 300;
      const legendItems = 8; // 8 strategies = 2 rows
      const total = getTotalChartHeight(chartHeight, legendItems);

      // Should be chart height + (2 rows * 24px) + 16px padding
      expect(total).toBe(300 + 2 * 24 + 16);
    });

    it("should handle single row of legend items", () => {
      const chartHeight = 300;
      const legendItems = 3; // 3 items = 1 row
      const total = getTotalChartHeight(chartHeight, legendItems);

      expect(total).toBe(300 + 1 * 24 + 16);
    });

    it("should use provided row estimate when given", () => {
      const chartHeight = 300;
      const legendItems = 8;
      const customRows = 4;
      const total = getTotalChartHeight(chartHeight, legendItems, customRows);

      expect(total).toBe(300 + 4 * 24 + 16);
    });
  });

  describe("STRATEGY_COLORS", () => {
    it("should have at least 2 distinct colors for strategies", () => {
      // We have 2 active strategies, but colors array may have more for future use
      expect(STRATEGY_COLORS.length).toBeGreaterThanOrEqual(2);
      const uniqueColors = new Set(STRATEGY_COLORS);
      expect(uniqueColors.size).toBe(STRATEGY_COLORS.length);
    });

    it("should have valid hex color format", () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      STRATEGY_COLORS.forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it("should have sufficient contrast (not all similar colors)", () => {
      // Simple check: colors should have different first characters after #
      const firstChars = STRATEGY_COLORS.map(c => c[1]);
      const uniqueFirstChars = new Set(firstChars);
      expect(uniqueFirstChars.size).toBeGreaterThan(3);
    });
  });
});

describe("Chart Layout Regression Tests", () => {
  describe("Mobile Layout (< 640px)", () => {
    const mobileWidth = 375; // iPhone SE width

    it("should have adequate chart height on mobile", () => {
      const height = getChartHeight("strategiesOverview", mobileWidth);
      expect(height).toBeGreaterThanOrEqual(250);
    });

    it("should validate mobile dimensions pass minimum requirements", () => {
      const height = getChartHeight("strategiesOverview", mobileWidth);
      const result = validateChartDimensions(mobileWidth - 32, height); // 32px for padding
      expect(result.valid).toBe(true);
    });
  });

  describe("Tablet Layout (640px - 1024px)", () => {
    const tabletWidth = 768;

    it("should have larger chart height than mobile", () => {
      const mobileHeight = getChartHeight("strategiesOverview", 375);
      const tabletHeight = getChartHeight("strategiesOverview", tabletWidth);
      expect(tabletHeight).toBeGreaterThan(mobileHeight);
    });
  });

  describe("Desktop Layout (>= 1024px)", () => {
    const desktopWidth = 1440;

    it("should have largest chart height on desktop", () => {
      const tabletHeight = getChartHeight("strategiesOverview", 768);
      const desktopHeight = getChartHeight("strategiesOverview", desktopWidth);
      expect(desktopHeight).toBeGreaterThan(tabletHeight);
    });
  });

  describe("Legend Layout", () => {
    it("should have enough space for 8 strategy legend items", () => {
      const chartHeight = CHART_HEIGHTS.strategiesOverview.mobile;
      const totalHeight = getTotalChartHeight(chartHeight, 8);

      // Total should fit in reasonable mobile viewport height
      expect(totalHeight).toBeLessThan(500);
    });

    it("should not overlap chart area", () => {
      // Legend is rendered outside chart, so chart height should be
      // independent of legend item count
      const chartHeight = CHART_HEIGHTS.strategiesOverview.mobile;
      expect(chartHeight).toBe(280); // Fixed height, not affected by legend
    });
  });
});
