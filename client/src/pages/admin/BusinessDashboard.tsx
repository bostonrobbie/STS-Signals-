/**
 * /admin/business — operator command-center.
 *
 * Single-pane-of-glass for Rob to see the whole business at a glance:
 * revenue & subscribers, signal delivery health, traffic funnel, AI
 * referrals, and ad-spend performance.
 *
 * Wiring philosophy:
 *   - Where a real tRPC endpoint already exists → query it, show live data.
 *   - Where a data source needs an external integration (GA4, Google Ads,
 *     Meta, PostHog, Search Console) → render a `DashboardStub` card with
 *     the exact env vars and setup URL needed to flip it on later.
 *
 * No new backend migrations; uses only existing public/admin tRPC
 * endpoints. Safe to merge into Manus.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { SEOHead } from "@/components/SEOHead";
import { DashboardStub } from "@/components/DashboardStub";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  DollarSign,
  Users,
  TrendingUp,
  UserPlus,
  Activity,
  Zap,
  Globe,
  MousePointerClick,
  Bot,
  BarChart3,
  Eye,
  ArrowRight,
  Megaphone,
  Search,
  Layers,
} from "lucide-react";

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 3650 },
] as const;

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${toneClass}`}>{value}</div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BusinessDashboard() {
  const [periodIdx, setPeriodIdx] = useState(1); // default 30d
  const period = PERIODS[periodIdx];

  // Backtest metrics for the Strategy Health card
  const platformStats = trpc.platform.stats.useQuery();
  const overview = trpc.publicApi.overview.useQuery(
    { startingCapital: 100000, contractMultiplier: 0.1 },
    { staleTime: 5 * 60 * 1000 }
  );
  const recentTrades =
    (overview.data?.recentTrades as any[] | undefined) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Business Dashboard — STS Futures Admin"
        description="Operator command center"
        canonical="https://stsdashboard.com/admin/business"
        noindex
      />

      <main className="container max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Business Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Everything at a glance. Live where wired, labeled where pending
              connection.
            </p>
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {PERIODS.map((p, i) => (
              <Button
                key={p.label}
                size="sm"
                variant={i === periodIdx ? "default" : "ghost"}
                onClick={() => setPeriodIdx(i)}
                className="h-7 px-3 text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* ── ROW 1: Revenue & subscriber KPIs (stubs until admin.businessStats wired) ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Revenue & Subscribers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStub
              icon={<DollarSign className="w-4 h-4" />}
              title="MRR (Monthly Recurring)"
              summary="Active subscribers × $50. Will pull from Stripe + the users table once the admin.businessStats tRPC endpoint is live."
              source="Stripe + users table"
              envHint="needs server/routers/adminBusiness.ts"
            />
            <DashboardStub
              icon={<Users className="w-4 h-4" />}
              title="Active Subscribers"
              summary="Count of users with subscriptionStatus='active'. Same endpoint as MRR."
              source="users table"
              envHint="needs admin.businessStats"
            />
            <DashboardStub
              icon={<UserPlus className="w-4 h-4" />}
              title={`New This ${period.label}`}
              summary="Signups created in the selected window. One query on users.createdAt."
              source="users table"
              envHint="needs admin.businessStats"
            />
            <DashboardStub
              icon={<TrendingUp className="w-4 h-4" />}
              title="Signup → Paid Conversion"
              summary="% of signups in the window who reached an active subscription. Join users × payment_history."
              source="users × payment_history"
              envHint="needs admin.businessStats"
            />
          </div>
        </section>

        {/* ── ROW 2: Signal delivery health (some data exists via trade feed) ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Signal Delivery
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overview.isLoading ? (
              <Card>
                <CardContent className="p-6 animate-pulse h-24" />
              </Card>
            ) : recentTrades.length > 0 ? (
              (() => {
                const last = recentTrades[0];
                const lastDate =
                  typeof last.exitDate === "string"
                    ? new Date(last.exitDate)
                    : last.exitDate;
                const hoursSince =
                  (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
                return (
                  <KpiCard
                    icon={<Zap className="w-4 h-4" />}
                    label="Last Trade Closed"
                    value={lastDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    sub={`${hoursSince < 24 ? Math.round(hoursSince) + "h" : Math.round(hoursSince / 24) + "d"} ago · ${last.direction} · ${
                      last.pnl > 0 ? "+" : ""
                    }$${(last.pnl / 100).toFixed(0)}`}
                    tone={last.pnl > 0 ? "good" : "default"}
                  />
                );
              })()
            ) : (
              <KpiCard
                icon={<Zap className="w-4 h-4" />}
                label="Last Trade Closed"
                value="—"
                sub="No trades in DB"
              />
            )}

            <DashboardStub
              icon={<Activity className="w-4 h-4" />}
              title="Webhook Success Rate"
              summary="Successful vs failed webhook deliveries in the period. Query the webhook_logs table grouped by status."
              source="webhook_logs"
              envHint="needs admin.webhookHealth endpoint"
            />
            <DashboardStub
              icon={<Layers className="w-4 h-4" />}
              title="Pending Retries"
              summary="Count of rows in webhook_retry_queue + dead_letter_queue. A non-zero dead-letter count means subscribers silently missed signals."
              source="webhook_retry_queue"
              envHint="needs admin.retryQueueStats endpoint"
            />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Strategy Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {platformStats.isLoading ? (
                  <div className="animate-pulse h-16" />
                ) : platformStats.data ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sharpe</span>
                      <span className="font-mono">
                        {platformStats.data.sharpeRatio?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win rate</span>
                      <span className="font-mono">
                        {platformStats.data.winRate?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trades</span>
                      <span className="font-mono">
                        {platformStats.data.totalTrades?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No data</div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── ROW 3: Traffic & funnel (all external, mostly stubs) ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Traffic & Funnel
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStub
              icon={<Globe className="w-4 h-4" />}
              title="Sessions by Channel"
              summary="Organic, paid, direct, social, referral, AI. Pulls from GA4 Data API once VITE_GA4_MEASUREMENT_ID + GA4_API_SECRET are set in env."
              source="Google Analytics 4"
              envHint="VITE_GA4_MEASUREMENT_ID, GA4_API_SECRET"
              setupUrl="https://analytics.google.com/"
            />
            <DashboardStub
              icon={<MousePointerClick className="w-4 h-4" />}
              title="Funnel: Visit → Paid"
              summary="Landing → pricing view → begin_checkout → purchase conversion rate. GA4 funnel exploration data via Measurement Protocol."
              source="GA4 + Stripe webhooks"
              envHint="GA4_API_SECRET"
            />
            <DashboardStub
              icon={<Bot className="w-4 h-4" />}
              title="AI Bot Crawls"
              summary="GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc. Already implemented in the ai_traffic_logs table + middleware on this same repo — toggles on when that branch ships."
              source="ai_traffic_logs"
              envHint="already in seo-aeo branch"
            />
            <DashboardStub
              icon={<Search className="w-4 h-4" />}
              title="Search Impressions"
              summary="Google Search Console impressions, clicks, avg position per query. Needs OAuth service account against the verified property."
              source="Google Search Console API"
              envHint="GSC_SERVICE_ACCOUNT_JSON"
              setupUrl="https://search.google.com/search-console"
            />
          </div>
        </section>

        {/* ── ROW 4: Ads (all external) ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ads
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardStub
              icon={<Megaphone className="w-4 h-4" />}
              title="Google Ads Spend"
              summary="Daily spend, clicks, impressions, conversions across all campaigns. Google Ads API via OAuth refresh token once account is live."
              source="Google Ads (AW-862612449)"
              envHint="GOOGLE_ADS_DEVELOPER_TOKEN, REFRESH_TOKEN, CUSTOMER_ID"
              setupUrl="https://ads.google.com/"
            />
            <DashboardStub
              icon={<Megaphone className="w-4 h-4" />}
              title="Meta Ads Spend"
              summary="Meta Ads campaigns + pixel conversions, including CAPI-attributed purchases."
              source="Meta Ads API"
              envHint="META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID"
              setupUrl="https://business.facebook.com/"
            />
            <DashboardStub
              icon={<DollarSign className="w-4 h-4" />}
              title="CAC by Channel"
              summary="Cost / acquisition per channel (Google, Meta, Reddit, organic, referral). Blends Stripe paid conversions with ad-platform spend."
              source="Stripe + Google Ads + Meta"
              envHint="requires both ad-platform APIs"
            />
            <DashboardStub
              icon={<TrendingUp className="w-4 h-4" />}
              title="LTV:CAC"
              summary="Rolling 90-day LTV ÷ CAC. Anything under 3:1 is a problem."
              source="Stripe + ad spend"
              envHint="requires MRR model + ads data"
            />
          </div>
        </section>

        {/* ── ROW 5: Recent activity (uses existing data) ── */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Recent Activity
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Latest 10 Trades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overview.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="animate-pulse h-7 bg-muted rounded"
                      />
                    ))}
                  </div>
                ) : recentTrades.length > 0 ? (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {recentTrades.slice(0, 10).map((t: any) => {
                      const exitDate =
                        typeof t.exitDate === "string"
                          ? new Date(t.exitDate)
                          : t.exitDate;
                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between text-xs py-1 border-b last:border-0"
                        >
                          <span className="text-muted-foreground font-mono">
                            {exitDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            NQ {t.direction}
                          </Badge>
                          <span
                            className={`font-mono font-semibold ${
                              t.pnl > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {t.pnl > 0 ? "+" : ""}$
                            {(t.pnl / 100).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No trades in DB yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <DashboardStub
              icon={<UserPlus className="w-4 h-4" />}
              title="Recent Signups"
              summary="Latest 10 users with email, signup date, first-touch channel from user_attribution, and subscription state. Reads from users + user_attribution tables."
              source="users + user_attribution"
              envHint="needs admin.recentSignups endpoint"
            />
          </div>
        </section>

        {/* ── Quick links ── */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Jump To
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Activity className="w-4 h-4 mr-2" />
                System Admin
              </Button>
            </Link>
            <Link href="/admin/messages">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                Contact Messages
              </Button>
            </Link>
            <Link href="/overview">
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                User Dashboard
              </Button>
            </Link>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <DollarSign className="w-4 h-4 mr-2" />
                Stripe Dashboard
                <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </a>
            <a
              href="https://ads.google.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <Megaphone className="w-4 h-4 mr-2" />
                Google Ads
                <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </a>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <Search className="w-4 h-4 mr-2" />
                Search Console
                <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </a>
          </div>
        </section>

        <p className="text-[11px] text-muted-foreground mt-8">
          Dashboard built to be progressively wired. Each "Not connected"
          card has the env var / endpoint name that turns it on. See{" "}
          <code className="font-mono">docs/ANALYTICS_SETUP.md</code> and{" "}
          <code className="font-mono">docs/AI_SEO_GUIDE.md</code> for the
          full connection playbook.
        </p>
      </main>
    </div>
  );
}
