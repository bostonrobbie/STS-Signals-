/**
 * Risk Management guide — /guides/risk-management
 *
 * Long-form educational page (~2500 words). Targets evergreen SEO
 * intent: "NQ futures position sizing", "futures drawdown survival",
 * "1% rule futures", "NQ contract sizing".
 *
 * The strategy has historically shown ~51% max drawdown. Most
 * subscribers underestimate what that feels like in practice. This
 * page exists so they don't blow up an account because they sized
 * for the average instead of the worst case.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calculator,
  Shield,
  Target,
  TrendingDown,
  Users,
} from "lucide-react";

const sizingTable = [
  {
    account: "$5,000",
    riskPerTrade: "$50",
    contracts: "1 MNQ",
    notes:
      "Below ideal. Strategy can sometimes risk 2× this per trade — only acceptable if you can stomach a 60%+ account swing.",
  },
  {
    account: "$10,000",
    riskPerTrade: "$100",
    contracts: "1 MNQ",
    notes:
      "Workable. Plan for $5k+ drawdowns at the 51% historical max.",
  },
  {
    account: "$25,000",
    riskPerTrade: "$250",
    contracts: "2-3 MNQ",
    notes:
      "Comfortable. Drawdowns sting but don't disqualify you from continuing.",
  },
  {
    account: "$50,000",
    riskPerTrade: "$500",
    contracts: "1 NQ or 5 MNQ",
    notes:
      "Sweet spot for E-mini. NQ is $20/point so 1 contract = ~$50/tick risk.",
  },
  {
    account: "$100,000",
    riskPerTrade: "$1,000",
    contracts: "2 NQ",
    notes:
      "Headroom for the historical 51% drawdown without forced liquidation.",
  },
  {
    account: "$250,000+",
    riskPerTrade: "$2,500+",
    contracts: "5 NQ+",
    notes:
      "Diminishing returns above this. Consider diversifying signal sources or markets.",
  },
];

export default function RiskManagement() {
  return (
    <>
      <SEOHead {...SEO_CONFIG.riskManagementGuide} />

      <div className="container max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-8 sm:space-y-12">
        {/* Hero */}
        <header className="space-y-4">
          <Badge variant="outline" className="mb-2">
            <BookOpen className="h-3 w-3 mr-1" />
            Guide · ~10 minute read
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Risk management for NQ futures signals
          </h1>
          <p className="text-lg text-muted-foreground">
            How to size positions so a 51% historical drawdown is{" "}
            <em>annoying</em> instead of <em>ruinous</em>. Practical, with
            an account-size-to-contract table and worked examples.
          </p>
        </header>

        {/* TL;DR */}
        <Card className="bg-primary/5 border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              TL;DR — three rules that handle 90% of risk
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <strong>1.</strong> Risk no more than 1% of your account on
              any single trade. Compute the dollar amount, then size the
              contract count to match.
            </p>
            <p>
              <strong>2.</strong> Trade micros (MNQ) until your account
              clears $25k. The contract math is the same; the dollar
              consequences are 10× smaller while you're learning.
            </p>
            <p>
              <strong>3.</strong> Pre-commit to a drawdown threshold (e.g.
              "I'll halve my size if I'm down 20% from peak"). Decide
              before the drawdown arrives — never during.
            </p>
          </CardContent>
        </Card>

        {/* Why this matters */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            Why this matters
          </h2>
          <p>
            The NQ Trend strategy has a backtested return of approximately
            +1,085% over 15 years on a $10,000 starting account.
            Impressive. The same backtest also has a maximum drawdown of
            roughly 51% — meaning at the worst point in those 15 years,
            the equity curve was 51% below its previous peak.
          </p>
          <p>
            Most subscribers focus on the +1,085%. Almost nobody emotionally
            prepares for the 51%. That asymmetry is what blows accounts
            up: you size for the average outcome, then quit (or worse,
            double down) when you hit the worst case you didn't plan for.
          </p>
          <p>
            This guide assumes you want to still be trading the system in
            year 5. Position sizing is the only lever that decides whether
            you make it to year 5 or you don't.
          </p>
        </section>

        {/* The 1% rule */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            The 1% rule, in detail
          </h2>
          <p>
            The "1% rule" says: never risk more than 1% of your trading
            account on a single trade. With a $50,000 account, that's $500
            per trade. With $10,000, it's $100.
          </p>
          <p>
            "Risk per trade" means the dollar loss if the trade hits its
            stop. For NQ, the strategy doesn't use a fixed-tick stop;
            it exits when conditions reverse. To size by the 1% rule, you
            estimate the typical adverse excursion — how far against you
            the trade is likely to go before the strategy exits.
          </p>
          <p>
            Look at the dashboard's trade log. Sort by P&L ascending. The
            10th-percentile worst trade (one in ten) is a good proxy for
            "typical adverse excursion." That's your 1% number.
          </p>
          <p>
            Suppose the 10th-percentile loss is ~25 points on NQ (= $500
            per E-mini contract). At $500 risk, you can take 1 NQ contract
            per $50,000 of account — that's the 1% rule applied with the
            actual data.
          </p>
        </section>

        {/* Sizing table */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Account-size-to-contract sizing table
          </h2>
          <p>
            Practical defaults using the 1% rule and assuming a typical
            $250-per-trade risk profile (which matches the NQ Trend
            strategy's recent stop behavior). Adjust upward if your
            personal drawdown tolerance is higher than the 51%
            historical max.
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account size</TableHead>
                    <TableHead>1% risk</TableHead>
                    <TableHead>Contracts</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Notes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sizingTable.map(row => (
                    <TableRow key={row.account}>
                      <TableCell className="font-medium">
                        {row.account}
                      </TableCell>
                      <TableCell>{row.riskPerTrade}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.contracts}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {row.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            <em>
              MNQ = Micro Nasdaq-100, $2/point. NQ = E-mini Nasdaq-100,
              $20/point. Contract specifications and margin requirements
              are set by the CME, not by us — confirm with your broker.
            </em>
          </p>
        </section>

        {/* Drawdown psychology */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-destructive" />
            What 51% drawdown feels like
          </h2>
          <p>
            Numbers on a backtest are abstract. Living through the
            drawdown is not. To make it concrete:
          </p>
          <p>
            On a $50,000 account at the historical max drawdown, your
            equity drops to ~$24,500. That's not "down a bit" — that's
            <em> half your money</em>. It happens over a stretch of weeks
            or months, not a single day, but every losing trade in that
            window feels like the strategy is broken.
          </p>
          <p>
            The math says: a 51% drawdown requires a +104% gain to
            recover. If you halve your position size during the drawdown
            (a common emotional response), you double the time it takes
            to recover. If you pause trading entirely, you guarantee that
            you miss the recovery.
          </p>
          <p>
            The only way to handle a 51% drawdown calmly is to have sized
            so that 51% off your account is an amount you've already
            mentally written off. If you're sized so that 51% off would
            mean liquidating to pay rent, you're sized too big.
          </p>
        </section>

        {/* When to skip */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            When to skip a signal
          </h2>
          <p>
            The strategy fires; you don't have to take every fire. There
            are legitimate reasons to skip:
          </p>
          <ul className="space-y-2 list-disc list-outside ml-6">
            <li>
              <strong>You're at your daily-loss limit.</strong> Pre-commit
              to a "stop trading at –3R" rule. If you've already lost 3×
              your per-trade risk amount today, you're done. The strategy
              will fire again tomorrow.
            </li>
            <li>
              <strong>You can't watch the position.</strong> If you have
              a meeting, are driving, or otherwise can't react to the
              exit signal, skip the entry. Holding through unexpected
              moves without the ability to manage is worse than missing
              the trade.
            </li>
            <li>
              <strong>The market is in a known anomaly.</strong> FOMC
              announcements, NFP, CPI release windows. The strategy is
              backtested across all conditions, but binary news events
              can produce slippage that the backtest didn't model.
            </li>
            <li>
              <strong>You're trading on tilt.</strong> If you just lost
              two trades in a row and you feel tempted to "make it back"
              with a bigger size on the next entry, skip the next entry
              entirely. Tilt is the most expensive mistake in this
              business.
            </li>
          </ul>
          <p>
            Skipping a signal occasionally is fine. Skipping signals
            consistently because you don't trust the strategy is a
            different problem — at that point, either size down to where
            trust isn't an issue, or unsubscribe.
          </p>
        </section>

        {/* Stop-loss strategies */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Stop-loss strategies
          </h2>
          <p>
            The strategy generates exit signals automatically — that's the
            "official" stop. But you can layer additional stops for risk
            control:
          </p>
          <ul className="space-y-2 list-disc list-outside ml-6">
            <li>
              <strong>Hard catastrophic stop.</strong> A wide ($300+ on
              NQ) hard stop in your broker that protects against total
              system failure (signal doesn't fire, your internet dies,
              etc.). Set it once when you enter; never tighten.
            </li>
            <li>
              <strong>Time stop.</strong> If the trade hasn't hit either
              the strategy's exit or the catastrophic stop within X
              hours, exit anyway. Helps when conditions change but the
              algorithm hasn't caught up yet.
            </li>
            <li>
              <strong>Daily-loss stop.</strong> Account-level: if your
              daily P&L hits –$X, stop trading for the day. Prevents
              tilt-cascade losses.
            </li>
          </ul>
          <p>
            <em>
              Don't use a tighter stop than the strategy's natural exit.
              That's optimizing the system to your fear, not the data.
              The wide hard stop is insurance, not a primary exit.
            </em>
          </p>
        </section>

        {/* Worked example */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Worked example</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Trader with $25,000 account, 1% risk per trade
              </CardTitle>
              <CardDescription>
                Conservative end of the sizing table.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <p>
                <strong>Per-trade risk:</strong> 1% × $25,000 = $250.
              </p>
              <p>
                <strong>Contract choice:</strong> 2-3 MNQ. At ~$2/point ×
                ~50 points typical adverse excursion = ~$100/contract risk
                = 2-3 contracts fits the $250 budget.
              </p>
              <p>
                <strong>Daily-loss limit:</strong> $750 (3× per-trade
                risk). Hit that, stop for the day.
              </p>
              <p>
                <strong>Drawdown plan:</strong> If the account hits
                $20,000 (–20% from peak), drop to 1 MNQ per trade until
                it recovers above $22,500.
              </p>
              <p>
                <strong>If the historical 51% DD plays out:</strong>{" "}
                Account bottoms around $12,250. Painful but survivable.
                Subscriber keeps trading at 1 MNQ until equity recovers,
                then scales back up to 2-3.
              </p>
              <p className="text-muted-foreground italic">
                Note how almost everything is decided BEFORE the
                drawdown. The plan is what carries you through; the
                emotional response in the moment is just execution.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* What this guide doesn't cover */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">
            What this guide deliberately doesn't cover
          </h2>
          <ul className="space-y-2 list-disc list-outside ml-6">
            <li>
              <strong>Tax optimization.</strong> Talk to a CPA; futures
              are taxed under Section 1256 in the US (60/40 long/short
              term) but state rules vary.
            </li>
            <li>
              <strong>Specific broker order entry.</strong> Each broker
              is different — see your broker's docs. The signal email
              tells you what to enter; the broker decides how.
            </li>
            <li>
              <strong>Combining STS with other strategies.</strong>{" "}
              Possible but advanced. Account margin gets shared across
              positions; dial back size on each system if you stack.
            </li>
            <li>
              <strong>Margin call mechanics.</strong> Your broker will
              tell you their specific maintenance margin and what
              triggers a call. Avoid hitting it by sizing as above.
            </li>
          </ul>
        </section>

        {/* CTA */}
        <section className="text-center space-y-4 py-6 border-t">
          <h2 className="text-2xl font-bold">Next steps</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <Link href="/getting-started">
                Read Getting Started{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/preferences">Set Account Preferences</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/faq">Read FAQ</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-4 max-w-2xl mx-auto">
            This guide is educational, not personalized financial advice.
            Trading futures involves substantial risk of loss and is not
            suitable for all investors. Past performance is not indicative
            of future results. Consult a licensed financial advisor before
            making investment decisions.
          </p>
        </section>
      </div>
    </>
  );
}
