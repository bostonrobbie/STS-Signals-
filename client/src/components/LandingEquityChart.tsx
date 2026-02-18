import { trpc } from "@/lib/trpc";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { useMemo, useState } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import { Clock } from "lucide-react";

interface LandingEquityChartProps {
  strategyVariant: "unleveraged" | "leveraged";
}

interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

type TimeRange = "6M" | "YTD" | "1Y" | "5Y" | "10Y" | "ALL";

export function LandingEquityChart({
  strategyVariant,
}: LandingEquityChartProps) {
  const chartColors = useChartColors();
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  // Fetch public strategies list to get the correct strategy ID
  const { data: strategies } = trpc.publicApi.listStrategies.useQuery();

  // Get the strategy ID based on variant
  const strategyId = useMemo(() => {
    if (!strategies) return undefined;
    const symbol =
      strategyVariant === "leveraged" ? "NQTrendLeveraged" : "NQTrend";
    const strategy = strategies.find(s => s.symbol === symbol);
    return strategy?.id;
  }, [strategies, strategyVariant]);

  // Fetch public strategy detail with equity curve
  const { data, isLoading } = trpc.publicApi.strategyDetail.useQuery(
    {
      strategyId: strategyId!,
      timeRange: timeRange,
      startingCapital: 100000,
    },
    {
      enabled: !!strategyId,
      staleTime: 5 * 60 * 1000,
    }
  );

  // Process chart data with high granularity
  const chartData = useMemo(() => {
    if (!data?.equityCurve || data.equityCurve.length === 0) return [];

    const equity = data.equityCurve as EquityPoint[];
    // Higher granularity for detailed chart
    const maxPoints = 1000;
    const step = Math.max(1, Math.floor(equity.length / maxPoints));

    return equity
      .filter(
        (_: EquityPoint, index: number) =>
          index % step === 0 || index === equity.length - 1
      )
      .map((point: EquityPoint) => {
        const dateObj = new Date(point.date);
        return {
          date: dateObj.toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "2-digit",
          }),
          fullDate: dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          portfolio: point.equity,
        };
      });
  }, [data?.equityCurve]);

  if (isLoading || !chartData.length) {
    return (
      <div className="h-[500px] bg-background/50 rounded-xl border border-border flex items-center justify-center">
        <div className="text-muted-foreground">Loading equity curve...</div>
      </div>
    );
  }

  const startingCapital = 100000;

  return (
    <div className="bg-background/50 rounded-xl border border-border p-4 sm:p-6">
      {/* Header with Title and Time Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            Equity Curve
            <span className="inline-flex items-center px-2 py-0.5 text-[10px] sm:text-xs font-normal text-green-400 border border-green-400/30 rounded">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              Live
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Portfolio performance over time
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {(["6M", "YTD", "1Y", "5Y", "10Y", "ALL"] as TimeRange[]).map(
            range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  timeRange === range
                    ? "bg-emerald-500 text-white"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {range}
              </button>
            )
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px] sm:h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 60 }}
          >
            <defs>
              <linearGradient
                id="portfolioGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#374151"
              opacity={0.3}
            />

            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fill: chartColors.foreground, fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={80}
              interval="preserveStartEnd"
            />

            <YAxis
              stroke="#9ca3af"
              tick={{ fill: chartColors.foreground, fontSize: 12 }}
              tickFormatter={value =>
                `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
              }
              domain={["dataMin - 10000", "dataMax + 10000"]}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                color: "#111827",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              }}
              labelStyle={{
                color: "#111827",
                fontWeight: 600,
                marginBottom: "4px",
              }}
              itemStyle={{ color: "#374151" }}
              formatter={(value: number) => [
                `$${value.toLocaleString()}`,
                "Portfolio",
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
            />

            {/* Starting Capital Reference Line */}
            <ReferenceLine
              y={startingCapital}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{
                value: `Starting Capital: $${(startingCapital / 1000).toFixed(0)}k`,
                position: "insideBottomRight",
                fill: "#10b981",
                fontSize: 12,
              }}
            />

            {/* Portfolio Line */}
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981" }}
              fill="url(#portfolioGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Disclaimer */}
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Data from Jan 2011 to present • Updated daily • Past performance does
          not guarantee future results
        </p>
      </div>
    </div>
  );
}
