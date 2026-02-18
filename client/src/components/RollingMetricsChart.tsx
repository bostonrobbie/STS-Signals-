import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartColors } from "@/hooks/useChartColors";

interface RollingMetricsData {
  window: number;
  data: Array<{
    date: Date;
    sharpe: number | null;
    sortino: number | null;
    maxDrawdown: number | null;
  }>;
}

interface RollingMetricsChartProps {
  rollingMetrics: RollingMetricsData[];
  timeRange?: string;
}

export function RollingMetricsChart({
  rollingMetrics,
  timeRange,
}: RollingMetricsChartProps) {
  const chartColors = useChartColors();
  // Determine window based on time range
  const getWindowForTimeRange = (range?: string) => {
    switch (range) {
      case "YTD":
      case "1Y":
        return 365;
      case "3Y":
        return 365;
      case "5Y":
      case "ALL":
        return 365;
      default:
        return 90;
    }
  };

  const selectedWindow = getWindowForTimeRange(timeRange);
  const selectedData = rollingMetrics.find(rm => rm.window === selectedWindow);

  if (!selectedData || selectedData.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rolling Performance Metrics</CardTitle>
          <CardDescription>
            Track performance stability over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  // Format data for charts
  const chartData = selectedData.data.map(d => ({
    date: d.date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    }),
    sharpe: d.sharpe,
    sortino: d.sortino,
    maxDrawdown: d.maxDrawdown,
  }));

  // Calculate medians
  const sharpeValues = chartData
    .map(d => d.sharpe)
    .filter(v => v !== null) as number[];
  const sortinoValues = chartData
    .map(d => d.sortino)
    .filter(v => v !== null) as number[];
  const medianSharpe =
    sharpeValues.length > 0
      ? sharpeValues.sort((a, b) => a - b)[Math.floor(sharpeValues.length / 2)]
      : null;
  const medianSortino =
    sortinoValues.length > 0
      ? sortinoValues.sort((a, b) => a - b)[
          Math.floor(sortinoValues.length / 2)
        ]
      : null;

  // Get latest values for end labels
  const latestSharpe = chartData[chartData.length - 1]?.sharpe;
  const latestSortino = chartData[chartData.length - 1]?.sortino;

  // Sample data for better performance (show every Nth point)
  const sampleRate = Math.max(1, Math.floor(chartData.length / 100));
  const sampledData = chartData.filter((_, i) => i % sampleRate === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rolling Performance Metrics</CardTitle>
        <CardDescription>
          {selectedWindow}-day rolling window showing Sharpe and Sortino ratio
          trends for selected time range
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Sharpe Ratio Chart */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Rolling Sharpe Ratio</h4>
              {latestSharpe !== null && latestSharpe !== undefined && (
                <span className="text-sm font-semibold text-blue-400">
                  Current: {latestSharpe.toFixed(2)}
                </span>
              )}
            </div>
            <div className="h-[180px] sm:h-[200px] md:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sampledData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    interval="preserveStartEnd"
                    tickCount={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    width={40}
                    label={{
                      value: "Ratio",
                      angle: -90,
                      position: "insideLeft",
                      fill: chartColors.foreground,
                      fontSize: 10,
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
                    formatter={(value: number) => value?.toFixed(2) ?? "N/A"}
                  />
                  <Line
                    type="monotone"
                    dataKey="sharpe"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                    name="Sharpe Ratio"
                  />
                  {medianSharpe !== null && (
                    <Line
                      type="monotone"
                      dataKey={() => medianSharpe}
                      stroke="#fbbf24"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Median"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sortino Ratio Chart */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">Rolling Sortino Ratio</h4>
              {latestSortino !== null && latestSortino !== undefined && (
                <span className="text-sm font-semibold text-green-400">
                  Current: {latestSortino.toFixed(2)}
                </span>
              )}
            </div>
            <div className="h-[180px] sm:h-[200px] md:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sampledData}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.15}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    interval="preserveStartEnd"
                    tickCount={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    width={40}
                    label={{
                      value: "Ratio",
                      angle: -90,
                      position: "insideLeft",
                      fill: chartColors.foreground,
                      fontSize: 10,
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
                    formatter={(value: number) => value?.toFixed(2) ?? "N/A"}
                  />
                  <Line
                    type="monotone"
                    dataKey="sortino"
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={false}
                    name="Sortino Ratio"
                  />
                  {medianSortino !== null && (
                    <Line
                      type="monotone"
                      dataKey={() => medianSortino}
                      stroke="#fbbf24"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Median"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-4">
            <p>
              <strong>Interpretation:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Sharpe Ratio:</strong> Risk-adjusted return. Higher is
                better. &gt;1 is good, &gt;2 is excellent.
              </li>
              <li>
                <strong>Sortino Ratio:</strong> Like Sharpe but only penalizes
                downside volatility. Higher is better.
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
