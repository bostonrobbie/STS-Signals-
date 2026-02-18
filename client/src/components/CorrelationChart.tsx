import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface EquityPoint {
  date: Date;
  equity: number;
}

interface CorrelationChartProps {
  portfolioEquity: EquityPoint[];
  benchmarkEquity: EquityPoint[];
  correlation: number;
}

export function CorrelationChart({
  portfolioEquity,
  benchmarkEquity,
  correlation,
}: CorrelationChartProps) {
  // Calculate daily returns for scatter plot
  const scatterData: Array<{
    portfolioReturn: number;
    benchmarkReturn: number;
  }> = [];

  for (
    let i = 1;
    i < Math.min(portfolioEquity.length, benchmarkEquity.length);
    i++
  ) {
    const pReturn =
      ((portfolioEquity[i]!.equity - portfolioEquity[i - 1]!.equity) /
        portfolioEquity[i - 1]!.equity) *
      100;
    const bReturn =
      ((benchmarkEquity[i]!.equity - benchmarkEquity[i - 1]!.equity) /
        benchmarkEquity[i - 1]!.equity) *
      100;

    // Filter out extreme outliers for better visualization
    if (Math.abs(pReturn) < 20 && Math.abs(bReturn) < 5) {
      scatterData.push({
        portfolioReturn: pReturn,
        benchmarkReturn: bReturn,
      });
    }
  }

  const getCorrelationLabel = (corr: number) => {
    const abs = Math.abs(corr);
    if (abs >= 0.7) return "Strong";
    if (abs >= 0.4) return "Moderate";
    if (abs >= 0.2) return "Weak";
    return "Very Weak";
  };

  const getCorrelationColor = (corr: number) => {
    if (corr >= 0.7) return "text-green-600";
    if (corr >= 0.4) return "text-blue-600";
    if (corr >= 0) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          Portfolio vs S&P 500 Correlation
        </h3>
        <p className="text-sm text-muted-foreground">
          Relationship between portfolio and benchmark returns
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Correlation Coefficient
            </p>
            <p
              className={`text-4xl font-bold ${getCorrelationColor(correlation)}`}
            >
              {correlation.toFixed(3)}
            </p>
            <p className="text-sm font-medium">
              {getCorrelationLabel(correlation)}{" "}
              {correlation >= 0 ? "Positive" : "Negative"}
            </p>
            <div className="pt-4 space-y-2 text-xs text-muted-foreground">
              <p>• 1.0 = Perfect positive correlation</p>
              <p>• 0.0 = No correlation</p>
              <p>• -1.0 = Perfect negative correlation</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Daily Returns Scatter
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="benchmarkReturn"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={value => `${value.toFixed(1)}%`}
                  label={{
                    value: "S&P 500 Return",
                    position: "insideBottom",
                    offset: -5,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  dataKey="portfolioReturn"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={value => `${value.toFixed(1)}%`}
                  label={{
                    value: "Portfolio Return",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                  }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                        <p className="text-xs text-gray-900">
                          Portfolio: {data.portfolioReturn.toFixed(2)}%
                        </p>
                        <p className="text-xs text-gray-900">
                          S&P 500: {data.benchmarkReturn.toFixed(2)}%
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterData}
                  fill="oklch(var(--primary))"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">
          <strong>Interpretation:</strong> A correlation of{" "}
          {correlation.toFixed(3)} indicates a{" "}
          {getCorrelationLabel(correlation).toLowerCase()}{" "}
          {correlation >= 0 ? "positive" : "negative"} relationship between your
          portfolio and the S&P 500.{" "}
          {correlation < 0.3 && correlation > -0.3
            ? "Your portfolio moves largely independently of the market."
            : correlation >= 0.7
              ? "Your portfolio tends to move in the same direction as the market."
              : "Your portfolio shows some tendency to move with the market."}
        </p>
      </Card>
    </div>
  );
}
