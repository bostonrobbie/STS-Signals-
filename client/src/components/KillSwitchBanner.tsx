/**
 * Kill-switch status banner.
 *
 * Shows a yellow (recently-off) or red (stale/off >1h) banner at the
 * top of the admin pages whenever `OUTBOUND_COMMS_ENABLED=false`.
 *
 * Exists because the kill switch silently suppresses every outbound
 * notification. Forgetting to flip it back is the obvious failure mode
 * — this makes "currently off" impossible to miss when Rob lands on
 * the admin dashboard.
 *
 * Data source: trpc.adminSafety.killSwitchStatus. Polls every 30s.
 * Server-side monitor updates its internal `offSinceMs` timestamp once
 * a minute, so 30s client poll is plenty fresh.
 */

import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Info } from "lucide-react";

function formatOffDuration(minutes: number): string {
  if (minutes <= 0) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function KillSwitchBanner() {
  const { data } = trpc.adminSafety.killSwitchStatus.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const status = data?.data;
  if (!status) return null;
  if (status.enabled) return null;

  const offFor = formatOffDuration(status.offMinutes);
  const isStale = status.isStale;

  return (
    <Alert
      variant={isStale ? "destructive" : "default"}
      className={
        isStale
          ? "border-destructive/50 bg-destructive/5"
          : "border-yellow-500/50 bg-yellow-500/5"
      }
      data-testid="kill-switch-banner"
    >
      {isStale ? (
        <AlertTriangle className="text-destructive" />
      ) : (
        <Info className="text-yellow-600" />
      )}
      <AlertTitle
        className={isStale ? "text-destructive" : "text-yellow-700"}
      >
        {isStale
          ? `⚠️ OUTBOUND_COMMS_ENABLED has been OFF for ${offFor}`
          : `ℹ️ OUTBOUND_COMMS_ENABLED is off (${offFor})`}
      </AlertTitle>
      <AlertDescription>
        {isStale ? (
          <>
            No subscriber emails, SSE pushes, or signal notifications have
            fired since the kill switch was flipped. If this is unintentional,
            set <code className="font-mono">OUTBOUND_COMMS_ENABLED=true</code>{" "}
            in Manus env config — takes effect within ~30 seconds of restart.
          </>
        ) : (
          <>
            All outbound subscriber comms are suppressed. Safe for test work.
            Flip back to <code className="font-mono">true</code> in Manus env
            config before expecting notifications to resume.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
