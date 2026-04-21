import { useState, useEffect } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import { useContractSize } from "@/contexts/ContractSizeContext";
import { useAccountValue } from "@/contexts/AccountValueContext";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { Loader2, Settings, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CalendarPnL } from "@/components/CalendarPnL";

import { DayOfWeekHeatmap } from "@/components/DayOfWeekHeatmap";
import { WeekOfMonthHeatmap } from "@/components/WeekOfMonthHeatmap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StrategyCorrelationHeatmap } from "@/components/StrategyCorrelationHeatmap";
import { RollingMetricsChart } from "@/components/RollingMetricsChart";
import { TradeAndRiskStats } from "@/components/TradeAndRiskStats";
// PositionSizingCalculator removed per user request
// TradeSourceBreakdown and WebhookSignalPerformance imports removed - not currently used

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DistributionSnapshot } from "@/components/DistributionSnapshot";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { TradeAlertsSection } from "@/components/TradeAlertsSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OverviewSkeleton } from "@/components/OverviewSkeleton";

type TimeRange = "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "ALL";
// Removed StrategyFilter - now locked to unleveraged only

export default function Overview() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");

  // Mark the "Take a tour of the dashboard" onboarding step as done the
  // first time a subscriber lands here. Cheap side-effect, runs once.
  useEffect(() => {
    try {
      window.localStorage.setItem("sts.onboarding.dashboardSeen", "1");
    } catch {
      /* localStorage unavailable — skip */
    }
  }, []);

  // Theme-aware chart colors (auto-updates on light/dark toggle)
  const chartColors = useChartColors();
  // Locked to unleveraged strategy only
  const strategyFilter = "unleveraged" as const;
  const { startingCapital, startingCapitalInput, setStartingCapitalInput } =
    useAccountValue();
  const { contractSize, setContractSize, contractMultiplier } =
    useContractSize();

  // Auto-apply user preferences on page load
  const { data: userPreferences } =
    trpc.userPreferences.getPreferences.useQuery();

  useEffect(() => {
    if (userPreferences) {
      // Apply contract size preference
      if (
        // @ts-expect-error TS2339
        userPreferences.contractSize &&
        // @ts-expect-error TS2339
        userPreferences.contractSize !== contractSize
      ) {
        // @ts-expect-error TS2339
        setContractSize(userPreferences.contractSize);
      }
      // Apply account value preference
      if (
        // @ts-expect-error TS2339
        userPreferences.accountValue &&
        // @ts-expect-error TS2339
        userPreferences.accountValue !== startingCapital
      ) {
        // @ts-expect-error TS2339
        setStartingCapitalInput(userPreferences.accountValue.toString());
      }
    }
  }, [
    userPreferences,
    contractSize,
    setContractSize,
    startingCapital,
    setStartingCapitalInput,
  ]);
  const [calendarPeriodType, setCalendarPeriodType] = useState<
    "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  >("yearly");
  // S&P 500 benchmark comparison removed per user request

  // Fetch available strategies to get IDs
  const {
    data: strategies,
    isLoading: strategiesLoading,
    error: strategiesError,
  } = trpc.portfolio.listStrategies.useQuery();

  // Debug logging
  useEffect(() => {
    console.log("[Overview] Strategies:", strategies);
    console.log("[Overview] Strategies Loading:", strategiesLoading);
    console.log("[Overview] Strategies Error:", strategiesError);
  }, [strategies, strategiesLoading, strategiesError]);

  // Get NQTrend strategy ID (unleveraged only)
  const selectedStrategyIds = (() => {
    if (!strategies) return undefined;
    const nqTrend = strategies.find(s => s.symbol === "NQTrend");
    return nqTrend ? [nqTrend.id] : undefined;
  })();

  const { data, isLoading, error } = trpc.portfolio.overview.useQuery(
    {
      timeRange,
      startingCapital,
      contractMultiplier,
      strategyIds: selectedStrategyIds,
      // @ts-expect-error TS2367
      isLeveraged: strategyFilter === "leveraged",
    },
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      enabled: strategies !== undefined, // Wait for strategies to load
    }
  );

  // Debug logging
  useEffect(() => {
    console.log("[Overview] Data:", data);
    console.log("[Overview] Loading:", isLoading);
    console.log("[Overview] Error:", error);
  }, [data, isLoading, error]);

  // Note: Portfolio sizing calculator now uses data.underwater from main query
  // No need for separate all-time query

  const { data: breakdownData } = trpc.portfolio.performanceBreakdown.useQuery(
    {
      timeRange,
      startingCapital,
    },
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // Show loading state with skeleton
  if (isLoading || strategiesLoading) {
    return <OverviewSkeleton />;
  }

  // Show error state
  if (error || strategiesError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">
              Error Loading Data
            </CardTitle>
            <CardDescription>
              {(error as any)?.message ||
                strategiesError?.message ||
                "An error occurred while loading data."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    console.warn(
      "[Overview] No data available. Loading:",
      isLoading,
      "Error:",
      error
    );
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Data Available</CardTitle>
            <CardDescription>
              {(error as any)?.message ||
                "Unable to load portfolio data. Please try again later."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { metrics, portfolioEquity, benchmarkEquity } = data;

  // Get the starting equity from the first point (should equal startingCapital)
  const baseEquity =
    portfolioEquity.length > 0 ? portfolioEquity[0]!.equity : startingCapital;

  // Prepare chart data with timestamps for proper domain calculation
  // For micro contracts: equity = startingCapital + (P&L * 0.1)
  // This keeps the starting point at startingCapital and only scales the gains/losses
  const chartData = portfolioEquity.map((point, index) => {
    // Calculate P&L from the base equity
    const pnl = point.equity - baseEquity;
    // Scale only the P&L portion by the contract multiplier
    const scaledEquity = startingCapital + pnl * contractMultiplier;

    // For benchmark, also scale only the P&L portion
    const benchmarkBase =
      benchmarkEquity.length > 0 ? benchmarkEquity[0]!.equity : startingCapital;
    const benchmarkPnl = benchmarkEquity[index]?.equity
      ? benchmarkEquity[index].equity - benchmarkBase
      : 0;
    const scaledBenchmark = benchmarkEquity[index]?.equity
      ? startingCapital + benchmarkPnl * contractMultiplier
      : null;

    // Handle date - it comes from API as ISO string
    const dateObj =
      typeof point.date === "string" ? new Date(point.date) : point.date;
    const timestamp =
      dateObj instanceof Date ? dateObj.getTime() : new Date(dateObj).getTime();

    return {
      date: dateObj.toLocaleDateString(),
      timestamp,
      portfolio: scaledEquity,
      benchmark: scaledBenchmark,
    };
  });

  // Get only the max drawdown period for subtle highlighting (less distracting)
  const maxDrawdownPeriod =
    data.majorDrawdowns && data.majorDrawdowns.length > 0
      ? (() => {
          const dd = data.majorDrawdowns[0]; // Max drawdown is always first
          const startDate = new Date(dd.startDate).toLocaleDateString();
          const endDate = dd.recoveryDate
            ? new Date(dd.recoveryDate).toLocaleDateString()
            : chartData[chartData.length - 1]!.date;
          const startIndex = chartData.findIndex(d => d.date === startDate);
          let endIndex = chartData.findIndex(d => d.date === endDate);
          if (endIndex === -1) endIndex = chartData.length - 1;

          if (startIndex >= 0 && endIndex >= 0) {
            return {
              startIndex,
              endIndex,
              depthPct: dd.depthPct,
            };
          }
          return null;
        })()
      : null;

  return (
    <>
      <SEOHead {...SEO_CONFIG.overview} />
      <div className="space-y-4 sm:space-y-6">
        {/* Overview Header Section - Bundled - Mobile Optimized */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-2">
          <CardContent className="pt-4 sm:pt-6 space-y-4 sm:space-y-6 px-3 sm:px-6">
            {/* Header - Centered Title */}
            <div className="text-center relative">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-1 sm:mb-2">
                Portfolio Overview
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Combined performance of all intraday strategies
              </p>

              {/* Theme Toggle & Settings - Top Right */}
              <div className="absolute top-0 right-0 flex items-center gap-2">
                <ThemeToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Account Settings</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="p-2 space-y-3">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="starting-capital-setting"
                          className="text-xs"
                        >
                          Starting Capital
                        </Label>
                        <Input
                          id="starting-capital-setting"
                          type="number"
                          value={startingCapitalInput}
                          onChange={e =>
                            setStartingCapitalInput(e.target.value)
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="contract-size-setting"
                          className="text-xs"
                        >
                          Contract Size
                        </Label>
                        <Select
                          value={contractSize}
                          onValueChange={v =>
                            setContractSize(v as "mini" | "micro")
                          }
                        >
                          <SelectTrigger
                            id="contract-size-setting"
                            className="h-8"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mini">Mini Contracts</SelectItem>
                            <SelectItem value="micro">
                              Micro Contracts
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Aesthetic Controls Bar */}
            <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                {/* Controls Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Portfolio Settings
                  </h3>
                </div>

                {/* Controls Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Time Range Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground/70 uppercase tracking-wide">
                      <Clock className="h-3 w-3 inline mr-1" />
                      Time Range
                    </Label>
                    <Select
                      value={timeRange}
                      onValueChange={v => setTimeRange(v as TimeRange)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6M">6 Months</SelectItem>
                        <SelectItem value="YTD">Year to Date</SelectItem>
                        <SelectItem value="1Y">1 Year</SelectItem>
                        <SelectItem value="3Y">3 Years</SelectItem>
                        <SelectItem value="5Y">5 Years</SelectItem>
                        <SelectItem value="10Y">10 Years</SelectItem>
                        <SelectItem value="ALL">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contract Size Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground/70 uppercase tracking-wide">
                      Contract Size
                    </Label>
                    <Select
                      value={contractSize}
                      onValueChange={v =>
                        setContractSize(v as "mini" | "micro")
                      }
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mini">Mini Contracts</SelectItem>
                        <SelectItem value="micro">Micro Contracts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Account Size Input */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="account-size-main"
                      className="text-xs font-medium text-foreground/70 uppercase tracking-wide"
                    >
                      Account Size
                    </Label>
                    <Input
                      id="account-size-main"
                      type="number"
                      value={startingCapitalInput}
                      onChange={e => setStartingCapitalInput(e.target.value)}
                      className="bg-background"
                      placeholder="$100,000"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Key Metrics Cards - Mobile Optimized Grid */}
            {/* Calculate adjusted percentages based on contract size */}
            {/* For micro contracts, P&L is 1/10th, so percentages need to be recalculated */}
            {(() => {
              // Calculate the actual P&L in dollars (scaled for contract size)
              const actualPnlDollars =
                (metrics.totalReturn / 100) *
                startingCapital *
                contractMultiplier;
              // Recalculate percentage based on actual P&L and starting capital
              const adjustedTotalReturnPct =
                (actualPnlDollars / startingCapital) * 100;

              // Calculate adjusted max drawdown percentage from underwater chart data
              // Use the actual drawdown from the underwater curve (most accurate)
              const maxDrawdownFromUnderwaterChart = data.underwater?.curve
                ? Math.min(
                    ...data.underwater.curve.map((p: any) => p.drawdownPercent)
                  )
                : metrics.maxDrawdown;

              const adjustedMaxDrawdownPct = Math.abs(
                maxDrawdownFromUnderwaterChart
              );

              // Calculate adjusted annualized return
              // Get the number of years from the data
              const yearsElapsed =
                metrics.annualizedReturn !== 0 && metrics.totalReturn !== 0
                  ? Math.log(1 + metrics.annualizedReturn / 100) /
                    Math.log(1 + metrics.totalReturn / 100)
                  : 1;
              const adjustedAnnualizedReturn =
                yearsElapsed > 0
                  ? (Math.pow(
                      1 + adjustedTotalReturnPct / 100,
                      1 / yearsElapsed
                    ) -
                      1) *
                    100
                  : adjustedTotalReturnPct;

              // For leveraged strategy, show % instead of $ amounts
              // @ts-expect-error TS2367
              const isLeveraged = strategyFilter === "leveraged";

              return (
                <div className="grid gap-1.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  {/* Total Return */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2">
                      Total Return
                    </div>
                    {isLeveraged ? (
                      // Leveraged: Show % as primary
                      <>
                        <div
                          className={`text-xs sm:text-base md:text-lg lg:text-xl font-bold mb-1 ${
                            adjustedTotalReturnPct >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                          title={`${adjustedTotalReturnPct >= 0 ? "+" : ""}${adjustedTotalReturnPct.toFixed(1)}%`}
                        >
                          {adjustedTotalReturnPct >= 0 ? "+" : ""}
                          {adjustedTotalReturnPct.toFixed(1)}%
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-foreground/50">
                          {adjustedAnnualizedReturn.toFixed(0)}% annualized
                        </div>
                      </>
                    ) : (
                      // Unleveraged: Show $ as primary
                      <>
                        <div
                          className={`text-xs sm:text-base md:text-lg lg:text-xl font-bold mb-1 ${
                            actualPnlDollars >= 0
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                          title={`${actualPnlDollars >= 0 ? "+" : ""}$${Math.round(actualPnlDollars).toLocaleString()}`}
                        >
                          {actualPnlDollars >= 0 ? "+" : ""}$
                          {(() => {
                            const value = Math.round(actualPnlDollars);
                            if (Math.abs(value) >= 1000000)
                              return (value / 1000000).toFixed(1) + "M";
                            if (Math.abs(value) >= 1000)
                              return (value / 1000).toFixed(1) + "K";
                            return value.toLocaleString();
                          })()}
                        </div>
                        <div className="text-[8px] sm:text-[9px] text-foreground/50">
                          {adjustedTotalReturnPct.toFixed(1)}% (
                          {adjustedAnnualizedReturn.toFixed(0)}% ann.)
                        </div>
                      </>
                    )}
                  </div>

                  {/* Max Drawdown */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2">
                      Max Drawdown
                    </div>
                    {/* Always show % as primary (matching homepage style) */}
                    <>
                      <div
                        className="text-xs sm:text-base md:text-lg lg:text-xl font-bold mb-1 text-amber-500"
                        title={`-${adjustedMaxDrawdownPct.toFixed(1)}%`}
                      >
                        -{adjustedMaxDrawdownPct.toFixed(1)}%
                      </div>
                      <div className="text-[8px] sm:text-[9px] text-foreground/50">
                        peak to trough
                      </div>
                    </>
                  </div>

                  {/* Sortino Ratio - Daily (Industry Standard) */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2 flex items-center justify-center gap-1">
                      <span className="hidden sm:inline">Sortino</span>
                      <span className="sm:hidden">Sortino</span>
                      <Badge
                        variant="outline"
                        className="text-[7px] sm:text-[8px] px-1 py-0 h-3 sm:h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      >
                        Daily
                      </Badge>
                    </div>
                    <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 text-foreground">
                      {data.dailyMetrics?.sortino?.toFixed(2) ??
                        metrics.sortinoRatio.toFixed(2)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      Trade: {metrics.sortinoRatio.toFixed(2)}
                    </div>
                  </div>

                  {/* Sharpe Ratio - Daily (Industry Standard) */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2 flex items-center justify-center gap-1">
                      <span className="hidden sm:inline">Sharpe</span>
                      <span className="sm:hidden">Sharpe</span>
                      <Badge
                        variant="outline"
                        className="text-[7px] sm:text-[8px] px-1 py-0 h-3 sm:h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      >
                        Daily
                      </Badge>
                    </div>
                    <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 text-foreground">
                      {data.dailyMetrics?.sharpe?.toFixed(2) ??
                        metrics.sharpeRatio.toFixed(2)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      Trade: {metrics.sharpeRatio.toFixed(2)}
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2">
                      Win Rate
                    </div>
                    <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 text-foreground">
                      {metrics.winRate.toFixed(1)}%
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      {metrics.totalTrades.toLocaleString()} trades
                    </div>
                  </div>

                  {/* Calmar Ratio */}
                  <div className="bg-muted/30 border border-muted rounded-lg p-2 sm:p-3 md:p-4 text-center overflow-hidden">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/60 font-semibold mb-1 sm:mb-2">
                      Calmar
                    </div>
                    <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 text-foreground">
                      {metrics.calmarRatio.toFixed(2)}
                    </div>
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      Return / DD
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Portfolio Summary removed per user request */}
          </CardContent>
        </Card>

        {/* Equity Curve Chart - Mobile Optimized */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  Equity Curve
                  <Badge
                    variant="outline"
                    className="text-[10px] sm:text-xs font-normal text-green-400 border-green-400/30"
                  >
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                    Live
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Portfolio performance over time
                </CardDescription>
              </div>
              {/* Time Range Selector - Mobile Optimized */}
              <div className="flex gap-1 flex-wrap w-full sm:w-auto">
                {(["6M", "YTD", "1Y", "5Y", "10Y", "ALL"] as const).map(
                  range => (
                    <Button
                      key={range}
                      variant={timeRange === range ? "default" : "outline"}
                      size="sm"
                      className="h-8 sm:h-7 px-2.5 sm:px-2 text-xs flex-1 sm:flex-none min-w-[40px]"
                      onClick={() => setTimeRange(range)}
                    >
                      {range}
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="h-[240px] sm:h-[350px] md:h-[400px] lg:h-[450px] -mx-1 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 5, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.2}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.border }}
                    axisLine={{ stroke: chartColors.border }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    tickCount={8}
                    domain={[0, chartData.length - 1]}
                    type="category"
                    padding={{ left: 20, right: 20 }}
                    label={{
                      value: "Date",
                      position: "insideBottom",
                      offset: -5,
                      fill: "hsl(var(--foreground))",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.border }}
                    axisLine={{ stroke: chartColors.border }}
                    tickFormatter={value => `$${(value / 1000).toFixed(0)}k`}
                    width={50}
                    label={{
                      value: "Portfolio Value",
                      angle: -90,
                      position: "insideLeft",
                      fill: chartColors.foreground,
                      fontSize: 12,
                      dx: -5,
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    labelStyle={{ color: "black" }}
                  />
                  <Legend
                    content={() => {
                      return (
                        <div className="flex justify-center gap-6 mt-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-0.5 bg-[#60a5fa]"></div>
                            <span className="text-sm">Portfolio</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  {/* Subtle max drawdown indicator - only show if significant */}
                  {maxDrawdownPeriod && maxDrawdownPeriod.depthPct > 10 && (
                    <ReferenceArea
                      x1={chartData[maxDrawdownPeriod.startIndex]!.date}
                      x2={chartData[maxDrawdownPeriod.endIndex]!.date}
                      fill="#ef4444"
                      fillOpacity={0.05}
                      stroke="#ef4444"
                      strokeOpacity={0.2}
                      strokeDasharray="3 3"
                    />
                  )}
                  {/* Starting Capital Reference Line */}
                  <ReferenceLine
                    y={startingCapital}
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    label={{
                      value: `Starting Capital: $${(startingCapital / 1000).toFixed(0)}k`,
                      position: "insideTopRight",
                      fill: "#10b981",
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="portfolio"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    name="Portfolio"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Underwater Curve - Directly Below Equity Curve */}
        {data.underwater && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Underwater Equity Curve
              </CardTitle>
              <CardDescription className="text-xs">
                Drawdown from peak over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] sm:h-[260px] md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                    data={(() => {
                      // Build a map of benchmark drawdown by date for efficient lookup
                      const benchmarkByDate = new Map<string, number>();
                      data.benchmarkUnderwater?.curve?.forEach((b: any) => {
                        const dateKey = new Date(b.date)
                          .toISOString()
                          .split("T")[0];
                        benchmarkByDate.set(dateKey, b.drawdownPercent);
                      });

                      // Forward-fill benchmark values
                      let lastBenchmarkDrawdown = 0;
                      return data.underwater.curve.map((point, index) => {
                        const pointDateKey = new Date(point.date)
                          .toISOString()
                          .split("T")[0];
                        const displayDate =
                          chartData[index]?.date ||
                          point.date.toLocaleDateString();

                        // Find exact match or use forward-fill
                        let benchmarkDrawdown =
                          benchmarkByDate.get(pointDateKey);
                        if (benchmarkDrawdown === undefined) {
                          // Look for closest previous date
                          const sortedDates = Array.from(
                            benchmarkByDate.keys()
                          ).sort();
                          for (const dateKey of sortedDates) {
                            if (dateKey <= pointDateKey) {
                              benchmarkDrawdown = benchmarkByDate.get(dateKey);
                            } else {
                              break;
                            }
                          }
                        }

                        if (benchmarkDrawdown !== undefined) {
                          lastBenchmarkDrawdown = benchmarkDrawdown;
                        }

                        // Drawdown percentage is already relative to running peak
                        // Cap at -100% for display (leveraged strategies can exceed this theoretically)
                        return {
                          date: displayDate,
                          drawdown: Math.max(point.drawdownPercent, -100),
                          benchmarkDrawdown: Math.max(
                            lastBenchmarkDrawdown,
                            -100
                          ),
                        };
                      });
                    })()}
                  >
                    <defs>
                      <linearGradient
                        id="drawdownGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.15}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: chartColors.foreground }}
                      tickLine={{ stroke: chartColors.border }}
                      axisLine={{ stroke: chartColors.border }}
                      angle={-45}
                      textAnchor="end"
                      height={55}
                      interval="preserveStartEnd"
                      domain={[0, chartData.length - 1]}
                      type="category"
                      padding={{ left: 20, right: 20 }}
                      label={{
                        value: "Date",
                        position: "insideBottom",
                        offset: -5,
                        fill: "hsl(var(--foreground))",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: chartColors.foreground }}
                      tickLine={{ stroke: chartColors.border }}
                      axisLine={{ stroke: chartColors.border }}
                      tickFormatter={value => `${value.toFixed(0)}%`}
                      domain={["dataMin", 0]}
                      width={45}
                      label={{
                        value: "Drawdown %",
                        angle: -90,
                        position: "insideLeft",
                        fill: chartColors.foreground,
                        fontSize: 11,
                        dx: -5,
                      }}
                    />
                    <Tooltip
                      formatter={(value: number) => `${value.toFixed(2)}%`}
                      labelStyle={{ color: "black" }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#drawdownGradient)"
                      name="Portfolio"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade Alerts Section - Visible only to paying members */}
        <TradeAlertsSection />

        {/* Additional Metrics */}
        {/* Major Drawdowns Table - REMOVED per user request */}

        {/* Distribution Snapshot */}
        {data.distribution && (
          <DistributionSnapshot distribution={data.distribution} />
        )}

        {/* Day-of-Week and Week-of-Month Performance */}
        {((data.dayOfWeekBreakdown && data.dayOfWeekBreakdown.length > 0) ||
          (data.weekOfMonthBreakdown &&
            data.weekOfMonthBreakdown.length > 0)) && (
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="day-of-week" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="day-of-week">Day of Week</TabsTrigger>
                  <TabsTrigger value="week-of-month">Week of Month</TabsTrigger>
                </TabsList>
                <TabsContent value="day-of-week">
                  {data.dayOfWeekBreakdown && (
                    <DayOfWeekHeatmap data={data.dayOfWeekBreakdown} />
                  )}
                </TabsContent>
                <TabsContent value="week-of-month">
                  {data.weekOfMonthBreakdown && (
                    <WeekOfMonthHeatmap data={data.weekOfMonthBreakdown} />
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Rolling Metrics */}
        {data.rollingMetrics && data.rollingMetrics.length > 0 && (
          <RollingMetricsChart
            rollingMetrics={data.rollingMetrics}
            timeRange={timeRange}
          />
        )}

        {/* Strategy Correlation Matrix */}
        {data.strategyCorrelationMatrix && (
          <Card>
            <CardContent className="pt-6">
              <StrategyCorrelationHeatmap
                labels={data.strategyCorrelationMatrix.labels}
                matrix={data.strategyCorrelationMatrix.matrix}
              />
            </CardContent>
          </Card>
        )}

        {/* Monthly Returns Calendar - REMOVED per user request (redundant with Calendar P&L) */}

        {/* Trade Source Breakdown and Webhook Signal Performance - MOVED to Admin page */}

        {/* Calendar P&L */}
        {breakdownData && (
          <CalendarPnL
            data={breakdownData[calendarPeriodType]}
            periodType={calendarPeriodType}
            onPeriodTypeChange={setCalendarPeriodType}
          />
        )}

        {/* Trade & Risk Statistics - Moved below Calendar P&L */}
        {data.tradeStats && (
          <TradeAndRiskStats
            tradeStats={data.tradeStats}
            // @ts-expect-error TS2367
            isLeveraged={strategyFilter === "leveraged"}
            startingCapital={startingCapital}
          />
        )}

        {/* Position Sizing Calculator removed per user request */}
      </div>
    </>
  );
}
