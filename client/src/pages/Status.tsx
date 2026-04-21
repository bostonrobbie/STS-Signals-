/**
 * Public system-status page — /status
 *
 * Polls /api/health and /api/notifications/status (both already public)
 * every 30 seconds and renders a service-by-service status grid. No
 * auth required, no server changes — this is a pure client page on
 * top of endpoints that already existed.
 *
 * Philosophy: show coarse green/yellow/red indicators, not operational
 * internals (heap %, request counts). Subscribers want to know "is it
 * working right now?" — not "how many connections are in the DB pool."
 */

import { useEffect, useMemo, useState } from "react";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Bell,
  CheckCircle2,
  Circle,
  Database,
  Globe,
  LayoutDashboard,
  Mail,
  RefreshCw,
  Webhook,
  XCircle,
} from "lucide-react";

type Severity = "operational" | "degraded" | "down" | "unknown";

interface HealthResponse {
  status?: "healthy" | "degraded" | "unhealthy";
  timestamp?: string;
  uptime?: number;
  uptimeFormatted?: string;
  database?: {
    connected?: boolean;
  } | null;
  requests?: {
    successRate?: number;
  };
}

interface NotificationsStatus {
  connectedClients?: number;
  timestamp?: string;
}

interface ServiceStatus {
  name: string;
  description: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string }>;
  detail?: string;
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case "operational":
      return "text-green-500";
    case "degraded":
      return "text-yellow-500";
    case "down":
      return "text-destructive";
    default:
      return "text-muted-foreground";
  }
}

function severityBadge(severity: Severity): { label: string; className: string } {
  switch (severity) {
    case "operational":
      return {
        label: "Operational",
        className:
          "bg-green-500/10 text-green-600 border-green-500/30",
      };
    case "degraded":
      return {
        label: "Degraded",
        className:
          "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      };
    case "down":
      return {
        label: "Down",
        className:
          "bg-destructive/10 text-destructive border-destructive/30",
      };
    default:
      return {
        label: "Checking…",
        className: "bg-muted text-muted-foreground border-border",
      };
  }
}

function overallSeverity(services: ServiceStatus[]): Severity {
  if (services.some(s => s.severity === "down")) return "down";
  if (services.some(s => s.severity === "degraded")) return "degraded";
  if (services.every(s => s.severity === "operational")) return "operational";
  return "unknown";
}

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch("/api/health", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.status === 503) {
      // Unhealthy response still returns a body; fall through to read it
      return (await res.json()) as HealthResponse;
    }
    if (!res.ok) return null;
    return (await res.json()) as HealthResponse;
  } catch {
    return null;
  }
}

async function fetchNotificationsStatus(): Promise<NotificationsStatus | null> {
  try {
    const res = await fetch("/api/notifications/status", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as NotificationsStatus;
  } catch {
    return null;
  }
}

export default function Status() {
  const [health, setHealth] = useState<HealthResponse | null | "loading">(
    "loading"
  );
  const [notif, setNotif] = useState<NotificationsStatus | null | "loading">(
    "loading"
  );
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [, setTick] = useState(0); // force re-render for "X seconds ago"

  async function refresh() {
    const [h, n] = await Promise.all([
      fetchHealth(),
      fetchNotificationsStatus(),
    ]);
    setHealth(h);
    setNotif(n);
    setLastChecked(new Date());
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    // Also re-render every 10s so the "last checked" timestamp stays fresh
    const tickId = setInterval(() => setTick(t => t + 1), 10_000);
    return () => {
      clearInterval(id);
      clearInterval(tickId);
    };
  }, []);

  const services: ServiceStatus[] = useMemo(() => {
    // Dashboard — if this page rendered, it's up
    const dashboard: ServiceStatus = {
      name: "Dashboard (web)",
      description: "The stsdashboard.com React app you're looking at now.",
      icon: LayoutDashboard,
      severity: "operational",
    };

    // Backend API — from /api/health status
    let apiSev: Severity = "unknown";
    let apiDetail: string | undefined;
    if (health === "loading") {
      apiSev = "unknown";
    } else if (health === null) {
      apiSev = "down";
      apiDetail = "Could not reach /api/health.";
    } else if (health.status === "healthy") {
      apiSev = "operational";
      if (health.uptimeFormatted) apiDetail = `Uptime ${health.uptimeFormatted}`;
    } else if (health.status === "degraded") {
      apiSev = "degraded";
      apiDetail = "Running under elevated load or reduced capacity.";
    } else {
      apiSev = "down";
      apiDetail = "Health check reports unhealthy state.";
    }
    const api: ServiceStatus = {
      name: "Backend API",
      description:
        "tRPC endpoints, authentication, Stripe integration, strategy queries.",
      icon: Globe,
      severity: apiSev,
      detail: apiDetail,
    };

    // Database
    let dbSev: Severity = "unknown";
    let dbDetail: string | undefined;
    if (health === "loading") {
      dbSev = "unknown";
    } else if (health === null) {
      dbSev = "unknown";
    } else if (health.database?.connected === true) {
      dbSev = "operational";
      dbDetail = "Connected.";
    } else if (health.database?.connected === false) {
      dbSev = "down";
      dbDetail = "Connection pool reports disconnected.";
    }
    const database: ServiceStatus = {
      name: "Database",
      description:
        "MySQL/TiDB — stores trades, users, webhook logs, subscriber state.",
      icon: Database,
      severity: dbSev,
      detail: dbDetail,
    };

    // Webhook ingestion — treated as operational when API is operational.
    // A finer-grained check would query webhook_logs for recent success
    // rate, but that requires an authenticated call. Keep it coarse.
    const webhook: ServiceStatus = {
      name: "Webhook ingestion",
      description:
        "Accepts TradingView signal webhooks and processes them into trades.",
      icon: Webhook,
      severity:
        apiSev === "operational"
          ? "operational"
          : apiSev === "degraded"
            ? "degraded"
            : apiSev === "down"
              ? "down"
              : "unknown",
      detail:
        apiSev === "operational"
          ? "Routing through /api/webhook/tradingview."
          : "Depends on Backend API — see above.",
    };

    // Real-time notifications (SSE) — from /api/notifications/status
    let notifSev: Severity = "unknown";
    let notifDetail: string | undefined;
    if (notif === "loading") {
      notifSev = "unknown";
    } else if (notif === null) {
      notifSev = "degraded";
      notifDetail = "Could not reach SSE status endpoint.";
    } else {
      notifSev = "operational";
      const count = notif.connectedClients ?? 0;
      notifDetail = `${count} active client${count === 1 ? "" : "s"}`;
    }
    const notifications: ServiceStatus = {
      name: "Real-time push",
      description:
        "Server-Sent Events stream that delivers live signal alerts to the dashboard.",
      icon: Bell,
      severity: notifSev,
      detail: notifDetail,
    };

    // Email delivery — coarse check. Full status would require a server
    // endpoint that exercises Resend. Mark as operational when API is up.
    const email: ServiceStatus = {
      name: "Email delivery",
      description:
        "Signal alert emails via Resend. Subject to deliverability by the recipient's inbox provider.",
      icon: Mail,
      severity:
        apiSev === "operational"
          ? "operational"
          : apiSev === "degraded"
            ? "degraded"
            : apiSev === "down"
              ? "down"
              : "unknown",
      detail:
        apiSev === "operational"
          ? "Outbound path ready (provider-level delivery is not checked from this page)."
          : "Depends on Backend API — see above.",
    };

    return [dashboard, api, database, webhook, notifications, email];
  }, [health, notif]);

  const overall = overallSeverity(services);
  const overallBadge = severityBadge(overall);

  const lastCheckedLabel = (() => {
    if (!lastChecked) return "Checking…";
    const secs = Math.max(0, Math.round((Date.now() - lastChecked.getTime()) / 1000));
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    return `${mins}m ago`;
  })();

  return (
    <>
      <SEOHead {...SEO_CONFIG.status} />

      <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-4">
          <Badge variant="outline" className="mb-2">
            <Activity className="h-3 w-3 mr-1" />
            Live — auto-refreshes every 30 seconds
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            System Status
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Badge className={`text-base px-4 py-1.5 ${overallBadge.className}`}>
              {overall === "operational" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : overall === "down" ? (
                <XCircle className="h-4 w-4 mr-2" />
              ) : (
                <Circle className="h-4 w-4 mr-2" />
              )}
              {overall === "operational"
                ? "All systems operational"
                : overall === "down"
                  ? "Major outage in progress"
                  : overall === "degraded"
                    ? "Partial degradation"
                    : "Checking all systems…"}
            </Badge>
            <button
              onClick={() => refresh()}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              aria-label="Refresh status"
            >
              <RefreshCw className="h-3 w-3" />
              Last checked: {lastCheckedLabel}
            </button>
          </div>
        </section>

        {/* Services */}
        <section className="space-y-3">
          {services.map(svc => {
            const badge = severityBadge(svc.severity);
            const Icon = svc.icon;
            return (
              <Card key={svc.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon
                          className={`h-5 w-5 ${severityColor(svc.severity)}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{svc.name}</CardTitle>
                        <CardDescription className="mt-0.5 text-xs sm:text-sm">
                          {svc.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={`${badge.className} shrink-0`}>
                      {badge.label}
                    </Badge>
                  </div>
                </CardHeader>
                {svc.detail && (
                  <CardContent className="pt-0 text-xs text-muted-foreground pl-16">
                    {svc.detail}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </section>

        {/* Context / runbook */}
        <section className="space-y-3 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                What each status means
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>
                <strong className="text-green-600">Operational</strong> — the
                service is responding normally. Subscribers should see fresh
                signals and dashboard updates with no observable delay.
              </p>
              <p>
                <strong className="text-yellow-600">Degraded</strong> — the
                service is responding but with elevated latency or reduced
                capacity. Signals still fire; some requests may be slower
                than usual.
              </p>
              <p>
                <strong className="text-destructive">Down</strong> — the
                service isn't responding at all. We'll post an incident
                update as soon as we know more. During an outage, subscribers
                don't receive new signal emails; the web dashboard may show
                stale data but won't execute new trades on your behalf.
              </p>
              <p>
                <strong>Checking…</strong> — the page is still polling the
                health endpoint. Should resolve within a few seconds.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Have a question? See an issue?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Email{" "}
              <a
                href="mailto:support@stsfutures.com"
                className="underline underline-offset-2 hover:text-foreground"
              >
                support@stsfutures.com
              </a>{" "}
              or open the{" "}
              <a
                href="/admin"
                className="underline underline-offset-2 hover:text-foreground"
              >
                admin dashboard
              </a>{" "}
              (Rob only) for operational details.
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}
