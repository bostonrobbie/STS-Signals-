import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricTooltipProps {
  title: string;
  description: string;
  details?: string[];
}

export function MetricTooltip({ title, description, details }: MetricTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          <div className="space-y-2">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            {details && details.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 mt-2 border-t border-border pt-2">
                {details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-primary">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Pre-defined tooltips for common metrics
export const METRIC_TOOLTIPS = {
  sharpeDaily: {
    title: "Daily Sharpe Ratio (Industry Standard)",
    description: "Risk-adjusted return calculated using daily portfolio values. This is the standard method used by institutional investors and professional backtesting platforms.",
    details: [
      "Uses one data point per trading day",
      "Properly annualized with √252",
      "Comparable to benchmarks and other strategies",
    ],
  },
  sharpeTrade: {
    title: "Trade-Based Sharpe Ratio",
    description: "Calculated using returns between each trade close. Less accurate for comparison because the time between trades varies.",
    details: [
      "One data point per trade (irregular intervals)",
      "May understate or overstate true volatility",
      "Useful for trade-level analysis only",
    ],
  },
  sortinoDaily: {
    title: "Daily Sortino Ratio (Industry Standard)",
    description: "Like Sharpe, but only penalizes downside volatility. Uses daily returns for accurate risk measurement.",
    details: [
      "Only considers negative returns as risk",
      "Better for strategies with asymmetric returns",
      "Higher is better (less downside risk)",
    ],
  },
  maxDrawdown: {
    title: "Maximum Drawdown",
    description: "The largest peak-to-trough decline in portfolio value. Represents the worst-case loss you would have experienced.",
    details: [
      "Measured from highest equity point to lowest",
      "Critical for position sizing decisions",
      "Historical drawdown may be exceeded in future",
    ],
  },
  calmar: {
    title: "Calmar Ratio",
    description: "Annualized return divided by maximum drawdown. Measures return relative to the worst-case risk.",
    details: [
      "Higher values indicate better risk-adjusted returns",
      "Useful for comparing strategies with different drawdowns",
      "Values above 1.0 are generally considered good",
    ],
  },
  profitFactor: {
    title: "Profit Factor",
    description: "Total gross profit divided by total gross loss. Shows how much you win for every dollar you lose.",
    details: [
      "Values above 1.0 indicate profitability",
      "2.0+ is considered excellent",
      "Does not account for trade frequency",
    ],
  },
  winRate: {
    title: "Win Rate",
    description: "Percentage of trades that were profitable. Should be evaluated alongside average win/loss ratio.",
    details: [
      "High win rate doesn't guarantee profitability",
      "Must consider average win vs average loss size",
      "Trend-following often has lower win rates",
    ],
  },
};
