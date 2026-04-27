import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import {
  CompetitorComparison,
  type ComparisonRow,
  type WhenToPick,
  type CompetitorFAQ,
} from "@/components/CompetitorComparison";

const rows: ComparisonRow[] = [
  {
    dimension: "What you're buying",
    sts: {
      verdict: "yes",
      detail:
        "Systematic NQ futures signals — entries, exits, and the analytics to verify the strategy.",
    },
    competitor: {
      verdict: "yes",
      detail:
        "Access to trade a funded account after passing a challenge. You take 90% of profits on the account.",
    },
  },
  {
    dimension: "Monthly cost",
    sts: { verdict: "yes", detail: "$50/month flat. Cancel anytime." },
    competitor: {
      verdict: "partial",
      detail:
        "Tiered: $49–$549/mo depending on account size, plus a one-time challenge fee (~$165–$540).",
    },
  },
  {
    dimension: "Your own capital at risk",
    sts: {
      verdict: "yes",
      detail:
        "Yes — you trade your own brokerage account. You keep 100% of gains and carry 100% of losses.",
    },
    competitor: {
      verdict: "no",
      detail:
        "No — you trade Topstep's capital. You keep 90% of profits; losses don't hit your bank account beyond the subscription + challenge fees.",
    },
  },
  {
    dimension: "Signal provided",
    sts: {
      verdict: "yes",
      detail:
        "Yes — a specific NQ entry/exit algo with 15+ years of backtested history.",
    },
    competitor: {
      verdict: "no",
      detail:
        "No — Topstep doesn't provide signals. You need your own strategy to pass the challenge.",
    },
  },
  {
    dimension: "Broker",
    sts: {
      verdict: "yes",
      detail:
        "Any futures broker you already use (NinjaTrader, Interactive Brokers, Tradovate, TradeStation).",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Topstep's own platform. You trade on their software, not through a brokerage you own.",
    },
  },
  {
    dimension: "Time to start",
    sts: {
      verdict: "yes",
      detail:
        "Subscribe and you're in the dashboard today. First signal can fire within hours.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Days to weeks. You must pass a challenge (hit a profit target without violating risk rules) before getting a funded account.",
    },
  },
  {
    dimension: "Drawdown rules",
    sts: {
      verdict: "yes",
      detail:
        "You set your own stop-loss rules. Strategy's historical max drawdown is ~51% (visible on the dashboard).",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Strict — daily loss limits and overall drawdown limits. Violate them once and your account is revoked.",
    },
  },
  {
    dimension: "Upside cap",
    sts: {
      verdict: "yes",
      detail: "None. You keep everything you earn.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Topstep keeps 10% of profits. Account size is capped at the funded tier you passed.",
    },
  },
  {
    dimension: "Scales with capital",
    sts: {
      verdict: "yes",
      detail:
        "Position-size by your own capital. $10k or $500k — same signals, different contract count.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Buy a larger funded-account tier to trade bigger. You'll need to pass that larger challenge too.",
    },
  },
];

const whenToPickSTS: WhenToPick = {
  heading: "Pick STS Futures when…",
  bullets: [
    "You already have trading capital ($5k+) and want a verified strategy to apply to it",
    "You want full control — your broker, your risk rules, your position size",
    "You don't want to pass a challenge or live under prop-firm drawdown rules",
    "You want to see exactly what you're getting (15+ years of trades, risk metrics) before paying",
    "You want to keep 100% of profits, not 90%",
  ],
};

const whenToPickTopstep: WhenToPick = {
  heading: "Pick Topstep when…",
  bullets: [
    "You have your own trading strategy already — signals aren't what you're missing",
    "You don't have the capital to trade NQ meaningfully on your own account (margin requirements are ~$17k/contract)",
    "You're comfortable trading inside strict daily-loss and overall-drawdown rules",
    "You're OK giving up 10% of profits in exchange for access to larger capital",
    "You want to prove discipline for a while before risking your own money",
  ],
};

const faqs: CompetitorFAQ[] = [
  {
    question: "Can I use STS signals on a Topstep funded account?",
    answer:
      "In principle yes — our signals are just entry/exit instructions. But Topstep's rules (daily-loss, overall drawdown, time-in-position) may not align with the strategy's normal behavior, especially during the historical 51% max-drawdown periods. Test thoroughly before going live on a funded account.",
  },
  {
    question: "If I fail a Topstep challenge, can I fall back to STS?",
    answer:
      "Yes — they're independent. STS charges $50/mo regardless of what you do with the signals. Many subscribers started on prop firms, realized the drawdown rules didn't fit their trading style, and moved to trading STS signals on their own accounts.",
  },
  {
    question: "Which is cheaper over a year?",
    answer:
      "STS: $50 × 12 = $600/year flat. Topstep: challenge fees (~$165–$540) plus monthly subscription ($49–$549) — a $50k funded-account route runs ~$1,200–$2,500/year before profits. But if Topstep is the only way you can access trading capital, the comparison isn't apples-to-apples.",
  },
  {
    question: "Do I need programming knowledge for STS?",
    answer:
      "No. The algorithm runs on our side. You receive signals via dashboard + email and place the trades manually. If you want to automate execution, any futures broker with a webhook/API works.",
  },
];

export default function StsVsTopstep() {
  return (
    <>
      <SEOHead {...SEO_CONFIG.vsTopstep} />
      <CompetitorComparison
        competitorName="Topstep"
        competitorTagline="Funded-account challenge — trade firm capital"
        heroDescription="STS Futures is an NQ signal service: we tell you when to enter and exit, you execute on your own brokerage account. Topstep is a prop firm: you pass a challenge, then trade their capital and split profits. Different products for different situations — here's how to decide."
        rows={rows}
        whenToPickSTS={whenToPickSTS}
        whenToPickCompetitor={whenToPickTopstep}
        faqs={faqs}
        competitorUrl="https://www.topstep.com"
      />
    </>
  );
}
