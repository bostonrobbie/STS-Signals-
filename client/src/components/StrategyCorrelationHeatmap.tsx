import { Card } from "@/components/ui/card";

interface CorrelationMatrixProps {
  labels: string[];
  matrix: number[][];
}

export function StrategyCorrelationHeatmap({ labels, matrix }: CorrelationMatrixProps) {
  // Get color for correlation value
  const getColor = (value: number) => {
    if (value >= 0.7) return 'oklch(0.7 0.15 145)'; // Strong positive - green
    if (value >= 0.4) return 'oklch(0.75 0.1 200)'; // Moderate positive - blue
    if (value >= 0.2) return 'oklch(0.8 0.08 250)'; // Weak positive - light blue
    if (value >= -0.2) return 'oklch(0.85 0.02 0)'; // Neutral - gray
    if (value >= -0.4) return 'oklch(0.8 0.08 50)'; // Weak negative - yellow
    if (value >= -0.7) return 'oklch(0.75 0.12 40)'; // Moderate negative - orange
    return 'oklch(0.6 0.18 25)'; // Strong negative - red
  };

  const getTextColor = (value: number) => {
    // Use white text for darker cells, black for lighter cells
    return Math.abs(value) > 0.5 ? '#ffffff' : '#000000';
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Strategy Correlation Matrix</h3>
        <p className="text-sm text-muted-foreground">
          Pearson correlation of daily returns between all strategies
        </p>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-xs font-medium text-left border"></th>
                  {labels.map((label, i) => (
                    <th
                      key={i}
                      className="p-2 text-xs font-medium text-center border min-w-[80px]"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((rowLabel, i) => (
                  <tr key={i}>
                    <td className="p-2 text-xs font-medium border whitespace-nowrap">
                      {rowLabel}
                    </td>
                    {labels.map((colLabel, j) => {
                      const value = matrix[i]?.[j] ?? 0;
                      return (
                        <td
                          key={j}
                          className="p-2 text-xs font-semibold text-center border cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: getColor(value),
                            color: getTextColor(value),
                          }}
                          title={`${rowLabel} vs ${colLabel}: ${value.toFixed(3)}`}
                        >
                          {value.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'oklch(0.7 0.15 145)' }}></div>
              <span>Strong (+0.7 to +1.0)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'oklch(0.85 0.02 0)' }}></div>
              <span>Neutral (-0.2 to +0.2)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'oklch(0.6 0.18 25)' }}></div>
              <span>Strong (-1.0 to -0.7)</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">
          <strong>Interpretation:</strong> Cells closer to +1.0 indicate highly correlated strategies that tend to move together.
          Cells near 0 show uncorrelated strategies that move independently.
          Negative values indicate inverse relationships. Diversification benefits come from low or negative correlations.
        </p>
      </Card>
    </div>
  );
}
