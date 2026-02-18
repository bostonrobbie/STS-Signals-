import { useState } from "react";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  TrendingUp,
  ArrowRight,
  Zap,
  Fuel,
  Bitcoin,
  Coins,
  Landmark,
  Activity,
  Maximize2,
  X,
} from "lucide-react";
import { Link } from "wouter";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from "recharts";

type TimeRange = "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "ALL";

// Format large numbers with K/M suffix
const formatCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (absValue >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
};

const STRATEGY_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

export default function Strategies() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [hiddenStrategies, setHiddenStrategies] = useState<Set<string>>(
    new Set()
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    data: strategies,
    isLoading,
    error,
  } = trpc.portfolio.listStrategies.useQuery();
  // Get all strategies comparison datafor the chart
  const {
    data: comparisonData,
    isLoading: isLoadingComparison,
    error: comparisonError,
  } = trpc.portfolio.compareStrategies.useQuery(
    {
      strategyIds: strategies?.map(s => s.id) || [],
      timeRange: timeRange,
      startingCapital: 100000,
    },
    {
      enabled: !!strategies && strategies.length > 0,
      retry: false, // Don't retry on timeout
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // Build a map of strategy first/last trade dates from listStrategies data
  const strategyDateRanges: Record<
    string,
    { firstTradeDate: Date | null; lastTradeDate: Date | null }
  > = {};
  strategies?.forEach(strat => {
    const stratKey = strat.symbol || `strategy${strat.id}`;
    const firstDate = strat.firstTradeDate
      ? new Date(strat.firstTradeDate)
      : null;
    const lastDate = strat.lastTradeDate ? new Date(strat.lastTradeDate) : null;
    strategyDateRanges[stratKey] = {
      firstTradeDate: firstDate,
      lastTradeDate: lastDate,
    };
  });

  // Build chart data by collecting all unique dates from all strategies
  // and mapping each strategy's equity at each date
  const chartData = (() => {
    if (!comparisonData?.strategies?.length) return [];

    // Collect all unique dates from all strategies
    const allDatesSet = new Set<number>();
    comparisonData.strategies.forEach(strat => {
      strat.equityCurve?.forEach(point => {
        allDatesSet.add(new Date(point.date).getTime());
      });
    });

    // Sort dates
    const allDates = Array.from(allDatesSet).sort((a, b) => a - b);

    // Sample if too many points
    const sampleEvery =
      allDates.length > 500 ? Math.ceil(allDates.length / 500) : 1;
    const sampledDates = allDates.filter((_, i) => i % sampleEvery === 0);

    // Build equity lookup maps for each strategy (date timestamp -> equity)
    const equityMaps: Record<string, Map<number, number>> = {};
    comparisonData.strategies.forEach((strat, stratIndex) => {
      const stratKey = strat.symbol || `strategy${stratIndex}`;
      const map = new Map<number, number>();
      strat.equityCurve?.forEach(point => {
        map.set(new Date(point.date).getTime(), point.equity);
      });
      equityMaps[stratKey] = map;
    });

    // Track last known equity for forward-filling within valid range
    const lastKnownEquity: Record<string, number> = {};

    return sampledDates.map(dateTs => {
      const pointDate = new Date(dateTs);
      const point: any = {
        date: pointDate.toLocaleDateString(undefined, {
          month: "short",
          year: "2-digit",
        }),
        _dateTs: dateTs, // Keep for sorting/debugging
      };

      comparisonData.strategies.forEach((strat, stratIndex) => {
        const stratKey = strat.symbol || `strategy${stratIndex}`;
        const dateRange = strategyDateRanges[stratKey];

        // Don't plot before the strategy's first trade date or after the last trade date
        if (dateRange) {
          if (
            dateRange.firstTradeDate &&
            pointDate < dateRange.firstTradeDate
          ) {
            point[stratKey] = undefined;
            return;
          }
          if (dateRange.lastTradeDate && pointDate > dateRange.lastTradeDate) {
            point[stratKey] = undefined;
            return;
          }
        }

        const equityMap = equityMaps[stratKey];
        const equity = equityMap?.get(dateTs);

        if (equity !== undefined) {
          // Use actual equity value and update last known
          lastKnownEquity[stratKey] = equity;
          point[stratKey] = equity;
        } else if (lastKnownEquity[stratKey] !== undefined) {
          // Use last known equity value (only within valid range)
          point[stratKey] = lastKnownEquity[stratKey];
        } else {
          // No data yet, use undefined to not plot
          point[stratKey] = undefined;
        }
      });

      return point;
    });
  })();

  const toggleStrategy = (symbol: string) => {
    setHiddenStrategies(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Strategies
            </CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEOHead {...(SEO_CONFIG as any).strategies} />
      <div className="space-y-4 sm:space-y-6">
        <div className="px-1 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Trading Strategies
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View detailed performance for each intraday strategy
          </p>
        </div>

        {/* All Strategies Equity Chart - Mobile Optimized */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
              <div>
                <CardTitle className="text-base sm:text-lg">
                  All Strategies Performance
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Compare all strategy equity curves
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
                  onClick={() => setIsFullscreen(true)}
                  title="View fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <div className="flex-1 sm:w-[180px]">
                  <Label htmlFor="chart-time-range" className="sr-only">
                    Time Range
                  </Label>
                  <Select
                    value={timeRange}
                    onValueChange={v => setTimeRange(v as TimeRange)}
                  >
                    <SelectTrigger
                      id="chart-time-range"
                      className="h-9 sm:h-10"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YTD">Year to Date</SelectItem>
                      <SelectItem value="1Y">1 Year</SelectItem>
                      <SelectItem value="3Y">3 Years</SelectItem>
                      <SelectItem value="5Y">5 Years</SelectItem>
                      <SelectItem value="10Y">10 Years</SelectItem>
                      <SelectItem value="ALL">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingComparison ? (
              <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="ml-3 text-sm text-muted-foreground">
                  Loading comparison data...
                </p>
              </div>
            ) : comparisonError ? (
              <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                <p className="text-sm text-muted-foreground">
                  Unable to load comparison chart
                </p>
                <p className="text-xs text-muted-foreground">
                  View individual strategy details below
                </p>
              </div>
            ) : (
              <div className="min-w-0 overflow-visible">
                {/* Chart container with fixed height for chart area only */}
                <div className="h-[280px] sm:h-[320px] md:h-[380px] lg:h-[420px]">
                  <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 10, left: -5, bottom: 35 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--muted-foreground))"
                        strokeOpacity={0.2}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "#ffffff" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                        interval="preserveStartEnd"
                        tickCount={6}
                        padding={{ left: 10, right: 10 }}
                        label={{
                          value: "Date",
                          position: "insideBottom",
                          offset: -5,
                          fill: "#ffffff",
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        domain={["dataMin", "dataMax"]}
                        tick={{ fontSize: 9, fill: "#ffffff" }}
                        tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                        tickFormatter={value =>
                          `$${(value / 1000).toFixed(0)}k`
                        }
                        width={40}
                        allowDataOverflow={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "11px",
                          padding: "6px 10px",
                          maxWidth: "160px",
                        }}
                        itemStyle={{
                          padding: "1px 0",
                          fontSize: "10px",
                        }}
                        labelStyle={{
                          fontWeight: "bold",
                          marginBottom: "4px",
                          fontSize: "11px",
                        }}
                        formatter={(value: number, name: string) => {
                          // Abbreviate strategy names for compact display
                          const shortName = name
                            .replace(" Trend Following", "")
                            .replace(" Opening Range Breakout", " ORB")
                            .replace("Trend", "T")
                            .replace("Opening", "O");
                          return [`$${(value / 1000).toFixed(0)}k`, shortName];
                        }}
                        wrapperStyle={{ zIndex: 1000 }}
                      />
                      <Legend content={() => null} />
                      {comparisonData?.strategies.map((strat, index) => (
                        <Line
                          key={strat.id}
                          type="monotone"
                          dataKey={strat.symbol || `strategy${index}`}
                          stroke={
                            STRATEGY_COLORS[index % STRATEGY_COLORS.length]
                          }
                          strokeWidth={2}
                          dot={false}
                          name={
                            strat.name ||
                            strat.symbol ||
                            `Strategy ${index + 1}`
                          }
                          hide={hiddenStrategies.has(
                            strat.symbol || `strategy${index}`
                          )}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      ))}
                      <Brush
                        dataKey="date"
                        height={30}
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--background))"
                        tickFormatter={() => ""}
                        className="touch-manipulation"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend moved outside chart for better mobile layout */}
                <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 sm:gap-x-4 sm:gap-y-2 pt-3 pb-1 px-2">
                  {comparisonData?.strategies.map((strat, index) => {
                    const stratKey = strat.symbol || `strategy${index}`;
                    const isHidden = hiddenStrategies.has(stratKey);
                    return (
                      <button
                        key={`legend-${strat.id}`}
                        type="button"
                        className="flex items-center gap-1.5 cursor-pointer hover:opacity-70 active:scale-95 transition-all py-1 px-2 rounded hover:bg-white/5 touch-manipulation"
                        onClick={() => toggleStrategy(stratKey)}
                        style={{ opacity: isHidden ? 0.4 : 1 }}
                      >
                        <div
                          className="w-3 h-0.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              STRATEGY_COLORS[index % STRATEGY_COLORS.length],
                          }}
                        />
                        <span
                          className="text-[10px] sm:text-xs whitespace-nowrap"
                          style={{
                            textDecoration: isHidden ? "line-through" : "none",
                          }}
                        >
                          {strat.name ||
                            strat.symbol ||
                            `Strategy ${index + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategy Cards - Mobile Optimized */}
        <div className="px-1 sm:px-0">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
            Individual Strategies
          </h2>
        </div>
        <div className="grid gap-3 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {strategies?.map(strategy => {
            // Get market-specific icon
            const getMarketIcon = (market: string) => {
              const m = market.toLowerCase();
              if (m.includes("es") || m.includes("s&p")) return Activity;
              if (m.includes("nq") || m.includes("nasdaq")) return Zap;
              if (m.includes("cl") || m.includes("crude")) return Fuel;
              if (m.includes("btc") || m.includes("bitcoin")) return Bitcoin;
              if (m.includes("gc") || m.includes("gold")) return Coins;
              if (m.includes("ym") || m.includes("dow")) return Landmark;
              return TrendingUp;
            };

            const MarketIcon = getMarketIcon(strategy.market || "Unknown");

            return (
              <Card
                key={strategy.id}
                className="relative overflow-hidden hover:shadow-2xl transition-all duration-300 border hover:border-primary/40 group bg-card/40 backdrop-blur-sm h-full flex flex-col"
              >
                <CardHeader className="pb-3 sm:pb-4 px-3 sm:px-6 pt-3 sm:pt-6 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md group-hover:blur-lg transition-all"></div>
                          <div className="relative p-2 sm:p-2.5 bg-primary/15 rounded-xl group-hover:bg-primary/25 transition-all border border-primary/20">
                            <MarketIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-lg sm:text-xl leading-tight font-bold group-hover:text-primary transition-colors">
                            {strategy.name}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs font-bold text-primary bg-primary/15 px-2.5 py-1 rounded-full border border-primary/30">
                              {strategy.symbol}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              {strategy.strategyType}
                            </span>
                          </div>
                        </div>
                      </div>
                      <CardDescription className="text-sm mt-2">
                        {strategy.description ||
                          `${strategy.market} ${strategy.strategyType?.toLowerCase() || "trading"} strategy`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6 relative z-10 flex-1 flex flex-col">
                  {/* Performance Metrics Grid */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                    <div className="bg-blue-500/5 rounded-lg p-2.5 border border-border/40">
                      <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide font-semibold">
                        Return
                      </div>
                      <div className="text-sm font-bold text-blue-600 truncate">
                        {strategy.totalReturn !== undefined
                          ? formatCurrency(strategy.totalReturn)
                          : "N/A"}
                      </div>
                    </div>
                    <div className="bg-blue-500/5 rounded-lg p-2.5 border border-border/40">
                      <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide font-semibold">
                        Max DD
                      </div>
                      <div className="text-sm font-bold text-blue-600 truncate">
                        {strategy.maxDrawdown !== undefined
                          ? formatCurrency(Math.abs(strategy.maxDrawdown))
                          : "N/A"}
                      </div>
                    </div>
                    <div className="bg-blue-500/5 rounded-lg p-2.5 border border-border/40">
                      <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide font-semibold">
                        Sharpe
                      </div>
                      <div className="text-sm font-bold text-blue-600 truncate">
                        {strategy.sharpeRatio !== undefined
                          ? strategy.sharpeRatio.toFixed(2)
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  {/* Market & Type Info */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
                    <div className="bg-muted/10 rounded-lg p-2.5 border border-border/40">
                      <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide font-semibold">
                        Market
                      </div>
                      <div className="text-sm font-bold">{strategy.market}</div>
                    </div>
                    <div className="bg-muted/10 rounded-lg p-2.5 border border-border/40">
                      <div className="text-[9px] text-muted-foreground mb-0.5 uppercase tracking-wide font-semibold">
                        Type
                      </div>
                      <div className="text-sm font-bold">
                        {strategy.strategyType}
                      </div>
                    </div>
                  </div>

                  <Link href={`/strategy/${strategy.id}`} className="mt-auto">
                    <Button
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm group-hover:shadow-md"
                      variant="outline"
                    >
                      <span className="font-semibold">View Details</span>
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>

                  {/* Decorative gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Chart Modal - Optimized for Mobile */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Compact Header */}
          <div className="flex items-center justify-between px-3 py-2 sm:p-4 border-b bg-background/95 backdrop-blur-sm">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold truncate">
                All Strategies Performance
              </h2>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Pinch to zoom, drag to pan
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Select
                value={timeRange}
                onValueChange={v => setTimeRange(v as TimeRange)}
              >
                <SelectTrigger className="w-[100px] sm:w-[140px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YTD">Year to Date</SelectItem>
                  <SelectItem value="1Y">1 Year</SelectItem>
                  <SelectItem value="3Y">3 Years</SelectItem>
                  <SelectItem value="5Y">5 Years</SelectItem>
                  <SelectItem value="10Y">10 Years</SelectItem>
                  <SelectItem value="ALL">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsFullscreen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Chart takes maximum space */}
          <div className="flex-1 min-h-0 p-2 sm:p-4">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.2}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#ffffff" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  interval="preserveStartEnd"
                  tickCount={6}
                  padding={{ left: 5, right: 5 }}
                />
                <YAxis
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 10, fill: "#ffffff" }}
                  tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                  tickFormatter={value => `$${(value / 1000).toFixed(0)}k`}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "11px",
                    padding: "6px 10px",
                    maxWidth: "180px",
                  }}
                  itemStyle={{
                    padding: "1px 0",
                    fontSize: "10px",
                  }}
                  labelStyle={{
                    fontWeight: "bold",
                    marginBottom: "4px",
                    fontSize: "11px",
                  }}
                  formatter={(value: number, name: string) => {
                    // Abbreviate strategy names
                    const shortName = name
                      .replace(" Trend Following", "")
                      .replace(" Opening Range Breakout", " ORB")
                      .replace("Trend", "T")
                      .replace("Opening", "O");
                    return [`$${(value / 1000).toFixed(0)}k`, shortName];
                  }}
                  wrapperStyle={{ zIndex: 1000 }}
                />
                {/* No Legend inside chart - moved to footer */}
                {comparisonData?.strategies.map((strat, index) => (
                  <Line
                    key={`fs-${strat.id}`}
                    type="monotone"
                    dataKey={strat.symbol || `strategy${index}`}
                    stroke={STRATEGY_COLORS[index % STRATEGY_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={strat.name || strat.symbol || `Strategy ${index + 1}`}
                    hide={hiddenStrategies.has(
                      strat.symbol || `strategy${index}`
                    )}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                <Brush
                  dataKey="date"
                  height={30}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--background))"
                  tickFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend Footer - Horizontal scrollable on mobile */}
          <div className="border-t bg-background/95 backdrop-blur-sm px-2 py-2 sm:py-3">
            <div className="flex flex-wrap sm:flex-wrap justify-center gap-x-1 gap-y-1 sm:gap-x-3 sm:gap-y-2 max-h-[80px] sm:max-h-none overflow-y-auto">
              {comparisonData?.strategies.map((strat, index) => {
                const stratKey = strat.symbol || `strategy${index}`;
                const isHidden = hiddenStrategies.has(stratKey);
                return (
                  <button
                    key={`legend-fs-${strat.id}`}
                    type="button"
                    className="flex items-center gap-1 sm:gap-1.5 cursor-pointer hover:opacity-70 active:scale-95 transition-all py-1 px-1.5 sm:px-2 rounded hover:bg-white/5 touch-manipulation"
                    onClick={() => toggleStrategy(stratKey)}
                    style={{ opacity: isHidden ? 0.4 : 1 }}
                  >
                    <div
                      className="w-2.5 sm:w-3 h-0.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          STRATEGY_COLORS[index % STRATEGY_COLORS.length],
                      }}
                    />
                    <span
                      className="text-[9px] sm:text-xs whitespace-nowrap"
                      style={{
                        textDecoration: isHidden ? "line-through" : "none",
                      }}
                    >
                      {/* Short name on mobile */}
                      <span className="sm:hidden">
                        {strat.symbol || `S${index + 1}`}
                      </span>
                      <span className="hidden sm:inline">
                        {strat.name || strat.symbol || `Strategy ${index + 1}`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
