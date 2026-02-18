import { useMemo, useState } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Shield,
  Target,
  DollarSign,
} from "lucide-react";

interface Trade {
  entryDate: Date;
  exitDate: Date;
  pnl: number;
}

interface MonteCarloSimulationProps {
  trades: Trade[];
  startingCapital: number;
}

interface SimulationResult {
  paths: number[][];
  percentiles: {
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
  };
  finalValues: number[];
  stats: {
    meanFinal: number;
    medianFinal: number;
    stdDevFinal: number;
    probProfit: number;
    probRuin: number;
    worstCase: number;
    bestCase: number;
    maxDrawdown: number;
    avgDrawdown: number;
    safePositionSize: number;
    recommendedCapital: number;
    expectedAnnualReturn: number;
    riskRewardRatio: number;
  };
}

function runMonteCarloSimulation(
  trades: Trade[],
  startingCapital: number,
  numSimulations: number = 1000
): SimulationResult {
  const returns = trades.map(t => t.pnl / 100); // Convert cents to dollars
  const numTrades = trades.length;

  // Calculate win rate and average win/loss
  // const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length; // Available for future use
  const winRate = returns.filter(r => r > 0).length / returns.length;
  const avgWin =
    returns.filter(r => r > 0).reduce((sum, r) => sum + r, 0) /
      returns.filter(r => r > 0).length || 0;
  const avgLoss =
    Math.abs(
      returns.filter(r => r < 0).reduce((sum, r) => sum + r, 0) /
        returns.filter(r => r < 0).length
    ) || 0;

  const paths: number[][] = [];
  const finalValues: number[] = [];
  const maxDrawdowns: number[] = [];

  // Run simulations
  for (let sim = 0; sim < numSimulations; sim++) {
    const path: number[] = [startingCapital];
    let equity = startingCapital;
    let peak = startingCapital;
    let maxDD = 0;

    // Randomly sample returns with replacement
    for (let i = 0; i < numTrades; i++) {
      const randomIndex = Math.floor(Math.random() * returns.length);
      const randomReturn = returns[randomIndex]!;
      equity += randomReturn;
      path.push(equity);

      // Track drawdown
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    paths.push(path);
    finalValues.push(equity);
    maxDrawdowns.push(maxDD);
  }

  // Calculate percentiles at each step
  const percentiles = {
    p5: [] as number[],
    p25: [] as number[],
    p50: [] as number[],
    p75: [] as number[],
    p95: [] as number[],
  };

  for (let step = 0; step <= numTrades; step++) {
    const values = paths.map(p => p[step]!).sort((a, b) => a - b);
    percentiles.p5.push(values[Math.floor(numSimulations * 0.05)]!);
    percentiles.p25.push(values[Math.floor(numSimulations * 0.25)]!);
    percentiles.p50.push(values[Math.floor(numSimulations * 0.5)]!);
    percentiles.p75.push(values[Math.floor(numSimulations * 0.75)]!);
    percentiles.p95.push(values[Math.floor(numSimulations * 0.95)]!);
  }

  // Calculate statistics
  const sortedFinals = [...finalValues].sort((a, b) => a - b);
  const sortedDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
  const meanFinal = finalValues.reduce((sum, v) => sum + v, 0) / numSimulations;
  const medianFinal = sortedFinals[Math.floor(numSimulations / 2)]!;
  const variance =
    finalValues.reduce((sum, v) => sum + Math.pow(v - meanFinal, 2), 0) /
    numSimulations;
  const stdDevFinal = Math.sqrt(variance);
  const probProfit =
    finalValues.filter(v => v > startingCapital).length / numSimulations;
  const probRuin =
    finalValues.filter(v => v < startingCapital * 0.5).length / numSimulations;
  const worstCase = sortedFinals[Math.floor(numSimulations * 0.05)]!; // 5th percentile
  const bestCase = sortedFinals[Math.floor(numSimulations * 0.95)]!; // 95th percentile

  // Calculate max drawdown stats
  const maxDrawdown = sortedDrawdowns[Math.floor(numSimulations * 0.95)]!; // 95th percentile of drawdowns
  const avgDrawdown =
    maxDrawdowns.reduce((sum, d) => sum + d, 0) / numSimulations;

  // Calculate recommended position sizing using Kelly Criterion (conservative)
  const kellyFraction = winRate - (1 - winRate) / (avgWin / avgLoss || 1);
  const safePositionSize = Math.max(0.01, Math.min(0.25, kellyFraction * 0.5)); // Half Kelly, capped at 25%

  // Calculate recommended capital based on worst-case scenario
  const worstDrawdownDollars = maxDrawdown * startingCapital;
  const recommendedCapital = worstDrawdownDollars / 0.2; // Max 20% drawdown tolerance

  // Calculate expected annual return (assuming 252 trading days, ~2 trades/day average)
  const tradesPerYear = Math.min(numTrades, 504);
  const totalReturn = (meanFinal - startingCapital) / startingCapital;
  const yearsSimulated = numTrades / tradesPerYear;
  const expectedAnnualReturn =
    yearsSimulated > 0 ? Math.pow(1 + totalReturn, 1 / yearsSimulated) - 1 : 0;

  // Risk/Reward ratio
  const riskRewardRatio = avgWin / avgLoss || 0;

  return {
    paths,
    percentiles,
    finalValues,
    stats: {
      meanFinal,
      medianFinal,
      stdDevFinal,
      probProfit,
      probRuin,
      worstCase,
      bestCase,
      maxDrawdown,
      avgDrawdown,
      safePositionSize,
      recommendedCapital,
      expectedAnnualReturn,
      riskRewardRatio,
    },
  };
}

export default function MonteCarloSimulation({
  trades,
  startingCapital,
}: MonteCarloSimulationProps) {
  const chartColors = useChartColors();
  const [numSimulations, setNumSimulations] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);

  const simulationResult = useMemo(() => {
    if (trades.length === 0) return null;
    setIsRunning(true);
    const result = runMonteCarloSimulation(
      trades,
      startingCapital,
      numSimulations
    );
    setIsRunning(false);
    return result;
  }, [trades, startingCapital, numSimulations]);

  if (trades.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <CardDescription>
            Insufficient trade data for simulation
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const chartData =
    simulationResult?.percentiles.p50.map((_, index) => ({
      trade: index,
      p5: simulationResult.percentiles.p5[index],
      p25: simulationResult.percentiles.p25[index],
      p50: simulationResult.percentiles.p50[index],
      p75: simulationResult.percentiles.p75[index],
      p95: simulationResult.percentiles.p95[index],
    })) || [];

  // Sample data for performance (show every Nth point)
  const sampleInterval = Math.max(1, Math.floor(chartData.length / 200));
  const sampledData = chartData.filter((_, i) => i % sampleInterval === 0);

  // Determine overall assessment
  const getAssessment = () => {
    if (!simulationResult) return { status: "loading", message: "" };
    const { probProfit, probRuin, maxDrawdown } = simulationResult.stats;

    if (probProfit >= 0.9 && probRuin < 0.05 && maxDrawdown < 0.2) {
      return {
        status: "excellent",
        message:
          "Excellent risk profile. This strategy shows strong probability of profit with manageable risk.",
        icon: CheckCircle2,
        color: "text-green-500",
      };
    } else if (probProfit >= 0.7 && probRuin < 0.15) {
      return {
        status: "good",
        message:
          "Good risk profile. Consider the recommended position sizing to optimize returns.",
        icon: CheckCircle2,
        color: "text-green-500",
      };
    } else if (probProfit >= 0.5 && probRuin < 0.25) {
      return {
        status: "moderate",
        message:
          "Moderate risk. Use conservative position sizing and ensure adequate capital reserves.",
        icon: AlertTriangle,
        color: "text-yellow-500",
      };
    } else {
      return {
        status: "high-risk",
        message:
          "High risk profile. Consider reducing position size or improving strategy edge before trading live.",
        icon: XCircle,
        color: "text-red-500",
      };
    }
  };

  const assessment = getAssessment();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Monte Carlo Risk Analysis
        </CardTitle>
        <CardDescription>
          {numSimulations.toLocaleString()} simulations of{" "}
          {trades.length.toLocaleString()} trades to estimate future outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <Label htmlFor="numSims">Number of Simulations</Label>
            <Input
              id="numSims"
              type="number"
              min={100}
              max={10000}
              step={100}
              value={numSimulations}
              onChange={e => setNumSimulations(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <Button
            onClick={() => setNumSimulations(prev => prev)}
            disabled={isRunning}
          >
            {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Simulation
          </Button>
        </div>

        {/* Overall Assessment */}
        {simulationResult && (
          <div
            className={`p-4 rounded-lg border-2 ${
              assessment.status === "excellent" || assessment.status === "good"
                ? "bg-green-500/10 border-green-500/30"
                : assessment.status === "moderate"
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-red-500/10 border-red-500/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {assessment.icon && (
                <assessment.icon
                  className={`h-6 w-6 ${assessment.color} flex-shrink-0 mt-0.5`}
                />
              )}
              <div>
                <h3 className={`font-semibold ${assessment.color}`}>
                  {assessment.status === "excellent"
                    ? "Excellent Risk Profile"
                    : assessment.status === "good"
                      ? "Good Risk Profile"
                      : assessment.status === "moderate"
                        ? "Moderate Risk"
                        : "High Risk Warning"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {assessment.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Key Recommendations */}
        {simulationResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-blue-500">
                  RECOMMENDED POSITION SIZE
                </span>
              </div>
              <div className="text-2xl font-bold">
                {(simulationResult.stats.safePositionSize * 100).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                of account per trade (Half-Kelly)
              </p>
            </div>

            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-purple-500">
                  MINIMUM ACCOUNT SIZE
                </span>
              </div>
              <div className="text-2xl font-bold">
                $
                {simulationResult.stats.recommendedCapital.toLocaleString(
                  undefined,
                  { maximumFractionDigits: 0 }
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                to survive 95th percentile drawdown
              </p>
            </div>

            <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-emerald-500">
                  95% CONFIDENCE OUTCOME
                </span>
              </div>
              <div className="text-2xl font-bold">
                {simulationResult.stats.probProfit >= 0.95 ? (
                  <span className="text-green-500">Profitable</span>
                ) : simulationResult.stats.probProfit >= 0.8 ? (
                  <span className="text-yellow-500">Likely Profitable</span>
                ) : (
                  <span className="text-red-500">Uncertain</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(simulationResult.stats.probProfit * 100).toFixed(1)}%
                probability of profit
              </p>
            </div>
          </div>
        )}

        {/* Detailed Statistics */}
        {simulationResult && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">
                Expected Outcome (Median)
              </div>
              <div className="text-lg font-bold">
                $
                {simulationResult.stats.medianFinal.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {(
                  ((simulationResult.stats.medianFinal - startingCapital) /
                    startingCapital) *
                  100
                ).toFixed(1)}
                % return
              </div>
            </div>

            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
              <div className="text-xs text-muted-foreground mb-1">
                Best Case (95th %ile)
              </div>
              <div className="text-lg font-bold text-green-600">
                $
                {simulationResult.stats.bestCase.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="text-xs text-green-600">
                +
                {(
                  ((simulationResult.stats.bestCase - startingCapital) /
                    startingCapital) *
                  100
                ).toFixed(1)}
                %
              </div>
            </div>

            <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
              <div className="text-xs text-muted-foreground mb-1">
                Worst Case (5th %ile)
              </div>
              <div className="text-lg font-bold text-red-600">
                $
                {simulationResult.stats.worstCase.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="text-xs text-red-600">
                {(
                  ((simulationResult.stats.worstCase - startingCapital) /
                    startingCapital) *
                  100
                ).toFixed(1)}
                %
              </div>
            </div>

            <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
              <div className="text-xs text-muted-foreground mb-1">
                Max Drawdown (95th %ile)
              </div>
              <div className="text-lg font-bold text-orange-600">
                {(simulationResult.stats.maxDrawdown * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-orange-600">
                $
                {(
                  simulationResult.stats.maxDrawdown * startingCapital
                ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">
                Risk/Reward Ratio
              </div>
              <div className="text-lg font-bold">
                {simulationResult.stats.riskRewardRatio.toFixed(2)}:1
              </div>
              <div className="text-xs text-muted-foreground">
                Avg Win / Avg Loss
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">
                Risk of Ruin
              </div>
              <div
                className={`text-lg font-bold ${simulationResult.stats.probRuin < 0.05 ? "text-green-600" : simulationResult.stats.probRuin < 0.15 ? "text-yellow-600" : "text-red-600"}`}
              >
                {(simulationResult.stats.probRuin * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                Chance of 50%+ loss
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">
                Std Deviation
              </div>
              <div className="text-lg font-bold">
                $
                {simulationResult.stats.stdDevFinal.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                Outcome variability
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">
                Simulations
              </div>
              <div className="text-lg font-bold">
                {numSimulations.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                Monte Carlo paths
              </div>
            </div>
          </div>
        )}

        {/* Chart */}
        {simulationResult && (
          <div className="h-[280px] sm:h-[320px] md:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sampledData}
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.15}
                  vertical={false}
                />
                <XAxis
                  dataKey="trade"
                  tick={{ fontSize: 10, fill: chartColors.foreground }}
                  tickLine={{ stroke: chartColors.mutedForeground }}
                  axisLine={{ stroke: chartColors.mutedForeground }}
                  interval="preserveStartEnd"
                  label={{
                    value: "Trade Number",
                    position: "insideBottom",
                    offset: -5,
                    fill: chartColors.foreground,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: chartColors.foreground }}
                  tickLine={{ stroke: chartColors.mutedForeground }}
                  axisLine={{ stroke: chartColors.mutedForeground }}
                  tickFormatter={value => `$${(value / 1000).toFixed(0)}k`}
                  width={55}
                  label={{
                    value: "Portfolio Value",
                    angle: -90,
                    position: "insideLeft",
                    fill: chartColors.foreground,
                    fontSize: 11,
                    dx: -5,
                  }}
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
                  formatter={(value: number) =>
                    `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  }
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Area
                  type="monotone"
                  dataKey="p95"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  name="Best 5%"
                />
                <Area
                  type="monotone"
                  dataKey="p75"
                  stackId="2"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  name="Top 25%"
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  name="Median"
                />
                <Area
                  type="monotone"
                  dataKey="p25"
                  stackId="3"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                  name="Bottom 25%"
                />
                <Area
                  type="monotone"
                  dataKey="p5"
                  stackId="4"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  name="Worst 5%"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Interpretation Guide */}
        <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-4">
          <p className="font-semibold mb-2 text-sm">
            How to Use These Results:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-medium text-foreground">Position Sizing:</p>
              <p>
                Risk no more than the recommended percentage per trade to
                survive drawdowns.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Account Size:</p>
              <p>
                Ensure your account exceeds the minimum to handle worst-case
                scenarios.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Confidence Level:</p>
              <p>
                95% confidence means only 5% of simulations performed worse than
                shown.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Risk of Ruin:</p>
              <p>
                Below 5% is excellent, 5-15% is acceptable, above 15% requires
                caution.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
