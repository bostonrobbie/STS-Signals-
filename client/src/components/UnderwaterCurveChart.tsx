import { useState } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface UnderwaterPoint {
  date: Date;
  drawdownPercent: number;
  daysUnderwater: number;
}

interface UnderwaterMetrics {
  curve: UnderwaterPoint[];
  maxDrawdownPct: number;
  longestDrawdownDays: number;
  averageDrawdownDays: number;
  pctTimeInDrawdown: number;
  pctTimeBelowMinus10: number;
}

interface UnderwaterCurveChartProps {
  data: UnderwaterMetrics;
  benchmarkData?: UnderwaterMetrics;
}

export function UnderwaterCurveChart({
  data,
  benchmarkData,
}: UnderwaterCurveChartProps) {
  const chartColors = useChartColors();
  const [showBenchmark, setShowBenchmark] = useState(false);

  const chartData = data.curve.map((point, index) => ({
    date: point.date.toLocaleDateString(),
    drawdown: point.drawdownPercent,
    benchmarkDrawdown:
      benchmarkData && showBenchmark
        ? benchmarkData.curve[index]?.drawdownPercent
        : undefined,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div>
          <h3 className="text-lg font-semibold">Underwater Equity Curve</h3>
          <p className="text-sm text-muted-foreground">
            Drawdown from peak over time - understanding your portfolio's risk
            profile
          </p>
        </div>
        {benchmarkData && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-benchmark-underwater"
              checked={showBenchmark}
              onCheckedChange={checked => setShowBenchmark(checked as boolean)}
            />
            <Label
              htmlFor="show-benchmark-underwater"
              className="text-sm cursor-pointer"
            >
              Show S&P 500
            </Label>
          </div>
        )}
      </div>

      {/* Statistics Grid */}
      <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        <Card className="p-2 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">
            Max Drawdown
          </div>
          <div className="text-base sm:text-lg font-semibold text-red-600">
            {data.maxDrawdownPct.toFixed(2)}%
          </div>
        </Card>

        <Card className="p-2 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">
            Longest Drawdown
          </div>
          <div className="text-base sm:text-lg font-semibold">
            {data.longestDrawdownDays} days
          </div>
        </Card>

        <Card className="p-2 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">
            Average Drawdown
          </div>
          <div className="text-base sm:text-lg font-semibold">
            {data.averageDrawdownDays} days
          </div>
        </Card>

        <Card className="p-2 sm:p-3">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">
            % Time in Drawdown
          </div>
          <div className="text-base sm:text-lg font-semibold">
            {data.pctTimeInDrawdown.toFixed(1)}%
          </div>
        </Card>

        <Card className="p-2 sm:p-3 col-span-2 sm:col-span-1">
          <div className="text-[10px] sm:text-xs text-muted-foreground mb-1">
            % Time Below -10%
          </div>
          <div className="text-base sm:text-lg font-semibold text-red-600">
            {data.pctTimeBelowMinus10.toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* Chart */}
      <div className="h-[250px] sm:h-[280px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="oklch(var(--destructive))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor="oklch(var(--destructive))"
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
              tickLine={{ stroke: chartColors.mutedForeground }}
              axisLine={{ stroke: chartColors.mutedForeground }}
              interval="preserveStartEnd"
              tickCount={6}
              tickFormatter={value => {
                const date = new Date(value);
                return date.toLocaleDateString(undefined, {
                  month: "short",
                  year: "2-digit",
                });
              }}
              label={{
                value: "Date",
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
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const data = payload[0]!.payload;
                return (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="text-sm font-medium mb-1 text-gray-900">
                      {data.date}
                    </p>
                    <p className="text-sm text-red-600">
                      Portfolio: {data.drawdown.toFixed(2)}%
                    </p>
                    {data.benchmarkDrawdown !== undefined && (
                      <p className="text-sm text-orange-500">
                        S&P 500: {data.benchmarkDrawdown.toFixed(2)}%
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="drawdown"
              name="Portfolio"
              stroke="#ef4444"
              fill="url(#drawdownGradient)"
              strokeWidth={2}
            />
            {showBenchmark && benchmarkData && (
              <Area
                type="monotone"
                dataKey="benchmarkDrawdown"
                name="S&P 500"
                stroke="#FF8C00"
                fill="none"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
