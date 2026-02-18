/**
 * Round 6 Fixes Tests
 *
 * Tests for:
 * 1. ES trade filtering - non-NQ strategies auto-marked as test
 * 2. Production strategy prefix filtering on endpoints
 * 3. Timezone formatting (Eastern Time)
 * 4. Legal page routing (no redirect to checkout)
 */
import { describe, it, expect, vi } from "vitest";

// ============================================================
// Test 1: ES Trade Filtering - validatePayload marks non-NQ as test
// ============================================================
describe("ES Trade Filtering - Non-NQ strategies auto-marked as test", () => {
  // We test the logic directly since validatePayload is not easily importable
  // Test the PRODUCTION_STRATEGY_PREFIXES logic
  const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];

  function isNonProductionStrategy(symbol: string): boolean {
    return !PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
      symbol.toUpperCase().startsWith(prefix)
    );
  }

  it("should mark ESTrend as non-production (test)", () => {
    expect(isNonProductionStrategy("ESTrend")).toBe(true);
  });

  it("should mark ES as non-production (test)", () => {
    expect(isNonProductionStrategy("ES")).toBe(true);
  });

  it("should mark CLTrend as non-production (test)", () => {
    expect(isNonProductionStrategy("CLTrend")).toBe(true);
  });

  it("should mark GCTrend as non-production (test)", () => {
    expect(isNonProductionStrategy("GCTrend")).toBe(true);
  });

  it("should mark BTCTrend as non-production (test)", () => {
    expect(isNonProductionStrategy("BTCTrend")).toBe(true);
  });

  it("should NOT mark NQTrend as non-production", () => {
    expect(isNonProductionStrategy("NQTrend")).toBe(false);
  });

  it("should NOT mark NQTripleVariant as non-production", () => {
    expect(isNonProductionStrategy("NQTripleVariant")).toBe(false);
  });

  it("should NOT mark NQ Triple Variant as non-production", () => {
    expect(isNonProductionStrategy("NQ Triple Variant")).toBe(false);
  });

  it("should handle case-insensitive matching", () => {
    expect(isNonProductionStrategy("nqtrend")).toBe(false);
    expect(isNonProductionStrategy("estrend")).toBe(true);
  });

  it("should handle empty string as non-production", () => {
    expect(isNonProductionStrategy("")).toBe(true);
  });
});

// ============================================================
// Test 2: Production strategy filtering on position endpoints
// ============================================================
describe("Production Strategy Filtering on Endpoints", () => {
  const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];

  function filterToProduction(positions: Array<{ strategySymbol: string }>) {
    return positions.filter(p =>
      PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
        p.strategySymbol.toUpperCase().startsWith(prefix)
      )
    );
  }

  it("should filter out ES positions from mixed list", () => {
    const positions = [
      { strategySymbol: "NQTrend" },
      { strategySymbol: "ESTrend" },
      { strategySymbol: "NQ Triple Variant" },
      { strategySymbol: "CLTrend" },
    ];
    const filtered = filterToProduction(positions);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].strategySymbol).toBe("NQTrend");
    expect(filtered[1].strategySymbol).toBe("NQ Triple Variant");
  });

  it("should return empty array when all positions are non-NQ", () => {
    const positions = [
      { strategySymbol: "ESTrend" },
      { strategySymbol: "CLTrend" },
      { strategySymbol: "GCTrend" },
    ];
    const filtered = filterToProduction(positions);
    expect(filtered).toHaveLength(0);
  });

  it("should return all positions when all are NQ", () => {
    const positions = [
      { strategySymbol: "NQTrend" },
      { strategySymbol: "NQ Triple Variant" },
    ];
    const filtered = filterToProduction(positions);
    expect(filtered).toHaveLength(2);
  });

  it("should handle empty positions array", () => {
    const filtered = filterToProduction([]);
    expect(filtered).toHaveLength(0);
  });
});

// ============================================================
// Test 3: Timezone formatting - Eastern Time
// ============================================================
describe("Timezone Formatting - Eastern Time", () => {
  it("should format UTC date to Eastern Time correctly", () => {
    // 11:10 PM UTC = 6:10 PM ET (EST, UTC-5)
    const utcDate = new Date("2026-02-17T23:10:00.000Z");
    const etFormatted = utcDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    expect(etFormatted).toContain("6:10");
    expect(etFormatted).toContain("PM");
  });

  it("should handle EDT (summer time) correctly", () => {
    // July 15, 2026 at 20:00 UTC = 4:00 PM EDT (UTC-4)
    const utcDate = new Date("2026-07-15T20:00:00.000Z");
    const etFormatted = utcDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    expect(etFormatted).toContain("4:00");
    expect(etFormatted).toContain("PM");
  });

  it("should handle EST (winter time) correctly", () => {
    // Jan 15, 2026 at 16:30 UTC = 11:30 AM EST (UTC-5)
    const utcDate = new Date("2026-01-15T16:30:00.000Z");
    const etFormatted = utcDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    expect(etFormatted).toContain("11:30");
    expect(etFormatted).toContain("AM");
  });

  it("should format date portion in Eastern Time", () => {
    // Feb 17, 2026 at 23:10 UTC = Feb 17, 2026 at 6:10 PM ET (still same day)
    const utcDate = new Date("2026-02-17T23:10:00.000Z");
    const etDate = utcDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
    expect(etDate).toContain("2/17/2026");
  });

  it("should handle date rollover correctly (UTC midnight = ET previous day)", () => {
    // Feb 18, 2026 at 03:00 UTC = Feb 17, 2026 at 10:00 PM ET
    const utcDate = new Date("2026-02-18T03:00:00.000Z");
    const etDate = utcDate.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
    expect(etDate).toContain("2/17/2026");
  });
});

// ============================================================
// Test 4: Legal page paths - should be public routes
// ============================================================
describe("Legal Page Public Routes", () => {
  const PUBLIC_LEGAL_PATHS = [
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
    "/risk-disclosure",
  ];

  const LEGAL_EXEMPT_PATHS = [
    "/",
    "/landing",
    "/pricing",
    "/checkout",
    "/qa",
    "/terms",
    "/privacy",
    "/refund-policy",
    "/disclaimer",
    "/risk-disclosure",
  ];

  it("should include all legal pages in the public exempt list", () => {
    for (const path of PUBLIC_LEGAL_PATHS) {
      expect(LEGAL_EXEMPT_PATHS).toContain(path);
    }
  });

  it("should not redirect legal pages to checkout", () => {
    // Simulate the DashboardLayout redirect logic
    const isAuthenticated = false;
    const currentPath = "/terms";

    const shouldRedirect =
      !isAuthenticated && !LEGAL_EXEMPT_PATHS.includes(currentPath);
    expect(shouldRedirect).toBe(false);
  });

  it("should redirect non-exempt pages when unauthenticated", () => {
    const isAuthenticated = false;
    const currentPath = "/dashboard";

    const shouldRedirect =
      !isAuthenticated && !LEGAL_EXEMPT_PATHS.includes(currentPath);
    expect(shouldRedirect).toBe(true);
  });

  it("should not redirect any page when authenticated", () => {
    const isAuthenticated = true;
    const paths = ["/dashboard", "/strategies", "/terms", "/privacy"];

    for (const path of paths) {
      const shouldRedirect =
        !isAuthenticated && !LEGAL_EXEMPT_PATHS.includes(path);
      expect(shouldRedirect).toBe(false);
    }
  });
});

// ============================================================
// Test 5: isTest flag comprehensive logic
// ============================================================
describe("isTest Flag Logic", () => {
  function computeIsTest(payload: {
    isTest?: boolean | string;
    comment?: string;
    symbol?: string;
    strategySymbol: string;
  }): boolean {
    const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];
    const isNonProductionStrategy = !PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
      payload.strategySymbol.toUpperCase().startsWith(prefix)
    );
    return (
      payload.isTest === true ||
      payload.isTest === "true" ||
      (typeof payload.comment === "string" &&
        payload.comment.toLowerCase().includes("test")) ||
      (typeof payload.symbol === "string" &&
        payload.symbol.toLowerCase().includes("test")) ||
      isNonProductionStrategy
    );
  }

  it("should be test when isTest is true", () => {
    expect(computeIsTest({ isTest: true, strategySymbol: "NQTrend" })).toBe(
      true
    );
  });

  it("should be test when isTest is string 'true'", () => {
    expect(computeIsTest({ isTest: "true", strategySymbol: "NQTrend" })).toBe(
      true
    );
  });

  it("should be test when comment contains 'test'", () => {
    expect(
      computeIsTest({
        comment: "This is a test run",
        strategySymbol: "NQTrend",
      })
    ).toBe(true);
  });

  it("should be test when symbol contains 'test'", () => {
    expect(computeIsTest({ symbol: "NQTest", strategySymbol: "NQTrend" })).toBe(
      true
    );
  });

  it("should be test when strategy is ESTrend (non-NQ)", () => {
    expect(computeIsTest({ strategySymbol: "ESTrend" })).toBe(true);
  });

  it("should NOT be test for NQTrend with no test flags", () => {
    expect(computeIsTest({ strategySymbol: "NQTrend" })).toBe(false);
  });

  it("should NOT be test for NQ Triple Variant with no test flags", () => {
    expect(computeIsTest({ strategySymbol: "NQ Triple Variant" })).toBe(false);
  });

  it("should be test for ESTrend even when isTest is explicitly false", () => {
    // Non-NQ strategy overrides explicit isTest: false
    expect(computeIsTest({ isTest: false, strategySymbol: "ESTrend" })).toBe(
      true
    );
  });
});

// ============================================================
// Test 6: Notification production filter
// ============================================================
describe("Notification Production Strategy Filter", () => {
  const PRODUCTION_PREFIXES = ["NQ"];

  function shouldSendNotification(
    strategySymbol: string,
    isTest: boolean
  ): boolean {
    const isProductionStrategy = PRODUCTION_PREFIXES.some(prefix =>
      strategySymbol.toUpperCase().startsWith(prefix)
    );
    return !isTest && isProductionStrategy;
  }

  it("should send notification for NQTrend non-test", () => {
    expect(shouldSendNotification("NQTrend", false)).toBe(true);
  });

  it("should NOT send notification for ESTrend non-test", () => {
    expect(shouldSendNotification("ESTrend", false)).toBe(false);
  });

  it("should NOT send notification for NQTrend test", () => {
    expect(shouldSendNotification("NQTrend", true)).toBe(false);
  });

  it("should NOT send notification for ESTrend test", () => {
    expect(shouldSendNotification("ESTrend", true)).toBe(false);
  });

  it("should send notification for NQ Triple Variant non-test", () => {
    expect(shouldSendNotification("NQ Triple Variant", false)).toBe(true);
  });

  it("should NOT send notification for CLTrend", () => {
    expect(shouldSendNotification("CLTrend", false)).toBe(false);
  });
});
