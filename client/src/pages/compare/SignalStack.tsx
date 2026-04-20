import { ComparePage } from "../ComparePage";

export default function CompareSignalStack() {
  return (
    <ComparePage
      competitorName="SignalStack"
      competitorSlug="signalstack"
      competitorUrl="https://signalstack.com"
      oneLiner="a signal-routing platform that connects webhook alerts (often from TradingView) to brokerage execution. SignalStack does not generate signals itself — you bring the strategy."
      summary="SignalStack and STS Futures are different categories of product: SignalStack is execution infrastructure, STS Futures is a signal source with its own dashboard and backtest. The two can be combined, but if you don't already have a proven strategy, SignalStack won't give you one."
      rows={[
        { feature: "Generates trading signals", sts: true, competitor: false, note: "SignalStack routes YOUR signals to a broker" },
        { feature: "Published 15-year backtest", sts: true, competitor: false },
        { feature: "Web dashboard with live equity curve", sts: true, competitor: "Routing logs only" },
        { feature: "Real-time email alerts", sts: true, competitor: "Trade execution confirmations only" },
        { feature: "Broker OAuth (IBKR/Tradovate/TradeStation)", sts: true, competitor: true },
        { feature: "Pricing model", sts: "$50/mo flat", competitor: "$27-$289/mo based on usage" },
        { feature: "Transparent rules / methodology", sts: true, competitor: "N/A (no strategy)" },
        { feature: "Scope", sts: "NQ futures only", competitor: "Any market/asset" },
        { feature: "Best for", sts: "Traders who want systematic NQ signals ready to execute", competitor: "Traders who already have a strategy and need broker automation" },
      ]}
      faqs={[
        {
          q: "Can I use STS Futures with SignalStack?",
          a: "Yes. You could subscribe to STS Futures for the signals and use SignalStack to route execution to your broker. However, STS Futures already has native OAuth connections to IBKR, Tradovate, and TradeStation — most subscribers find the built-in execution sufficient and skip the extra SignalStack layer and cost.",
        },
        {
          q: "Does SignalStack generate NQ signals?",
          a: "No. SignalStack is a routing layer — it forwards webhook alerts you create (typically from TradingView or another source) to your broker for execution. You need to supply the strategy. STS Futures provides the strategy itself with a 15-year public backtest.",
        },
        {
          q: "Which is cheaper?",
          a: "STS Futures is $50/month flat. SignalStack's pricing scales with usage (trade volume, number of strategies, tier of features) from ~$27 to $289+/month. If you're trading more than one or two strategies through SignalStack, it typically costs more than a full STS subscription.",
        },
        {
          q: "Can STS Futures signals be auto-routed to any broker?",
          a: "STS has direct OAuth integrations with Interactive Brokers, Tradovate, and TradeStation. For other brokers (Amp, NinjaTrader, Optimus, etc.) subscribers execute manually from the dashboard alerts — which takes about 15 seconds per trade.",
        },
      ]}
    />
  );
}
