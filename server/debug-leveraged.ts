// Debug script to check leveraged calculation
import * as db from "./db";
import * as analytics from "./analytics";

async function debugLeveraged() {
  console.log("Fetching strategies...");
  const strategies = await db.getAllStrategies();
  console.log(
    "Strategies:",
    strategies.map(s => ({ id: s.id, name: s.name, symbol: s.symbol }))
  );

  // Find NQTrend strategy
  const nqTrend = strategies.find(s => s.symbol === "NQTrend");
  if (!nqTrend) {
    console.log("NQTrend strategy not found!");
    return;
  }
  console.log("NQTrend strategy ID:", nqTrend.id);

  // Get trades for NQTrend
  const trades = await db.getTrades({ strategyIds: [nqTrend.id] });
  console.log("Total trades:", trades.length);

  // Check pnlPercent values
  console.log("Sample trades with pnlPercent:");
  trades.slice(0, 5).forEach(t => {
    console.log({
      id: t.id,
      pnl: t.pnl,
      pnlPercent: t.pnlPercent,
      entryDate: t.entryDate,
      exitDate: t.exitDate,
    });
  });

  // Calculate leveraged metrics
  const startingCapital = 10000;
  console.log(
    "\\nCalculating leveraged metrics with starting capital:",
    startingCapital
  );

  const leveragedMetrics = analytics.calculateLeveragedPerformanceMetrics(
    trades as any,
    startingCapital
  );
  console.log("Leveraged metrics:", {
    totalReturn: leveragedMetrics.totalReturn,
    maxDrawdown: leveragedMetrics.maxDrawdown,
    winRate: leveragedMetrics.winRate,
    calmarRatio: leveragedMetrics.calmarRatio,
  });

  // Calculate standard metrics for comparison
  const standardMetrics = analytics.calculatePerformanceMetrics(
    trades as any,
    100000
  );
  console.log("Standard metrics:", {
    totalReturn: standardMetrics.totalReturn,
    maxDrawdown: standardMetrics.maxDrawdown,
    winRate: standardMetrics.winRate,
    calmarRatio: standardMetrics.calmarRatio,
  });

  // Calculate leveraged equity curve
  const leveragedEquity = analytics.calculateLeveragedEquityCurve(
    trades as any,
    startingCapital
  );
  console.log("\\nLeveraged equity curve (first 5 points):");
  leveragedEquity.slice(0, 5).forEach(p => {
    console.log({ date: p.date, equity: p.equity, drawdown: p.drawdown });
  });
  console.log("Leveraged equity curve (last 5 points):");
  leveragedEquity.slice(-5).forEach(p => {
    console.log({ date: p.date, equity: p.equity, drawdown: p.drawdown });
  });

  process.exit(0);
}

debugLeveraged().catch(console.error);
