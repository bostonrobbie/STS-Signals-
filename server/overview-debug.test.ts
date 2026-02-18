import { describe, it, expect } from "vitest";
import { getAllStrategies, getTrades } from "./db";

describe("Overview Page Data Debug", () => {
  it("should verify strategies exist in database", async () => {
    const allStrategies = await getAllStrategies();
    console.log(`[DEBUG] Found ${allStrategies.length} strategies`);
    console.log(
      `[DEBUG] Strategies:`,
      allStrategies.map(s => ({ id: s.id, symbol: s.symbol }))
    );

    expect(allStrategies.length).toBeGreaterThan(0);
  });

  it("should verify trades exist for each strategy", async () => {
    const allStrategies = await getAllStrategies();

    for (const strategy of allStrategies) {
      const strategyTrades = await getTrades({
        strategyIds: [strategy.id],
      });
      console.log(
        `[DEBUG] Strategy ${strategy.symbol} (ID: ${strategy.id}): ${strategyTrades.length} trades`
      );
      expect(strategyTrades.length).toBeGreaterThanOrEqual(0);
    }
  });

  it("should verify portfolio.overview query returns data", async () => {
    const allStrategies = await getAllStrategies();
    const strategyIds = allStrategies.map(s => s.id);

    const allTrades = await getTrades({
      strategyIds,
      startDate: undefined,
      endDate: new Date(),
      source: "all",
    });

    console.log(`[DEBUG] Total trades found: ${allTrades.length}`);

    if (allTrades.length > 0) {
      console.log(`[DEBUG] First trade:`, {
        entryDate: allTrades[0]?.entryDate,
        exitDate: allTrades[0]?.exitDate,
        pnl: allTrades[0]?.pnl,
      });
    }

    expect(allTrades.length).toBeGreaterThan(0);
  });

  it("should verify equity curve calculation", async () => {
    const allStrategies = await getAllStrategies();
    const strategyIds = allStrategies.map(s => s.id);

    const allTrades = await getTrades({
      strategyIds,
      startDate: undefined,
      endDate: new Date(),
      source: "all",
    });

    // Sort by exit date
    const sortedTrades = allTrades.sort((a, b) => {
      const dateA =
        typeof a.exitDate === "string" ? new Date(a.exitDate) : a.exitDate;
      const dateB =
        typeof b.exitDate === "string" ? new Date(b.exitDate) : b.exitDate;
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate equity curve
    const startingCapital = 100000;
    let currentEquity = startingCapital;
    const equityCurve = [
      {
        date: new Date(sortedTrades[0]?.entryDate || new Date()),
        equity: currentEquity,
      },
    ];

    for (const trade of sortedTrades) {
      const pnl = trade.pnl || 0;
      currentEquity += pnl;
      const exitDate =
        typeof trade.exitDate === "string"
          ? new Date(trade.exitDate)
          : trade.exitDate;
      equityCurve.push({ date: exitDate, equity: currentEquity });
    }

    console.log(`[DEBUG] Equity curve points: ${equityCurve.length}`);
    console.log(
      `[DEBUG] Starting equity: $${equityCurve[0]?.equity.toFixed(2)}`
    );
    console.log(
      `[DEBUG] Ending equity: $${equityCurve[equityCurve.length - 1]?.equity.toFixed(2)}`
    );
    console.log(
      `[DEBUG] Total P&L: $${(currentEquity - startingCapital).toFixed(2)}`
    );

    expect(equityCurve.length).toBeGreaterThan(1);
    expect(currentEquity).not.toBe(startingCapital); // Should have some P&L
  });
});
