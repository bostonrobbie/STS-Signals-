/**
 * Demo page — lets a curious visitor see what subscribers get, without
 * signing up. Mostly static (screenshots + copy) so it's fast and
 * crawlable. No personalized data, no auth.
 *
 * SEO target: "STS Futures dashboard preview", "NQ signal email example",
 * and the long-tail "what do you get when you subscribe to STS Futures"
 * queries. Picks up traffic from people who got a referral but want to
 * see the product before paying.
 */

import { Link } from "wouter";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  LineChart,
  Mail,
  Play,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";

/**
 * Sample signal email content. Shown as a text block so subscribers
 * have an accurate idea of what lands in their inbox.
 *
 * Numbers are illustrative (not from a real trade).
 */
const sampleEntryEmail = {
  subject: "📈 NQ Trend — LONG entry signal at 18,547.25",
  from: "STS Futures <noreply@stsdashboard.com>",
  body: `Strategy: NQ Trend (NQ1!, micro contracts)
Direction: LONG
Entry price: 18,547.25
Signal time: 2026-04-18 09:32:15 ET
Position size recommendation: 1 contract at $10,000 starting capital

Rationale: The NQ Trend strategy detected a confirmed breakout above
yesterday's afternoon consolidation. Stop is set at 18,508.50.

Open the dashboard to see full trade context:
https://stsdashboard.com/overview

— STS Futures`,
};

const sampleExitEmail = {
  subject: "✅ NQ Trend — LONG exit at 18,612.75 (+$327.50)",
  from: "STS Futures <noreply@stsdashboard.com>",
  body: `Strategy: NQ Trend (NQ1!, micro contracts)
Direction: LONG (CLOSED)
Exit price: 18,612.75
Entry: 18,547.25  |  Exit: 18,612.75
P&L: +$327.50 (+0.35%)
Held: 2h 14m

View this trade in your dashboard:
https://stsdashboard.com/overview

— STS Futures`,
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription className="pt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Demo() {
  return (
    <>
      <SEOHead {...SEO_CONFIG.demo} />

      <div className="container max-w-6xl mx-auto px-4 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <Badge variant="outline" className="mb-2">
            <Play className="h-3 w-3 mr-1" />
            Live demo — no signup required
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            See what STS Futures subscribers see
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            A walkthrough of the dashboard, signal emails, and real-time
            alerts — before you decide whether the $50/month is worth it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/pricing">See Pricing</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/overview">Open Live Dashboard</Link>
            </Button>
          </div>
        </section>

        {/* Video placeholder */}
        <section>
          <Card className="overflow-hidden border-2 border-dashed">
            <div className="aspect-video bg-gradient-to-br from-muted/30 to-muted/60 flex items-center justify-center relative">
              <div className="text-center space-y-3">
                <div className="h-20 w-20 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center mx-auto">
                  <Play className="h-8 w-8 text-primary ml-1" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto px-4">
                  <strong>Video walkthrough coming soon.</strong>{" "}
                  In the meantime, open{" "}
                  <Link
                    href="/overview"
                    className="text-primary underline underline-offset-2"
                  >
                    the live dashboard
                  </Link>{" "}
                  — equity curve, strategy detail, and trade log are all
                  public.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* What's included */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">
              What you see as a subscriber
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Four things, all available the moment you subscribe. No
              setup fees, no broker connections required to view signals.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <FeatureCard
              icon={Bell}
              title="Real-time signal alerts"
              description="Email the moment a signal fires on the live dashboard."
              bullets={[
                "Entry: strategy, direction, price, suggested contract count",
                "Exit: P&L in dollars and %, hold duration, running total",
                "Typically 1–3 signals per trading day",
                "Delivered via Resend — usually within 2 seconds of the trade",
              ]}
            />

            <FeatureCard
              icon={LineChart}
              title="Equity curve + drawdown"
              description="15+ years of backtested performance, updated with each new live signal."
              bullets={[
                "Starting capital assumption is user-configurable ($10k, $25k, $100k)",
                "Drawdown overlay shows worst-case loss windows at a glance",
                "Sharpe, Sortino, win rate, profit factor computed live",
                "Compare strategies side-by-side on one chart",
              ]}
            />

            <FeatureCard
              icon={BarChart3}
              title="Per-strategy trade log"
              description="Every trade, filterable by date, direction, or source."
              bullets={[
                "7,900+ historical trades available for inspection",
                "Filter by webhook-only (live) vs. CSV-imported (backtest)",
                "Export to CSV for your own analysis",
                "Trade details: entry/exit prices, duration, commission",
              ]}
            />

            <FeatureCard
              icon={TrendingUp}
              title="Calendar + monthly heatmap"
              description="See daily and monthly P&L patterns at a glance."
              bullets={[
                "Daily P&L color-coded (green profitable, red losing)",
                "Month-over-month comparison — are recent months in line?",
                "Year-over-year drawdown seasonality",
                "Downloadable as an image for your trade journal",
              ]}
            />
          </div>
        </section>

        {/* Email examples */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-2">
              <Mail className="h-7 w-7 text-primary" />
              What a signal email looks like
            </h2>
            <p className="text-muted-foreground">
              Here are the exact templates we send — nothing more, nothing
              less.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <Badge className="w-fit" variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  Entry signal
                </Badge>
                <CardTitle className="text-base font-mono mt-2">
                  {sampleEntryEmail.subject}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  From: {sampleEntryEmail.from}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/30 rounded-md p-4 leading-relaxed">
                  {sampleEntryEmail.body}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Badge className="w-fit" variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  Exit signal
                </Badge>
                <CardTitle className="text-base font-mono mt-2">
                  {sampleExitEmail.subject}
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  From: {sampleExitEmail.from}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs font-mono bg-muted/30 rounded-md p-4 leading-relaxed">
                  {sampleExitEmail.body}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6 pb-6 flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Safety: we rate-limit your inbox</p>
                <p className="text-muted-foreground">
                  Max 3 emails per 5-minute window per subject. If the
                  upstream signal retries or hiccups, you'll never get 5
                  emails for the same trade — there's a central guard
                  with a 60-second signal-fingerprint dedupe and a
                  one-flip kill switch we can hit if anything looks
                  wrong.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Typical day */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">
              What a typical trading day looks like
            </h2>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">09:30 ET — Market open</p>
                  <p className="text-sm text-muted-foreground">
                    Dashboard stats reset for the new session. Strategies
                    begin monitoring NQ price action.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">
                    09:35–15:00 ET — Signals fire as conditions match
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Average is ~1–3 trades per day across the NQ Trend
                    strategy. You get an email within seconds of each
                    entry and exit. Dashboard updates in real-time too
                    (no refresh needed).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">
                    16:00 ET — Session close, daily recap
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Calendar tile for today turns green or red. Month-to-date
                    P&L updates. If you opted in, a short digest email
                    summarizes today's trades.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-4 py-8">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Ready to see it live?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The dashboard is public — open it and poke around. If you
            like what you see, $50/month gets you email alerts and full
            trade log access.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button asChild size="lg">
              <Link href="/pricing">Subscribe — $50/month</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/overview">Open Live Dashboard</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/faq">Read FAQ</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-4">
            Cancel anytime. No hidden fees. Trading futures involves
            substantial risk of loss; past performance is not indicative
            of future results.
          </p>
        </section>
      </div>
    </>
  );
}
