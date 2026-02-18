import * as db from './db';
import * as analytics from './analytics';

async function debugEquityCurve() {
  console.log('=== Debugging Equity Curve ===\n');

  // Get all strategies
  const strategies = await db.getAllStrategies();
  console.log(`Found ${strategies.length} strategies:`, strategies.map(s => s.name));

  // Get all trades for the last year
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const allTrades = await db.getTrades({
    strategyIds: strategies.map(s => s.id),
    startDate: oneYearAgo,
    endDate: now,
  });

  console.log(`\nFound ${allTrades.length} trades in the last year`);
  if (allTrades.length > 0) {
    console.log('First trade:', {
      strategyId: allTrades[0]?.strategyId,
      entry: allTrades[0]?.entryDate,
      exit: allTrades[0]?.exitDate,
      pnl: allTrades[0]?.pnl,
    });
    console.log('Last trade:', {
      strategyId: allTrades[allTrades.length - 1]?.strategyId,
      entry: allTrades[allTrades.length - 1]?.entryDate,
      exit: allTrades[allTrades.length - 1]?.exitDate,
      pnl: allTrades[allTrades.length - 1]?.pnl,
    });
  }

  // Calculate raw equity curve
  const rawEquity = analytics.calculateEquityCurve(allTrades, 100000);
  console.log(`\nRaw equity curve has ${rawEquity.length} points`);
  if (rawEquity.length > 0) {
    console.log('First point:', rawEquity[0]);
    console.log('Last point:', rawEquity[rawEquity.length - 1]);
  }

  // Forward-fill
  const equityStartDate = rawEquity.length > 0 ? rawEquity[0]!.date : oneYearAgo;
  const forwardFilled = analytics.forwardFillEquityCurve(
    rawEquity,
    equityStartDate,
    now
  );
  console.log(`\nForward-filled equity curve has ${forwardFilled.length} points`);
  if (forwardFilled.length > 0) {
    console.log('First point:', forwardFilled[0]);
    console.log('Last point:', forwardFilled[forwardFilled.length - 1]);
  }

  // Get benchmark data
  const benchmarkData = await db.getBenchmarkData({
    startDate: oneYearAgo,
    endDate: now,
  });
  console.log(`\nFound ${benchmarkData.length} benchmark data points`);

  const rawBenchmark = analytics.calculateBenchmarkEquityCurve(benchmarkData, 100000);
  console.log(`Raw benchmark curve has ${rawBenchmark.length} points`);

  const benchmarkFilled = analytics.forwardFillEquityCurve(
    rawBenchmark,
    equityStartDate,
    now
  );
  console.log(`Forward-filled benchmark curve has ${benchmarkFilled.length} points`);

  process.exit(0);
}

debugEquityCurve().catch(console.error);
