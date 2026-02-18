import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useContractSize } from "@/contexts/ContractSizeContext";
import { useAccountValue } from "@/contexts/AccountValueContext";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, ArrowLeft } from "lucide-react";
import { TradeFilters, TradeFilterState } from "@/components/TradeFilters";
import { exportTradesToCSV } from "@/lib/csvExport";
import { Button } from "@/components/ui/button";
import { DataQualityBadge } from "@/components/DataQualityBadge";
// Unused imports cleaned up

type TimeRange = "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "ALL";

export default function StrategyDetail() {
  const [, params] = useRoute("/strategy/:id");
  const strategyId = params?.id ? parseInt(params.id) : 0;

  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const { startingCapital, setStartingCapitalInput } = useAccountValue();
  const { contractSize, setContractSize } = useContractSize();
  const [filters, setFilters] = useState<TradeFilterState>({});
  const [showBenchmark, setShowBenchmark] = useState(true);

  const { data, isLoading, error } = trpc.portfolio.strategyDetail.useQuery({
    strategyId,
    timeRange,
    startingCapital,
    contractSize,
  });

  // SEO meta tags handled via SEOHead in the main return

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    const isNotFound = error.message.toLowerCase().includes("not found");
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">
              {isNotFound ? "Strategy Not Found" : "Error Loading Data"}
            </CardTitle>
            <CardDescription>
              {isNotFound
                ? `The strategy with ID ${strategyId} does not exist or may have been removed.`
                : error.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/strategies">
                <ArrowLeft className="w-4 h-4 mr-2" />
                View All Strategies
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/my-dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { strategy, metrics, equityCurve, recentTrades } = data;

  // Apply filters to trades
  const filteredTrades = recentTrades.filter(trade => {
    if (
      filters.startDate &&
      new Date(trade.exitDate) < new Date(filters.startDate)
    )
      return false;
    if (filters.endDate && new Date(trade.exitDate) > new Date(filters.endDate))
      return false;
    if (
      filters.direction &&
      trade.direction.toLowerCase() !== filters.direction
    )
      return false;
    if (filters.minPnl !== undefined && trade.pnl / 100 < filters.minPnl)
      return false;
    if (filters.maxPnl !== undefined && trade.pnl / 100 > filters.maxPnl)
      return false;
    return true;
  });

  // CSV export handler
  const handleExportCSV = () => {
    const tradesForExport = filteredTrades.map(trade => ({
      entryDate: new Date(trade.entryDate),
      exitDate: new Date(trade.exitDate),
      direction: trade.direction,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      quantity: trade.quantity,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      commission: trade.commission,
    }));
    const filename = `${strategy.name.replace(/\s+/g, "_")}_trades_${new Date().toISOString().split("T")[0]}.csv`;
    exportTradesToCSV(tradesForExport, filename);
  };

  // Prepare chart data (equity curve already has contract size applied on backend)
  // Normalize benchmark to starting capital - match by date, not index
  const firstBenchmarkValue = data.benchmarkData?.[0]?.close ?? 1;

  // Create a map of benchmark data by date for O(1) lookups
  const benchmarkByDate = new Map<string, number>();
  data.benchmarkData?.forEach(b => {
    const dateKey = new Date(b.date).toISOString().split("T")[0];
    benchmarkByDate.set(dateKey, b.close);
  });

  // Forward-fill benchmark values to handle missing dates
  let lastBenchmarkClose = firstBenchmarkValue;
  const chartData = equityCurve.map(point => {
    const pointDateKey = new Date(point.date).toISOString().split("T")[0];

    // Find the closest benchmark date on or before this point's date
    let benchmarkClose = benchmarkByDate.get(pointDateKey);

    // If no exact match, find the most recent benchmark value
    if (benchmarkClose === undefined) {
      // Look for the closest previous date
      const sortedBenchmarkDates = Array.from(benchmarkByDate.keys()).sort();
      for (const dateKey of sortedBenchmarkDates) {
        if (dateKey <= pointDateKey) {
          benchmarkClose = benchmarkByDate.get(dateKey);
        } else {
          break;
        }
      }
    }

    // Update last known value for forward-fill
    if (benchmarkClose !== undefined) {
      lastBenchmarkClose = benchmarkClose;
    }

    const normalizedBenchmark =
      (lastBenchmarkClose / firstBenchmarkValue) * startingCapital;

    return {
      date: new Date(point.date).toLocaleDateString(),
      equity: point.equity,
      benchmark: normalizedBenchmark,
    };
  });

  // Prepare underwater curve data with forward-fill for benchmark - match by date
  // Create a map of benchmark underwater data by date
  const benchmarkUnderwaterByDate = new Map<string, number>();
  data.benchmarkUnderwater?.forEach(b => {
    const dateKey = new Date(b.date).toISOString().split("T")[0];
    benchmarkUnderwaterByDate.set(dateKey, b.drawdownPercent);
  });

  let lastBenchmarkDrawdown: number | undefined = undefined;
  const underwaterData =
    data.underwaterCurve?.map(point => {
      const pointDateKey = new Date(point.date).toISOString().split("T")[0];

      // Find exact match or closest previous date
      let currentBenchmarkDrawdown =
        benchmarkUnderwaterByDate.get(pointDateKey);

      if (currentBenchmarkDrawdown === undefined) {
        // Look for the closest previous date
        const sortedDates = Array.from(benchmarkUnderwaterByDate.keys()).sort();
        for (const dateKey of sortedDates) {
          if (dateKey <= pointDateKey) {
            currentBenchmarkDrawdown = benchmarkUnderwaterByDate.get(dateKey);
          } else {
            break;
          }
        }
      }

      if (currentBenchmarkDrawdown !== undefined) {
        lastBenchmarkDrawdown = currentBenchmarkDrawdown;
      }

      return {
        date: new Date(point.date).toLocaleDateString(),
        drawdown: point.drawdownPercent, // Already in percentage
        benchmarkDrawdown: lastBenchmarkDrawdown,
      };
    }) ?? [];

  return (
    <>
      <SEOHead
        title={`${strategy.name} Strategy | Performance Analysis | STS Futures`}
        description={`Detailed performance analysis for ${strategy.name} strategy trading ${strategy.symbol} futures. View equity curve, trade history, drawdown analysis, and risk metrics.`}
        canonical={`https://stsdashboard.com/strategy/${strategyId}`}
      />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link href="/overview">
            <Button variant="ghost" size="sm" className="w-fit">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Overview
            </Button>
          </Link>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {strategy.name}
                </h1>
                <p className="text-muted-foreground">
                  {strategy.market} • {strategy.strategyType}
                </p>
              </div>
            </div>

            {/* Controls Card */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Starting Capital */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Starting Capital
                    </Label>
                    <Input
                      type="number"
                      value={startingCapital}
                      onChange={e => setStartingCapitalInput(e.target.value)}
                      className="text-lg font-medium"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStartingCapitalInput("10000")}
                        className="text-xs"
                      >
                        $10K
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStartingCapitalInput("25000")}
                        className="text-xs"
                      >
                        $25K
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStartingCapitalInput("50000")}
                        className="text-xs"
                      >
                        $50K
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStartingCapitalInput("100000")}
                        className="text-xs"
                      >
                        $100K
                      </Button>
                    </div>
                  </div>

                  {/* Time Range */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Time Range</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={timeRange === "6M" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("6M")}
                        className="text-xs"
                      >
                        6M
                      </Button>
                      <Button
                        variant={timeRange === "YTD" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("YTD")}
                        className="text-xs"
                      >
                        YTD
                      </Button>
                      <Button
                        variant={timeRange === "1Y" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("1Y")}
                      >
                        1Y
                      </Button>
                      <Button
                        variant={timeRange === "5Y" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("5Y")}
                      >
                        5Y
                      </Button>
                      <Button
                        variant={timeRange === "10Y" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("10Y")}
                      >
                        10Y
                      </Button>
                      <Button
                        variant={timeRange === "ALL" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTimeRange("ALL")}
                      >
                        ALL
                      </Button>
                    </div>
                  </div>

                  {/* Contract Size */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">
                      Contract Size
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={
                          contractSize === "mini" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setContractSize("mini")}
                        className="text-xs"
                      >
                        Mini
                      </Button>
                      <Button
                        variant={
                          contractSize === "micro" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setContractSize("micro")}
                        className="text-xs"
                      >
                        Micro
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Return
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                +$
                {(
                  (metrics.totalReturn / 100) *
                  startingCapital
                ).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +{metrics.totalReturn.toFixed(2)}% • Ann:{" "}
                {metrics.annualizedReturn.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Sharpe Ratio
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                  Daily
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics.sharpeRatio.toFixed(2)}
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Sortino: {metrics.sortinoRatio.toFixed(2)}
                </p>
                <div className="pt-1 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground/70">
                    Trade-based: {metrics.tradeBasedSharpe?.toFixed(2) ?? "N/A"}{" "}
                    / {metrics.tradeBasedSortino?.toFixed(2) ?? "N/A"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max Drawdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                -$
                {Math.abs(
                  (metrics.maxDrawdown / 100) * startingCapital
                ).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.maxDrawdown.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {metrics.winRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round((metrics.totalTrades * metrics.winRate) / 100)} /{" "}
                {metrics.totalTrades} trades
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Quality Indicator */}
        {data?.dataQuality && (
          <div className="grid gap-4 md:grid-cols-2">
            <DataQualityBadge quality={data.dataQuality} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trading Statistics
                </CardTitle>
                <CardDescription className="text-xs">
                  Data coverage and activity metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Trading Days
                    </p>
                    <p className="font-medium">
                      {metrics.tradingDays?.toLocaleString() ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Trades per Day
                    </p>
                    <p className="font-medium">
                      {metrics.tradingDays && metrics.tradingDays > 0
                        ? (metrics.totalTrades / metrics.tradingDays).toFixed(2)
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Data Period</span>
                    <span className="font-medium">
                      {equityCurve.length > 0
                        ? `${new Date(equityCurve[0]?.date).toLocaleDateString()} - ${new Date(equityCurve[equityCurve.length - 1]?.date).toLocaleDateString()}`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Extended Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Detailed Performance Statistics</CardTitle>
            <CardDescription>
              Industry-standard metrics for comprehensive strategy analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {/* Risk Metrics */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Risk Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Calmar Ratio
                    </span>
                    <span className="font-medium">
                      {metrics.calmarRatio?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Profit Factor
                    </span>
                    <span className="font-medium">
                      {metrics.profitFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Recovery Factor
                    </span>
                    <span className="font-medium">
                      {(
                        metrics.totalReturn / Math.abs(metrics.maxDrawdown)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Risk/Reward
                    </span>
                    <span className="font-medium">
                      {Math.abs(metrics.avgWin / metrics.avgLoss).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trade Statistics */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Trade Statistics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total Trades
                    </span>
                    <span className="font-medium">
                      {metrics.totalTrades.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Avg Win
                    </span>
                    <span className="font-medium text-green-500">
                      ${(metrics.avgWin / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Avg Loss
                    </span>
                    <span className="font-medium text-red-500">
                      -${Math.abs(metrics.avgLoss / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Expectancy
                    </span>
                    <span className="font-medium">
                      ${metrics.tradeStats?.expectancyPnL?.toFixed(2) ?? "N/A"}
                      /trade
                    </span>
                  </div>
                </div>
              </div>

              {/* Best/Worst Performance */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Best/Worst
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Best Trade
                    </span>
                    <span className="font-medium text-green-500">
                      ${metrics.tradeStats?.bestTradePnL?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Worst Trade
                    </span>
                    <span className="font-medium text-red-500">
                      ${metrics.tradeStats?.worstTradePnL?.toFixed(2) ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Max Consec. Wins
                    </span>
                    <span className="font-medium">
                      {metrics.tradeStats?.longestWinStreak ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Max Consec. Losses
                    </span>
                    <span className="font-medium">
                      {metrics.tradeStats?.longestLossStreak ?? "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Return Metrics */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Returns
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total Return
                    </span>
                    <span className="font-medium text-green-500">
                      +{metrics.totalReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Annualized
                    </span>
                    <span className="font-medium">
                      {metrics.annualizedReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Avg Daily Return
                    </span>
                    <span className="font-medium">
                      {(metrics.annualizedReturn / 252).toFixed(3)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Volatility (Ann.)
                    </span>
                    <span className="font-medium">
                      {(metrics.annualizedReturn / metrics.sharpeRatio).toFixed(
                        2
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Kelly Criterion Section */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
                Kelly Criterion Analysis
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-muted/20 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Kelly Percentage
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {metrics.tradeStats?.kellyPercentage !== undefined
                      ? `${(metrics.tradeStats.kellyPercentage * 100).toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Optimal position size
                  </div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Half-Kelly (Recommended)
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {metrics.tradeStats?.kellyPercentage !== undefined
                      ? `${(metrics.tradeStats.kellyPercentage * 50).toFixed(1)}%`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Conservative sizing
                  </div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Risk of Ruin
                  </div>
                  <div
                    className={`text-2xl font-bold ${(metrics.tradeStats?.riskOfRuin ?? 0) < 5 ? "text-green-400" : (metrics.tradeStats?.riskOfRuin ?? 0) < 20 ? "text-yellow-400" : "text-red-400"}`}
                  >
                    {metrics.tradeStats?.riskOfRuin !== undefined
                      ? `${metrics.tradeStats.riskOfRuin < 0.01 ? "<0.01" : metrics.tradeStats.riskOfRuin.toFixed(2)}%`
                      : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    At current capital
                  </div>
                </div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                <p>
                  <strong>Kelly Formula:</strong> f* = (bp - q) / b, where b =
                  payoff ratio (
                  {Math.abs(metrics.avgWin / metrics.avgLoss).toFixed(2)}), p =
                  win rate ({(metrics.winRate / 100).toFixed(2)}), q = loss rate
                  ({(1 - metrics.winRate / 100).toFixed(2)})
                </p>
                <p className="mt-1">
                  <strong>Recommendation:</strong> Use Half-Kelly or
                  Quarter-Kelly for reduced volatility while maintaining
                  positive expectancy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Equity Curve */}
        <Card>
          <CardHeader>
            <CardTitle>Equity Curve</CardTitle>
            <CardDescription>
              Strategy performance vs S&P 500 benchmark
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[350px] md:h-[400px] lg:h-[450px] -mx-2 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 5, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#ffffff" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    domain={["dataMin", "dataMax"]}
                    padding={{ left: 20, right: 20 }}
                    label={{
                      value: "Date",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#ffffff" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    tickFormatter={value => `$${(value / 1000).toFixed(0)}k`}
                    width={65}
                    domain={["auto", "auto"]}
                    label={{
                      value: "Portfolio Value",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#ffffff",
                      fontSize: 12,
                      dx: -5,
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    labelStyle={{ color: "black" }}
                    contentStyle={{
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                      border: "none",
                    }}
                  />
                  <Legend
                    onClick={(e: any) => {
                      if (e.dataKey === "benchmark") {
                        setShowBenchmark(!showBenchmark);
                      }
                    }}
                    wrapperStyle={{ cursor: "pointer" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Strategy"
                    connectNulls
                  />
                  {showBenchmark && data?.benchmarkData && (
                    <Line
                      type="monotone"
                      dataKey="benchmark"
                      stroke="#6b7280"
                      strokeWidth={1.5}
                      dot={false}
                      name="S&P 500"
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Underwater Equity Curve */}
        <Card>
          <CardHeader>
            <CardTitle>Underwater Equity Curve</CardTitle>
            <CardDescription>
              Drawdown from peak equity over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px] sm:h-[280px] md:h-[320px] lg:h-[350px] -mx-2 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={underwaterData}
                  margin={{ top: 10, right: 5, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#ffffff" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                    domain={["dataMin", "dataMax"]}
                    padding={{ left: 20, right: 20 }}
                    label={{
                      value: "Date",
                      position: "insideBottom",
                      offset: -5,
                      fill: "#ffffff",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#ffffff" }}
                    tickLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.3)" }}
                    tickFormatter={value => `${value.toFixed(1)}%`}
                    width={55}
                    label={{
                      value: "Drawdown %",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#ffffff",
                      fontSize: 12,
                      dx: -5,
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                    labelStyle={{ color: "black" }}
                    contentStyle={{
                      backgroundColor: "rgba(0, 0, 0, 0.8)",
                      border: "none",
                    }}
                  />
                  <Legend
                    onClick={(e: any) => {
                      if (e.dataKey === "benchmarkDrawdown") {
                        setShowBenchmark(!showBenchmark);
                      }
                    }}
                    wrapperStyle={{ cursor: "pointer" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="drawdown"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Strategy Drawdown"
                    connectNulls
                  />
                  {showBenchmark && data?.benchmarkUnderwater && (
                    <Line
                      type="monotone"
                      dataKey="benchmarkDrawdown"
                      stroke="#fb923c"
                      strokeWidth={1.5}
                      dot={false}
                      name="S&P 500 Drawdown"
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
            <CardDescription>Filter and export trade history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TradeFilters
              filters={filters}
              onFiltersChange={setFilters}
              onExportCSV={handleExportCSV}
              totalTrades={recentTrades.length}
              filteredTrades={filteredTrades.length}
            />

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry Date</TableHead>
                    <TableHead>Exit Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead className="text-right">Entry Price</TableHead>
                    <TableHead className="text-right">Exit Price</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">P&L %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map(trade => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        {new Date(trade.entryDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {new Date(trade.exitDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            trade.direction === "Long"
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          {trade.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ${trade.entryPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${trade.exitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${trade.pnl >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        ${(trade.pnl / 100).toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${trade.pnlPercent >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {trade.pnlPercent.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
