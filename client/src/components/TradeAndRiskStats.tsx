import { memo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { VisualAnalyticsCharts } from "./VisualAnalyticsCharts";

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  medianTradePnL: number;
  bestTradePnL: number;
  worstTradePnL: number;
  expectancyPnL: number;
  expectancyPct: number | null;
  averageHoldingTimeMinutes: number | null;
  medianHoldingTimeMinutes: number | null;
  longestWinStreak: number | null;
  longestLossStreak: number | null;
  // Professional risk metrics
  payoffRatio: number;
  riskOfRuin: number;
  riskOfRuinDetails: {
    capitalUnits: number;
    tradingAdvantage: number;
    minBalanceForZeroRisk: number;
    minBalanceForZeroRiskMicro: number; // For micro contracts (1/10th size)
  } | null;
  kellyPercentage: number;
  recoveryFactor: number;
  ulcerIndex: number;
  marRatio: number;
  monthlyConsistency: number;
  quarterlyConsistency: number;
}

interface TradeAndRiskStatsProps {
  tradeStats: TradeStats;
  isLeveraged?: boolean;
  startingCapital?: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatHoldingTime(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export const TradeAndRiskStats = memo(function TradeAndRiskStats({
  tradeStats,
  isLeveraged = false,
  startingCapital = 10000,
}: TradeAndRiskStatsProps) {
  // Helper to convert dollar amount to percentage of starting capital
  const toPercent = (dollarValue: number) =>
    (dollarValue / startingCapital) * 100;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade & Risk Statistics</CardTitle>
        <CardDescription>
          Comprehensive trading performance and risk metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="core" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="core" className="text-xs sm:text-sm py-2">
              Core Metrics
            </TabsTrigger>
            <TabsTrigger value="risk" className="text-xs sm:text-sm py-2">
              Risk Analysis
            </TabsTrigger>
            <TabsTrigger
              value="consistency"
              className="text-xs sm:text-sm py-2"
            >
              Consistency
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-xs sm:text-sm py-2">
              Visual
            </TabsTrigger>
          </TabsList>

          {/* Core Metrics Tab */}
          <TabsContent
            value="core"
            className="space-y-4 sm:space-y-6 mt-4 sm:mt-6"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Total Trades
                </div>
                <div className="text-xl sm:text-3xl font-bold">
                  {tradeStats.totalTrades}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tradeStats.winningTrades}W / {tradeStats.losingTrades}L
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Win Rate
                </div>
                <div className="text-xl sm:text-3xl font-bold">
                  {formatPercent(tradeStats.winRate)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Percentage of wins
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Profit Factor
                </div>
                <div className="text-xl sm:text-3xl font-bold">
                  {tradeStats.profitFactor.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Gross profit / loss
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Expectancy
                </div>
                <div
                  className={`text-xl sm:text-3xl font-bold ${tradeStats.expectancyPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {isLeveraged
                    ? `${toPercent(tradeStats.expectancyPnL).toFixed(2)}%`
                    : formatCurrency(tradeStats.expectancyPnL)}
                </div>
                <div className="text-xs text-muted-foreground">Per trade</div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Avg Win
                  </div>
                  <div className="text-xl font-semibold text-green-600">
                    {isLeveraged
                      ? `+${toPercent(tradeStats.avgWin).toFixed(2)}%`
                      : formatCurrency(tradeStats.avgWin)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Avg Loss
                  </div>
                  <div className="text-xl font-semibold text-red-600">
                    {isLeveraged
                      ? `${toPercent(tradeStats.avgLoss).toFixed(2)}%`
                      : formatCurrency(tradeStats.avgLoss)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Best Trade
                  </div>
                  <div className="text-xl font-semibold text-green-600">
                    {isLeveraged
                      ? `+${toPercent(tradeStats.bestTradePnL).toFixed(2)}%`
                      : formatCurrency(tradeStats.bestTradePnL)}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Worst Trade
                  </div>
                  <div className="text-xl font-semibold text-red-600">
                    {isLeveraged
                      ? `${toPercent(tradeStats.worstTradePnL).toFixed(2)}%`
                      : formatCurrency(tradeStats.worstTradePnL)}
                  </div>
                </div>
              </div>
            </div>

            {(tradeStats.averageHoldingTimeMinutes !== null ||
              tradeStats.longestWinStreak !== null) && (
              <div className="border-t pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {tradeStats.averageHoldingTimeMinutes !== null && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Avg Hold Time
                      </div>
                      <div className="text-xl font-semibold">
                        {formatHoldingTime(
                          tradeStats.averageHoldingTimeMinutes
                        )}
                      </div>
                    </div>
                  )}

                  {tradeStats.medianHoldingTimeMinutes !== null && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Median Hold
                      </div>
                      <div className="text-xl font-semibold">
                        {formatHoldingTime(tradeStats.medianHoldingTimeMinutes)}
                      </div>
                    </div>
                  )}

                  {tradeStats.longestWinStreak !== null && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Win Streak
                      </div>
                      <div className="text-xl font-semibold text-green-600">
                        {tradeStats.longestWinStreak}
                      </div>
                    </div>
                  )}

                  {tradeStats.longestLossStreak !== null && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Loss Streak
                      </div>
                      <div className="text-xl font-semibold text-red-600">
                        {tradeStats.longestLossStreak}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Risk Analysis Tab */}
          <TabsContent value="risk" className="space-y-6 mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Payoff Ratio
                </div>
                <div className="text-3xl font-bold">
                  {tradeStats.payoffRatio.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Avg Win / Avg Loss
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Kelly %
                </div>
                <div className="text-3xl font-bold text-blue-600">
                  {formatPercent(tradeStats.kellyPercentage, 2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Optimal position size
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Risk of Ruin
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-2 text-xs">
                          <div className="font-semibold">
                            Risk of Ruin Formula
                          </div>
                          <div className="font-mono text-[10px] bg-muted p-2 rounded">
                            RoR = ((1 - A) / (1 + A))^U
                          </div>
                          <div className="space-y-1">
                            <div>
                              <strong>A</strong> = Trading Advantage
                            </div>
                            <div className="pl-4 text-muted-foreground">
                              = (WinRate × PayoffRatio - LossRate) / PayoffRatio
                              {tradeStats.riskOfRuinDetails && (
                                <div>
                                  ={" "}
                                  {(
                                    tradeStats.riskOfRuinDetails
                                      .tradingAdvantage * 100
                                  ).toFixed(2)}
                                  %
                                </div>
                              )}
                            </div>
                            <div>
                              <strong>U</strong> = Capital Units
                            </div>
                            <div className="pl-4 text-muted-foreground">
                              = Account Balance / Avg Loss
                              {tradeStats.riskOfRuinDetails && (
                                <div>
                                  ={" "}
                                  {tradeStats.riskOfRuinDetails.capitalUnits.toFixed(
                                    1
                                  )}{" "}
                                  units
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="pt-2 border-t">
                            <strong>Assumptions:</strong> Fixed fractional
                            position sizing, independent trades, consistent win
                            rate and payoff ratio
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div
                  className={`text-3xl font-bold ${tradeStats.riskOfRuin < 5 ? "text-green-600" : tradeStats.riskOfRuin < 20 ? "text-yellow-600" : "text-red-600"}`}
                >
                  {tradeStats.riskOfRuin < 0.01
                    ? "<0.01%"
                    : formatPercent(tradeStats.riskOfRuin, 2)}
                </div>
                {tradeStats.riskOfRuinDetails &&
                  tradeStats.riskOfRuinDetails.minBalanceForZeroRisk > 0 && (
                    <div className="text-xs text-muted-foreground space-y-2">
                      <div className="font-medium text-foreground">
                        Min balance for 0% risk:
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/30 rounded p-2">
                          <div className="text-[10px] text-muted-foreground uppercase">
                            Micro Contracts
                          </div>
                          <div className="font-semibold text-foreground text-sm">
                            $
                            {tradeStats.riskOfRuinDetails.minBalanceForZeroRiskMicro.toLocaleString(
                              undefined,
                              { maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded p-2">
                          <div className="text-[10px] text-muted-foreground uppercase">
                            Mini Contracts
                          </div>
                          <div className="font-semibold text-foreground text-sm">
                            $
                            {tradeStats.riskOfRuinDetails.minBalanceForZeroRisk.toLocaleString(
                              undefined,
                              { maximumFractionDigits: 0 }
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                {!tradeStats.riskOfRuinDetails && (
                  <div className="text-xs text-muted-foreground">
                    Account depletion risk
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Recovery Factor
                  </div>
                  <div className="text-2xl font-bold">
                    {tradeStats.recoveryFactor.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Net Profit / Max DD
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    MAR Ratio
                  </div>
                  <div className="text-2xl font-bold">
                    {tradeStats.marRatio.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Return / Max DD
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    Ulcer Index
                  </div>
                  <div className="text-2xl font-bold">
                    {tradeStats.ulcerIndex.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    DD volatility
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <div className="text-sm font-semibold">Risk Interpretation</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    • <strong>Kelly %:</strong> Suggests risking{" "}
                    {tradeStats.kellyPercentage.toFixed(1)}% of capital per
                    trade for optimal growth
                  </div>
                  <div>
                    • <strong>Risk of Ruin:</strong>{" "}
                    {tradeStats.riskOfRuin < 5
                      ? "Very low"
                      : tradeStats.riskOfRuin < 20
                        ? "Moderate"
                        : "High"}{" "}
                    probability of account depletion
                  </div>
                  <div>
                    • <strong>Recovery Factor:</strong>{" "}
                    {tradeStats.recoveryFactor > 2
                      ? "Excellent"
                      : tradeStats.recoveryFactor > 1
                        ? "Good"
                        : "Needs improvement"}{" "}
                    - higher is better
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Consistency Tab */}
          <TabsContent value="consistency" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Monthly Consistency
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-bold">
                    {formatPercent(tradeStats.monthlyConsistency)}
                  </div>
                  <div className="text-sm text-muted-foreground pb-1">
                    of months profitable
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, tradeStats.monthlyConsistency)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  Quarterly Consistency
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-4xl font-bold">
                    {formatPercent(tradeStats.quarterlyConsistency)}
                  </div>
                  <div className="text-sm text-muted-foreground pb-1">
                    of quarters profitable
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, tradeStats.quarterlyConsistency)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <div className="text-sm font-semibold">
                  Consistency Benchmarks
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    • <strong>Excellent:</strong> &gt;70% monthly, &gt;80%
                    quarterly consistency
                  </div>
                  <div>
                    • <strong>Good:</strong> 50-70% monthly, 60-80% quarterly
                    consistency
                  </div>
                  <div>
                    • <strong>Needs Work:</strong> &lt;50% monthly, &lt;60%
                    quarterly consistency
                  </div>
                  <div className="pt-2 border-t mt-2">
                    <strong>Your Performance:</strong>{" "}
                    {tradeStats.monthlyConsistency > 70 &&
                    tradeStats.quarterlyConsistency > 80
                      ? "Excellent - Very consistent returns"
                      : tradeStats.monthlyConsistency > 50 &&
                          tradeStats.quarterlyConsistency > 60
                        ? "Good - Reasonably consistent"
                        : "Room for improvement - Focus on reducing volatility"}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Visual Analytics Tab */}
          <TabsContent value="visual" className="space-y-6 mt-6">
            <VisualAnalyticsCharts />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
