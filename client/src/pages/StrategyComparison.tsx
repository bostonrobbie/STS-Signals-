import { useState } from "react";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
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
import { Checkbox } from "@/components/ui/checkbox";

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
import { Loader2 } from "lucide-react";
import MonteCarloSimulation from "@/components/MonteCarloSimulation";

type TimeRange = "YTD" | "1Y" | "3Y" | "5Y" | "ALL";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
];

export default function StrategyComparison() {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const { startingCapital, setStartingCapitalInput } = useAccountValue();
  const { contractSize, setContractSize } = useContractSize();
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<number[]>([
    9, 11,
  ]);
  const [showBenchmark, setShowBenchmark] = useState(false);

  const [hiddenStrategies, setHiddenStrategies] = useState<Set<string>>(
    new Set()
  );

  // Get list of all strategies
  const { data: strategies } = trpc.portfolio.listStrategies.useQuery();

  // Get comparison data
  const { data, isLoading, error } = trpc.portfolio.compareStrategies.useQuery(
    {
      strategyIds: selectedStrategyIds,
      timeRange,
      startingCapital,
    },
    {
      enabled: selectedStrategyIds.length >= 2,
    }
  );

  const toggleStrategy = (strategyId: number) => {
    setSelectedStrategyIds(prev => {
      if (prev.includes(strategyId)) {
        return prev.filter(id => id !== strategyId);
      } else if (prev.length < 4) {
        return [...prev, strategyId];
      }
      return prev;
    });
  };

  // Get benchmark data if needed
  const { data: benchmarkData } = trpc.portfolio.overview.useQuery(
    {
      timeRange,
      startingCapital,
    },
    {
      enabled: showBenchmark && selectedStrategyIds.length >= 2,
    }
  );

  // Prepare chart data
  const chartData =
    data?.strategies[0]?.equityCurve.map((_, index) => {
      const point: any = {
        date: new Date(
          data.strategies[0]!.equityCurve[index]!.date
        ).toLocaleDateString(),
      };

      // Add equity curves
      data.strategies.forEach((strat, stratIndex) => {
        point[`strategy${stratIndex}`] = strat.equityCurve[index]?.equity || 0;
      });

      point.combined = data.combinedEquity[index]?.equity || 0;

      if (showBenchmark && benchmarkData?.benchmarkEquity[index]) {
        point.benchmark = benchmarkData.benchmarkEquity[index].equity;
      }

      // Calculate drawdowns (as percentages)
      data.strategies.forEach((strat, stratIndex) => {
        const equity = strat.equityCurve[index]?.equity || 0;
        const peak = Math.max(
          ...strat.equityCurve.slice(0, index + 1).map(p => p.equity)
        );
        const dd = peak > 0 ? ((equity - peak) / peak) * 100 : 0;
        point[`dd${stratIndex}`] = dd;
      });

      // Combined drawdown
      const combinedEquity = data.combinedEquity[index]?.equity || 0;
      const combinedPeak = Math.max(
        ...data.combinedEquity.slice(0, index + 1).map(p => p.equity)
      );
      const combinedDD =
        combinedPeak > 0
          ? ((combinedEquity - combinedPeak) / combinedPeak) * 100
          : 0;
      point.combinedDD = combinedDD;

      // Benchmark drawdown (S&P 500)
      if (showBenchmark && benchmarkData?.benchmarkEquity[index]) {
        const benchmarkEquity = benchmarkData.benchmarkEquity[index].equity;
        const benchmarkPeak = Math.max(
          ...benchmarkData.benchmarkEquity
            .slice(0, index + 1)
            .map(p => p.equity)
        );
        const benchmarkDD =
          benchmarkPeak > 0
            ? ((benchmarkEquity - benchmarkPeak) / benchmarkPeak) * 100
            : 0;
        point.benchmarkDD = benchmarkDD;
      }

      return point;
    }) || [];

  const toggleStrategyVisibility = (strategyKey: string) => {
    setHiddenStrategies(prev => {
      const next = new Set(prev);
      if (next.has(strategyKey)) {
        next.delete(strategyKey);
      } else {
        next.add(strategyKey);
      }
      return next;
    });
  };

  return (
    <>
      <SEOHead {...SEO_CONFIG.compare} />
      <div className="space-y-4 sm:space-y-6">
        {/* Header - Mobile Optimized */}
        <div className="px-1 sm:px-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Strategy Comparison
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Compare performance and correlation between strategies
          </p>
        </div>

        {/* Controls - Mobile Optimized */}
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-end">
          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <Label htmlFor="starting-capital" className="text-xs sm:text-sm">
              Starting Capital
            </Label>
            <Input
              id="starting-capital"
              type="number"
              value={startingCapital}
              onChange={e => setStartingCapitalInput(e.target.value)}
              className="w-full md:w-[200px] h-9 sm:h-10"
            />
          </div>

          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <Label htmlFor="time-range" className="text-xs sm:text-sm">
              Time Range
            </Label>
            <Select
              value={timeRange}
              onValueChange={v => setTimeRange(v as TimeRange)}
            >
              <SelectTrigger
                id="time-range"
                className="w-full md:w-[200px] h-9 sm:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YTD">Year to Date</SelectItem>
                <SelectItem value="1Y">1 Year</SelectItem>
                <SelectItem value="3Y">3 Years</SelectItem>
                <SelectItem value="5Y">5 Years</SelectItem>
                <SelectItem value="ALL">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <Label htmlFor="contract-size" className="text-xs sm:text-sm">
              Contract Size
            </Label>
            <Select
              value={contractSize}
              onValueChange={v => setContractSize(v as "mini" | "micro")}
            >
              <SelectTrigger
                id="contract-size"
                className="w-full md:w-[200px] h-9 sm:h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mini">Mini Contracts</SelectItem>
                <SelectItem value="micro">Micro Contracts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Strategy Selection - Mobile Optimized */}
        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="text-base sm:text-lg">
              Select Strategies (2-4)
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Choose strategies to compare
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {strategies?.map(strategy => (
                <div key={strategy.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`strategy-${strategy.id}`}
                    checked={selectedStrategyIds.includes(strategy.id)}
                    onCheckedChange={() => toggleStrategy(strategy.id)}
                    disabled={
                      !selectedStrategyIds.includes(strategy.id) &&
                      selectedStrategyIds.length >= 4
                    }
                  />
                  <label
                    htmlFor={`strategy-${strategy.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {strategy.name}
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comparison Results */}
        {selectedStrategyIds.length < 2 && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">
                Please select at least 2 strategies to compare
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">
                Error Loading Data
              </CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {data && selectedStrategyIds.length >= 2 && (
          <>
            {/* Equity Curves */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Equity Curves</CardTitle>
                    <CardDescription>
                      Individual and combined portfolio performance
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show-benchmark"
                      checked={showBenchmark}
                      onCheckedChange={checked =>
                        setShowBenchmark(checked as boolean)
                      }
                    />
                    <label
                      htmlFor="show-benchmark"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      Show S&P 500
                    </label>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] sm:h-[350px] md:h-[400px] lg:h-[450px] -mx-2 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
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
                        tickFormatter={value =>
                          `$${(value / 1000).toFixed(0)}k`
                        }
                        width={65}
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
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "20px", cursor: "pointer" }}
                        onClick={(e: any) => {
                          if (e.dataKey) {
                            toggleStrategyVisibility(e.dataKey);
                          }
                        }}
                      />
                      {data.strategies.map((strat, index) => (
                        <Line
                          key={strat.id}
                          type="monotone"
                          dataKey={`strategy${index}`}
                          stroke={COLORS[index]}
                          strokeWidth={2}
                          dot={false}
                          name={strat.name || ""}
                          hide={hiddenStrategies.has(`strategy${index}`)}
                          opacity={0.7}
                        />
                      ))}
                      <Line
                        type="monotone"
                        dataKey="combined"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                        name="Combined Portfolio"
                        hide={hiddenStrategies.has("combined")}
                      />
                      {showBenchmark && (
                        <Line
                          type="monotone"
                          dataKey="benchmark"
                          stroke="#fbbf24"
                          strokeWidth={2}
                          dot={false}
                          name="S&P 500"
                          hide={hiddenStrategies.has("benchmark")}
                          strokeDasharray="3 3"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Drawdown Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Drawdown Comparison</CardTitle>
                <CardDescription>
                  Individual and combined portfolio drawdowns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] sm:h-[350px] md:h-[400px] lg:h-[450px] -mx-2 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
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
                        domain={[
                          (dataMin: number) => {
                            // Auto-scale: add 15% padding below the actual minimum drawdown
                            const paddedMin = dataMin * 1.15;
                            // Round down to nearest 5% for cleaner axis labels
                            return Math.floor(paddedMin / 5) * 5;
                          },
                          0, // Drawdown is always 0 or negative
                        ]}
                      />
                      <Tooltip
                        formatter={(value: number) => `${value.toFixed(2)}%`}
                        labelStyle={{ color: "black" }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: "20px", cursor: "pointer" }}
                        onClick={(e: any) => {
                          if (e.dataKey) {
                            toggleStrategyVisibility(e.dataKey);
                          }
                        }}
                      />
                      {data.strategies.map((strat, index) => (
                        <Line
                          key={strat.id}
                          type="monotone"
                          dataKey={`dd${index}`}
                          stroke={COLORS[index]}
                          strokeWidth={2}
                          dot={false}
                          name={`${strat.name} DD`}
                          hide={hiddenStrategies.has(`strategy${index}`)}
                          opacity={0.7}
                        />
                      ))}
                      <Line
                        type="monotone"
                        dataKey="combinedDD"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                      />
                      {showBenchmark && (
                        <Line
                          type="monotone"
                          dataKey="benchmarkDD"
                          stroke="#FF8C00"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          name="S&P 500 DD"
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Correlation Matrix */}
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
                <CardDescription>
                  Correlation between strategy returns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-muted"></th>
                        {data.strategies.map(strat => (
                          <th
                            key={strat.id}
                            className="border p-2 bg-muted text-sm"
                          >
                            {strat.symbol}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.strategies.map((strat1, i) => (
                        <tr key={strat1.id}>
                          <td className="border p-2 bg-muted font-medium text-sm">
                            {strat1.symbol}
                          </td>
                          {data.strategies.map((strat2, j) => {
                            const corr = data.correlationMatrix[i]?.[j] || 0;
                            const bgColor =
                              i === j
                                ? "bg-primary/20 text-foreground"
                                : corr > 0.7
                                  ? "bg-red-500/80 text-white"
                                  : corr > 0.3
                                    ? "bg-yellow-500/80 text-black"
                                    : corr < -0.3
                                      ? "bg-blue-500/80 text-white"
                                      : "bg-green-500/80 text-white";

                            return (
                              <td
                                key={strat2.id}
                                className={`border p-2 text-center text-sm font-semibold ${bgColor}`}
                              >
                                {corr.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>Correlation ranges from -1 to 1:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>
                      <span className="text-blue-600">Blue</span>: Negative
                      correlation (&lt; -0.3)
                    </li>
                    <li>
                      <span className="text-green-600">Green</span>: Low
                      correlation (-0.3 to 0.3)
                    </li>
                    <li>
                      <span className="text-yellow-600">Yellow</span>: Moderate
                      correlation (0.3 to 0.7)
                    </li>
                    <li>
                      <span className="text-red-600">Red</span>: High
                      correlation (&gt; 0.7)
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Performance Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
                <CardDescription>Side-by-side metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-muted text-left">
                          Metric
                        </th>
                        <th className="border p-2 bg-primary/10 text-right font-bold">
                          Combined
                        </th>
                        {data.strategies.map(strat => (
                          <th
                            key={strat.id}
                            className="border p-2 bg-muted text-right"
                          >
                            {strat.symbol}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border p-2 font-medium">Total Return</td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold">
                          {data.combinedMetrics?.totalReturn.toFixed(2)}%
                        </td>
                        {data.strategies.map(strat => (
                          <td key={strat.id} className="border p-2 text-right">
                            {strat.metrics?.totalReturn.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border p-2 font-medium">
                          Annualized Return
                        </td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold">
                          {data.combinedMetrics?.annualizedReturn.toFixed(2)}%
                        </td>
                        {data.strategies.map(strat => (
                          <td key={strat.id} className="border p-2 text-right">
                            {strat.metrics?.annualizedReturn.toFixed(2)}%
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border p-2 font-medium">Sharpe Ratio</td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold">
                          {data.combinedMetrics?.sharpeRatio.toFixed(2)}
                        </td>
                        {data.strategies.map(strat => (
                          <td key={strat.id} className="border p-2 text-right">
                            {strat.metrics?.sharpeRatio.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border p-2 font-medium">Max Drawdown</td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold text-destructive">
                          -$
                          {(
                            ((data.combinedMetrics?.maxDrawdown || 0) *
                              startingCapital) /
                            100
                          ).toLocaleString("en-US", {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        {data.strategies.map(strat => (
                          <td
                            key={strat.id}
                            className="border p-2 text-right text-destructive"
                          >
                            -$
                            {(
                              ((strat.metrics?.maxDrawdown || 0) *
                                startingCapital) /
                              100
                            ).toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border p-2 font-medium">Win Rate</td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold">
                          {data.combinedMetrics?.winRate.toFixed(1)}%
                        </td>
                        {data.strategies.map(strat => (
                          <td key={strat.id} className="border p-2 text-right">
                            {strat.metrics?.winRate.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="border p-2 font-medium">Total Trades</td>
                        <td className="border p-2 bg-primary/5 text-right font-semibold">
                          {data.combinedMetrics?.totalTrades}
                        </td>
                        {data.strategies.map(strat => (
                          <td key={strat.id} className="border p-2 text-right">
                            {strat.metrics?.totalTrades}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Monte Carlo Simulation */}
            <MonteCarloSimulation
              trades={data.combinedTrades || []}
              startingCapital={startingCapital}
            />
          </>
        )}
      </div>
    </>
  );
}
