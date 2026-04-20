import { ComparePage } from "../ComparePage";

export default function CompareGeneric() {
  return (
    <ComparePage
      competitorName="Discord-based signal services"
      competitorSlug="discord-signal-services"
      oneLiner="the general category of paid signal groups that post trade calls in a Discord server. Highly variable quality — some are reasonable, most have no published track record and rely on community testimonials."
      summary="The single biggest difference is transparency. A Discord signal service typically doesn't publish a verifiable backtest, doesn't publish trade-by-trade historical performance, and changes approach based on what the lead trader feels. STS Futures publishes every trade from 15 years of systematic rules, visible in the subscriber dashboard."
      rows={[
        { feature: "Published full trade history", sts: true, competitor: false },
        { feature: "Verified 15-year backtest", sts: true, competitor: false },
        { feature: "Rules-based (same every day)", sts: true, competitor: false, note: "Most Discord services are discretionary" },
        { feature: "Dashboard with equity curve + metrics", sts: true, competitor: false },
        { feature: "Signal delivery redundancy (dashboard + email)", sts: true, competitor: "Discord-only" },
        { feature: "Real-time latency under 500ms", sts: true, competitor: "Variable; depends on Discord delivery" },
        { feature: "Published win rate / Sharpe / drawdown", sts: true, competitor: false },
        { feature: "Single transparent price", sts: "$50/mo", competitor: "$100-500/mo typical, often with upsells" },
        { feature: "Upsell-free", sts: true, competitor: false, note: "Most have mentorship/course upsells" },
        { feature: "Cancel-anytime", sts: true, competitor: "Variable" },
        { feature: "Scope", sts: "NQ futures only", competitor: "Mixed" },
      ]}
      faqs={[
        {
          q: "Why should I trust STS Futures's backtest over a Discord service's testimonials?",
          a: "Testimonials are unverifiable and biased — you hear from people who had good experiences, never from the ones who lost money and left. STS Futures publishes every one of 7,960 historical trades with exact timestamps and prices, so you can compute the equity curve, Sharpe ratio, and max drawdown yourself without taking anyone's word for it.",
        },
        {
          q: "Are Discord signal services scams?",
          a: "Most aren't outright scams, but the combination of no published track record + discretionary calls + high subscription fees + mentorship upsells adds up to a structure that benefits the operator more than the subscriber. The ones that are good operators could pass our transparency bar — they just choose not to.",
        },
        {
          q: "Why doesn't STS Futures use Discord?",
          a: "Discord is unreliable for mission-critical signals: it goes down, notifications get buried, there's no audit trail, and signal timing can't be cryptographically verified. STS Futures publishes signals to a web dashboard with persistent websockets and simultaneous email delivery, so subscribers never miss a signal and can always verify exactly when each signal fired.",
        },
        {
          q: "Is $50/month really enough to make this sustainable for you?",
          a: "Yes. The work of building and maintaining a systematic strategy is done once, and the marginal cost of adding a subscriber is nearly zero. Most signal services charge $200-500/month because they're paying a human trader to make discretionary calls; STS runs on rules, so we don't have that overhead.",
        },
      ]}
    />
  );
}
