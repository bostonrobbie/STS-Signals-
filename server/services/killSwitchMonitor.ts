/**
 * Kill-switch health monitor.
 *
 * Watches OUTBOUND_COMMS_ENABLED and remembers how long it's been off.
 * Surfaces that state to the admin dashboard so Rob sees a banner when
 * the kill switch has been off for > 1 hour — addresses the obvious
 * failure mode where the switch is flipped for test work and then
 * forgotten, silently suppressing legitimate subscriber notifications.
 *
 * The monitor does NOT bypass the kill switch. It doesn't send emails
 * or alerts — it just:
 *   1. Logs a loud warning to server logs every 10 minutes while off
 *   2. Exposes state via `getKillSwitchStatus()` for the admin API
 *
 * Rob sees the state on `/admin/business` (or wherever the banner is
 * wired). No automatic recovery, on purpose — if the switch was flipped
 * deliberately, auto-flipping it back would defeat the point.
 */

import { outboundCommsEnabled } from "../_core/commsGuard";

const TICK_INTERVAL_MS = 60_000;
const WARN_EVERY_MS = 10 * 60_000;
const STALE_THRESHOLD_MINUTES = 60;

let offSinceMs: number | null = null;
let lastWarnAtMs: number | null = null;
let monitorStartedAt: number | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function tick(): void {
  const enabled = outboundCommsEnabled();
  const now = Date.now();

  if (enabled) {
    if (offSinceMs !== null) {
      const offForMs = now - offSinceMs;
      const offMinutes = Math.round(offForMs / 60_000);
      console.log(
        `[KillSwitchMonitor] OUTBOUND_COMMS_ENABLED restored after ${offMinutes} minutes`
      );
    }
    offSinceMs = null;
    lastWarnAtMs = null;
    return;
  }

  // Kill switch is OFF
  if (offSinceMs === null) {
    offSinceMs = now;
    lastWarnAtMs = now;
    console.warn(
      "[KillSwitchMonitor] OUTBOUND_COMMS_ENABLED=false detected. All outbound comms suppressed. If this is not intentional, restore the env var."
    );
    return;
  }

  const offForMs = now - offSinceMs;
  const offMinutes = Math.round(offForMs / 60_000);

  if (
    lastWarnAtMs === null ||
    now - lastWarnAtMs >= WARN_EVERY_MS
  ) {
    const marker = offMinutes >= STALE_THRESHOLD_MINUTES ? "⚠️ STALE" : "ℹ️ ";
    console.warn(
      `[KillSwitchMonitor] ${marker} OUTBOUND_COMMS_ENABLED has been off for ${offMinutes} minutes. Set OUTBOUND_COMMS_ENABLED=true to resume subscriber emails/SSE/notifications.`
    );
    lastWarnAtMs = now;
  }
}

/**
 * Start the monitor. Idempotent — calling twice is a no-op.
 * Called from server/_core/serverInit.ts on boot.
 */
export function startKillSwitchMonitor(): void {
  if (tickTimer) return;
  monitorStartedAt = Date.now();
  // Immediate tick to initialize state if the switch is already off on
  // boot. (Common if Rob set it before a deploy.)
  tick();
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  // Prevent the timer from blocking process exit during dev reloads.
  if (typeof tickTimer.unref === "function") tickTimer.unref();
  console.log("[KillSwitchMonitor] Started");
}

/** Stop (for tests / clean shutdown). */
export function stopKillSwitchMonitor(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  offSinceMs = null;
  lastWarnAtMs = null;
  monitorStartedAt = null;
}

export interface KillSwitchStatus {
  enabled: boolean;
  offSinceEpochMs: number | null;
  offMinutes: number;
  isStale: boolean;
  monitorStartedAt: number | null;
}

/**
 * Read the current status without mutating monitor state.
 * Safe to call from any tRPC admin endpoint.
 */
export function getKillSwitchStatus(): KillSwitchStatus {
  const enabled = outboundCommsEnabled();
  const now = Date.now();
  const offMinutes =
    offSinceMs === null ? 0 : Math.round((now - offSinceMs) / 60_000);
  return {
    enabled,
    offSinceEpochMs: offSinceMs,
    offMinutes,
    isStale: !enabled && offMinutes >= STALE_THRESHOLD_MINUTES,
    monitorStartedAt,
  };
}
