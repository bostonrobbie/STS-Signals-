import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import {
  CompetitorComparison,
  type ComparisonRow,
  type WhenToPick,
  type CompetitorFAQ,
} from "@/components/CompetitorComparison";

const rows: ComparisonRow[] = [
  {
    dimension: "Type of service",
    sts: {
      verdict: "yes",
      detail:
        "Pure signal service — we don't sell you brokerage or take custody of funds.",
    },
    competitor: {
      verdict: "yes",
      detail:
        "Full-service futures broker that also distributes third-party systematic products.",
    },
  },
  {
    dimension: "Monthly cost",
    sts: {
      verdict: "yes",
      detail: "$50/month flat for signal access. Cancel anytime.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Varies widely by product — some free to clients, others $100–$300/mo. Brokerage commissions charged per contract.",
    },
  },
  {
    dimension: "Broker flexibility",
    sts: {
      verdict: "yes",
      detail:
        "Your choice — NinjaTrader, Interactive Brokers, Tradovate, TradeStation, etc.",
    },
    competitor: {
      verdict: "no",
      detail:
        "Account must be at Cannon (or a Cannon partner) to use their bundled products.",
    },
  },
  {
    dimension: "Strategy transparency",
    sts: {
      verdict: "yes",
      detail:
        "Every historical trade visible in the dashboard. Rules documented. 15+ years of backtest data downloadable.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Depends on the specific product. Some are open about methodology; others are black-box.",
    },
  },
  {
    dimension: "Account minimum",
    sts: {
      verdict: "yes",
      detail:
        "None from us — the futures broker sets the minimum (usually $500 for MNQ, $5k+ for NQ).",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Brokerage account required at Cannon (~$500 for micro, higher for E-mini). Some bundled products require $10k+.",
    },
  },
  {
    dimension: "You place the trades",
    sts: {
      verdict: "yes",
      detail:
        "Yes — you're in control of every trade. Signals are instructions, not auto-execution.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Varies — some are auto-executed on your Cannon account (check the specific product).",
    },
  },
  {
    dimension: "Conflict of interest",
    sts: {
      verdict: "yes",
      detail:
        "We don't profit from your commissions or spreads — only from the flat subscription.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Broker earns commission per trade. A higher-frequency product makes them more money on execution.",
    },
  },
  {
    dimension: "Instrument coverage",
    sts: {
      verdict: "partial",
      detail:
        "NQ (E-mini Nasdaq) only. Micro NQ (MNQ) works on the same signals.",
    },
    competitor: {
      verdict: "yes",
      detail:
        "Full futures spectrum — NQ, ES, CL, GC, ZB, ZN, softs, agriculture, etc.",
    },
  },
  {
    dimension: "Switch-out cost",
    sts: {
      verdict: "yes",
      detail:
        "Cancel anytime, keep your broker account. Past signals remain accessible in read-only mode.",
    },
    competitor: {
      verdict: "partial",
      detail:
        "Switching brokers requires an ACAT transfer — couple weeks, potential fees, possible tax-year timing issues.",
    },
  },
];

const whenToPickSTS: WhenToPick = {
  heading: "Pick STS Futures when…",
  bullets: [
    "You want to keep your existing broker and just add a systematic NQ signal",
    "You trade NQ (or MNQ) specifically — a focused algo beats a generalist",
    "You want fully-transparent trade history before committing",
    "You value the separation: your broker does execution, we do signals",
    "You want a fixed $50/mo cost — no per-trade surprises",
  ],
};

const whenToPickCannon: WhenToPick = {
  heading: "Pick Cannon Trading when…",
  bullets: [
    "You want one relationship that covers brokerage AND signals",
    "You trade multiple futures products beyond NQ (ES, CL, GC, etc.)",
    "You need hand-holding from a licensed broker rep, not just a dashboard",
    "You're comfortable with commission-based pricing and auto-executed products",
    "You prioritize broad futures coverage over depth in any one instrument",
  ],
};

const faqs: CompetitorFAQ[] = [
  {
    question: "Can I use STS signals on a Cannon Trading account?",
    answer:
      "Yes. STS signals are broker-agnostic — they're delivered to you via dashboard + email, and you place the trades on whatever account you choose. A Cannon account is perfectly valid; so is NinjaTrader, Interactive Brokers, TradeStation, Tradovate, or any other futures broker.",
  },
  {
    question: "Does STS take custody of my funds?",
    answer:
      "No. STS is a software subscription — we never touch your brokerage account, never hold your money, never execute trades for you. Cannon is a licensed broker that does hold funds. If you want the separation between signal source and money custodian, STS + your broker of choice gives you that.",
  },
  {
    question:
      "Cannon has many NQ systematic products. Why pick STS over one of those?",
    answer:
      "Honest answer: if one of Cannon's bundled NQ products fits your style and you're already a Cannon client, using it can be simpler than adding an external subscription. STS wins when you want (a) broker flexibility, (b) fully-visible trade history, or (c) to avoid the broker's commission incentive influencing signal quality.",
  },
  {
    question: "Can I run both at once?",
    answer:
      "Technically yes — but running two NQ systems on the same account can blow through margin and daily loss limits. If you want to experiment, paper-trade one or size both down dramatically until you know how they interact.",
  },
];

export default function StsVsCannon() {
  return (
    <>
      <SEOHead {...SEO_CONFIG.vsCannon} />
      <CompetitorComparison
        competitorName="Cannon Trading"
        competitorTagline="Full-service futures broker with bundled systematic products"
        heroDescription="STS Futures is a pure signal service: we send you entries and exits, you execute on your broker of choice. Cannon Trading is a futures broker that also distributes third-party systematic products — you trade through them. The choice depends on whether you want broker flexibility or a single-vendor relationship."
        rows={rows}
        whenToPickSTS={whenToPickSTS}
        whenToPickCompetitor={whenToPickCannon}
        faqs={faqs}
        competitorUrl="https://www.cannontrading.com"
      />
    </>
  );
}
