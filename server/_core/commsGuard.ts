/**
 * Outbound-communications guard.
 *
 * The canonical decision point for "should this request cause an email,
 * SSE push, or other subscriber-visible notification to fire?"
 *
 * Exists because Manus's staging environment has historically shared
 * resources with production — a previous test-environment session
 * suppressed real exit alerts on prod AND then double-fired fake
 * alerts during the fix. This module is the single chokepoint we can
 * use to prevent that class of incident from recurring.
 *
 * Three independent layers:
 *
 *   1. Global kill-switch — OUTBOUND_COMMS_ENABLED=false disables ALL
 *      outbound notifications (email, SSE, Resend, Meta, GA4 server-side).
 *      One env-var flip before any test work. Safe default: enabled.
 *
 *   2. Test-strategy prefix — any strategy symbol starting with TEST-,
 *      STAGING-, DEV-, or SANDBOX- is treated as non-subscriber-facing:
 *      webhook logs are recorded but no emails / SSE / customer-visible
 *      state change happens. Lets us test webhook pipelines against real
 *      data without touching subscribers.
 *
 *   3. Signal dedupe — an in-memory fingerprint cache prevents the same
 *      signal (same strategy + direction + price + minute-bucket) from
 *      firing notifications twice within a 60-second window. Defeats the
 *      "replay queue fires a signal we already acted on" failure mode.
 *
 * All three check functions are pure. Call from every notification
 * dispatch path: email send, SSE broadcast, server-side ad conversion,
 * push notification.
 */

const TEST_PREFIXES = ["TEST-", "STAGING-", "DEV-", "SANDBOX-"];

const DEDUPE_WINDOW_MS = 60_000;

// In-memory fingerprint cache. Sized-bounded — sweep on each add.
// Non-persistent across restarts by design; restart = fresh window,
// which is the correct behavior for a dedupe intended to catch bursts.
const seenFingerprints = new Map<string, number>();

function sweepExpired(now: number) {
  if (seenFingerprints.size < 512) return; // cheap path
  const cutoff = now - DEDUPE_WINDOW_MS;
  for (const [k, ts] of seenFingerprints) {
    if (ts < cutoff) seenFingerprints.delete(k);
  }
}

/**
 * Returns true if outbound comms are globally enabled.
 * Defaults to TRUE unless explicitly set to "false" / "0" / "no".
 */
export function outboundCommsEnabled(): boolean {
  const v = (process.env.OUTBOUND_COMMS_ENABLED ?? "").trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return true;
}

/**
 * Returns true if the given strategy symbol looks like a test/staging
 * entity that should NOT generate subscriber-visible notifications.
 */
export function isTestStrategy(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const upper = symbol.trim().toUpperCase();
  return TEST_PREFIXES.some(p => upper.startsWith(p));
}

export interface DedupeKey {
  strategySymbol: string;
  direction: string; // "long" | "short" | "Long" | "Short" — normalized
  signalType: string; // "entry" | "exit" | etc
  price: number | string;
  timestamp?: Date | string;
}

/**
 * Returns TRUE if this is a new-to-us signal (fire the notification).
 * Returns FALSE if we've seen an identical fingerprint in the last 60s
 * (suppress the notification — it's a duplicate).
 *
 * Timestamp is bucketed to the minute so retries within a minute window
 * always collide on the same fingerprint.
 */
export function claimSignalFingerprint(key: DedupeKey): boolean {
  const ts = key.timestamp
    ? new Date(key.timestamp).getTime()
    : Date.now();
  // Bucket to 60s so retries within the window map to the same key
  const minuteBucket = Math.floor(ts / 60_000);
  const fp = [
    key.strategySymbol.toUpperCase(),
    key.direction.toLowerCase(),
    key.signalType.toLowerCase(),
    String(key.price),
    minuteBucket,
  ].join("|");

  const now = Date.now();
  sweepExpired(now);

  const prior = seenFingerprints.get(fp);
  if (prior && now - prior < DEDUPE_WINDOW_MS) return false;
  seenFingerprints.set(fp, now);
  return true;
}

/**
 * Composite decision: should we dispatch subscriber notifications for
 * this signal? Combines all three layers. Returns a structured reason
 * for logging so failed-to-fire can be investigated.
 */
export interface CommsDecisionInput {
  strategySymbol: string;
  direction: string;
  signalType: string;
  price: number | string;
  timestamp?: Date | string;
  isTest?: boolean;
}

export interface CommsDecision {
  allowed: boolean;
  reason?:
    | "global_killswitch_off"
    | "strategy_is_test"
    | "payload_is_test"
    | "duplicate_fingerprint";
}

export function decideSubscriberNotify(
  input: CommsDecisionInput
): CommsDecision {
  if (!outboundCommsEnabled()) {
    return { allowed: false, reason: "global_killswitch_off" };
  }
  if (input.isTest) {
    return { allowed: false, reason: "payload_is_test" };
  }
  if (isTestStrategy(input.strategySymbol)) {
    return { allowed: false, reason: "strategy_is_test" };
  }
  const fresh = claimSignalFingerprint({
    strategySymbol: input.strategySymbol,
    direction: input.direction,
    signalType: input.signalType,
    price: input.price,
    timestamp: input.timestamp,
  });
  if (!fresh) return { allowed: false, reason: "duplicate_fingerprint" };
  return { allowed: true };
}

/** Public test-reset hook for unit tests. No-op in production paths. */
export function _resetCommsGuardForTests() {
  seenFingerprints.clear();
}
