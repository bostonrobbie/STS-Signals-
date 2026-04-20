/**
 * Unit tests for commsGuard — the central outbound-comms decision
 * point. These protect against regressions in any of the three safety
 * layers (kill switch, test-prefix detection, dedupe).
 *
 * All tests exercise the synchronous / pure code paths. The DB-backed
 * dedupe falls back to in-memory when the DB isn't reachable (which it
 * isn't in vitest), so `decideSubscriberNotify` is testable end-to-end
 * here even though it's async.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  claimSignalFingerprint,
  decideSubscriberNotify,
  isTestStrategy,
  outboundCommsEnabled,
  _resetCommsGuardForTests,
} from "./commsGuard";

const originalEnv = process.env.OUTBOUND_COMMS_ENABLED;

describe("commsGuard", () => {
  beforeEach(() => {
    _resetCommsGuardForTests();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OUTBOUND_COMMS_ENABLED;
    } else {
      process.env.OUTBOUND_COMMS_ENABLED = originalEnv;
    }
  });

  // ── Kill switch ─────────────────────────────────────────────────────
  describe("outboundCommsEnabled()", () => {
    it("defaults to true when env var is unset", () => {
      delete process.env.OUTBOUND_COMMS_ENABLED;
      expect(outboundCommsEnabled()).toBe(true);
    });

    it("returns true for empty string", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "";
      expect(outboundCommsEnabled()).toBe(true);
    });

    it("returns true for 'true'", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      expect(outboundCommsEnabled()).toBe(true);
    });

    it("returns false for 'false'", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "false";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("returns false for '0'", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "0";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("returns false for 'no'", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "no";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("returns false for 'off'", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "off";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("is case-insensitive", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "FALSE";
      expect(outboundCommsEnabled()).toBe(false);
      process.env.OUTBOUND_COMMS_ENABLED = "False";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("ignores whitespace", () => {
      process.env.OUTBOUND_COMMS_ENABLED = "  false  ";
      expect(outboundCommsEnabled()).toBe(false);
    });

    it("treats unrecognized strings as enabled (fail-open on env typos)", () => {
      // An env typo like "disabled" should NOT suppress notifications —
      // silently dropping subscriber alerts because of a typo would be
      // the worst-case bug.
      process.env.OUTBOUND_COMMS_ENABLED = "disabled";
      expect(outboundCommsEnabled()).toBe(true);
    });
  });

  // ── Test-prefix detection ──────────────────────────────────────────
  describe("isTestStrategy()", () => {
    it.each(["TEST-FOO", "STAGING-BAR", "DEV-BAZ", "SANDBOX-QUX"])(
      "flags %s as test",
      symbol => {
        expect(isTestStrategy(symbol)).toBe(true);
      }
    );

    it("is case-insensitive", () => {
      expect(isTestStrategy("test-foo")).toBe(true);
      expect(isTestStrategy("Test-Foo")).toBe(true);
    });

    it("trims whitespace", () => {
      expect(isTestStrategy("  TEST-FOO  ")).toBe(true);
    });

    it("does NOT flag legitimate production symbols", () => {
      expect(isTestStrategy("NQ_TREND_T3")).toBe(false);
      expect(isTestStrategy("NQ_DRIFT_D1")).toBe(false);
      expect(isTestStrategy("ES_REVERSAL_R5")).toBe(false);
    });

    it("returns false for null / undefined / empty", () => {
      expect(isTestStrategy(null)).toBe(false);
      expect(isTestStrategy(undefined)).toBe(false);
      expect(isTestStrategy("")).toBe(false);
    });

    it("does NOT flag strings that just contain TEST somewhere", () => {
      // Only prefixes count. A symbol like "NQ_TEST_PREP" is production.
      expect(isTestStrategy("NQ_TEST_PREP")).toBe(false);
      expect(isTestStrategy("STRATEGYTEST")).toBe(false);
    });
  });

  // ── In-memory dedupe ───────────────────────────────────────────────
  describe("claimSignalFingerprint()", () => {
    const baseKey = {
      strategySymbol: "NQ_TREND_T3",
      direction: "long",
      signalType: "entry",
      price: 18500,
      timestamp: new Date("2026-04-20T14:30:00Z"),
    };

    it("returns true the first time (fresh signal fires)", () => {
      expect(claimSignalFingerprint(baseKey)).toBe(true);
    });

    it("returns false on immediate re-call (dedupe fires)", () => {
      claimSignalFingerprint(baseKey);
      expect(claimSignalFingerprint(baseKey)).toBe(false);
    });

    it("treats different strategies as distinct", () => {
      claimSignalFingerprint(baseKey);
      expect(
        claimSignalFingerprint({
          ...baseKey,
          strategySymbol: "NQ_DRIFT_D1",
        })
      ).toBe(true);
    });

    it("treats different directions as distinct", () => {
      claimSignalFingerprint(baseKey);
      expect(
        claimSignalFingerprint({ ...baseKey, direction: "short" })
      ).toBe(true);
    });

    it("treats different signal types as distinct", () => {
      claimSignalFingerprint(baseKey);
      expect(
        claimSignalFingerprint({ ...baseKey, signalType: "exit" })
      ).toBe(true);
    });

    it("treats different prices as distinct", () => {
      claimSignalFingerprint(baseKey);
      expect(
        claimSignalFingerprint({ ...baseKey, price: 18501 })
      ).toBe(true);
    });

    it("buckets timestamps within the same minute as duplicates", () => {
      claimSignalFingerprint(baseKey);
      // Same minute (14:30:45 is still in the 14:30 bucket)
      expect(
        claimSignalFingerprint({
          ...baseKey,
          timestamp: new Date("2026-04-20T14:30:45Z"),
        })
      ).toBe(false);
    });

    it("treats same signal in different minute-buckets as distinct", () => {
      claimSignalFingerprint(baseKey);
      // 14:31 is a different minute bucket
      expect(
        claimSignalFingerprint({
          ...baseKey,
          timestamp: new Date("2026-04-20T14:31:00Z"),
        })
      ).toBe(true);
    });

    it("accepts numeric and string prices (same value)", () => {
      claimSignalFingerprint({ ...baseKey, price: 18500 });
      expect(
        claimSignalFingerprint({ ...baseKey, price: "18500" })
      ).toBe(false);
    });

    it("normalizes case in strategy symbol", () => {
      claimSignalFingerprint({
        ...baseKey,
        strategySymbol: "NQ_TREND_T3",
      });
      expect(
        claimSignalFingerprint({
          ...baseKey,
          strategySymbol: "nq_trend_t3",
        })
      ).toBe(false);
    });
  });

  // ── End-to-end decision ────────────────────────────────────────────
  describe("decideSubscriberNotify()", () => {
    const input = {
      strategySymbol: "NQ_TREND_T3",
      direction: "long",
      signalType: "entry",
      price: 18500,
      timestamp: new Date("2026-04-20T14:30:00Z"),
    };

    it("allows a normal signal", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      const decision = await decideSubscriberNotify(input);
      expect(decision.allowed).toBe(true);
      expect(decision.reason).toBeUndefined();
    });

    it("blocks when kill switch is off", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "false";
      const decision = await decideSubscriberNotify(input);
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("global_killswitch_off");
    });

    it("blocks test-prefix strategy", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      const decision = await decideSubscriberNotify({
        ...input,
        strategySymbol: "TEST-FOO",
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("strategy_is_test");
    });

    it("blocks payload flagged isTest", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      const decision = await decideSubscriberNotify({
        ...input,
        isTest: true,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe("payload_is_test");
    });

    it("blocks duplicate signal within window", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      const first = await decideSubscriberNotify(input);
      expect(first.allowed).toBe(true);
      const second = await decideSubscriberNotify(input);
      expect(second.allowed).toBe(false);
      expect(second.reason).toBe("duplicate_fingerprint");
    });

    it("kill switch wins over test-prefix wins over dedupe", async () => {
      // Order-of-precedence check: if multiple reasons apply, the
      // earliest-checked reason wins. Kill switch is cheapest so
      // first.
      process.env.OUTBOUND_COMMS_ENABLED = "false";
      const decision = await decideSubscriberNotify({
        ...input,
        strategySymbol: "TEST-FOO",
        isTest: true,
      });
      expect(decision.reason).toBe("global_killswitch_off");
    });

    it("payload_is_test wins over strategy_is_test", async () => {
      process.env.OUTBOUND_COMMS_ENABLED = "true";
      const decision = await decideSubscriberNotify({
        ...input,
        strategySymbol: "TEST-FOO",
        isTest: true,
      });
      expect(decision.reason).toBe("payload_is_test");
    });
  });
});
