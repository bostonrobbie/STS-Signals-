/**
 * Admin safety-net telemetry.
 *
 * Read-only endpoints that surface the state of the commsGuard pipeline
 * (kill switch, recent suppressions, dedupe table health) so the admin
 * dashboard can display a banner the moment something looks wrong.
 *
 * Stays scoped to READS. Any write/mutation belongs elsewhere; keeping
 * this router read-only means it's safe to call from a banner component
 * that polls every few seconds.
 */

import { router, adminProcedure } from "../_core/trpc";
import { getKillSwitchStatus } from "../services/killSwitchMonitor";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const adminSafetyRouter = router({
  /**
   * Current kill-switch state + how long it's been off.
   * Safe to poll every 10-30s.
   */
  killSwitchStatus: adminProcedure.query(() => {
    const status = getKillSwitchStatus();
    return { success: true, data: status };
  }),

  /**
   * Recent signal-fingerprint dedupe activity. Helpful to debug
   * "why didn't my test alert fire" — if it's in this list with a
   * recent timestamp, the dedupe caught it.
   *
   * Returns up to 50 most-recent fingerprints (regardless of expiry).
   * Gracefully returns [] if the signal_fingerprints table doesn't
   * exist yet (migration not applied).
   */
  recentFingerprints: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { success: true, data: [] };
    try {
      const rows = (await db.execute(
        sql`SELECT id, fingerprint, strategySymbol, direction, signalType,
                   priceCents, minuteBucket, firstSeenAt, claimedByHost,
                   expiresAt
            FROM signal_fingerprints
            ORDER BY firstSeenAt DESC
            LIMIT 50`
      )) as any;
      const list = Array.isArray(rows) ? rows[0] : rows;
      return { success: true, data: list ?? [] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("doesn't exist") ||
        msg.includes("ER_NO_SUCH_TABLE")
      ) {
        return {
          success: true,
          data: [],
          note: "signal_fingerprints table not yet migrated — apply drizzle/manual/0001_signal_fingerprints.sql",
        };
      }
      throw err;
    }
  }),

  /**
   * Health summary for the whole safety pipeline. Single call for the
   * admin-dashboard safety widget: kill switch, dedupe, table status.
   */
  summary: adminProcedure.query(async () => {
    const db = await getDb();
    const killSwitch = getKillSwitchStatus();

    let fingerprintCount = 0;
    let expiredCount = 0;
    let tableExists = false;

    if (db) {
      try {
        const row = (await db.execute(
          sql`SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN expiresAt < NOW() THEN 1 ELSE 0 END) AS expired
              FROM signal_fingerprints`
        )) as any;
        const list = Array.isArray(row) ? row[0] : row;
        const first = list?.[0] ?? {};
        fingerprintCount = Number(first.total ?? 0);
        expiredCount = Number(first.expired ?? 0);
        tableExists = true;
      } catch {
        tableExists = false;
      }
    }

    return {
      success: true,
      data: {
        killSwitch,
        dedupe: {
          tableExists,
          activeFingerprints: Math.max(0, fingerprintCount - expiredCount),
          expiredFingerprints: expiredCount,
          totalFingerprints: fingerprintCount,
        },
      },
    };
  }),
});

export default adminSafetyRouter;
