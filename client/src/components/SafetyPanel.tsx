/**
 * Safety Panel — the admin-visible view of commsGuard state.
 *
 * One place to see: is the kill switch on? Is the persistent dedupe
 * table alive? What signals has the dedupe caught recently?
 *
 * Everything here is read-only and safe to poll. Wires up the
 * `trpc.adminSafety.*` routes shipped with the persistent-dedupe branch.
 */

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

function StatusRow({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {good ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <AlertCircle className="w-4 h-4 text-destructive" />
        )}
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

function formatTimestamp(ts: string | Date | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = typeof ts === "string" ? new Date(ts) : ts;
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

export function SafetyPanel() {
  const { data: summary, isLoading: summaryLoading } =
    trpc.adminSafety.summary.useQuery(undefined, {
      refetchInterval: 30_000,
    });

  const { data: fingerprints } =
    trpc.adminSafety.recentFingerprints.useQuery(undefined, {
      refetchInterval: 60_000,
    });

  const status = summary?.data;
  const killSwitch = status?.killSwitch;
  const dedupe = status?.dedupe;

  const rows: any[] = (fingerprints?.data as any[] | undefined) ?? [];
  const fpNote = (fingerprints as any)?.note;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Outbound Comms Safety
          </CardTitle>
          <CardDescription>
            Live state of the three-layer safety net (kill switch,
            test-prefix, persistent dedupe). All subscriber emails + SSE
            pushes + server-side conversions flow through these checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {summaryLoading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {killSwitch && (
            <>
              <StatusRow
                label="OUTBOUND_COMMS_ENABLED"
                value={killSwitch.enabled ? "true (sending)" : "false (suppressed)"}
                good={killSwitch.enabled}
              />
              {!killSwitch.enabled && (
                <StatusRow
                  label="Kill switch off for"
                  value={`${killSwitch.offMinutes} minute${killSwitch.offMinutes === 1 ? "" : "s"}${killSwitch.isStale ? " ⚠️ STALE" : ""}`}
                  good={!killSwitch.isStale}
                />
              )}
              {killSwitch.monitorStartedAt && (
                <StatusRow
                  label="Kill-switch monitor started"
                  value={formatTimestamp(
                    new Date(killSwitch.monitorStartedAt)
                  )}
                  good={true}
                />
              )}
            </>
          )}
          {dedupe && (
            <>
              <StatusRow
                label="Persistent dedupe table"
                value={
                  dedupe.tableExists
                    ? "signal_fingerprints (live)"
                    : "MISSING — using in-memory fallback"
                }
                good={dedupe.tableExists}
              />
              <StatusRow
                label="Active fingerprints (within window)"
                value={String(dedupe.activeFingerprints ?? 0)}
                good={true}
              />
              <StatusRow
                label="Expired fingerprints (awaiting reap)"
                value={String(dedupe.expiredFingerprints ?? 0)}
                good={dedupe.expiredFingerprints < 5000}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent fingerprints */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            Recent Signal Fingerprints
          </CardTitle>
          <CardDescription>
            Most-recent 50 signals that hit the dedupe. A row here means
            commsGuard saw this signal AT LEAST ONCE. The 60s dedupe
            window prevents retries from double-firing notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fpNote ? (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-sm">
              <ShieldAlert className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-yellow-700">
                  Dedupe table not yet migrated
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  {fpNote}
                </p>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fingerprints yet. Fire a test webhook to populate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Price (¢)</TableHead>
                    <TableHead>First seen</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Claimed by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.strategySymbol}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.direction === "long"
                              ? "text-green-600 border-green-500/30"
                              : "text-red-600 border-red-500/30"
                          }
                        >
                          {row.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.signalType}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.priceCents}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTimestamp(row.firstSeenAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTimestamp(row.expiresAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.claimedByHost || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend / runbook link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-4 h-4 text-muted-foreground" />
            What to do if something's wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p className="flex items-start gap-2">
            <ShieldX className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
            <span>
              Kill switch stuck off? Set{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                OUTBOUND_COMMS_ENABLED=true
              </code>{" "}
              in Manus env config.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
            <span>
              Dedupe table missing? Apply{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                drizzle/manual/0001_signal_fingerprints.sql
              </code>{" "}
              on the Manus DB. Code falls back to in-memory dedupe
              until then — not broken, just less durable.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
            <span>
              Full procedures in{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                docs/INCIDENT_RUNBOOK.md
              </code>
              .
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
