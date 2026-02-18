import { useState, useEffect } from "react";

/* eslint-disable no-undef */
/**
 * Hook that resolves CSS custom properties to actual color strings
 * for use in Recharts components (which need inline color values, not CSS vars).
 * Automatically updates when the theme changes (light/dark toggle).
 */
export function useChartColors() {
  const [colors, setColors] = useState({
    foreground: "#000",
    mutedForeground: "#666",
    border: "#ccc",
    background: "#fff",
  });

  useEffect(() => {
    function resolveColors() {
      const root = document.documentElement;
      const tempEl = document.createElement("div");
      tempEl.style.display = "none";
      root.appendChild(tempEl);

      tempEl.style.color = "var(--foreground)";
      const foreground = window.getComputedStyle(tempEl).color;

      tempEl.style.color = "var(--muted-foreground)";
      const mutedForeground = window.getComputedStyle(tempEl).color;

      tempEl.style.color = "var(--border)";
      const border = window.getComputedStyle(tempEl).color;

      tempEl.style.color = "var(--background)";
      const background = window.getComputedStyle(tempEl).color;

      root.removeChild(tempEl);

      setColors({
        foreground: foreground || "#000",
        mutedForeground: mutedForeground || "#666",
        border: border || "#ccc",
        background: background || "#fff",
      });
    }

    // Resolve on mount
    resolveColors();

    // Re-resolve when theme changes (class attribute on <html> toggles "dark")
    const observer = new MutationObserver(resolveColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
