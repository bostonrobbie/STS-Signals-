import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { useChartColors } from "@/hooks/useChartColors";

interface DistributionBucket {
  from: number;
  to: number;
  count: number;
  percentage: number;
}

interface DailyReturnsDistribution {
  buckets: DistributionBucket[];
  skewness: number;
  kurtosis: number;
  pctGt1pct: number;
  pctLtMinus1pct: number;
  mean: number;
  stdDev: number;
  totalDays: number;
}

interface DistributionSnapshotProps {
  distribution: DailyReturnsDistribution;
}

export function DistributionSnapshot({
  distribution,
}: DistributionSnapshotProps) {
  const chartColors = useChartColors();
  if (!distribution || distribution.buckets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Returns Distribution</CardTitle>
          <CardDescription>
            Histogram of daily percentage returns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No distribution data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for chart
  const chartData = distribution.buckets.map(bucket => ({
    range: `${bucket.from.toFixed(1)}%`,
    percentage: bucket.percentage,
    count: bucket.count,
    from: bucket.from,
    to: bucket.to,
  }));

  // Color buckets based on return range
  const getBarColor = (from: number) => {
    if (from >= 1) return "hsl(142, 76%, 36%)"; // Strong green for >1%
    if (from >= 0) return "hsl(142, 76%, 56%)"; // Light green for positive
    if (from >= -1) return "hsl(0, 84%, 66%)"; // Light red for small negative
    return "hsl(0, 84%, 46%)"; // Strong red for <-1%
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">
          Daily Returns Distribution
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Histogram of {distribution.totalDays.toLocaleString()} trading days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Chart */}
          <div className="lg:col-span-2">
            <div className="h-[200px] sm:h-[230px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
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
                    dataKey="range"
                    tick={{ fontSize: 9, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    interval={1}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                    label={{
                      value: "Return Range",
                      position: "insideBottom",
                      offset: -5,
                      fill: chartColors.foreground,
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: chartColors.foreground }}
                    tickLine={{ stroke: chartColors.mutedForeground }}
                    axisLine={{ stroke: chartColors.mutedForeground }}
                    width={40}
                    label={{
                      value: "% of Days",
                      angle: -90,
                      position: "insideLeft",
                      fill: chartColors.foreground,
                      fontSize: 10,
                      dx: -5,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0]!.payload;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-sm text-gray-900">
                              {data.from.toFixed(1)}% to {data.to.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-600">
                              {data.count} days ({data.percentage.toFixed(1)}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(entry.from)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h4 className="text-xs sm:text-sm font-semibold mb-2">
                Distribution Stats
              </h4>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mean:</span>
                  <span className="font-medium">
                    {distribution.mean.toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Std Dev:</span>
                  <span className="font-medium">
                    {distribution.stdDev.toFixed(3)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skewness:</span>
                  <span className="font-medium">
                    {distribution.skewness.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kurtosis:</span>
                  <span className="font-medium">
                    {distribution.kurtosis.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs sm:text-sm font-semibold mb-2">
                Tail Analysis
              </h4>
              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days &gt; +1%:</span>
                  <span className="font-medium text-green-600">
                    {distribution.pctGt1pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days &lt; -1%:</span>
                  <span className="font-medium text-red-600">
                    {distribution.pctLtMinus1pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[10px] sm:text-xs text-muted-foreground pt-2 border-t">
              <p>
                <strong>Skewness:</strong>{" "}
                {distribution.skewness > 0
                  ? "Positive"
                  : distribution.skewness < 0
                    ? "Negative"
                    : "Symmetric"}
                {distribution.skewness > 0 && " (more extreme gains)"}
                {distribution.skewness < 0 && " (more extreme losses)"}
              </p>
              <p className="mt-1">
                <strong>Kurtosis:</strong>{" "}
                {distribution.kurtosis > 0
                  ? "Fat tails"
                  : distribution.kurtosis < 0
                    ? "Thin tails"
                    : "Normal"}
                {distribution.kurtosis > 0 && " (more outliers)"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
