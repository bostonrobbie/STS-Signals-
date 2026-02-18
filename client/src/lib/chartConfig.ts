/**
 * Chart Layout Configuration
 *
 * Centralized configuration for chart dimensions and responsive breakpoints.
 * This ensures consistent chart layouts across the application and makes
 * it easier to test and maintain chart sizing.
 */

// Responsive breakpoints (matching Tailwind defaults)
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

// Chart height configurations for different contexts
export const CHART_HEIGHTS = {
  // Strategies page - All Strategies Performance chart
  strategiesOverview: {
    mobile: 280, // < 640px
    sm: 320, // >= 640px
    md: 380, // >= 768px
    lg: 420, // >= 1024px
  },
  // Dashboard overview chart
  dashboardOverview: {
    mobile: 200,
    sm: 250,
    md: 300,
    lg: 350,
  },
  // Strategy detail page chart
  strategyDetail: {
    mobile: 250,
    sm: 300,
    md: 350,
    lg: 400,
  },
  // Comparison chart (fullscreen modal)
  fullscreen: {
    mobile: 400,
    sm: 500,
    md: 600,
    lg: 700,
  },
} as const;

// Chart margin configurations
export const CHART_MARGINS = {
  // Default margins for most charts
  default: {
    top: 5,
    right: 10,
    left: -5,
    bottom: 35,
  },
  // Margins for charts with brush/zoom
  withBrush: {
    top: 5,
    right: 10,
    left: -5,
    bottom: 35,
  },
  // Margins for compact charts (cards, small widgets)
  compact: {
    top: 5,
    right: 5,
    left: -10,
    bottom: 20,
  },
  // Margins for fullscreen charts
  fullscreen: {
    top: 10,
    right: 20,
    left: 10,
    bottom: 40,
  },
} as const;

// Legend configuration
export const LEGEND_CONFIG = {
  // Position legend outside chart for better mobile layout
  position: "outside" as const,
  // Gap between legend items
  gap: {
    mobile: { x: 8, y: 4 }, // gap-x-2 gap-y-1
    desktop: { x: 16, y: 8 }, // gap-x-4 gap-y-2
  },
  // Font sizes
  fontSize: {
    mobile: 10, // text-[10px]
    desktop: 12, // text-xs
  },
} as const;

// Minimum dimensions to prevent layout issues
export const MIN_DIMENSIONS = {
  chartHeight: 200,
  chartWidth: 280,
  legendItemHeight: 24,
  brushHeight: 30,
} as const;

/**
 * Get the appropriate chart height based on viewport width
 */
export function getChartHeight(
  config: keyof typeof CHART_HEIGHTS,
  viewportWidth: number
): number {
  const heights = CHART_HEIGHTS[config];

  if (viewportWidth >= BREAKPOINTS.lg) return heights.lg;
  if (viewportWidth >= BREAKPOINTS.md) return heights.md;
  if (viewportWidth >= BREAKPOINTS.sm) return heights.sm;
  return heights.mobile;
}

/**
 * Validate chart dimensions meet minimum requirements
 */
export function validateChartDimensions(
  width: number,
  height: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (height < MIN_DIMENSIONS.chartHeight) {
    errors.push(
      `Chart height (${height}px) is below minimum (${MIN_DIMENSIONS.chartHeight}px)`
    );
  }

  if (width < MIN_DIMENSIONS.chartWidth) {
    errors.push(
      `Chart width (${width}px) is below minimum (${MIN_DIMENSIONS.chartWidth}px)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate total chart container height including legend
 */
export function getTotalChartHeight(
  chartHeight: number,
  legendItemCount: number,
  legendRowsEstimate?: number
): number {
  // Estimate legend rows based on item count if not provided
  const rows = legendRowsEstimate ?? Math.ceil(legendItemCount / 4);
  const legendHeight = rows * MIN_DIMENSIONS.legendItemHeight + 16; // 16px padding

  return chartHeight + legendHeight;
}

// Strategy colors (exported for consistency)
export const STRATEGY_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
] as const;
