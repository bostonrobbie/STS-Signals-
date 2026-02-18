/**
 * Trade Source Breakdown Component
 *
 * Displays breakdown of trades by source (CSV Import, Webhook, Manual)
 * with performance metrics for each source.
 */

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  FileSpreadsheet,
  Webhook,
  PenLine,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface TradeSourceBreakdownProps {
  timeRange?: "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "ALL";
}

const SOURCE_COLORS = {
  csv_import: "#3b82f6", // Blue
  webhook: "#10b981", // Green
  manual: "#f59e0b", // Amber
};

const SOURCE_LABELS = {
  csv_import: "CSV Import",
  webhook: "Webhook Signal",
  manual: "Manual Entry",
};

const SOURCE_ICONS = {
  csv_import: FileSpreadsheet,
  webhook: Webhook,
  manual: PenLine,
};

export function TradeSourceBreakdown({ timeRange }: TradeSourceBreakdownProps) {
  const { data, isLoading, error } = trpc.tradeSource.breakdown.useQuery({
    timeRange,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Source Breakdown</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Source Breakdown</CardTitle>
          <CardDescription className="text-destructive">
            Failed to load trade source data
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Prepare pie chart data
  const pieData = data.breakdown.map(b => ({
    name: SOURCE_LABELS[b.source],
    value: b.tradeCount,
    color: SOURCE_COLORS[b.source],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Trade Source Breakdown
          <Badge variant="outline" className="ml-2">
            {data.totalTrades.toLocaleString()} trades
          </Badge>
        </CardTitle>
        <CardDescription>
          Performance comparison by trade source
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="h-[250px]">
            {data.totalTrades > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(1)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [
                      value.toLocaleString(),
                      "Trades",
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trades found
              </div>
            )}
          </div>

          {/* Source Details */}
          <div className="space-y-3">
            {data.breakdown.map(source => {
              const Icon = SOURCE_ICONS[source.source];
              const isProfit = source.totalPnL >= 0;

              return (
                <div
                  key={source.source}
                  className="p-4 rounded-lg border bg-card"
                  style={{
                    borderLeftColor: SOURCE_COLORS[source.source],
                    borderLeftWidth: 4,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon
                        className="h-4 w-4"
                        style={{ color: SOURCE_COLORS[source.source] }}
                      />
                      <span className="font-medium">
                        {SOURCE_LABELS[source.source]}
                      </span>
                    </div>
                    <Badge variant={isProfit ? "default" : "destructive"}>
                      {isProfit ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      $
                      {Math.abs(source.totalPnL).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Trades:</span>
                      <span className="ml-1 font-medium">
                        {source.tradeCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Win Rate:</span>
                      <span className="ml-1 font-medium">
                        {source.winRate.toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PF:</span>
                      <span className="ml-1 font-medium">
                        {source.profitFactor === Infinity
                          ? "∞"
                          : source.profitFactor.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    <div>
                      <span className="text-muted-foreground">Avg Win:</span>
                      <span className="ml-1 font-medium text-green-500">
                        $
                        {source.avgWin.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Loss:</span>
                      <span className="ml-1 font-medium text-red-500">
                        $
                        {source.avgLoss.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {data.breakdown.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No trade data available for the selected time range
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Webhook Signal Performance Card
 * Shows specific metrics for TradingView webhook signals
 */
export function WebhookSignalPerformance({
  timeRange,
}: TradeSourceBreakdownProps) {
  const { data, isLoading, error } =
    trpc.tradeSource.webhookPerformance.useQuery({ timeRange });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-green-500" />
            Webhook Signal Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.totalSignals === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-green-500" />
            Webhook Signal Performance
          </CardTitle>
          <CardDescription>No webhook signals recorded yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect TradingView alerts to start tracking webhook signal
            performance.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isProfit = data.totalPnL >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-green-500" />
          Webhook Signal Performance
          <Badge variant="outline" className="ml-2">
            {data.totalSignals.toLocaleString()} signals
          </Badge>
        </CardTitle>
        <CardDescription>TradingView webhook trading results</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div
              className="text-2xl font-bold"
              style={{ color: isProfit ? "#10b981" : "#ef4444" }}
            >
              $
              {Math.abs(data.totalPnL).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground">Total P&L</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{data.winRate.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">
              $
              {data.avgPnL.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="text-xs text-muted-foreground">Avg P&L/Trade</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">
              {data.profitFactor === Infinity
                ? "∞"
                : data.profitFactor.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Profit Factor</div>
          </div>
        </div>

        {data.signalsByStrategy.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">By Strategy</h4>
            <div className="space-y-2">
              {data.signalsByStrategy.map(s => (
                <div
                  key={s.strategyId}
                  className="flex justify-between items-center text-sm"
                >
                  <span>Strategy #{s.strategyId}</span>
                  <div className="flex gap-4">
                    <span>{s.tradeCount} trades</span>
                    <span
                      className={
                        s.totalPnL >= 0 ? "text-green-500" : "text-red-500"
                      }
                    >
                      $
                      {s.totalPnL.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span>{s.winRate.toFixed(1)}% WR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
