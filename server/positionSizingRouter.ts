import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import {
  calculatePositionSize,
  calculateKellyCriterion,
  CONTRACT_SPECS,
  // @ts-expect-error TS6133 unused
  type PositionSizingResult,
} from "./lib/positionSizing";
import * as db from "./db";
// @ts-expect-error TS6192
import { strategies, trades } from "../drizzle/schema";
// @ts-expect-error TS6192
import { eq, and, isNotNull } from "drizzle-orm";

export const positionSizingRouter = router({
  /**
   * Calculate recommended position size for a strategy
   */
  calculate: protectedProcedure
    .input(
      z.object({
        strategyId: z.number(),
        accountSize: z.number().min(1000).max(10000000),
        riskPercentage: z.number().min(0.5).max(10).default(2),
      })
    )
    .query(async ({ input }) => {
      const { strategyId, accountSize, riskPercentage } = input;

      // Fetch strategy details
      const strategy = await db.getStrategyById(strategyId);

      if (!strategy) {
        throw new Error("Strategy not found");
      }

      // Get contract spec for this strategy's symbol
      const contractSpec = CONTRACT_SPECS[strategy.symbol];
      if (!contractSpec) {
        throw new Error(`Contract spec not found for ${strategy.symbol}`);
      }

      // Calculate max drawdown from trades
      const strategyTrades = await db.getTrades({
        strategyIds: [strategyId],
        startDate: undefined,
        endDate: undefined,
      });

      // Calculate equity curve and max drawdown
      let equity = 100000; // Starting capital
      let peak = equity;
      let maxDD = 0;

      for (const trade of strategyTrades) {
        const pnl = trade.pnl / 100; // Convert cents to dollars
        equity += pnl;

        if (equity > peak) {
          peak = equity;
        }

        const drawdown = peak - equity;
        if (drawdown > maxDD) {
          maxDD = drawdown;
        }
      }

      // Calculate win rate and avg win/loss for Kelly criterion
      const winningTrades = strategyTrades.filter(t => (t.pnl || 0) > 0);
      const losingTrades = strategyTrades.filter(t => (t.pnl || 0) < 0);

      const winRate = winningTrades.length / strategyTrades.length;
      const avgWin =
        winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) /
        winningTrades.length /
        100;
      const avgLoss = Math.abs(
        losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) /
          losingTrades.length /
          100
      );

      // Calculate Kelly criterion
      const kellySuggestion = calculateKellyCriterion(winRate, avgWin, avgLoss);

      // Calculate position size
      const result = calculatePositionSize({
        accountSize,
        riskPercentage,
        maxDrawdown: maxDD,
        contractSpec,
      });

      return {
        ...result,
        strategy: {
          id: strategy.id,
          name: strategy.name,
          symbol: strategy.symbol,
        },
        contractSpec,
        strategyStats: {
          maxDrawdown: maxDD,
          winRate: winRate * 100,
          avgWin,
          avgLoss,
          totalTrades: strategyTrades.length,
        },
        kellySuggestion: {
          percentage: kellySuggestion * 100,
          note: "Kelly Criterion suggests optimal risk per trade (fractional Kelly at 25% for safety)",
        },
      };
    }),

  /**
   * Get contract specifications
   */
  getContractSpecs: protectedProcedure.query(() => {
    return CONTRACT_SPECS;
  }),

  /**
   * Save user's account size preference
   */
  saveAccountSize: protectedProcedure
    .input(
      z.object({
        accountSize: z.number().min(1000).max(10000000),
      })
    )
    // @ts-expect-error TS6133 unused
    .mutation(async ({ input, ctx }) => {
      // Store in user metadata (you may need to add this field to users table)
      // For now, we'll just return success
      // TODO: Add accountSize field to users table
      return { success: true, accountSize: input.accountSize };
    }),
});
