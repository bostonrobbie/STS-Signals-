/**
 * Getting Started page — /getting-started
 *
 * The "what do I do after subscribing" walkthrough. Different from
 * /demo (which is for prospects deciding to subscribe) — this is for
 * subscribers in their first 24-48 hours who need to know what to do.
 *
 * SEO: targets "what to do after subscribing to STS Futures",
 * "first NQ futures signal", "futures signal service onboarding".
 */

import { Link } from "wouter";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Mail,
  Settings,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

interface StepProps {
  number: number;
  title: string;
  duration: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

function Step({ number, title, duration, icon: Icon, children }: StepProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                Step {number}
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {duration}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none">
        {children}
      </CardContent>
    </Card>
  );
}

export default function GettingStarted() {
  return (
    <>
      <SEOHead {...SEO_CONFIG.gettingStarted} />

      <div className="container max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Hero */}
        <section className="text-center space-y-4">
          <Badge variant="outline" className="mb-2">
            <Sparkles className="h-3 w-3 mr-1" />
            For new subscribers
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Your first week with STS Futures
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            A six-step walkthrough so you don't waste your first signal
            scrambling to figure out what to do. ~25 minutes total of setup
            spread across the first day.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild size="lg">
              <Link href="/overview">Open Live Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/preferences">Account Preferences</Link>
            </Button>
          </div>
        </section>

        {/* TL;DR */}
        <Card className="bg-primary/5 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              TL;DR — three things that actually matter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <li>
                <strong>Set your starting capital</strong> in Preferences
                so position-size suggestions match your account.
              </li>
              <li>
                <strong>Paper-trade the first 3-5 signals</strong> before
                placing real orders. Get comfortable with the workflow.
              </li>
              <li>
                <strong>Read the risk-management guide</strong> (linked at
                the bottom). The strategy has a 51% historical drawdown —
                size accordingly.
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Steps */}
        <section className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Six steps, ~25 minutes
          </h2>

          <Step
            number={1}
            title="Confirm your dashboard access"
            duration="2 min"
            icon={CheckCircle2}
          >
            <p>
              Open{" "}
              <Link
                href="/overview"
                className="text-primary underline underline-offset-2"
              >
                /overview
              </Link>{" "}
              and confirm you can see the equity curve, the trade log, and
              the calendar P&L heatmap. If anything doesn't render, that's
              a deployment problem — email{" "}
              <a
                href="mailto:support@stsfutures.com"
                className="text-primary underline underline-offset-2"
              >
                support@stsfutures.com
              </a>{" "}
              before going further.
            </p>
            <p>
              Bookmark the dashboard. You'll be back here multiple times a
              day during market hours.
            </p>
          </Step>

          <Step
            number={2}
            title="Configure your starting capital + contract size"
            duration="3 min"
            icon={Settings}
          >
            <p>
              Go to{" "}
              <Link
                href="/preferences"
                className="text-primary underline underline-offset-2"
              >
                /preferences
              </Link>{" "}
              and set:
            </p>
            <ul>
              <li>
                <strong>Starting capital</strong> — your actual trading
                account balance. The dashboard uses this to compute
                "1 contract per $X" position-size recommendations and
                projected dollar P&L on each trade.
              </li>
              <li>
                <strong>Contract size</strong> — pick <em>micro</em> (MNQ)
                if your account is under $25k. Pick <em>mini</em> (NQ) if
                you're trading $50k+. The signals are the same; only the
                multiplier differs (NQ = $20/point, MNQ = $2/point).
              </li>
            </ul>
            <p>
              These settings are stored on your account and applied
              everywhere on the dashboard.
            </p>
          </Step>

          <Step
            number={3}
            title="Configure email notification preferences"
            duration="2 min"
            icon={Bell}
          >
            <p>
              Open{" "}
              <Link
                href="/my-dashboard?tab=notifications"
                className="text-primary underline underline-offset-2"
              >
                Notifications
              </Link>{" "}
              and decide:
            </p>
            <ul>
              <li>
                <strong>Email on entry</strong> — recommended ON. You'll
                get an email the moment a signal fires so you can place
                the trade in your broker.
              </li>
              <li>
                <strong>Email on exit</strong> — recommended ON. Tells you
                P&L when the position closes so you know to flatten in
                your broker.
              </li>
              <li>
                <strong>Daily digest</strong> — optional. End-of-session
                summary email if you don't want intra-day pings but still
                want to know what happened.
              </li>
            </ul>
            <p>
              <em>
                Heads up: we rate-limit to 3 emails per 5-minute window per
                subject — you'll never get spammed if our retry queue
                hiccups.
              </em>
            </p>
          </Step>

          <Step
            number={4}
            title="Wait for your first signal — and don't trade it"
            duration="0–8 hours"
            icon={Clock}
          >
            <p>
              Average is ~1–3 NQ signals per trading day during regular
              market hours (09:30–16:00 ET). Your first signal might fire
              within an hour, or it might not come until tomorrow.
            </p>
            <p>
              <strong>When it does fire, don't place a real trade yet.</strong>{" "}
              Instead:
            </p>
            <ul>
              <li>Read the email. Note the entry price + direction.</li>
              <li>
                Open the dashboard. Confirm the same signal appears there.
              </li>
              <li>
                Track it as a <em>paper trade</em> in your trading journal
                (or just on paper). If you want, place a 1-micro order to
                test the workflow at minimal risk.
              </li>
              <li>
                Wait for the exit signal. Note the P&L. Confirm it matches
                what the dashboard shows.
              </li>
            </ul>
            <p>
              The point: get one full signal cycle under your belt before
              risking meaningful capital.
            </p>
          </Step>

          <Step
            number={5}
            title="Trade signals 2-5 with small size"
            duration="Days 2–5"
            icon={TrendingUp}
          >
            <p>
              Once paper trade #1 made sense, place real orders for the
              next 3-5 signals at <strong>small size</strong>. "Small" is
              relative — for most subscribers that's 1 micro contract
              (MNQ), even if their starting capital would support more.
            </p>
            <p>
              The goal isn't profit on these trades. The goal is:
            </p>
            <ul>
              <li>
                Build a habit of seeing the email and acting within
                ~30 seconds (signals are time-sensitive).
              </li>
              <li>
                Confirm your broker's order-entry flow works — keyboard
                shortcuts, default order type, slippage you actually pay.
              </li>
              <li>
                Get comfortable with the emotional side. Watching a 1-micro
                position go red is a good rehearsal for watching a 5-mini
                position go red later.
              </li>
            </ul>
          </Step>

          <Step
            number={6}
            title="Scale up only after a 5-trade win-rate check"
            duration="End of week 1"
            icon={Shield}
          >
            <p>
              After ~5 trades, look at your real-money P&L vs. what the
              dashboard shows for the same trades. They won't match exactly
              — your slippage, fills, and timing add a few ticks of
              friction per trade — but they should be close.
            </p>
            <p>
              If you're consistently 2+ ticks worse than the dashboard,
              there's a workflow issue: late entries, wrong order type,
              wrong contract. Fix that BEFORE adding size.
            </p>
            <p>
              When real fills track dashboard signals within a tick or two,
              you can scale up to your target position size based on the
              risk-management guide (linked at the bottom). Don't skip
              the risk piece.
            </p>
          </Step>
        </section>

        {/* Risk reminder */}
        <Card className="border-yellow-500/40 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Required reading: risk management
            </CardTitle>
            <CardDescription>
              The strategy has a +1,085% backtested return — but also a
              ~51% maximum historical drawdown. Position sizing is the
              difference between "ride out drawdowns" and "blow up your
              account during one."
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/guides/risk-management">
                Read the risk-management guide{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* What's next */}
        <section className="space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">After week 1</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Optional: enable daily digest
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Once you're confident in the workflow, you may not need
                every entry/exit email. Switch to the once-per-day digest
                to reduce inbox noise.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Track your slippage
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Average tick difference between dashboard fills and your
                actual fills. Above 1 tick consistently? Switch to limit
                orders or move closer to the open/close.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Subscribe to signal-fire push notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Browser push notifications fire instantly the moment a
                signal hits the dashboard — faster than email. Enable in
                Notifications.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Re-read the risk guide quarterly
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Drawdowns happen. The guide tells you how to size so a
                51%-strategy drawdown is "annoying" instead of "ruinous."
                Worth a re-read every quarter.
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 py-6">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to start?</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <Link href="/overview">Open Live Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/preferences">Set Preferences</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/faq">Read FAQ</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-4 max-w-2xl mx-auto">
            Trading futures involves substantial risk of loss and is not
            suitable for all investors. Past performance is not indicative
            of future results.
          </p>
        </section>
      </div>
    </>
  );
}
