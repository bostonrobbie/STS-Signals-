import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Calculator, AlertCircle, Info, Save } from "lucide-react";

interface PositionSizingCalculatorProps {
  strategyId: number;
  strategyName: string;
}

export function PositionSizingCalculator({
  strategyId,
  // @ts-expect-error TS6133 unused
  strategyName,
}: PositionSizingCalculatorProps) {
  const [accountSize, setAccountSize] = useState<number>(100000);
  const [riskPercentage, setRiskPercentage] = useState<number>(2);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load user preferences
  const { data: preferences } = trpc.userPreferences.getPreferences.useQuery();
  const updatePreferences =
    trpc.userPreferences.updatePreferences.useMutation();

  // Auto-load saved preferences
  useEffect(() => {
    if (preferences) {
      if (preferences.accountSize) {
        setAccountSize(Number(preferences.accountSize));
      }
      if (preferences.riskPercentage) {
        setRiskPercentage(Number(preferences.riskPercentage));
      }
    }
  }, [preferences]);

  // Handle save preferences
  const handleSavePreferences = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updatePreferences.mutateAsync({
        accountSize,
        riskPercentage,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch position sizing calculation
  const { data, isLoading, error } = trpc.positionSizing.calculate.useQuery(
    {
      strategyId,
      accountSize,
      riskPercentage,
    },
    {
      enabled: accountSize >= 1000 && riskPercentage > 0,
    }
  );

  return (
    <div className="bg-background/50 rounded-xl border border-border p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-5 h-5 text-emerald-500" />
        <h3 className="text-lg font-semibold text-white">
          Position Sizing Calculator
        </h3>
      </div>

      {/* Input Fields */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Account Size
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <input
              type="number"
              value={accountSize}
              onChange={e => setAccountSize(Number(e.target.value))}
              min={1000}
              max={10000000}
              step={1000}
              className="w-full pl-8 pr-4 py-2 bg-card border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Your total trading account balance
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Risk Per Trade
          </label>
          <div className="relative">
            <input
              type="number"
              value={riskPercentage}
              onChange={e => setRiskPercentage(Number(e.target.value))}
              min={0.5}
              max={10}
              step={0.5}
              className="w-full pr-8 pl-4 py-2 bg-card border border-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Percentage of account to risk per trade (1-2% recommended)
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSavePreferences}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving..." : "Save Preferences"}
        </button>

        {saveSuccess && (
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-3">
            <p className="text-sm text-emerald-400 text-center">
              ✓ Preferences saved successfully
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Calculating position size...
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400">
                Error calculating position size
              </p>
              <p className="text-xs text-red-500 mt-1">{error.message}</p>
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Recommended Contracts */}
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-lg p-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">
                Recommended Contracts
              </p>
              <p className="text-4xl font-bold text-emerald-500">
                {data.recommendedContracts}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.strategy.symbol} Futures
              </p>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Risk Amount</p>
              <p className="text-lg font-semibold text-white">
                ${data.riskAmount.toLocaleString()}
              </p>
            </div>

            <div className="bg-card/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Margin Required
              </p>
              <p className="text-lg font-semibold text-white">
                ${data.marginRequired.toLocaleString()}
              </p>
            </div>

            <div className="bg-card/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Margin Utilization
              </p>
              <p className="text-lg font-semibold text-white">
                {data.marginUtilization.toFixed(1)}%
              </p>
            </div>

            <div className="bg-card/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Max Loss Scenario
              </p>
              <p className="text-lg font-semibold text-red-400">
                -${data.maxLossScenario.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Strategy Stats */}
          {data.strategyStats && (
            <div className="bg-card/30 rounded-lg p-4 border border-border">
              <p className="text-sm font-medium text-gray-300 mb-3">
                Strategy Statistics
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Max Drawdown:</span>
                  <span className="text-red-400 ml-2 font-medium">
                    -${data.strategyStats.maxDrawdown.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="text-emerald-400 ml-2 font-medium">
                    {data.strategyStats.winRate.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Win:</span>
                  <span className="text-emerald-400 ml-2 font-medium">
                    ${data.strategyStats.avgWin.toFixed(0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Loss:</span>
                  <span className="text-red-400 ml-2 font-medium">
                    -${data.strategyStats.avgLoss.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Kelly Criterion Suggestion */}
          {data.kellySuggestion && (
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-300">
                    Kelly Criterion Suggestion
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.kellySuggestion.note}
                  </p>
                  <p className="text-sm text-blue-400 mt-2">
                    Suggested risk: {data.kellySuggestion.percentage.toFixed(2)}
                    %
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {data.notes && data.notes.length > 0 && (
            <div className="space-y-2">
              {data.notes.map((note, index) => (
                <div
                  key={index}
                  className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-400">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Contract Specs */}
          {data.contractSpec && (
            <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
              <p>
                <span className="text-muted-foreground">Point Value:</span> $
                {data.contractSpec.pointValue} per point
              </p>
              <p>
                <span className="text-muted-foreground">
                  Margin Requirement:
                </span>{" "}
                ${data.contractSpec.marginRequirement.toLocaleString()} per
                contract
              </p>
              <p>
                <span className="text-muted-foreground">Tick Size:</span> $
                {data.contractSpec.tickSize}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          This calculator provides general guidance only. Past performance does
          not guarantee future results. Always consult with a financial advisor
          before trading.
        </p>
      </div>
    </div>
  );
}
