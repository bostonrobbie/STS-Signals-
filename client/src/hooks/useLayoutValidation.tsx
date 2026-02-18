import { useEffect, useRef, useCallback } from "react";
import { validateChartDimensions, MIN_DIMENSIONS } from "@/lib/chartConfig";

interface LayoutValidationOptions {
  /** Component name for error reporting */
  componentName: string;
  /** Minimum expected width */
  minWidth?: number;
  /** Minimum expected height */
  minHeight?: number;
  /** Whether to log warnings in development */
  logWarnings?: boolean;
  /** Callback when layout issues are detected */
  onLayoutIssue?: (issues: string[]) => void;
}

interface LayoutMetrics {
  width: number;
  height: number;
  isValid: boolean;
  issues: string[];
}

/**
 * Hook to validate layout dimensions at runtime
 * Helps catch layout issues during development and can report them in production
 */
export function useLayoutValidation(
  ref: React.RefObject<HTMLElement>,
  options: LayoutValidationOptions
): LayoutMetrics {
  const {
    componentName,
    minWidth = MIN_DIMENSIONS.chartWidth,
    minHeight = MIN_DIMENSIONS.chartHeight,
    logWarnings = process.env.NODE_ENV === "development",
    onLayoutIssue,
  } = options;

  const lastMetrics = useRef<LayoutMetrics>({
    width: 0,
    height: 0,
    isValid: true,
    issues: [],
  });

  const validateLayout = useCallback(() => {
    if (!ref.current) return lastMetrics.current;

    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const validation = validateChartDimensions(width, height);
    const issues: string[] = [];

    if (width < minWidth) {
      issues.push(
        `${componentName}: Width (${Math.round(width)}px) below minimum (${minWidth}px)`
      );
    }
    if (height < minHeight) {
      issues.push(
        `${componentName}: Height (${Math.round(height)}px) below minimum (${minHeight}px)`
      );
    }

    const isValid = issues.length === 0 && validation.valid;

    if (!isValid && logWarnings) {
      console.warn(`[Layout Validation] ${componentName}:`, {
        width: Math.round(width),
        height: Math.round(height),
        issues: [...issues, ...validation.errors],
      });
    }

    if (!isValid && onLayoutIssue) {
      onLayoutIssue([...issues, ...validation.errors]);
    }

    lastMetrics.current = {
      width,
      height,
      isValid,
      issues: [...issues, ...validation.errors],
    };

    return lastMetrics.current;
  }, [ref, componentName, minWidth, minHeight, logWarnings, onLayoutIssue]);

  useEffect(() => {
    // Initial validation after mount
    const timeoutId = setTimeout(validateLayout, 100);

    // Validate on window resize as a fallback
    const handleResize = () => validateLayout();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [validateLayout]);

  return lastMetrics.current;
}

/**
 * Hook to track viewport size for responsive debugging
 */
export function useViewportSize() {
  const getSize = () => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    breakpoint: getBreakpoint(
      typeof window !== "undefined" ? window.innerWidth : 0
    ),
  });

  const sizeRef = useRef(getSize());

  useEffect(() => {
    const handleResize = () => {
      sizeRef.current = getSize();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return sizeRef.current;
}

function getBreakpoint(width: number): string {
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  if (width >= 640) return "sm";
  return "mobile";
}

/**
 * Development-only component to display layout metrics overlay
 */
export function LayoutDebugOverlay({
  metrics,
  show = process.env.NODE_ENV === "development",
}: {
  metrics: LayoutMetrics;
  show?: boolean;
}) {
  if (!show) return null;

  const dimensionText = `${Math.round(metrics.width)}x${Math.round(metrics.height)}`;
  const warningText = !metrics.isValid ? " !!" : "";

  return (
    <div
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        padding: "4px 8px",
        fontSize: 10,
        fontFamily: "monospace",
        backgroundColor: metrics.isValid
          ? "rgba(0,128,0,0.8)"
          : "rgba(255,0,0,0.8)",
        color: "white",
        borderRadius: 4,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {dimensionText}
      {warningText}
    </div>
  );
}
