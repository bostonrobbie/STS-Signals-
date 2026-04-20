import { ComparePage } from "../ComparePage";

export default function CompareTradersPost() {
  return (
    <ComparePage
      competitorName="TradersPost"
      competitorSlug="traderspost"
      competitorUrl="https://traderspost.io"
      oneLiner="a webhook-to-broker automation platform. Like SignalStack, TradersPost routes signals you generate elsewhere (typically TradingView, your own scripts, or third-party signal services) into automated broker execution."
      summary="TradersPost is an execution automation layer — it does not generate signals. STS Futures is a signal source with its own systematic strategy and 15-year backtest. A subscriber could in theory use TradersPost to route STS Futures signals, but STS Futures's built-in broker OAuth already does that natively."
      rows={[
        { feature: "Generates trading signals", sts: true, competitor: false },
        { feature: "Published 15-year backtest", sts: true, competitor: false },
        { feature: "Signal dashboard with analytics", sts: true, competitor: "Routing/execution logs" },
        { feature: "Sharpe/Sortino/Calmar metrics", sts: true, competitor: false },
        { feature: "Equity curve visualization", sts: true, competitor: "Basic P&L only" },
        { feature: "Monthly/yearly P&L calendar", sts: true, competitor: false },
        { feature: "Real-time email notifications", sts: true, competitor: "Execution-only" },
        { feature: "Broker OAuth support", sts: true, competitor: true, note: "Both support IBKR, Tradovate, TradeStation" },
        { feature: "Pricing model", sts: "$50/mo flat", competitor: "$49-$299/mo tiered by feature set" },
        { feature: "Scope", sts: "NQ futures only", competitor: "Any market/asset" },
        { feature: "Best for", sts: "Traders who want NQ signals with a verified edge", competitor: "Traders who need to automate their own existing strategy" },
      ]}
      faqs={[
        {
          q: "How is TradersPost different from a signal service?",
          a: "TradersPost doesn't tell you what to trade — you supply the strategy (usually via a TradingView alert or your own webhook). It then executes that signal in your broker automatically. STS Futures provides the strategy itself, with signals you can execute via our built-in broker connections or copy manually.",
        },
        {
          q: "Can I use TradersPost to auto-trade STS Futures signals?",
          a: "You could forward STS signals to TradersPost via a webhook bridge, but STS Futures already has native OAuth connections to IBKR, Tradovate, and TradeStation. That direct integration is included in the $50/month subscription; adding TradersPost on top adds another layer of cost and complexity without adding functionality.",
        },
        {
          q: "Which platform has a better backtest?",
          a: "STS Futures publishes the full 15-year trade-by-trade record (7,960 trades, every entry/exit timestamped) inside the subscriber dashboard. TradersPost doesn't publish a backtest because it's not a strategy — it's an execution layer for strategies you bring.",
        },
        {
          q: "What's the total cost to actually trade NQ signals?",
          a: "With STS Futures alone: $50/month + your broker's futures commissions. With TradersPost + a separate signal source: $49-$299/month for TradersPost + a signal source cost + broker commissions. STS is usually the simpler and cheaper path if NQ is your focus.",
        },
      ]}
    />
  );
}
