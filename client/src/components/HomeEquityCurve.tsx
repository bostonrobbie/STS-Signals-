import { useState, useMemo, useEffect, useRef } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type TimeRange = "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "ALL";

interface HomeEquityCurveProps {
  className?: string;
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export function HomeEquityCurve({ className = "" }: HomeEquityCurveProps) {
  const chartColors = useChartColors();
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  // @ts-expect-error TS6133 unused
  const _strategyFilter = "unleveraged"; // Locked to unleveraged strategy
  const [contractSize, setContractSize] = useState<"micro" | "mini">("mini");
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy load: only fetch data when component is visible
  useEffect(() => {
    // eslint-disable-next-line no-undef
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" } // Start loading 200px before visible
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Calculate contract multiplier based on size
  const contractMultiplier = contractSize === "micro" ? 0.1 : 1;
  const startingCapital = 100000; // Fixed $100K starting capital

  // Fetch public strategies list to get the correct strategy ID
  const { data: strategies } = trpc.publicApi.listStrategies.useQuery();

  // Get the strategy ID based on variant
  const strategyId = useMemo(() => {
    if (!strategies) return undefined;
    const symbol = "NQTrend"; // Always use unleveraged strategy
    const strategy = strategies.find(s => s.symbol === symbol);
    return strategy?.id;
  }, [strategies]);

  // Fetch public strategy detail with equity curve
  const { data, isLoading, error } = trpc.publicApi.strategyDetail.useQuery(
    {
      strategyId: strategyId!,
      timeRange,
      startingCapital,
      maxPoints: 200, // Request pre-sampled data from server
    },
    {
      enabled: !!strategyId && isVisible, // Only fetch when visible
      staleTime: 30 * 60 * 1000, // Cache for 30 minutes
    }
  );

  // DEBUG: Log data to see what's being returned
  console.log("[HomeEquityCurve] data:", data);
  console.log("[HomeEquityCurve] data?.metrics:", data?.metrics);
  console.log("[HomeEquityCurve] isLoading:", isLoading);
  console.log("[HomeEquityCurve] error:", error);

  // Prepare chart data for equity curve
  const chartData = useMemo(() => {
    if (!data?.equityCurve || data.equityCurve.length === 0) return [];

    const equity = data.equityCurve as EquityPoint[];
    const baseEquity = equity.length > 0 ? equity[0]!.equity : startingCapital;

    // Data is already sampled by server, no need for client-side sampling
    return equity.map((point: EquityPoint) => {
      // Calculate P&L from the base equity
      const pnl = point.equity - baseEquity;
      // Scale only the P&L portion by the contract multiplier
      const scaledEquity = startingCapital + pnl * contractMultiplier;

      return {
        date: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        fullDate: new Date(point.date).toLocaleDateString(),
        portfolio: scaledEquity,
        drawdown: point.drawdown, // Drawdown as percent
      };
    });
  }, [data?.equityCurve, contractMultiplier, startingCapital]);

  // Prepare underwater chart data (drawdown visualization)
  const underwaterData = useMemo(() => {
    if (!data?.equityCurve || data.equityCurve.length === 0) return [];

    const equity = data.equityCurve as EquityPoint[];

    // Data is already sampled by server, no need for client-side sampling
    return equity.map((point: EquityPoint) => ({
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      fullDate: new Date(point.date).toLocaleDateString(),
      drawdown: -Math.abs(point.drawdown), // Negative for underwater visualization
    }));
  }, [data?.equityCurve]);

  // Calculate metrics for display
  const metrics = useMemo(() => {
    if (!data?.metrics) return null;

    const totalReturn = data.metrics.totalReturn;

    // Calculate maxDrawdown from equity curve to ensure it matches underwater curve
    const maxDrawdown =
      data.equityCurve && data.equityCurve.length > 0
        ? Math.max(
            ...(data.equityCurve as EquityPoint[]).map(p =>
              Math.abs(p.drawdown)
            ),
            0
          )
        : data.metrics.maxDrawdown;
    const sharpeRatio = data.metrics.sharpeRatio;
    const sortinoRatio = data.metrics.sortinoRatio;
    const calmarRatio = data.metrics.calmarRatio || 0;
    const avgReturnPerYear = data.metrics.annualizedReturn;
    const winRate = data.metrics.winRate;
    const totalTrades = data.metrics.totalTrades;
    const profitFactor = data.metrics.profitFactor || 0;

    // Calculate dollar values based on contract size
    const totalReturnDollars =
      (totalReturn / 100) * startingCapital * contractMultiplier;
    const maxDrawdownDollars =
      (maxDrawdown / 100) * startingCapital * contractMultiplier;
    const annualizedReturnDollars =
      (avgReturnPerYear / 100) * startingCapital * contractMultiplier;

    // Calculate adjusted percentages for contract size
    const adjustedTotalReturnPct = (totalReturnDollars / startingCapital) * 100;
    const adjustedMaxDrawdownPct = (maxDrawdownDollars / startingCapital) * 100;

    return {
      totalReturn,
      totalReturnDollars,
      adjustedTotalReturnPct,
      avgReturnPerYear,
      annualizedReturnDollars,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDrawdown,
      maxDrawdownDollars,
      adjustedMaxDrawdownPct,
      winRate,
      totalTrades,
      profitFactor,
    };
  }, [data?.metrics, data?.equityCurve, contractMultiplier, startingCapital]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Unable to load equity curve data
      </div>
    );
  }

  const isLeveraged = false; // Always unleveraged

  return (
    <div ref={containerRef} className={`${className}`}>
      {/* Toggle Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
        {/* Strategy Mode Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Strategy:</span>
          {/* Strategy locked to Unleveraged */}
        </div>

        {/* Contract Size Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Contract Size:</span>
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${
                contractSize === "micro"
                  ? "bg-emerald-600 text-white"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setContractSize("micro")}
            >
              Micro
            </button>
            <button
              className={`px-3 py-1.5 text-sm transition-colors ${
                contractSize === "mini"
                  ? "bg-emerald-600 text-white"
                  : "bg-card text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => setContractSize("mini")}
            >
              Mini
            </button>
          </div>
        </div>

        {/* Time Range Buttons */}
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-muted-foreground mr-1" />
          {(["6M", "YTD", "1Y", "5Y", "10Y", "ALL"] as TimeRange[]).map(
            range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeRange === range
                    ? "bg-emerald-600 text-white"
                    : "bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {range}
              </button>
            )
          )}
        </div>
      </div>

      {/* Comprehensive Metrics Grid - Matching Overview Page */}
      {metrics && !isLoading && (
        <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-6">
          {/* Total Return */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2">
              Total Return
            </div>
            {isLeveraged ? (
              <>
                <div
                  className={`text-xs sm:text-base md:text-lg font-bold mb-1 ${
                    metrics.adjustedTotalReturnPct >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {metrics.adjustedTotalReturnPct >= 0 ? "+" : ""}
                  {metrics.adjustedTotalReturnPct.toFixed(1)}%
                </div>
                <div className="text-[8px] sm:text-[9px] text-muted-foreground">
                  {metrics.avgReturnPerYear.toFixed(0)}% annualized
                </div>
              </>
            ) : (
              <>
                <div
                  className={`text-xs sm:text-base md:text-lg font-bold mb-1 ${
                    metrics.totalReturnDollars >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {metrics.totalReturnDollars >= 0 ? "+" : ""}$
                  {(() => {
                    const value = Math.round(metrics.totalReturnDollars);
                    if (Math.abs(value) >= 1000000)
                      return (value / 1000000).toFixed(1) + "M";
                    if (Math.abs(value) >= 1000)
                      return (value / 1000).toFixed(1) + "K";
                    return value.toLocaleString();
                  })()}
                </div>
                <div className="text-[8px] sm:text-[9px] text-muted-foreground">
                  {metrics.adjustedTotalReturnPct.toFixed(1)}% (
                  {metrics.avgReturnPerYear.toFixed(0)}% ann.)
                </div>
              </>
            )}
          </div>

          {/* Max Drawdown */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2">
              Max Drawdown
            </div>
            <div className="text-xs sm:text-base md:text-lg font-bold mb-1 text-amber-400">
              -{metrics.maxDrawdown.toFixed(1)}%
            </div>
            <div className="text-[8px] sm:text-[9px] text-muted-foreground">
              peak to trough
            </div>
          </div>

          {/* Sortino Ratio */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2 flex items-center justify-center gap-1">
              <span>Sortino</span>
              <Badge
                variant="outline"
                className="text-[7px] sm:text-[8px] px-1 py-0 h-3 sm:h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              >
                Trade
              </Badge>
            </div>
            <div className="text-sm sm:text-lg md:text-xl font-bold mb-1 text-foreground">
              {metrics.sortinoRatio.toFixed(2)}
            </div>
            <div className="text-[8px] sm:text-[9px] text-muted-foreground">
              downside risk
            </div>
          </div>

          {/* Sharpe Ratio */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2 flex items-center justify-center gap-1">
              <span>Sharpe</span>
              <Badge
                variant="outline"
                className="text-[7px] sm:text-[8px] px-1 py-0 h-3 sm:h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
              >
                Trade
              </Badge>
            </div>
            <div className="text-sm sm:text-lg md:text-xl font-bold mb-1 text-foreground">
              {metrics.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-[8px] sm:text-[9px] text-muted-foreground">
              risk-adjusted
            </div>
          </div>

          {/* Calmar Ratio */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2">
              Calmar
            </div>
            <div className="text-sm sm:text-lg md:text-xl font-bold mb-1 text-foreground">
              {metrics.calmarRatio.toFixed(2)}
            </div>
            <div className="text-[8px] sm:text-[9px] text-muted-foreground">
              return/DD
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-card/50 border border-border rounded-lg p-2 sm:p-3 text-center overflow-hidden">
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 sm:mb-2">
              Win Rate
            </div>
            <div className="text-sm sm:text-lg md:text-xl font-bold mb-1 text-foreground">
              {metrics.winRate.toFixed(1)}%
            </div>
            <div className="text-[8px] sm:text-[9px] text-muted-foreground">
              {metrics.totalTrades} trades
            </div>
          </div>
        </div>
      )}

      {/* Main Equity Curve Chart */}
      <div className="bg-background/50 border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Equity Curve
            </h3>
            <p className="text-sm text-muted-foreground">
              Unleveraged (Fixed Contracts)
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">
              Starting Capital
            </div>
            <div className="text-lg font-semibold text-foreground">
              ${startingCapital.toLocaleString()}
            </div>
          </div>
        </div>

        {!isVisible ? (
          <div className="h-[300px] flex items-center justify-center bg-card/30 rounded-lg animate-pulse">
            <div className="text-muted-foreground text-sm">
              Loading chart...
            </div>
          </div>
        ) : isLoading || !chartData.length ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: chartColors.foreground, fontSize: 10 }}
                axisLine={{ stroke: chartColors.border }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: chartColors.foreground, fontSize: 10 }}
                axisLine={{ stroke: chartColors.border }}
                tickLine={false}
                tickFormatter={value => `$${(value / 1000).toFixed(0)}K`}
                domain={["dataMin - 10000", "dataMax + 10000"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                formatter={(value: number) => [
                  `$${value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}`,
                  "Portfolio Value",
                ]}
                labelFormatter={(label: string, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0]?.payload?.fullDate || label;
                  }
                  return label;
                }}
              />
              <ReferenceLine
                y={startingCapital}
                stroke="#6B7280"
                strokeDasharray="5 5"
                label={{
                  value: "Starting Capital",
                  fill: "#9CA3AF",
                  fontSize: 10,
                  position: "right",
                }}
              />
              <Line
                type="monotone"
                dataKey="portfolio"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#10B981",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Underwater Equity Curve (Drawdown Visualization) */}
      <div className="bg-background/50 border border-border rounded-xl p-4">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Underwater Equity Curve
          </h3>
          <p className="text-sm text-muted-foreground">
            Drawdown from peak over time
          </p>
        </div>

        {!isVisible ? (
          <div className="h-[200px] flex items-center justify-center bg-card/30 rounded-lg animate-pulse">
            <div className="text-muted-foreground text-sm">
              Loading chart...
            </div>
          </div>
        ) : isLoading || !underwaterData.length ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={underwaterData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#374151"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: chartColors.foreground, fontSize: 10 }}
                axisLine={{ stroke: chartColors.border }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: chartColors.foreground, fontSize: 10 }}
                axisLine={{ stroke: chartColors.border }}
                tickLine={false}
                tickFormatter={value => `${value.toFixed(0)}%`}
                domain={["dataMin", 0]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                formatter={(value: number) => [
                  `${Math.abs(value).toFixed(2)}%`,
                  "Drawdown",
                ]}
                labelFormatter={(label: string, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0]?.payload?.fullDate || label;
                  }
                  return label;
                }}
              />
              <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="5 5" />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
