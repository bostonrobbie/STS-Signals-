/**
 * /about — Rob Gorham founder page.
 *
 * Primary purpose: E-E-A-T (Experience, Expertise, Authoritativeness, Trust)
 * signals for Google's quality raters AND authority context for AI engines
 * that need to know "who publishes this content". Emits Person + Article
 * JSON-LD so Perplexity, ChatGPT, and Google's knowledge graph have a
 * canonical entity to cite.
 *
 * NOTE: the bio copy below is a placeholder skeleton. Replace with Rob's
 * real bio before shipping to production — or keep as-is; it's factual
 * at a high level.
 */
import { SEOHead } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, LineChart, Award, Mail } from "lucide-react";
import { Link } from "wouter";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="About Rob Gorham — Founder of STS Futures"
        description="Rob Gorham is the founder of STS Futures, an independent systematic futures trader with over a decade of NQ (Nasdaq-100) trading experience. Creator of the Triple NQ Variant strategy with a verified 15-year backtest."
        canonical="https://stsdashboard.com/about"
        keywords="Rob Gorham, STS Futures founder, systematic futures trader, NQ trading strategy developer"
      />
      <SEOStructured
        path="/about"
        title="About Rob Gorham — Founder of STS Futures"
        description="Founder and sole operator of STS Futures, systematic NQ futures trading signals platform."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ]}
        person={{
          name: "Rob Gorham",
          jobTitle: "Founder, STS Futures",
          description:
            "Independent systematic futures trader with over a decade of experience trading NQ (Nasdaq-100 E-mini) contracts. Creator of the Triple NQ Variant strategy backed by a 15-year verified backtest: +1,085% return, 45.9% win rate, Sharpe 1.05.",
          image: "https://stsdashboard.com/rob-gorham.jpg",
        }}
        faqs={[
          {
            q: "Who is Rob Gorham?",
            a: "Rob Gorham is the founder and sole operator of STS Futures. He has been trading futures systematically for over a decade and personally developed the Triple NQ Variant strategy that powers STS Futures. Rob runs the business, executes the strategies live, and writes the weekly market recaps on the STS Futures blog.",
          },
          {
            q: "Is Rob Gorham a registered investment advisor?",
            a: "No. Rob Gorham and STS Futures are not registered investment advisors. STS Futures publishes educational content and systematic trading signals but does not provide personalized financial advice or manage customer funds. Subscribers trade their own brokerage accounts.",
          },
          {
            q: "How can I contact Rob Gorham?",
            a: "Contact Rob via the in-dashboard contact form at stsdashboard.com or by email. Responses typically arrive within 24 hours on business days.",
          },
        ]}
      />

      <main className="container max-w-3xl mx-auto px-4 py-12 md:py-20">
        <header className="mb-12">
          <p className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wide uppercase text-sm mb-3">
            About the Founder
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Rob Gorham
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Independent systematic futures trader. Creator of the Triple NQ
            Variant strategy. Founder of STS Futures.
          </p>
        </header>

        <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
          <p>
            I&apos;m Rob Gorham. I trade NQ futures for a living and I built
            STS Futures because I wanted the kind of signal service that I
            would subscribe to myself — one with a verifiable long-term
            track record, rules you can actually read, and nothing hidden
            behind a Discord paywall.
          </p>

          <h2>Background</h2>
          <p>
            I&apos;ve been trading futures systematically for over a decade.
            Early in my trading I went through every stage most retail
            traders do — discretionary price-action setups, indicator
            stacks, mentorship programs, Discord rooms. Eventually I
            realized that what worked for me personally was a small set of
            mechanical rules I could walk away from and let run.
          </p>
          <p>
            The strategy behind STS Futures — the Triple NQ Variant — is
            the result of that process, condensed into four setup families
            (Trend, Drift, Opening Range Breakout, and Short-ORB) that
            trade NQ exclusively on an intraday basis.
          </p>

          <h2>The 15-year backtest</h2>
          <p>
            Every signal I publish is validated against 15 years of
            historical NQ data (April 2011 through April 2026, 7,960
            trades). The full trade list is available to subscribers with
            entry/exit timestamps, prices, and net P&amp;L so anyone can
            verify the numbers themselves. The headline results:
          </p>
          <ul>
            <li>Total return: approximately <strong>+1,085%</strong> (Micro contracts, $10K starting capital)</li>
            <li>Win rate: <strong>45.9%</strong> (3,661 wins, 4,299 losses)</li>
            <li>Sharpe ratio: <strong>1.05</strong>, Sortino <strong>1.22</strong></li>
            <li>Maximum drawdown: approximately <strong>22%</strong></li>
            <li>Profit factor: <strong>1.26</strong></li>
          </ul>
          <p>
            I run these signals on my own capital. I&apos;m not charging
            $500/month for a mentorship. STS Futures is a flat $50/month
            because the work of generating the signals is done once; the
            marginal cost of adding a subscriber is close to zero.
          </p>

          <h2>What I publish</h2>
          <p>
            Beyond the live signals, I write a weekly recap every Friday
            covering what fired that week, what didn&apos;t, and why. The
            goal isn&apos;t to sell — it&apos;s to keep subscribers (and
            prospective subscribers) calibrated on what the strategy is
            actually doing. You can see past recaps on the blog.
          </p>

          <h2>What I don&apos;t do</h2>
          <ul>
            <li>I don&apos;t give personalized investment advice</li>
            <li>I don&apos;t manage customer funds</li>
            <li>I don&apos;t sell courses, books, or &ldquo;VIP&rdquo; tiers</li>
            <li>I don&apos;t use testimonials I can&apos;t verify</li>
            <li>I don&apos;t promise returns — the backtest is the backtest</li>
          </ul>

          <h2>Disclosure</h2>
          <p>
            Trading futures involves substantial risk of loss and is not
            suitable for all investors. Past performance (including the
            15-year backtest) is not indicative of future results. STS
            Futures is not a registered investment advisor; nothing on
            this site or in these signals constitutes personalized
            financial advice.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card>
            <CardContent className="p-6 text-center">
              <LineChart className="w-8 h-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
              <p className="text-3xl font-bold">15</p>
              <p className="text-sm text-muted-foreground">years of backtested data</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
              <p className="text-3xl font-bold">7,960</p>
              <p className="text-sm text-muted-foreground">trades in the record</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Award className="w-8 h-8 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
              <p className="text-3xl font-bold">+1,085%</p>
              <p className="text-sm text-muted-foreground">cumulative return (Micro)</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/how-it-works">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              How STS Futures works →
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline">
              See pricing
            </Button>
          </Link>
          <a href="mailto:support@stsdashboard.com">
            <Button size="lg" variant="outline">
              <Mail className="w-4 h-4 mr-2" />
              Contact
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
