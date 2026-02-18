import React, { useMemo } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface WebhookLog {
  id: number;
  createdAt: Date | string;
  processingTimeMs: number | null;
  status: string;
}

interface WebhookLatencyChartProps {
  logs: WebhookLog[];
  avgProcessingTimeMs?: number;
}

export function WebhookLatencyChart({
  logs,
  avgProcessingTimeMs,
}: WebhookLatencyChartProps) {
  const chartColors = useChartColors();
  const chartData = useMemo(() => {
    // Filter successful webhooks with processing time
    const successfulLogs = logs
      .filter(log => log.status === "success" && log.processingTimeMs !== null)
      .slice(-50); // Last 50 webhooks

    return successfulLogs.map((log, index) => ({
      index: index + 1,
      time: log.processingTimeMs,
      timestamp: new Date(log.createdAt).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
      }),
    }));
  }, [logs]);

  const stats = useMemo(() => {
    const times = chartData.map(d => d.time);
    if (times.length === 0) return { min: 0, max: 0, avg: 0 };

    return {
      // @ts-expect-error TS2345
      min: Math.min(...times),
      // @ts-expect-error TS2345
      max: Math.max(...times),
      avg:
        // @ts-expect-error TS18047, TS2531
        avgProcessingTimeMs || times.reduce((a, b) => a + b, 0) / times.length,
    };
  }, [chartData, avgProcessingTimeMs]);

  if (chartData.length === 0) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Webhook Latency Monitor</CardTitle>
          <CardDescription className="text-xs">
            Real-time processing time trends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No webhook data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Webhook Latency Monitor</CardTitle>
        <CardDescription className="text-xs">
          Last {chartData.length} successful webhooks • Min:{" "}
          {stats.min.toFixed(0)}ms • Avg: {stats.avg.toFixed(0)}ms • Max:{" "}
          {stats.max.toFixed(0)}ms
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.2}
                vertical={false}
              />
              <XAxis
                dataKey="index"
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                label={{
                  value: "Webhook #",
                  position: "insideBottom",
                  offset: -5,
                  style: { fill: chartColors.foreground, fontSize: 11 },
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: chartColors.foreground }}
                tickLine={{ stroke: chartColors.mutedForeground }}
                axisLine={{ stroke: chartColors.mutedForeground }}
                label={{
                  value: "Time (ms)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: chartColors.foreground, fontSize: 11 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#111827",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 600 }}
                itemStyle={{ color: "#374151" }}
                labelFormatter={value => `Webhook #${value}`}
                formatter={(value: number) => [
                  `${value.toFixed(0)}ms`,
                  "Latency",
                ]}
              />
              {/* Average line */}
              <ReferenceLine
                y={stats.avg}
                stroke="#10b981"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Avg: ${stats.avg.toFixed(0)}ms`,
                  position: "right",
                  fill: "#10b981",
                  fontSize: 11,
                }}
              />
              {/* Target line (100ms) */}
              <ReferenceLine
                y={100}
                stroke="#3b82f6"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: "Target: 100ms",
                  position: "right",
                  fill: "#3b82f6",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="time"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 2, fill: "#60a5fa" }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
