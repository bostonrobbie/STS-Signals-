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
 *   3. Signal dedupe — fingerprint cache prevents the same signal (same
 *      strategy + direction + price + minute-bucket) from firing
 *      notifications twice within a 60-second window. Defeats the
 *      "replay queue fires a signal we already acted on" failure mode.
 *
 *      Dedupe is two-tier:
 *        - DB-backed (signal_fingerprints table) — survives server
 *          restarts, works across replicas. Primary path.
 *        - In-memory Map — fallback for when DB is unreachable or
 *          the table hasn't been migrated yet. Resets on restart.
 *
 * All decisions log a structured reason so failed-to-fire can be
 * investigated. Call `decideSubscriberNotify` from every notification
 * dispatch path: email send, SSE broadcast, server-side ad conversion,
 * push notification.
 */

import os from "os";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const TEST_PREFIXES = ["TEST-", "STAGING-", "DEV-", "SANDBOX-"];

const DEDUPE_WINDOW_MS = 60_000;

// In-memory fingerprint cache. Sized-bounded — sweep on each add.
// Non-persistent across restarts; used as fallback when the DB is not
// reachable or when the signal_fingerprints table hasn't been migrated.
const seenFingerprints = new Map<string, number>();

// Track whether DB-backed dedupe is known-good. If an insert errors
// because the table doesn't exist, we flip this off for a cooldown
// period so we don't hammer the DB with the same failing query on
// every signal. Re-probes after the cooldown.
let dbDedupeAvailable: boolean | null = null; // null = not yet probed
let dbDedupeDisabledUntil = 0;
const DB_DEDUPE_COOLDOWN_MS = 5 * 60_000; // 5 minutes

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

function buildFingerprint(key: DedupeKey): {
  fp: string;
  minuteBucket: number;
  priceCents: number;
} {
  const ts = key.timestamp
    ? new Date(key.timestamp).getTime()
    : Date.now();
  // Bucket to 60s so retries within the window map to the same key
  const minuteBucket = Math.floor(ts / 60_000);
  const priceRaw =
    typeof key.price === "number" ? key.price : parseFloat(String(key.price));
  // Round to the nearest integer cent — matches how prices are stored
  // everywhere else in the system. Fingerprint stability depends on
  // identical representation across call sites.
  const priceCents = Number.isFinite(priceRaw) ? Math.round(priceRaw) : 0;
  const fp = [
    key.strategySymbol.toUpperCase(),
    key.direction.toLowerCase(),
    key.signalType.toLowerCase(),
    String(priceCents),
    minuteBucket,
  ].join("|");
  return { fp, minuteBucket, priceCents };
}

/**
 * In-memory fingerprint claim. Synchronous, always safe to call.
 *
 * Returns TRUE if this is a new-to-us signal (fire the notification).
 * Returns FALSE if we've seen an identical fingerprint in the last 60s
 * (suppress the notification — it's a duplicate).
 *
 * Kept as a public export for tests and for fallback paths that can't
 * await (e.g. synchronous SSE broadcast guards).
 */
export function claimSignalFingerprint(key: DedupeKey): boolean {
  const { fp } = buildFingerprint(key);
  const now = Date.now();
  sweepExpired(now);
  const prior = seenFingerprints.get(fp);
  if (prior && now - prior < DEDUPE_WINDOW_MS) return false;
  seenFingerprints.set(fp, now);
  return true;
}

/**
 * DB-backed fingerprint claim. Preferred over the sync version because
 * it survives server restarts and works across replicas (MySQL unique-
 * constraint gives us atomic claim semantics).
 *
 * Falls back to the in-memory claim if:
 *   - DB is not reachable
 *   - signal_fingerprints table doesn't exist yet
 *   - the DB query errors unexpectedly
 *
 * A fallback is always safe: worst case, the in-memory path still
 * catches duplicates within a single process. Falling all the way
 * through would be worse (firing every duplicate), so we never do.
 */
export async function claimSignalFingerprintPersistent(
  key: DedupeKey
): Promise<boolean> {
  const { fp, minuteBucket, priceCents } = buildFingerprint(key);
  const now = Date.now();

  // Fast-path: if we've recently confirmed DB dedupe is unavailable,
  // skip the DB attempt entirely for a cooldown.
  if (dbDedupeAvailable === false && now < dbDedupeDisabledUntil) {
    return claimSignalFingerprint(key);
  }

  const db = await getDb().catch(() => null);
  if (!db) {
    // No DB configured (e.g. local scripts) — in-memory only.
    return claimSignalFingerprint(key);
  }

  try {
    const expiresAtMs = now + DEDUPE_WINDOW_MS;
    const firstSeenAt = new Date(now)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const expiresAt = new Date(expiresAtMs)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // INSERT IGNORE: if the fingerprint is unique, row inserts and the
    // affectedRows is 1. If the fingerprint already exists, affectedRows
    // is 0 — that's our "duplicate" signal. Atomic in MySQL.
    const result = (await db.execute(
      sql`INSERT IGNORE INTO signal_fingerprints
          (fingerprint, strategySymbol, direction, signalType,
           priceCents, minuteBucket, firstSeenAt, claimedByHost, expiresAt)
          VALUES (${fp}, ${key.strategySymbol.toUpperCase()}, ${key.direction.toLowerCase()},
                  ${key.signalType.toLowerCase()}, ${priceCents}, ${minuteBucket},
                  ${firstSeenAt}, ${os.hostname().slice(0, 100)}, ${expiresAt})`
    )) as any;

    // mysql2 returns [OkPacket, undefined] for raw execute — the shape
    // differs slightly between execute vs query, and between drizzle
    // versions. Normalize defensively.
    const packet = Array.isArray(result) ? result[0] : result;
    const affected =
      packet?.affectedRows ??
      packet?.rowsAffected ??
      (result as any)?.affectedRows ??
      0;

    // Mark DB dedupe as available on the first successful query.
    if (dbDedupeAvailable !== true) {
      dbDedupeAvailable = true;
    }

    if (affected >= 1) {
      // We claimed a new fingerprint. Also cache in-memory so a
      // follow-up sync call in the same process short-circuits without
      // hitting the DB again.
      seenFingerprints.set(fp, now);
      return true;
    }

    // affectedRows === 0 → duplicate within the window. Before we
    // declare a dupe, check the expiresAt of the existing row — if the
    // old row is stale (expired), the dupe claim is a no-op for our
    // 60s window. Simpler to just accept the dupe signal; the janitor
    // sweeps stale rows.
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Common case: table doesn't exist yet (migration hasn't been
    // applied). Disable DB path for a cooldown and fall through.
    if (
      msg.includes("doesn't exist") ||
      msg.includes("Unknown table") ||
      msg.includes("no such table") ||
      msg.includes("ER_NO_SUCH_TABLE")
    ) {
      dbDedupeAvailable = false;
      dbDedupeDisabledUntil = now + DB_DEDUPE_COOLDOWN_MS;
      console.warn(
        "[commsGuard] signal_fingerprints table missing — falling back to in-memory dedupe for 5 minutes. Apply drizzle/manual/0001_signal_fingerprints.sql."
      );
    } else {
      // Transient error. Log once, fall through. Don't disable the
      // DB path — next signal will retry.
      console.warn(
        "[commsGuard] DB dedupe insert failed; falling back to in-memory:",
        msg
      );
    }
    return claimSignalFingerprint(key);
  }
}

/**
 * Composite decision: should we dispatch subscriber notifications for
 * this signal? Combines all three layers. Returns a structured reason
 * for logging so failed-to-fire can be investigated.
 *
 * Async so we can use the DB-backed dedupe. Callers must `await`.
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

export async function decideSubscriberNotify(
  input: CommsDecisionInput
): Promise<CommsDecision> {
  if (!outboundCommsEnabled()) {
    return { allowed: false, reason: "global_killswitch_off" };
  }
  if (input.isTest) {
    return { allowed: false, reason: "payload_is_test" };
  }
  if (isTestStrategy(input.strategySymbol)) {
    return { allowed: false, reason: "strategy_is_test" };
  }
  const fresh = await claimSignalFingerprintPersistent({
    strategySymbol: input.strategySymbol,
    direction: input.direction,
    signalType: input.signalType,
    price: input.price,
    timestamp: input.timestamp,
  });
  if (!fresh) return { allowed: false, reason: "duplicate_fingerprint" };
  return { allowed: true };
}

/**
 * Deletes rows older than the dedupe window from signal_fingerprints.
 * Safe to run on a schedule — no-op if table missing.
 *
 * The dedupe semantics only care about the last 60s, so anything older
 * is pure storage. Sweep daily is plenty.
 */
export async function reapExpiredFingerprints(): Promise<number> {
  const db = await getDb().catch(() => null);
  if (!db) return 0;
  try {
    const result = (await db.execute(
      sql`DELETE FROM signal_fingerprints WHERE expiresAt < NOW()`
    )) as any;
    const packet = Array.isArray(result) ? result[0] : result;
    const affected =
      packet?.affectedRows ??
      packet?.rowsAffected ??
      (result as any)?.affectedRows ??
      0;
    if (affected > 0) {
      console.log(`[commsGuard] Reaped ${affected} expired fingerprints`);
    }
    return affected;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("doesn't exist")) {
      console.warn("[commsGuard] Reap failed:", msg);
    }
    return 0;
  }
}

/** Public test-reset hook for unit tests. No-op in production paths. */
export function _resetCommsGuardForTests() {
  seenFingerprints.clear();
  dbDedupeAvailable = null;
  dbDedupeDisabledUntil = 0;
}
