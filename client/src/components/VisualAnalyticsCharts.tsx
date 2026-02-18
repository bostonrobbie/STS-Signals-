import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useChartColors } from "@/hooks/useChartColors";

type TimeRange = "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "ALL";

interface VisualAnalyticsChartsProps {
  timeRange?: TimeRange;
}

export function VisualAnalyticsCharts({
  timeRange,
}: VisualAnalyticsChartsProps) {
  const chartColors = useChartColors();
  const { data, isLoading } = trpc.portfolio.visualAnalytics.useQuery(
    { timeRange },
    { staleTime: 15 * 60 * 1000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  // Prepare streak distribution data for chart
  const streakData = [
    ...data.streakDistribution.winStreaks.map(s => ({
      length: `${s.length}W`,
      wins: s.count,
      losses: 0,
    })),
    ...data.streakDistribution.lossStreaks.map(s => ({
      length: `${s.length}L`,
      wins: 0,
      losses: s.count,
    })),
  ].sort((a, b) => {
    const aNum = parseInt(a.length);
    const bNum = parseInt(b.length);
    const aIsWin = a.length.endsWith("W");
    const bIsWin = b.length.endsWith("W");

    if (aIsWin && !bIsWin) return -1;
    if (!aIsWin && bIsWin) return 1;
    return aNum - bNum;
  });

  // Prepare day of week data - only show Monday-Friday for intraday strategies
  // Weekend trades (if any) are likely data entry errors or timezone issues
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayOfWeekData = dayOrder
    .map(day => data.dayOfWeekPerformance.find(d => d.dayOfWeek === day))
    .filter(d => d && d.trades > 0) // Only include days with actual trades
    .map(day => ({
      day: day!.dayOfWeek.slice(0, 3),
      trades: day!.trades,
      winRate: day!.winRate,
      avgPnL: day!.avgPnL,
    }));

  return (
    <div className="space-y-8">
      {/* Consecutive Wins/Losses Distribution */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            Consecutive Wins/Losses Distribution
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Frequency of winning and losing streaks
          </p>
        </div>
        <div className="h-[220px] sm:h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={streakData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis
                dataKey="length"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                label={{
                  value: "Streak Length",
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
                width={40}
                label={{
                  value: "Count",
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
                  borderRadius: "6px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                formatter={(value: number) => value}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="wins"
                fill="#10b981"
                name="Win Streaks"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="losses"
                fill="#ef4444"
                name="Loss Streaks"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trade Duration Histogram */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            Trade Duration Distribution
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Number of trades by holding time
          </p>
        </div>
        <div className="h-[220px] sm:h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.durationDistribution.buckets}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                label={{
                  value: "Duration",
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
                width={40}
                label={{
                  value: "Trades",
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
                  borderRadius: "6px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                formatter={(value: number, name: string) => {
                  if (name === "avgPnL") return `$${value.toFixed(2)}`;
                  return value;
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                name="Trades"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win/Loss by Day of Week */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">
            Performance by Day of Week
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Win rate and average P&L by trading day
          </p>
        </div>
        <div className="h-[220px] sm:h-[260px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dayOfWeekData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.15}
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                width={40}
                label={{
                  value: "Win Rate %",
                  angle: -90,
                  position: "insideLeft",
                  fill: chartColors.foreground,
                  fontSize: 10,
                  dx: -5,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                width={50}
                label={{
                  value: "Avg P&L $",
                  angle: 90,
                  position: "insideRight",
                  fill: chartColors.foreground,
                  fontSize: 10,
                  dx: 5,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                formatter={(value: number, name: string) => {
                  if (name === "Win Rate") return `${value.toFixed(1)}%`;
                  if (name === "Avg P&L") return `$${value.toFixed(2)}`;
                  return value;
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                yAxisId="left"
                dataKey="winRate"
                fill="#8b5cf6"
                name="Win Rate"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="avgPnL"
                fill="#06b6d4"
                name="Avg P&L"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
