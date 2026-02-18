import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  Target,
  Activity,
  Scale,
  Zap,
  Shield,
  PieChart,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface PortfolioMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
}

interface AllocationEntry {
  name: string;
  value: number;
  color: string;
}

interface PortfolioPerformanceCenterProps {
  stats:
    | {
        totalSubscriptions: number;
        activeStrategies?: number;
        totalSignalsReceived?: number;
        pendingSignals?: number;
        signalsExecuted: number;
        signalsSkipped: number;
      }
    | null
    | undefined;
  portfolioData: {
    metrics: PortfolioMetrics | null;
  };
  allocationData: AllocationEntry[];
  startingCapital: number;
}

// Rating helper
const getRating = (
  value: number,
  thresholds: { excellent: number; good: number }
) => {
  if (value >= thresholds.excellent)
    return { label: "Excellent", color: "text-emerald-400" };
  if (value >= thresholds.good)
    return { label: "Good", color: "text-amber-400" };
  return { label: "Poor", color: "text-rose-400" };
};

export function PortfolioPerformanceCenter({
  stats,
  portfolioData,
  allocationData,
  startingCapital,
}: PortfolioPerformanceCenterProps) {
  const metrics = portfolioData.metrics;

  // Calculate derived metrics
  const expectancy = metrics
    ? (metrics.avgWin * metrics.winRate) / 100 -
      (Math.abs(metrics.avgLoss) * (100 - metrics.winRate)) / 100
    : 0;

  const payoffRatio = metrics?.avgLoss
    ? metrics.avgWin / Math.abs(metrics.avgLoss)
    : 0;

  const volatility = metrics?.sharpeRatio
    ? (metrics.annualizedReturn || 10) / metrics.sharpeRatio
    : 0;

  const recoveryFactor = metrics?.maxDrawdown
    ? metrics.totalReturn / Math.abs(metrics.maxDrawdown)
    : 0;

  const winningTrades = metrics
    ? Math.round((metrics.totalTrades * metrics.winRate) / 100)
    : 0;

  const losingTrades = metrics
    ? Math.round((metrics.totalTrades * (100 - metrics.winRate)) / 100)
    : 0;

  const yearsOfData = new Date().getFullYear() - 2010 || 1;
  const tradesPerYear = metrics
    ? Math.round(metrics.totalTrades / yearsOfData)
    : 0;

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border-emerald-500/20 shadow-lg shadow-emerald-500/5">
      <CardHeader className="pb-4 border-b border-emerald-500/10">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="p-2 bg-emerald-500/15 rounded-lg">
            <Activity className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-white">Portfolio Performance Center</span>
            <p className="text-xs font-normal text-emerald-400/60 mt-0.5">
              Institutional-Grade Analytics
            </p>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Activity Stats Row - Unified emerald/teal theme */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ActivityStat
            icon={BarChart3}
            label="Subscriptions"
            value={stats?.totalSubscriptions || 0}
            variant="primary"
          />
          <ActivityStat
            icon={Clock}
            label="Pending"
            value={(stats as any)?.pendingSignals || 0}
            variant="secondary"
          />
          <ActivityStat
            icon={CheckCircle2}
            label="Executed"
            value={stats?.signalsExecuted || 0}
            variant="success"
          />
          <ActivityStat
            icon={XCircle}
            label="Skipped"
            value={stats?.signalsSkipped || 0}
            variant="muted"
          />
        </div>

        {/* Key Performance Indicators - Clean uniform cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            icon={TrendingUp}
            label="Total Return"
            value={`+${(metrics?.totalReturn || 0).toFixed(2)}%`}
            subValue={`$${(((metrics?.totalReturn || 0) * startingCapital) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            variant="positive"
          />
          <KPICard
            icon={Activity}
            label="Annualized"
            value={`+${(metrics?.annualizedReturn || 0).toFixed(2)}%`}
            subValue={`$${(((metrics?.annualizedReturn || 0) * startingCapital) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr`}
            variant="primary"
          />
          <KPICard
            icon={Scale}
            label="Avg Trade"
            value={`$${expectancy.toFixed(2)}`}
            subValue="Expectancy"
            variant={expectancy >= 0 ? "positive" : "negative"}
          />
          <KPICard
            icon={TrendingDown}
            label="Max Drawdown"
            value={`${(metrics?.maxDrawdown || 0).toFixed(2)}%`}
            subValue={`-$${(((metrics?.maxDrawdown || 0) * startingCapital) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            variant="negative"
          />
          <KPICard
            icon={Target}
            label="Win Rate"
            value={`${(metrics?.winRate || 0).toFixed(1)}%`}
            subValue={`${(metrics?.totalTrades || 0).toLocaleString()} trades`}
            variant="secondary"
          />
          <KPICard
            icon={Zap}
            label="Profit Factor"
            value={(metrics?.profitFactor || 0).toFixed(2)}
            subValue="Gross P/L"
            variant="accent"
          />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Strategy Allocation */}
          <div className="space-y-4">
            <SectionHeader icon={PieChart} title="Strategy Allocation" />
            <div className="bg-slate-800/30 rounded-xl p-4 border border-emerald-500/10">
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={4}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [
                        `${((value / allocationData.reduce((s, d) => s + d.value, 0)) * 100).toFixed(0)}%`,
                        "Allocation",
                      ]}
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        border: "1px solid rgba(16, 185, 129, 0.2)",
                        borderRadius: "8px",
                        padding: "8px 12px",
                      }}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {allocationData.map((entry, index) => {
                  const total = allocationData.reduce((s, d) => s + d.value, 0);
                  const percent = ((entry.value / total) * 100).toFixed(0);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs hover:bg-slate-700/30 rounded px-2 py-1 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span
                        className="truncate flex-1 text-slate-300"
                        title={entry.name}
                      >
                        {entry.name}
                      </span>
                      <span className="text-emerald-400 font-medium tabular-nums">
                        {percent}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Core Metrics */}
          <div className="space-y-4">
            <SectionHeader icon={BarChart3} title="Core Metrics" />
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Avg Win"
                  value={`$${(metrics?.avgWin || 0).toFixed(2)}`}
                  subValue={`+${(((metrics?.avgWin || 0) / startingCapital) * 100).toFixed(3)}%`}
                  variant="positive"
                />
                <MetricCard
                  label="Avg Loss"
                  value={`-$${Math.abs(metrics?.avgLoss || 0).toFixed(2)}`}
                  subValue={`-${((Math.abs(metrics?.avgLoss || 0) / startingCapital) * 100).toFixed(3)}%`}
                  variant="negative"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Total Trades"
                  value={(metrics?.totalTrades || 0).toLocaleString()}
                  subValue={`${tradesPerYear}/yr avg`}
                  variant="neutral"
                />
                <MetricCard
                  label="Ann. Return"
                  value={`${(metrics?.annualizedReturn || 0).toFixed(2)}%`}
                  subValue="CAGR"
                  variant="primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="Winning"
                  value={winningTrades.toLocaleString()}
                  subValue={`${(metrics?.winRate || 0).toFixed(1)}% win rate`}
                  variant="positive"
                  size="sm"
                />
                <MetricCard
                  label="Losing"
                  value={losingTrades.toLocaleString()}
                  subValue={`${(100 - (metrics?.winRate || 0)).toFixed(1)}% loss rate`}
                  variant="negative"
                  size="sm"
                />
              </div>
              {/* Payoff Ratio Bar */}
              <div className="bg-slate-800/30 rounded-lg p-3 border border-emerald-500/10">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>Payoff Ratio</span>
                  <span className="font-semibold text-emerald-400 tabular-nums">
                    {payoffRatio.toFixed(2)}:1
                  </span>
                </div>
                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, payoffRatio * 33)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Risk-Adjusted Metrics */}
          <div className="space-y-4">
            <SectionHeader icon={Shield} title="Risk-Adjusted" />
            <div className="space-y-2.5">
              <RiskMetricRow
                label="Sharpe Ratio"
                description="Risk-adjusted return"
                value={metrics?.sharpeRatio || 0}
                format={v => v.toFixed(2)}
                thresholds={{ excellent: 1, good: 0.5 }}
              />
              <RiskMetricRow
                label="Sortino Ratio"
                description="Downside risk only"
                value={metrics?.sortinoRatio || 0}
                format={v => v.toFixed(2)}
                thresholds={{ excellent: 2, good: 1 }}
              />
              <RiskMetricRow
                label="Calmar Ratio"
                description="Return / Max DD"
                value={metrics?.calmarRatio || 0}
                format={v => v.toFixed(2)}
                thresholds={{ excellent: 1, good: 0.5 }}
              />
              <RiskMetricRow
                label="Volatility (Ann.)"
                description="Standard deviation"
                value={volatility}
                format={v => `${v.toFixed(1)}%`}
                thresholds={{ excellent: 100, good: 50 }} // Higher is worse, so reverse logic
                reverseColors
                suffix="Annual σ"
              />
              <RiskMetricRow
                label="Recovery Factor"
                description="Net P/L / Max DD"
                value={recoveryFactor}
                format={v => v.toFixed(2)}
                thresholds={{ excellent: 3, good: 1 }}
                suffix="Times recovered"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-components

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-emerald-400" />
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

function ActivityStat({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: any;
  label: string;
  value: number;
  variant: "primary" | "secondary" | "success" | "muted";
}) {
  const styles = {
    primary:
      "from-emerald-500/15 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
    secondary:
      "from-teal-500/15 to-teal-600/5 border-teal-500/20 text-teal-400",
    success:
      "from-emerald-500/15 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
    muted:
      "from-slate-500/10 to-slate-600/5 border-slate-500/15 text-slate-400",
  };

  const iconStyles = {
    primary: "bg-emerald-500/20 text-emerald-400",
    secondary: "bg-teal-500/20 text-teal-400",
    success: "bg-emerald-500/20 text-emerald-400",
    muted: "bg-slate-500/15 text-slate-400",
  };

  return (
    <div
      className={`bg-gradient-to-br ${styles[variant]} rounded-lg p-3 border flex items-center gap-3`}
    >
      <div className={`p-2 rounded-lg ${iconStyles[variant]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p
          className={`text-lg font-bold tabular-nums ${styles[variant].split(" ").pop()}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  subValue,
  variant,
}: {
  icon: any;
  label: string;
  value: string;
  subValue: string;
  variant: "positive" | "negative" | "primary" | "secondary" | "accent";
}) {
  const styles = {
    positive: "from-emerald-500/15 to-emerald-600/5 border-emerald-500/20",
    negative: "from-rose-500/15 to-rose-600/5 border-rose-500/20",
    primary: "from-emerald-500/12 to-teal-600/5 border-emerald-500/15",
    secondary: "from-teal-500/15 to-teal-600/5 border-teal-500/20",
    accent: "from-cyan-500/15 to-cyan-600/5 border-cyan-500/20",
  };

  const textColors = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    primary: "text-emerald-400",
    secondary: "text-teal-400",
    accent: "text-cyan-400",
  };

  const subColors = {
    positive: "text-emerald-300/60",
    negative: "text-rose-300/60",
    primary: "text-emerald-300/60",
    secondary: "text-teal-300/60",
    accent: "text-cyan-300/60",
  };

  return (
    <div
      className={`bg-gradient-to-br ${styles[variant]} rounded-lg p-3 border`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${textColors[variant]}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${textColors[variant]}`}>
        {value}
      </p>
      <p className={`text-xs ${subColors[variant]}`}>{subValue}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subValue,
  variant,
  size = "md",
}: {
  label: string;
  value: string;
  subValue: string;
  variant: "positive" | "negative" | "neutral" | "primary";
  size?: "sm" | "md";
}) {
  const styles = {
    positive: "from-emerald-500/15 to-emerald-600/5 border-emerald-500/15",
    negative: "from-rose-500/12 to-rose-600/5 border-rose-500/15",
    neutral: "from-slate-500/10 to-slate-600/5 border-slate-500/15",
    primary: "from-emerald-500/12 to-teal-600/5 border-emerald-500/15",
  };

  const textColors = {
    positive: "text-emerald-400",
    negative: "text-rose-400",
    neutral: "text-slate-200",
    primary: "text-emerald-400",
  };

  const subColors = {
    positive: "text-emerald-300/50",
    negative: "text-rose-300/50",
    neutral: "text-slate-400",
    primary: "text-emerald-300/50",
  };

  return (
    <div
      className={`bg-gradient-to-br ${styles[variant]} rounded-lg p-3 border`}
    >
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`${size === "sm" ? "text-base" : "text-lg"} font-bold tabular-nums ${textColors[variant]}`}
      >
        {value}
      </p>
      <p className={`text-xs ${subColors[variant]}`}>{subValue}</p>
    </div>
  );
}

function RiskMetricRow({
  label,
  description,
  value,
  format,
  thresholds,
  reverseColors = false,
  suffix,
}: {
  label: string;
  description: string;
  value: number;
  format: (v: number) => string;
  thresholds: { excellent: number; good: number };
  reverseColors?: boolean;
  suffix?: string;
}) {
  const rating = reverseColors
    ? { label: "", color: "text-teal-400" }
    : getRating(value, thresholds);

  return (
    <div className="flex justify-between items-center bg-slate-800/30 rounded-lg p-3 border border-emerald-500/10 hover:border-emerald-500/20 transition-colors">
      <div>
        <p className="text-xs text-slate-300 font-medium">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold tabular-nums ${rating.color}`}>
          {format(value)}
        </p>
        <p className="text-xs text-slate-500">{suffix || rating.label}</p>
      </div>
    </div>
  );
}

export default PortfolioPerformanceCenter;
