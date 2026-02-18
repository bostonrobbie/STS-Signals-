import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  router,
  viewAnalyticsProcedure,
  deleteStrategyProcedure,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getAllStrategies, getTrades } from "./db";
import * as analytics from "./analytics";
import * as breakdown from "./breakdown";
import * as brokerService from "./brokerService";
import * as subscriptionService from "./subscriptionService";
import * as dataValidation from "./core/dataValidation";
import * as dailyEquityCurve from "./core/dailyEquityCurve";
import * as paperTrading from "./paperTradingService";
import { stripeRouter } from "./stripe/stripeRouter";
import { passwordRouter } from "./auth/passwordRouter";
import { positionSizingRouter } from "./positionSizingRouter";
import { userPreferencesRouter } from "./userPreferencesRouter";
import { cache, cacheKeys, cacheTTL } from "./cache";
import { monitorWebhookUrl, checkWebhookUrl } from "./webhookMonitor";
import { processWebhook } from "./webhookService";
import { submitToIndexNow } from "./indexNow";

// Time range enum for filtering
const TimeRange = z.enum(["6M", "YTD", "1Y", "3Y", "5Y", "10Y", "ALL"]);

// Helper function to sample equity curve for mobile app (reduce data points)
function sampleEquityCurve(
  curve: analytics.EquityPoint[],
  maxPoints: number
): { date: string; equity: number; drawdown: number }[] {
  if (curve.length <= maxPoints) {
    return curve.map(p => ({
      date: p.date.toISOString(),
      equity: Math.round(p.equity * 100) / 100,
      drawdown: Math.round(p.drawdown * 100) / 100,
    }));
  }

  const step = Math.ceil(curve.length / maxPoints);
  const sampled: { date: string; equity: number; drawdown: number }[] = [];

  for (let i = 0; i < curve.length; i += step) {
    const point = curve[i]!;
    sampled.push({
      date: point.date.toISOString(),
      equity: Math.round(point.equity * 100) / 100,
      drawdown: Math.round(point.drawdown * 100) / 100,
    });
  }

  // Always include the last point
  const lastPoint = curve[curve.length - 1]!;
  if (sampled[sampled.length - 1]?.date !== lastPoint.date.toISOString()) {
    sampled.push({
      date: lastPoint.date.toISOString(),
      equity: Math.round(lastPoint.equity * 100) / 100,
      drawdown: Math.round(lastPoint.drawdown * 100) / 100,
    });
  }

  return sampled;
}

export const appRouter = router({
  system: systemRouter,
  stripe: stripeRouter,
  auth: passwordRouter,
  positionSizing: positionSizingRouter,
  userPreferences: userPreferencesRouter,

  // IndexNow: Submit URLs to search engines (admin only)
  indexNow: router({
    submit: adminProcedure.mutation(async () => {
      const results = await submitToIndexNow();
      return { results, submittedAt: new Date().toISOString() };
    }),
  }),

  // Public platform statistics for landing page
  platform: router({
    stats: publicProcedure.query(async () => {
      // Use cache for platform stats (5 minute TTL)
      return cache.getOrCompute(
        cacheKeys.platformStats(),
        async () => {
          // Get all strategies
          const strategies = await getAllStrategies();
          const strategyIds = strategies.map(s => s.id);

          // Get all trades for calculating aggregate stats
          const allTrades = await getTrades({
            strategyIds,
            startDate: undefined,
            endDate: new Date(),
          });

          // Calculate portfolio metrics
          const startingCapital = 100000;
          const metrics = analytics.calculatePerformanceMetrics(
            allTrades,
            startingCapital
          );

          // Calculate equity curve for total return
          const portfolioEquity = analytics.calculateEquityCurve(
            allTrades,
            startingCapital
          );
          const finalEquity =
            portfolioEquity.length > 0
              ? portfolioEquity[portfolioEquity.length - 1]!.equity
              : startingCapital;
          const totalReturn =
            ((finalEquity - startingCapital) / startingCapital) * 100;

          // Get years of data
          const firstTradeDate =
            allTrades.length > 0 ? allTrades[0]!.entryDate : new Date();
          const yearsOfData = Math.max(
            1,
            (Date.now() - firstTradeDate.getTime()) /
              (365 * 24 * 60 * 60 * 1000)
          );

          return {
            totalReturn: Math.round(totalReturn * 100) / 100,
            annualizedReturn: Math.round(metrics.annualizedReturn * 100) / 100,
            sharpeRatio: Math.round(metrics.sharpeRatio * 100) / 100,
            sortinoRatio: Math.round(metrics.sortinoRatio * 100) / 100,
            maxDrawdown: Math.round(metrics.maxDrawdown * 100) / 100,
            winRate: Math.round(metrics.winRate * 100) / 100,
            profitFactor: Math.round(metrics.profitFactor * 100) / 100,
            totalTrades: metrics.totalTrades,
            strategyCount: strategies.length,
            yearsOfData: Math.round(yearsOfData * 10) / 10,
            avgWin: Math.round(metrics.avgWin * 100) / 100,
            avgLoss: Math.round(metrics.avgLoss * 100) / 100,
          };
        },
        cacheTTL.platformStats
      );
    }),
  }),

  // ============================================================================
  // PUBLIC API ENDPOINTS FOR MOBILE APP
  // These endpoints allow unauthenticated users to browse strategies and view
  // platform performance before signing up.
  // ============================================================================
  publicApi: router({
    /**
     * Public portfolio overview - returns aggregate platform performance
     * Similar to portfolio.overview but without authentication requirement
     */
    overview: publicProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
          contractMultiplier: z.number().optional().default(1),
          isLeveraged: z.boolean().optional().default(false),
        })
      )
      .query(async ({ input }) => {
        const { timeRange, startingCapital, contractMultiplier, isLeveraged } =
          input;

        // Use cache for public overview (5 minute TTL)
        const cacheKey = `public_overview_${timeRange || "ALL"}_${startingCapital}_${contractMultiplier}_${isLeveraged ? "lev" : "unlev"}`;

        return cache.getOrCompute(
          cacheKey,
          async () => {
            // Calculate date range
            const now = new Date();
            let startDate: Date | undefined;

            if (timeRange) {
              const year = now.getFullYear();
              switch (timeRange) {
                case "6M":
                  startDate = new Date(now);
                  startDate.setMonth(now.getMonth() - 6);
                  break;
                case "YTD":
                  startDate = new Date(year, 0, 1);
                  break;
                case "1Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 1);
                  break;
                case "3Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 3);
                  break;
                case "5Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 5);
                  break;
                case "10Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 10);
                  break;
                case "ALL":
                  startDate = undefined;
                  break;
              }
            }

            // Get all strategies
            const strategies = await getAllStrategies();
            const strategyIds = strategies.map(s => s.id);

            // Get trades for all strategies
            const allTrades = await getTrades({
              strategyIds,
              startDate,
              endDate: now,
            });

            // Calculate metrics based on leveraged or unleveraged mode
            const metrics = isLeveraged
              ? analytics.calculateLeveragedPerformanceMetrics(
                  allTrades,
                  startingCapital
                )
              : analytics.calculatePerformanceMetrics(
                  allTrades,
                  startingCapital
                );

            // Calculate equity curve based on mode
            let rawPortfolioEquity;
            if (isLeveraged) {
              // Leveraged: use percentage-based compounding
              rawPortfolioEquity = analytics.calculateLeveragedEquityCurve(
                allTrades,
                startingCapital
              );
            } else {
              // Unleveraged: use fixed dollar amounts
              rawPortfolioEquity = analytics.calculateEquityCurve(
                allTrades,
                startingCapital
              );
            }

            // Forward-fill equity curve
            const equityStartDate =
              startDate ||
              (rawPortfolioEquity.length > 0
                ? rawPortfolioEquity[0]!.date
                : new Date());
            const portfolioEquity = analytics.forwardFillEquityCurve(
              rawPortfolioEquity,
              equityStartDate,
              now
            );

            // Sample equity curve for mobile (reduce data points)
            const sampledEquity = sampleEquityCurve(portfolioEquity, 100);

            // Calculate daily metrics
            const dailyEquityResult =
              dailyEquityCurve.calculateDailyEquityCurve(
                allTrades,
                startingCapital,
                undefined,
                contractMultiplier
              );
            const dailySharpe = dailyEquityCurve.calculateDailySharpeRatio(
              dailyEquityResult.dailyReturns
            );
            const dailySortino = dailyEquityCurve.calculateDailySortinoRatio(
              dailyEquityResult.dailyReturns
            );

            return {
              metrics: {
                totalReturn: metrics.totalReturn,
                annualizedReturn: metrics.annualizedReturn,
                sharpeRatio: metrics.sharpeRatio,
                sortinoRatio: metrics.sortinoRatio,
                calmarRatio: metrics.calmarRatio,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownDollars: metrics.maxDrawdownDollars,
                winRate: metrics.winRate,
                profitFactor: metrics.profitFactor,
                totalTrades: metrics.totalTrades,
                avgWin: metrics.avgWin,
                avgLoss: metrics.avgLoss,
              },
              dailyMetrics: {
                sharpe: dailySharpe,
                sortino: dailySortino,
                tradingDays: dailyEquityResult.tradingDays,
              },
              equityCurve: sampledEquity,
              strategyCount: strategies.length,
            };
          },
          cacheTTL.platformStats
        );
      }),

    /**
     * Public list of all strategies with metrics
     * Allows browsing strategies without authentication
     */
    listStrategies: publicProcedure.query(async () => {
      // Use cache for strategy list (5 minute TTL)
      return cache.getOrCompute(
        "public_strategies_list",
        async () => {
          const strategies = await getAllStrategies();

          const strategiesWithMetrics = await Promise.all(
            strategies.map(async strategy => {
              const trades = await getTrades({ strategyIds: [strategy.id] });

              if (trades.length === 0) {
                return {
                  id: strategy.id,
                  name: strategy.name,
                  symbol: strategy.symbol,
                  market: strategy.market,
                  description: strategy.description,
                  totalReturn: 0,
                  maxDrawdown: 0,
                  sharpeRatio: 0,
                  winRate: 0,
                  totalTrades: 0,
                  firstTradeDate: null,
                  lastTradeDate: null,
                };
              }

              const metrics = analytics.calculatePerformanceMetrics(
                trades,
                100000
              );
              const totalReturnDollars = (metrics.totalReturn / 100) * 100000;

              const sortedTrades = [...trades].sort(
                (a, b) =>
                  new Date(a.entryDate).getTime() -
                  new Date(b.entryDate).getTime()
              );

              return {
                id: strategy.id,
                name: strategy.name,
                symbol: strategy.symbol,
                market: strategy.market,
                description: strategy.description,
                totalReturn: totalReturnDollars,
                maxDrawdown: metrics.maxDrawdownDollars,
                sharpeRatio: metrics.sharpeRatio,
                winRate: metrics.winRate,
                totalTrades: metrics.totalTrades,
                firstTradeDate: sortedTrades[0]?.entryDate ?? null,
                lastTradeDate:
                  sortedTrades[sortedTrades.length - 1]?.exitDate ?? null,
              };
            })
          );

          return strategiesWithMetrics;
        },
        cacheTTL.platformStats
      );
    }),

    /**
     * Public strategy detail - returns detailed info for a single strategy
     */
    strategyDetail: publicProcedure
      .input(
        z.object({
          strategyId: z.number(),
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
          maxPoints: z.number().optional().default(200),
        })
      )
      .query(async ({ input }) => {
        const { strategyId, timeRange, startingCapital, maxPoints } = input;

        // Use cache for strategy detail (5 minute TTL)
        const cacheKey = `public_strategy_${strategyId}_${timeRange || "ALL"}_${startingCapital}_${maxPoints}`;

        return cache.getOrCompute(
          cacheKey,
          async () => {
            const strategy = await db.getStrategyById(strategyId);
            if (!strategy) {
              throw new Error("Strategy not found");
            }

            // Calculate date range
            const now = new Date();
            let startDate: Date | undefined;

            if (timeRange) {
              const year = now.getFullYear();
              switch (timeRange) {
                case "6M":
                  startDate = new Date(now);
                  startDate.setMonth(now.getMonth() - 6);
                  break;
                case "YTD":
                  startDate = new Date(year, 0, 1);
                  break;
                case "1Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 1);
                  break;
                case "3Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 3);
                  break;
                case "5Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 5);
                  break;
                case "10Y":
                  startDate = new Date(now);
                  startDate.setFullYear(year - 10);
                  break;
                case "ALL":
                  startDate = undefined;
                  break;
              }
            }

            // Get trades
            const trades = await getTrades({
              strategyIds: [strategyId],
              startDate,
              endDate: now,
            });

            // Calculate metrics
            const metrics = analytics.calculatePerformanceMetrics(
              trades,
              startingCapital
            );

            // Calculate equity curve
            const rawEquityCurve = analytics.calculateEquityCurve(
              trades,
              startingCapital
            );

            const equityStartDate =
              startDate ||
              (rawEquityCurve.length > 0
                ? rawEquityCurve[0]!.date
                : new Date());

            const equityCurve = analytics.forwardFillEquityCurve(
              rawEquityCurve,
              equityStartDate,
              now
            );

            // Sample equity curve based on requested maxPoints
            const sampledEquity = sampleEquityCurve(equityCurve, maxPoints);

            // Get recent trades (last 20 for mobile)
            const recentTrades = [...trades]
              .sort((a, b) => b.exitDate.getTime() - a.exitDate.getTime())
              .slice(0, 20)
              .map(t => ({
                id: t.id,
                entryDate: t.entryDate,
                exitDate: t.exitDate,
                direction: t.direction,
                pnl: t.pnl,
                entryPrice: t.entryPrice,
                exitPrice: t.exitPrice,
              }));

            return {
              strategy: {
                id: strategy.id,
                name: strategy.name,
                symbol: strategy.symbol,
                market: strategy.market,
                description: strategy.description,
              },
              metrics: {
                totalReturn: metrics.totalReturn,
                annualizedReturn: metrics.annualizedReturn,
                sharpeRatio: metrics.sharpeRatio,
                sortinoRatio: metrics.sortinoRatio,
                calmarRatio: metrics.calmarRatio,
                maxDrawdown: metrics.maxDrawdown,
                maxDrawdownDollars: metrics.maxDrawdownDollars,
                winRate: metrics.winRate,
                profitFactor: metrics.profitFactor,
                totalTrades: metrics.totalTrades,
                avgWin: metrics.avgWin,
                avgLoss: metrics.avgLoss,
              },
              equityCurve: sampledEquity,
              recentTrades,
            };
          },
          cacheTTL.platformStats
        );
      }),
  }),

  // auth router moved to line 80 with passwordRouter
  authLegacy: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await db.updateUserOnboarding(ctx.user.id, true);
      return { success: true };
    }),
    dismissOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
      await db.dismissUserOnboarding(ctx.user.id);
      return { success: true };
    }),
  }),

  // User preferences
  user: router({
    getStartingCapital: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      return {
        startingCapital: user?.startingCapital ?? 100000,
      };
    }),
    setStartingCapital: protectedProcedure
      .input(z.object({ startingCapital: z.number().min(1000).max(100000000) }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserStartingCapital(ctx.user.id, input.startingCapital);
        return { success: true };
      }),
    // Get user preferences (starting capital and contract size)
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getUserPreferences(ctx.user.id);
      return prefs;
    }),
    // Update user preferences (starting capital and/or contract size)
    setPreferences: protectedProcedure
      .input(
        z.object({
          startingCapital: z.number().min(1000).max(100000000).optional(),
          contractSize: z.enum(["mini", "micro"]).optional(),
          themePreference: z.enum(["light", "dark"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserPreferences(ctx.user.id, input);
        return { success: true };
      }),
  }),

  portfolio: router({
    /**
     * Get portfolio overview with combined performance metrics
     */
    overview: viewAnalyticsProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
          contractMultiplier: z.number().optional().default(1), // 1 for mini, 0.1 for micro
          source: z
            .enum(["csv_import", "webhook", "manual", "all"])
            .optional()
            .default("all"),
          strategyIds: z.array(z.number()).optional(), // Optional: filter to specific strategies
          isLeveraged: z.boolean().optional().default(false), // Use leveraged calculation (pnlPercent)
        })
      )
      .query(async ({ input }) => {
        const {
          timeRange,
          startingCapital,
          contractMultiplier,
          source,
          strategyIds: inputStrategyIds,
          isLeveraged,
        } = input;

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        // Get all strategies (or filter to specific ones if provided)
        const allStrategies = await getAllStrategies();
        const strategies =
          inputStrategyIds && inputStrategyIds.length > 0
            ? allStrategies.filter(s => inputStrategyIds.includes(s.id))
            : allStrategies;
        const strategyIds = strategies.map(s => s.id);

        // Get trades for all strategies (filtered by time range and source)
        const allTrades = await getTrades({
          strategyIds,
          startDate,
          endDate: now,
          source,
        });

        // Also get ALL trades (full history) for rolling metrics calculation
        const allTradesFullHistory = await getTrades({
          strategyIds,
          startDate: undefined, // No filter - get everything
          endDate: now,
          source,
        });

        // Get benchmark data (SPY is default)
        const benchmarkData = await db.getBenchmarkData({
          startDate,
          endDate: now,
          symbol: "SPY",
        });

        // Get additional benchmark data for correlation matrix
        const qqqBenchmarkData = await db.getBenchmarkData({
          startDate,
          endDate: now,
          symbol: "QQQ",
        });
        const iwmBenchmarkData = await db.getBenchmarkData({
          startDate,
          endDate: now,
          symbol: "IWM",
        });
        const gldBenchmarkData = await db.getBenchmarkData({
          startDate,
          endDate: now,
          symbol: "GLD",
        });

        // Calculate average conversion ratio for portfolio (weighted by trade count)
        const strategyRatios = new Map<number, number>();
        for (const strategy of strategies) {
          strategyRatios.set(strategy.id, strategy.microToMiniRatio);
        }

        // Use weighted average ratio based on trades per strategy
        let _totalRatio = 0;
        let _totalTrades = 0;
        for (const strategy of strategies) {
          const stratTrades = allTrades.filter(
            t => t.strategyId === strategy.id
          );
          _totalRatio += strategy.microToMiniRatio * stratTrades.length;
          _totalTrades += stratTrades.length;
        }
        // Average ratio available for future use
        // const avgRatio = _totalTrades > 0 ? _totalRatio / _totalTrades : 10;

        // Calculate portfolio metrics (use leveraged or standard calculation)
        const metrics = isLeveraged
          ? analytics.calculateLeveragedPerformanceMetrics(
              allTrades,
              startingCapital
            )
          : analytics.calculatePerformanceMetrics(allTrades, startingCapital);

        // Calculate full history equity curve first to get all-time peak
        const rawPortfolioEquityFull = isLeveraged
          ? analytics.calculateLeveragedEquityCurve(
              allTradesFullHistory,
              startingCapital
            )
          : analytics.calculateEquityCurve(
              allTradesFullHistory,
              startingCapital
            );

        // Find all-time peak from full history
        const allTimePeak =
          rawPortfolioEquityFull.length > 0
            ? Math.max(...rawPortfolioEquityFull.map(p => p.equity))
            : startingCapital;

        // Calculate equity curves for selected time range (use leveraged or standard)
        const rawPortfolioEquityTemp = isLeveraged
          ? analytics.calculateLeveragedEquityCurve(allTrades, startingCapital)
          : analytics.calculateEquityCurve(allTrades, startingCapital);

        // Recalculate drawdowns using all-time peak (not just peak within time range)
        const rawPortfolioEquity = analytics.recalculateDrawdownsWithPeak(
          rawPortfolioEquityTemp,
          allTimePeak
        );
        const rawBenchmarkEquity = analytics.calculateBenchmarkEquityCurve(
          benchmarkData,
          startingCapital
        );

        // Determine date range for forward fill
        const equityStartDate =
          startDate ||
          (rawPortfolioEquity.length > 0
            ? rawPortfolioEquity[0]!.date
            : new Date());
        const equityEndDate = now;

        // Benchmark should use its own start date (earliest available data in range)
        const benchmarkStartDate =
          rawBenchmarkEquity.length > 0
            ? rawBenchmarkEquity[0]!.date
            : equityStartDate;

        // Benchmark should end at its last available data point (not portfolio end)
        const benchmarkEndDate =
          rawBenchmarkEquity.length > 0
            ? rawBenchmarkEquity[rawBenchmarkEquity.length - 1]!.date
            : equityEndDate;

        // Forward-fill to create continuous daily series
        const portfolioEquity = analytics.forwardFillEquityCurve(
          rawPortfolioEquity,
          equityStartDate,
          equityEndDate
        );

        // Forward-fill full history for rolling metrics
        const fullHistoryStartDate =
          rawPortfolioEquityFull.length > 0
            ? rawPortfolioEquityFull[0]!.date
            : new Date();
        const portfolioEquityFull = analytics.forwardFillEquityCurve(
          rawPortfolioEquityFull,
          fullHistoryStartDate,
          equityEndDate
        );
        // Forward-fill benchmark only to its last available date
        const benchmarkEquity = analytics.forwardFillEquityCurve(
          rawBenchmarkEquity,
          benchmarkStartDate,
          benchmarkEndDate
        );

        // Calculate performance by period
        const dailyPerf = analytics.calculatePerformanceByPeriod(
          allTrades,
          "day"
        );
        const weeklyPerf = analytics.calculatePerformanceByPeriod(
          allTrades,
          "week"
        );
        const monthlyPerf = analytics.calculatePerformanceByPeriod(
          allTrades,
          "month"
        );
        const quarterlyPerf = analytics.calculatePerformanceByPeriod(
          allTrades,
          "quarter"
        );
        const yearlyPerf = analytics.calculatePerformanceByPeriod(
          allTrades,
          "year"
        );

        // Calculate underwater data for portfolio and benchmark
        // Pass isLeveraged flag so drawdown calculation uses appropriate method:
        // - Unleveraged: drawdown as % of base capital ($100K)
        // - Leveraged: drawdown as % from peak equity (traditional)
        const underwater = analytics.calculatePortfolioUnderwater(
          portfolioEquity,
          100000,
          isLeveraged
        );
        const benchmarkUnderwater = analytics.calculatePortfolioUnderwater(
          benchmarkEquity,
          100000,
          false
        );
        const dayOfWeekBreakdown =
          analytics.calculateDayOfWeekBreakdown(allTrades);
        const weekOfMonthBreakdown =
          analytics.calculateWeekOfMonthBreakdown(allTrades);

        // Calculate strategy correlation matrix
        const strategyEquityCurves = new Map<string, analytics.EquityPoint[]>();
        for (const strategy of strategies) {
          const strategyTrades = allTrades.filter(
            t => t.strategyId === strategy.id
          );
          if (strategyTrades.length > 0) {
            const rawEquity = analytics.calculateEquityCurve(
              strategyTrades,
              startingCapital
            );
            const strategyStartDate =
              rawEquity.length > 0 ? rawEquity[0]!.date : equityStartDate;
            const forwardFilled = analytics.forwardFillEquityCurve(
              rawEquity,
              strategyStartDate,
              equityEndDate
            );
            strategyEquityCurves.set(strategy.name, forwardFilled);
          }
        }

        // Add benchmarks to correlation matrix
        strategyEquityCurves.set("S&P 500", benchmarkEquity);

        // Add additional benchmarks if data is available
        if (qqqBenchmarkData.length > 0) {
          const rawQqqEquity = analytics.calculateBenchmarkEquityCurve(
            qqqBenchmarkData,
            startingCapital
          );
          if (rawQqqEquity.length > 0) {
            const qqqStartDate = rawQqqEquity[0]!.date;
            const qqqEndDate = rawQqqEquity[rawQqqEquity.length - 1]!.date;
            const qqqEquity = analytics.forwardFillEquityCurve(
              rawQqqEquity,
              qqqStartDate,
              qqqEndDate
            );
            strategyEquityCurves.set("QQQ", qqqEquity);
          }
        }

        if (iwmBenchmarkData.length > 0) {
          const rawIwmEquity = analytics.calculateBenchmarkEquityCurve(
            iwmBenchmarkData,
            startingCapital
          );
          if (rawIwmEquity.length > 0) {
            const iwmStartDate = rawIwmEquity[0]!.date;
            const iwmEndDate = rawIwmEquity[rawIwmEquity.length - 1]!.date;
            const iwmEquity = analytics.forwardFillEquityCurve(
              rawIwmEquity,
              iwmStartDate,
              iwmEndDate
            );
            strategyEquityCurves.set("IWM", iwmEquity);
          }
        }

        if (gldBenchmarkData.length > 0) {
          const rawGldEquity = analytics.calculateBenchmarkEquityCurve(
            gldBenchmarkData,
            startingCapital
          );
          if (rawGldEquity.length > 0) {
            const gldStartDate = rawGldEquity[0]!.date;
            const gldEndDate = rawGldEquity[rawGldEquity.length - 1]!.date;
            const gldEquity = analytics.forwardFillEquityCurve(
              rawGldEquity,
              gldStartDate,
              gldEndDate
            );
            strategyEquityCurves.set("GLD", gldEquity);
          }
        }

        const strategyCorrelationMatrix =
          analytics.calculateStrategyCorrelationMatrix(strategyEquityCurves);

        // Calculate rolling metrics (30, 90, 365 day windows)
        // Compute on full history, then filter to time range
        const rollingMetrics = analytics.calculateRollingMetrics(
          portfolioEquityFull,
          [30, 90, 365],
          startDate,
          now
        );

        // Calculate monthly returns calendar
        const monthlyReturnsCalendar =
          analytics.calculateMonthlyReturnsCalendar(portfolioEquity);

        // Generate portfolio summary narrative
        // For ALL time range, use the earliest trade date as start
        const effectiveStartDate =
          startDate || (allTrades.length > 0 ? allTrades[0]!.entryDate : now);
        const summary = analytics.generatePortfolioSummary(
          metrics,
          underwater,
          effectiveStartDate,
          now
        );

        // Calculate industry-standard daily Sharpe/Sortino using proper daily equity curve
        // Pass contractMultiplier to scale P&L values for realistic daily returns
        const dailyEquityResult = dailyEquityCurve.calculateDailyEquityCurve(
          allTrades,
          startingCapital,
          undefined, // calendar
          contractMultiplier
        );
        const dailySharpe = dailyEquityCurve.calculateDailySharpeRatio(
          dailyEquityResult.dailyReturns
        );
        const dailySortino = dailyEquityCurve.calculateDailySortinoRatio(
          dailyEquityResult.dailyReturns
        );
        const tradingDaysCount = dailyEquityResult.tradingDays;

        // Calculate daily returns distribution
        const distribution =
          analytics.calculateDailyReturnsDistribution(portfolioEquity);

        // Major drawdowns (calculate on FULL history, not filtered by timeRange)
        // Use -5% threshold to ensure we capture top 3 drawdowns for visualization
        const majorDrawdowns = analytics.calculateMajorDrawdowns(
          portfolioEquityFull,
          -5
        );

        return {
          metrics,
          tradeStats: metrics.tradeStats, // Expose tradeStats directly for easier frontend access
          summary, // Portfolio narrative summary
          // Industry-standard daily-based metrics
          dailyMetrics: {
            sharpe: dailySharpe,
            sortino: dailySortino,
            tradingDays: tradingDaysCount,
            tradesPerDay:
              tradingDaysCount > 0 ? allTrades.length / tradingDaysCount : 0,
          },
          portfolioEquity,
          benchmarkEquity,
          underwater,
          benchmarkUnderwater,
          majorDrawdowns,
          distribution,
          dayOfWeekBreakdown,
          weekOfMonthBreakdown,
          strategyCorrelationMatrix,
          rollingMetrics,
          monthlyReturnsCalendar,
          periodPerformance: {
            daily: dailyPerf,
            weekly: weeklyPerf,
            monthly: monthlyPerf,
            quarterly: quarterlyPerf,
            yearly: yearlyPerf,
          },
          strategies: strategies.map(s => ({
            id: s.id,
            name: s.name,
            symbol: s.symbol,
            market: s.market,
          })),
        };
      }),

    /**
     * Get detailed performance for a single strategy
     */
    strategyDetail: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
          contractSize: z.enum(["mini", "micro"]).optional().default("mini"),
        })
      )
      .query(async ({ input }) => {
        const { strategyId, timeRange, startingCapital, contractSize } = input;

        // Get strategy info
        const strategy = await db.getStrategyById(strategyId);
        if (!strategy) {
          throw new Error("Strategy not found");
        }

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        // Get trades for this strategy
        const rawTrades = await getTrades({
          strategyIds: [strategyId],
          startDate,
          endDate: now,
        });

        // Apply contract size multiplier (micro contracts are 1/10th of mini)
        const contractMultiplier = contractSize === "micro" ? 0.1 : 1;
        const strategyTrades = rawTrades.map(trade => ({
          ...trade,
          pnl: trade.pnl * contractMultiplier,
        }));

        // Calculate metrics
        const metrics = analytics.calculatePerformanceMetrics(
          strategyTrades,
          startingCapital
        );

        // Calculate equity curve
        const rawEquityCurve = analytics.calculateEquityCurve(
          strategyTrades,
          startingCapital
        );

        // Determine date range for forward fill
        const equityStartDate =
          startDate ||
          (rawEquityCurve.length > 0 ? rawEquityCurve[0]!.date : new Date());
        const equityEndDate = now;

        // If we have a time filter, prepend starting capital point at startDate
        const equityCurveWithStart =
          startDate && rawEquityCurve.length > 0
            ? [
                { date: startDate, equity: startingCapital, drawdown: 0 },
                ...rawEquityCurve, // Keep all trade points
              ]
            : rawEquityCurve;

        // Forward-fill to create continuous daily series
        const equityCurve = analytics.forwardFillEquityCurve(
          equityCurveWithStart,
          equityStartDate,
          equityEndDate
        );

        // Get recent trades (last 50)
        const recentTrades = [...strategyTrades]
          .sort((a, b) => b.exitDate.getTime() - a.exitDate.getTime())
          .slice(0, 50);

        // Get benchmark data (S&P 500)
        const benchmarkData = await db.getBenchmarkData({
          startDate: equityStartDate,
          endDate: equityEndDate,
        });

        // Calculate underwater curve
        const underwaterCurve = analytics.calculateUnderwaterCurve(equityCurve);

        // Convert benchmark to equity curve format for underwater calculation
        const benchmarkEquityCurve = benchmarkData.map(b => ({
          date: b.date,
          equity: b.close,
          drawdown: 0, // Will be calculated by underwater curve
        }));
        const benchmarkUnderwater =
          analytics.calculateUnderwaterCurve(benchmarkEquityCurve);

        // Generate data quality report
        const dataQuality = dataValidation.generateDataQualityReport(
          strategyTrades,
          startingCapital
        );

        return {
          strategy,
          metrics,
          equityCurve,
          benchmarkData,
          underwaterCurve,
          benchmarkUnderwater,
          recentTrades,
          dataQuality,
        };
      }),

    /**
     * Compare multiple strategies
     */
    compareStrategies: protectedProcedure
      .input(
        z.object({
          strategyIds: z.array(z.number()).min(1).max(10),
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
        })
      )
      .query(async ({ input }) => {
        const { strategyIds, timeRange, startingCapital } = input;

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        // Get strategy info
        const strategiesWithNulls = await Promise.all(
          strategyIds.map(id => db.getStrategyById(id))
        );

        // Filter out null strategies and track which IDs are invalid
        const strategies = strategiesWithNulls.filter(
          (s): s is NonNullable<typeof s> => s !== null
        );
        const validStrategyIds = strategies.map(s => s.id);

        // If no valid strategies found, return early
        if (strategies.length === 0) {
          throw new Error("No valid strategies found");
        }

        // Get trades for each strategy (only valid ones)
        const tradesPerStrategy = await Promise.all(
          validStrategyIds.map(id =>
            getTrades({
              strategyIds: [id],
              startDate,
              endDate: now,
            })
          )
        );

        // Calculate metrics for each strategy
        const metricsPerStrategy = tradesPerStrategy.map(trades =>
          analytics.calculatePerformanceMetrics(trades, startingCapital)
        );

        // Calculate equity curves for each strategy
        const equityCurvesPerStrategy = tradesPerStrategy.map(trades =>
          analytics.calculateEquityCurve(trades, startingCapital)
        );

        // Find date range for forward-filling
        const allDates = equityCurvesPerStrategy
          .flat()
          .map(p => p.date)
          .sort((a, b) => a.getTime() - b.getTime());

        // Handle case where there are no trades
        if (allDates.length === 0) {
          return {
            strategies: strategies.map(s => ({
              id: s.id,
              name: s.name,
              symbol: s.symbol,
              market: s.market,
              metrics: {
                totalReturn: 0,
                annualizedReturn: 0,
                sharpeRatio: 0,
                sortino: 0,
                maxDrawdown: 0,
                winRate: 0,
                profitFactor: 0,
                expectancy: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
              },
              equityCurve: [],
            })),
            combinedEquity: [],
            combinedMetrics: {
              totalReturn: 0,
              annualizedReturn: 0,
              sharpeRatio: 0,
              sortino: 0,
              maxDrawdown: 0,
              winRate: 0,
              profitFactor: 0,
              expectancy: 0,
              totalTrades: 0,
              winningTrades: 0,
              losingTrades: 0,
            },
            correlationMatrix: [],
          };
        }

        const globalMinDate = allDates[0]!;
        const globalMaxDate = allDates[allDates.length - 1]!;

        // Forward-fill each strategy's equity curve from its first trade to its last trade
        // This creates smooth daily curves like the individual strategy pages
        const forwardFilledCurves = equityCurvesPerStrategy.map(curve => {
          if (curve.length === 0) return [];

          // Get this strategy's date range (first trade to last trade)
          const strategyMinDate = curve[0]!.date;
          const strategyMaxDate = curve[curve.length - 1]!.date;

          // Forward-fill within this strategy's own date range
          return analytics.forwardFillEquityCurve(
            curve,
            strategyMinDate,
            strategyMaxDate
          );
        });

        // Calculate combined equity curve by simulating actual combined trading
        // This merges all trades and calculates equity as if trading all strategies from one account
        const allCombinedTrades = tradesPerStrategy.flat();
        const rawCombinedEquity = analytics.calculateEquityCurve(
          allCombinedTrades,
          startingCapital // Use same starting capital, not scaled
        );
        const combinedEquity = analytics.forwardFillEquityCurve(
          rawCombinedEquity,
          globalMinDate,
          globalMaxDate
        );

        // Calculate combined metrics from combined trades
        const combinedMetrics = analytics.calculatePerformanceMetrics(
          allCombinedTrades,
          startingCapital // Use same starting capital
        );

        // Calculate correlation matrix
        const correlationMatrix: number[][] = [];
        for (let i = 0; i < forwardFilledCurves.length; i++) {
          correlationMatrix[i] = [];
          for (let j = 0; j < forwardFilledCurves.length; j++) {
            const corr = analytics.calculateCorrelation(
              forwardFilledCurves[i]!,
              forwardFilledCurves[j]!
            );
            correlationMatrix[i]![j] = corr;
          }
        }

        return {
          strategies: strategies.map((s, i) => ({
            id: s.id,
            name: s.name,
            symbol: s.symbol,
            market: s.market,
            metrics: metricsPerStrategy[i],
            equityCurve: forwardFilledCurves[i],
          })),
          combinedEquity,
          combinedMetrics,
          combinedTrades: allCombinedTrades,
          correlationMatrix,
        };
      }),

    /**
     * Get performance breakdown by time periods
     */
    performanceBreakdown: protectedProcedure
      .input(
        z.object({
          strategyId: z.number().optional(),
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
        })
      )
      .query(async ({ input }) => {
        const { strategyId, timeRange, startingCapital } = input;

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        // Get trades
        const trades = await getTrades({
          strategyIds: strategyId ? [strategyId] : undefined,
          startDate,
          endDate: now,
        });

        // Calculate breakdown (mini contracts)
        const performanceBreakdown = breakdown.calculatePerformanceBreakdown(
          trades,
          startingCapital
        );

        return performanceBreakdown;
      }),

    /**
     * Get visual analytics data for charts
     */
    visualAnalytics: protectedProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
        })
      )
      .query(async ({ input }) => {
        const { timeRange } = input;
        const visualAnalytics = await import("./analytics.visual.js");

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        // Get all trades
        const trades = await getTrades({
          startDate,
          endDate: now,
        });

        // Calculate visual analytics
        const streakDistribution =
          visualAnalytics.calculateStreakDistribution(trades);
        const durationDistribution =
          visualAnalytics.calculateDurationDistribution(trades);
        const dayOfWeekPerformance =
          visualAnalytics.calculateDayOfWeekPerformance(trades);

        return {
          streakDistribution,
          durationDistribution,
          dayOfWeekPerformance,
        };
      }),

    /**
     * Get list of all strategies with performance metrics
     */
    listStrategies: protectedProcedure.query(async () => {
      const strategies = await getAllStrategies();

      // Fetch performance metrics for each strategy
      const strategiesWithMetrics = await Promise.all(
        strategies.map(async strategy => {
          const trades = await getTrades({ strategyIds: [strategy.id] });

          if (trades.length === 0) {
            return {
              ...strategy,
              totalReturn: 0,
              maxDrawdown: 0,
              sharpeRatio: 0,
              firstTradeDate: null,
              lastTradeDate: null,
            };
          }

          const metrics = analytics.calculatePerformanceMetrics(trades, 100000);

          // Convert percentage return to dollar amount for display
          const totalReturnDollars = (metrics.totalReturn / 100) * 100000;

          // Get first and last trade dates for proper chart alignment
          const sortedTrades = [...trades].sort(
            (a, b) =>
              new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
          );
          const firstTradeDate = sortedTrades[0]?.entryDate ?? null;
          const lastTradeDate =
            sortedTrades[sortedTrades.length - 1]?.exitDate ?? null;

          return {
            ...strategy,
            totalReturn: totalReturnDollars,
            maxDrawdown: metrics.maxDrawdownDollars,
            sharpeRatio: metrics.sharpeRatio,
            firstTradeDate,
            lastTradeDate,
          };
        })
      );

      return strategiesWithMetrics;
    }),
  }),

  // Webhook router for TradingView integration (Admin-only)
  webhook: router({
    /**
     * Check if current user has admin access to webhooks
     */
    checkAccess: protectedProcedure.query(({ ctx }) => {
      return {
        hasAccess: ctx.user.role === "admin",
        role: ctx.user.role,
      };
    }),

    /**
     * Get webhook configuration (URL and templates)
     *
     * IMPORTANT: The webhook URL must be stable and not change between deployments.
     * We use WEBHOOK_BASE_URL env var if set, otherwise fall back to the production manus.space domain.
     * This ensures TradingView alerts always go to the correct endpoint.
     */
    getConfig: adminProcedure.query(({ ctx }) => {
      // Use configured webhook base URL for stability
      // Priority: WEBHOOK_BASE_URL env var > production manus.space domain > request-derived URL
      let baseUrl: string;

      if (process.env.WEBHOOK_BASE_URL) {
        // Explicit configuration takes priority
        baseUrl = process.env.WEBHOOK_BASE_URL;
      } else if (
        process.env.NODE_ENV === "production" ||
        process.env.MANUS_APP_DOMAIN
      ) {
        // In production, use the stable manus.space domain
        // The MANUS_APP_DOMAIN is automatically set by the Manus platform
        const domain = process.env.MANUS_APP_DOMAIN || "stsdashboard.com";
        baseUrl = `https://${domain}`;
      } else {
        // In development, derive from request headers
        const protocol = ctx.req.headers["x-forwarded-proto"] || "https";
        const host =
          ctx.req.headers["x-forwarded-host"] ||
          ctx.req.headers.host ||
          "localhost:3000";
        baseUrl = `${protocol}://${host}`;
      }

      // Get the webhook token (masked for display, full for template generation)
      const webhookToken = process.env.TRADINGVIEW_WEBHOOK_TOKEN || "";
      const hasToken = webhookToken.length > 0;

      const webhookUrl = `${baseUrl}/api/webhook/tradingview`;

      // Monitor the webhook URL for changes (async, non-blocking)
      // This will alert the owner if the URL doesn't match the expected stable URL
      monitorWebhookUrl(webhookUrl).catch(err => {
        console.error("[WebhookMonitor] Error monitoring URL:", err);
      });

      // Check if URL matches expected
      const urlCheck = checkWebhookUrl(webhookUrl);

      return {
        webhookUrl,
        webhookToken: webhookToken, // Full token for template generation
        hasToken,
        tokenLength: webhookToken.length,
        urlStatus: {
          isCorrect: urlCheck.isCorrect,
          expectedUrl: urlCheck.expectedUrl,
          mismatchType: urlCheck.mismatchType,
        },
      };
    }),

    /**
     * Get recent webhook logs
     */
    getLogs: adminProcedure
      .input(
        z.object({
          limit: z.number().optional().default(50),
          status: z
            .enum(["all", "success", "failed", "duplicate"])
            .optional()
            .default("all"),
          strategyId: z.number().optional(),
          search: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        let logs = await db.getWebhookLogs(input.limit * 2); // Get extra for filtering

        // Apply filters
        if (input.status !== "all") {
          logs = logs.filter(l => l.status === input.status);
        }
        if (input.strategyId) {
          logs = logs.filter(l => l.strategyId === input.strategyId);
        }
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          logs = logs.filter(
            l =>
              l.payload?.toLowerCase().includes(searchLower) ||
              l.errorMessage?.toLowerCase().includes(searchLower) ||
              l.strategySymbol?.toLowerCase().includes(searchLower)
          );
        }
        if (input.startDate) {
          logs = logs.filter(l => new Date(l.createdAt) >= input.startDate!);
        }
        if (input.endDate) {
          logs = logs.filter(l => new Date(l.createdAt) <= input.endDate!);
        }

        return logs.slice(0, input.limit);
      }),

    /**
     * Get webhook processing status and statistics
     */
    getStatus: adminProcedure.query(async () => {
      const settings = await db.getWebhookSettings();
      const logs = await db.getWebhookLogs(100);

      // Calculate statistics
      const stats = {
        total: logs.length,
        success: logs.filter(l => l.status === "success").length,
        failed: logs.filter(l => l.status === "failed").length,
        duplicate: logs.filter(l => l.status === "duplicate").length,
        pending: logs.filter(
          l => l.status === "pending" || l.status === "processing"
        ).length,
      };

      // Calculate average processing time
      const processingTimes = logs
        .filter(l => l.processingTimeMs !== null)
        .map(l => l.processingTimeMs!);
      const avgProcessingTime =
        processingTimes.length > 0
          ? Math.round(
              processingTimes.reduce((a, b) => a + b, 0) /
                processingTimes.length
            )
          : 0;

      return {
        isPaused: settings.paused,
        stats,
        avgProcessingTimeMs: avgProcessingTime,
        lastWebhook: logs.length > 0 ? logs[0].createdAt : null,
      };
    }),

    /**
     * Pause webhook processing
     */
    pause: adminProcedure.mutation(async () => {
      await db.updateWebhookSettings({ paused: true });
      return { success: true, message: "Webhook processing paused" };
    }),

    /**
     * Resume webhook processing
     */
    resume: adminProcedure.mutation(async () => {
      await db.updateWebhookSettings({ paused: false });
      return { success: true, message: "Webhook processing resumed" };
    }),

    /**
     * Delete a specific webhook log
     */
    deleteLog: adminProcedure
      .input(z.object({ logId: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteWebhookLog(input.logId);
        return { success };
      }),

    /**
     * Clear all webhook logs
     */
    clearLogs: adminProcedure.mutation(async () => {
      const deleted = await db.deleteAllWebhookLogs();
      return { success: true, deleted };
    }),

    /**
     * Delete a trade (for removing test trades)
     */
    deleteTrade: adminProcedure
      .input(z.object({ tradeId: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteTrade(input.tradeId);
        return { success };
      }),

    /**
     * Upload trades from TradingView CSV with optional overwrite
     * Parses CSV data and inserts trades for a strategy
     */
    uploadTrades: adminProcedure
      .input(
        z.object({
          strategyId: z.number(),
          trades: z.array(
            z.object({
              entryDate: z.string(),
              exitDate: z.string(),
              direction: z.string(),
              entryPrice: z.number(),
              exitPrice: z.number(),
              quantity: z.number().optional().default(1),
              pnl: z.number(),
              commission: z.number().optional().default(0),
            })
          ),
          overwrite: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        // Convert string dates to Date objects and calculate pnlPercent
        const tradesToUpload = input.trades.map(t => {
          const entryDate = new Date(t.entryDate);
          const exitDate = new Date(t.exitDate);
          const entryPriceCents = Math.round(t.entryPrice * 100);
          const exitPriceCents = Math.round(t.exitPrice * 100);
          const pnlCents = Math.round(t.pnl * 100);
          const pnlPercent = Math.round((t.pnl / t.entryPrice) * 10000);

          return {
            entryDate,
            exitDate,
            direction: t.direction,
            entryPrice: entryPriceCents,
            exitPrice: exitPriceCents,
            quantity: t.quantity,
            pnl: pnlCents,
            pnlPercent,
            commission: Math.round(t.commission * 100),
          };
        });

        const result = await db.uploadTradesForStrategy(
          input.strategyId,
          tradesToUpload,
          input.overwrite
        );

        return {
          success: true,
          deleted: result.deleted,
          inserted: result.inserted,
          message: input.overwrite
            ? `Replaced ${result.deleted} trades with ${result.inserted} new trades`
            : `Added ${result.inserted} new trades`,
        };
      }),

    /**
     * Send a test webhook (for testing the integration)
     */
    sendTestWebhook: adminProcedure
      .input(
        z.object({
          type: z.enum(["entry", "exit"]),
          strategy: z.string(),
          direction: z.enum(["Long", "Short"]),
          price: z.number(),
          quantity: z.number().optional().default(1),
          entryPrice: z.number().optional(),
          pnl: z.number().optional(),
          includeToken: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        // Build the test payload
        const payload: Record<string, unknown> = {
          symbol: input.strategy,
          date: new Date().toISOString(),
          data:
            input.type === "entry"
              ? input.direction === "Long"
                ? "buy"
                : "sell"
              : "exit",
          quantity: input.quantity,
          price: input.price,
          direction: input.direction,
          isTest: true, // Always mark test webhooks to prevent dashboard pollution
        };

        // Add token if requested
        if (input.includeToken && process.env.TRADINGVIEW_WEBHOOK_TOKEN) {
          payload.token = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
        }

        // Add entry data for exit signals
        if (input.type === "exit") {
          payload.entryPrice =
            input.entryPrice ||
            input.price - (input.direction === "Long" ? 10 : -10);
          payload.entryTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
          if (input.pnl !== undefined) {
            payload.pnl = input.pnl;
          }
        }

        try {
          // VALIDATE ONLY - do not persist to database
          const strategy = await db.getStrategyBySymbol(input.strategy);

          // Check token
          const expectedToken = process.env.TRADINGVIEW_WEBHOOK_TOKEN;
          const tokenValid = !expectedToken || payload.token === expectedToken;

          if (!strategy) {
            return {
              success: false,
              logId: 0,
              message: "Test validation failed",
              error: `Unknown strategy: ${input.strategy}`,
              payload,
              isTest: true,
            };
          }

          if (!tokenValid) {
            return {
              success: false,
              logId: 0,
              message: "Test validation failed",
              error: "Invalid or missing authentication token",
              payload,
              isTest: true,
            };
          }

          return {
            success: true,
            logId: 0,
            message: `Test webhook validated successfully for ${strategy.name}`,
            payload,
            isTest: true,
            strategyName: strategy.name,
          };
        } catch (error) {
          return {
            success: false,
            logId: 0,
            message: "Test validation failed",
            error: error instanceof Error ? error.message : "Unknown error",
            payload,
            isTest: true,
          };
        }
      }),

    /**
     * Validate a webhook payload without processing (dry run)
     */
    validatePayload: adminProcedure
      .input(
        z.object({
          payload: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const parsed = JSON.parse(input.payload);
          const validated = parsed;

          // Check if strategy exists
          const strategySymbol =
            validated.strategySymbol ||
            validated.symbol ||
            validated.strategy ||
            "";
          const strategy = await db.getStrategyBySymbol(strategySymbol);

          return {
            valid: true,
            parsed: validated,
            strategyFound: !!strategy,
            strategyName: strategy?.name || null,
            mappedSymbol: strategySymbol,
          };
        } catch (error) {
          return {
            valid: false,
            error: error instanceof Error ? error.message : "Invalid payload",
            parsed: null,
            strategyFound: false,
            strategyName: null,
            mappedSymbol: null,
          };
        }
      }),

    /**
     * Get comprehensive webhook health and monitoring data
     */
    getHealthReport: adminProcedure.query(async () => {
      const { isCircuitOpen, getCircuitStatus } = await import(
        "./webhookSecurity"
      );

      const logs = await db.getWebhookLogs(500);
      const now = Date.now();

      // Calculate metrics for different time windows
      const calculateMetrics = (windowMs: number) => {
        const windowLogs = logs.filter(l => {
          const logTime = new Date(l.createdAt).getTime();
          return now - logTime < windowMs;
        });

        const total = windowLogs.length;
        const success = windowLogs.filter(l => l.status === "success").length;
        const failed = windowLogs.filter(l => l.status === "failed").length;
        const duplicate = windowLogs.filter(
          l => l.status === "duplicate"
        ).length;

        const processingTimes = windowLogs
          .filter(l => l.processingTimeMs !== null)
          .map(l => l.processingTimeMs!);

        return {
          total,
          success,
          failed,
          duplicate,
          successRate:
            total > 0 ? ((success / total) * 100).toFixed(1) + "%" : "100%",
          avgProcessingMs:
            processingTimes.length > 0
              ? Math.round(
                  processingTimes.reduce((a, b) => a + b, 0) /
                    processingTimes.length
                )
              : 0,
          maxProcessingMs:
            processingTimes.length > 0 ? Math.max(...processingTimes) : 0,
          p95ProcessingMs:
            processingTimes.length > 0
              ? processingTimes.sort((a, b) => a - b)[
                  Math.floor(processingTimes.length * 0.95)
                ]
              : 0,
        };
      };

      // Check for issues
      const issues: string[] = [];
      const last24h = calculateMetrics(24 * 60 * 60 * 1000);
      const lastHour = calculateMetrics(60 * 60 * 1000);

      const settings = await db.getWebhookSettings();
      if (settings?.paused) {
        issues.push("Webhook processing is paused");
      }

      if (isCircuitOpen("webhook-database")) {
        issues.push("Database circuit breaker is open");
      }

      const successRateNum = parseFloat(lastHour.successRate);
      if (lastHour.total > 5 && successRateNum < 50) {
        issues.push(`Low success rate in last hour: ${lastHour.successRate}`);
      }

      if (lastHour.avgProcessingMs > 500) {
        issues.push(
          `High latency in last hour: ${lastHour.avgProcessingMs}ms avg`
        );
      }

      return {
        status: issues.length === 0 ? "healthy" : "degraded",
        isPaused: settings?.paused ?? false,
        circuitBreaker: {
          open: isCircuitOpen("webhook-database"),
          status: getCircuitStatus("webhook-database"),
        },
        metrics: {
          lastHour,
          last24Hours: last24h,
        },
        issues,
        lastWebhook: logs.length > 0 ? logs[0].createdAt : null,
      };
    }),

    /**
     * Trigger owner notification for webhook issues
     */
    notifyOwnerOfIssues: adminProcedure
      .input(
        z.object({
          issues: z.array(z.string()),
          metrics: z.object({
            total: z.number(),
            failed: z.number(),
            successRate: z.string(),
          }),
        })
      )
      .mutation(async ({ input }) => {
        const { notifyOwner } = await import("./_core/notification");

        const content = `
**Webhook Health Alert**

Issues detected:
${input.issues.map(i => `- ${i}`).join("\n")}

**Metrics (Last Hour):**
- Total webhooks: ${input.metrics.total}
- Failed: ${input.metrics.failed}
- Success rate: ${input.metrics.successRate}

Please check the Webhooks page in your dashboard for more details.
        `.trim();

        const success = await notifyOwner({
          title: "TradingView Webhook Alert",
          content,
        });

        return { success };
      }),

    /**
     * Get all open positions (trades waiting for exit signals)
     */
    getOpenPositions: adminProcedure.query(async () => {
      const positions = await db.getAllOpenPositions();
      // SAFEGUARD: Only show positions from active NQ strategies to prevent
      // test suite ES trades from appearing in customer-facing feeds
      const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];
      const filteredPositions = positions.filter(p =>
        PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
          p.strategySymbol.toUpperCase().startsWith(prefix)
        )
      );
      return filteredPositions.map(p => ({
        id: p.id,
        strategyId: p.strategyId,
        strategySymbol: p.strategySymbol,
        direction: p.direction,
        entryPrice: p.entryPrice / 100, // Convert from cents to dollars
        quantity: p.quantity,
        entryTime: p.entryTime,
        status: p.status,
        createdAt: p.createdAt,
      }));
    }),

    /**
     * Get recent positions (open + closed) for activity feed
     */
    getRecentPositions: adminProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        const positions = await db.getRecentPositions(input.limit);
        // SAFEGUARD: Only show NQ strategies in customer-facing feeds
        const PRODUCTION_STRATEGY_PREFIXES = ["NQ"];
        const filteredPositions = positions.filter(p =>
          PRODUCTION_STRATEGY_PREFIXES.some(prefix =>
            p.strategySymbol.toUpperCase().startsWith(prefix)
          )
        );
        return filteredPositions.map(p => ({
          id: p.id,
          strategyId: p.strategyId,
          strategySymbol: p.strategySymbol,
          direction: p.direction,
          entryPrice: p.entryPrice / 100,
          exitPrice: p.exitPrice ? p.exitPrice / 100 : null,
          quantity: p.quantity,
          entryTime: p.entryTime,
          exitTime: p.exitTime,
          status: p.status,
          pnl: p.pnl ? p.pnl / 100 : null,
          tradeId: p.tradeId,
          createdAt: p.createdAt,
        }));
      }),

    /**
     * Get position statistics for dashboard
     */
    getPositionStats: adminProcedure.query(async () => {
      const stats = await db.getPositionStats();
      return {
        openPositions: stats.open,
        closedToday: stats.closedToday,
        totalPnlToday: stats.totalPnlToday / 100, // Convert from cents to dollars
      };
    }),

    /**
     * Delete an open position (admin function)
     */
    deletePosition: adminProcedure
      .input(z.object({ positionId: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteOpenPosition(input.positionId);
        return { success };
      }),

    /**
     * Clear all open positions for a strategy (admin function)
     */
    clearPositionsForStrategy: adminProcedure
      .input(z.object({ strategySymbol: z.string() }))
      .mutation(async ({ input }) => {
        const deleted = await db.clearOpenPositionsForStrategy(
          input.strategySymbol
        );
        return { success: true, deleted };
      }),

    /**
     * Force close a position (for reconciliation)
     */
    forceClosePosition: adminProcedure
      .input(
        z.object({
          positionId: z.number(),
          reason: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { forceClosePosition } = await import("./reconciliationService");
        await forceClosePosition(
          input.positionId,
          input.reason,
          // @ts-expect-error TS2345
          ctx.user.name || ctx.user.openId
        );
        return { success: true };
      }),

    /**
     * Get unresolved discrepancies
     */
    getDiscrepancies: adminProcedure.query(async () => {
      const { getUnresolvedDiscrepancies } = await import(
        "./reconciliationService"
      );
      return getUnresolvedDiscrepancies();
    }),

    /**
     * Resolve a discrepancy
     */
    resolveDiscrepancy: adminProcedure
      .input(
        z.object({
          discrepancyId: z.number(),
          action: z.enum([
            "sync_from_broker",
            "force_close",
            "ignore",
            "manual_fix",
          ]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { resolveDiscrepancy } = await import("./reconciliationService");
        await resolveDiscrepancy(input.discrepancyId, {
          action: input.action,
          // @ts-expect-error TS2322
          resolvedBy: ctx.user.name || ctx.user.openId,
          notes: input.notes,
        });
        return { success: true };
      }),

    /**
     * Get position adjustment history
     */
    getAdjustmentHistory: adminProcedure
      .input(z.object({ strategySymbol: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const { getAdjustmentHistory } = await import(
          "./reconciliationService"
        );
        return getAdjustmentHistory(input?.strategySymbol);
      }),

    // ============================================================================
    // Staging Trades (Webhook Review Workflow)
    // ============================================================================

    /**
     * Get staging trades with optional filters
     */
    getStagingTrades: adminProcedure
      .input(
        z
          .object({
            status: z
              .enum(["pending", "approved", "rejected", "edited"])
              .optional(),
            strategyId: z.number().optional(),
            isOpen: z.boolean().optional(),
            limit: z.number().optional().default(100),
          })
          .optional()
      )
      .query(async ({ input }) => {
        const trades = await db.getStagingTrades(input);
        return trades.map(t => ({
          id: t.id,
          webhookLogId: t.webhookLogId,
          strategyId: t.strategyId,
          strategySymbol: t.strategySymbol,
          entryDate: t.entryDate,
          exitDate: t.exitDate,
          direction: t.direction,
          entryPrice: t.entryPrice / 100, // Convert from cents
          exitPrice: t.exitPrice ? t.exitPrice / 100 : null,
          quantity: t.quantity,
          pnl: t.pnl ? t.pnl / 100 : null,
          pnlPercent: t.pnlPercent ? t.pnlPercent / 10000 : null,
          commission: t.commission / 100,
          isOpen: t.isOpen,
          status: t.status,
          reviewedBy: t.reviewedBy,
          reviewedAt: t.reviewedAt,
          reviewNotes: t.reviewNotes,
          originalPayload: t.originalPayload,
          productionTradeId: t.productionTradeId,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        }));
      }),

    /**
     * Get staging trade statistics
     */
    getStagingStats: adminProcedure.query(async () => {
      return db.getStagingTradeStats();
    }),

    /**
     * Approve a staging trade (move to production)
     */
    approveStagingTrade: adminProcedure
      .input(
        z.object({
          stagingTradeId: z.number(),
          reviewNotes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.approveStagingTrade(
          input.stagingTradeId,
          ctx.user.id,
          input.reviewNotes
        );
        return result;
      }),

    /**
     * Reject a staging trade
     */
    rejectStagingTrade: adminProcedure
      .input(
        z.object({
          stagingTradeId: z.number(),
          reviewNotes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const result = await db.rejectStagingTrade(
          input.stagingTradeId,
          ctx.user.id,
          input.reviewNotes
        );
        return result;
      }),

    /**
     * Edit a staging trade before approval
     */
    editStagingTrade: adminProcedure
      .input(
        z.object({
          stagingTradeId: z.number(),
          updates: z.object({
            entryDate: z.string().optional(),
            exitDate: z.string().optional(),
            direction: z.string().optional(),
            entryPrice: z.number().optional(),
            exitPrice: z.number().optional(),
            quantity: z.number().optional(),
            pnl: z.number().optional(),
            commission: z.number().optional(),
          }),
          reviewNotes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Convert dollars to cents for storage
        const updates: Record<string, unknown> = {};
        if (input.updates.entryDate)
          updates.entryDate = new Date(input.updates.entryDate);
        if (input.updates.exitDate)
          updates.exitDate = new Date(input.updates.exitDate);
        if (input.updates.direction)
          updates.direction = input.updates.direction;
        if (input.updates.entryPrice !== undefined)
          updates.entryPrice = Math.round(input.updates.entryPrice * 100);
        if (input.updates.exitPrice !== undefined)
          updates.exitPrice = Math.round(input.updates.exitPrice * 100);
        if (input.updates.quantity !== undefined)
          updates.quantity = input.updates.quantity;
        if (input.updates.pnl !== undefined) {
          updates.pnl = Math.round(input.updates.pnl * 100);
          // Recalculate pnlPercent if we have entry price
          if (input.updates.entryPrice) {
            updates.pnlPercent = Math.round(
              (input.updates.pnl / input.updates.entryPrice) * 10000
            );
          }
        }
        if (input.updates.commission !== undefined)
          updates.commission = Math.round(input.updates.commission * 100);

        const result = await db.editStagingTrade(
          input.stagingTradeId,
          ctx.user.id,
          updates as any,
          input.reviewNotes
        );
        return result;
      }),

    /**
     * Delete a staging trade permanently
     */
    deleteStagingTrade: adminProcedure
      .input(z.object({ stagingTradeId: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteStagingTrade(input.stagingTradeId);
        return { success };
      }),
  }),

  // Broker router for trading integrations (Admin-only)
  broker: router({
    /**
     * Get Tradovate OAuth URL for redirect-based authentication
     */
    getTradovateOAuthUrl: adminProcedure
      .input(z.object({ isLive: z.boolean().optional().default(false) }))
      .query(async ({ ctx, input }) => {
        // Generate OAuth state for security
        const state = `${ctx.user.id}_${Date.now()}_${input.isLive ? "live" : "demo"}`;

        // Build OAuth URL - Tradovate OAuth endpoint
        const clientId = process.env.TRADOVATE_CLIENT_ID;
        if (!clientId) {
          return { url: null, error: "Tradovate OAuth not configured" };
        }

        const baseUrl =
          process.env.VITE_APP_URL || "https://intradaystrategies.com";
        const redirectUri = `${baseUrl}/api/oauth/tradovate/callback`;

        const params = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          state: state,
        });

        return {
          url: `https://trader.tradovate.com/oauth?${params.toString()}`,
          state,
        };
      }),

    /**
     * Get all broker connections for the current user
     */
    getConnections: adminProcedure.query(async ({ ctx }) => {
      const connections = await brokerService.getBrokerConnections(ctx.user.id);
      // Don't expose sensitive tokens
      return connections.map(c => ({
        id: c.id,
        broker: c.broker,
        name: c.name,
        status: c.status,
        accountId: c.accountId,
        accountName: c.accountName,
        accountType: c.accountType,
        lastConnectedAt: c.lastConnectedAt,
        lastError: c.lastError,
        createdAt: c.createdAt,
      }));
    }),

    /**
     * Create a new broker connection
     */
    createConnection: adminProcedure
      .input(
        z.object({
          broker: z.enum(["tradovate", "ibkr", "tradestation"]),
          name: z.string().min(1).max(100),
          accountId: z.string().optional(),
          accountType: z.enum(["live", "paper", "demo"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await brokerService.createBrokerConnection({
          userId: ctx.user.id,
          broker: input.broker,
          name: input.name,
          accountId: input.accountId,
          accountType: input.accountType,
        });
        return { success: true };
      }),

    /**
     * Connect a broker with credentials
     */
    connect: adminProcedure
      .input(
        z.object({
          broker: z.enum(["tradovate", "ibkr", "tradestation"]),
          credentials: z.object({
            apiKey: z.string().optional(),
            apiSecret: z.string().optional(),
            username: z.string().optional(),
            password: z.string().optional(),
            accountId: z.string().optional(),
            clientId: z.string().optional(),
            clientSecret: z.string().optional(),
            gatewayUrl: z.string().optional(),
          }),
          isDemo: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Create the connection with credentials
        // Note: In production, credentials should be encrypted before storage
        await brokerService.createBrokerConnection({
          userId: ctx.user.id,
          broker: input.broker,
          name: `${input.broker.charAt(0).toUpperCase() + input.broker.slice(1)} ${input.isDemo ? "Demo" : "Live"}`,
          accountId: input.credentials.accountId,
          accountType: input.isDemo ? "demo" : "live",
        });
        return { success: true };
      }),

    /**
     * Disconnect a broker
     */
    disconnect: adminProcedure
      .input(z.object({ connectionId: z.number() }))
      .mutation(async ({ input }) => {
        await brokerService.deleteBrokerConnection(input.connectionId);
        return { success: true };
      }),

    /**
     * Delete a broker connection
     */
    deleteConnection: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await brokerService.deleteBrokerConnection(input.id);
        return { success: true };
      }),

    /**
     * Get routing rules
     */
    getRoutingRules: adminProcedure.query(async ({ ctx }) => {
      return brokerService.getRoutingRules(ctx.user.id);
    }),

    /**
     * Get execution logs
     */
    getExecutionLogs: adminProcedure
      .input(
        z.object({
          webhookLogId: z.number().optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ input }) => {
        return brokerService.getExecutionLogs(input.webhookLogId, input.limit);
      }),

    /**
     * Test IBKR connection - pings the gateway and returns account info
     */
    testIBKRConnection: adminProcedure
      .input(
        z.object({
          gatewayUrl: z.string().optional().default("http://localhost:5000"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Try to ping the IBKR Client Portal Gateway
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(
            `${input.gatewayUrl}/v1/api/iserver/auth/status`,
            {
              method: "POST",
              signal: controller.signal,
              headers: {
                "Content-Type": "application/json",
              },
            }
          ).catch(() => null);

          clearTimeout(timeoutId);

          if (!response || !response.ok) {
            return {
              success: false,
              error:
                "Cannot reach IBKR Gateway. Make sure the Client Portal Gateway is running on your machine.",
              details: {
                gatewayUrl: input.gatewayUrl,
                status: response?.status || "unreachable",
              },
            };
          }

          const authStatus = await response.json();

          // If authenticated, get account info
          if (authStatus.authenticated) {
            const accountsResponse = await fetch(
              `${input.gatewayUrl}/v1/api/portfolio/accounts`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                },
              }
            ).catch(() => null);

            const accounts = accountsResponse?.ok
              ? await accountsResponse.json()
              : [];

            return {
              success: true,
              authenticated: true,
              accounts: accounts,
              message: `Connected! Found ${accounts.length} account(s).`,
            };
          } else {
            return {
              success: true,
              authenticated: false,
              message:
                "Gateway is running but not authenticated. Please log in to the Client Portal.",
            };
          }
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Connection test failed",
          };
        }
      }),

    /**
     * Place a test order on IBKR paper account
     */
    placeIBKRTestOrder: adminProcedure
      .input(
        z.object({
          gatewayUrl: z.string().optional().default("http://localhost:5000"),
          accountId: z.string(),
          symbol: z.string().optional().default("MES"),
          quantity: z.number().optional().default(1),
          side: z.enum(["BUY", "SELL"]).optional().default("BUY"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // First, search for the contract
          const searchResponse = await fetch(
            `${input.gatewayUrl}/v1/api/iserver/secdef/search?symbol=${input.symbol}&secType=FUT`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ symbol: input.symbol }),
            }
          ).catch(() => null);

          if (!searchResponse?.ok) {
            return {
              success: false,
              error:
                "Failed to search for contract. Make sure IBKR Gateway is running and authenticated.",
            };
          }

          const contracts = await searchResponse.json();
          if (!contracts || contracts.length === 0) {
            return {
              success: false,
              error: `Contract ${input.symbol} not found.`,
            };
          }

          const conid = contracts[0].conid;

          // Place a market order
          const orderResponse = await fetch(
            `${input.gatewayUrl}/v1/api/iserver/account/${input.accountId}/orders`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orders: [
                  {
                    conid: conid,
                    orderType: "MKT",
                    side: input.side,
                    quantity: input.quantity,
                    tif: "DAY",
                  },
                ],
              }),
            }
          ).catch(() => null);

          if (!orderResponse?.ok) {
            const errorText = await orderResponse
              ?.text()
              .catch(() => "Unknown error");
            return {
              success: false,
              error: `Order failed: ${errorText}`,
            };
          }

          const orderResult = await orderResponse.json();

          // IBKR may require order confirmation
          if (orderResult[0]?.id === "confirm") {
            // Auto-confirm the order for paper trading
            const confirmResponse = await fetch(
              `${input.gatewayUrl}/v1/api/iserver/reply/${orderResult[0].id}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmed: true }),
              }
            ).catch(() => null);

            const confirmResult = confirmResponse?.ok
              ? await confirmResponse.json()
              : null;
            return {
              success: true,
              message: `Test order placed and confirmed!`,
              orderId: confirmResult?.[0]?.order_id || orderResult[0]?.id,
              details: {
                symbol: input.symbol,
                side: input.side,
                quantity: input.quantity,
                conid: conid,
              },
            };
          }

          return {
            success: true,
            message: `Test order placed successfully!`,
            orderId: orderResult[0]?.order_id,
            details: {
              symbol: input.symbol,
              side: input.side,
              quantity: input.quantity,
              conid: conid,
            },
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to place test order",
          };
        }
      }),

    /**
     * Get supported brokers with their status
     */
    getSupportedBrokers: adminProcedure.query(() => {
      return [
        {
          id: "tradovate",
          name: "Tradovate",
          description: "Futures trading platform",
          status: "available",
          features: ["futures", "paper-trading"],
        },
        {
          id: "ibkr",
          name: "Interactive Brokers",
          description: "Multi-asset broker",
          status: "coming-soon",
          features: ["stocks", "options", "futures", "forex"],
        },
        {
          id: "tradestation",
          name: "TradeStation",
          description: "Futures & equities platform",
          status: "coming-soon",
          features: ["stocks", "options", "futures"],
        },
      ];
    }),

    /**
     * Simulate a webhook for testing (isolated test data)
     */
    simulateWebhook: adminProcedure
      .input(
        z.object({
          symbol: z.string(),
          action: z.enum(["entry", "exit"]),
          direction: z.enum(["long", "short"]),
          price: z.number(),
          quantity: z.number().optional().default(1),
          isTest: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const correlationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();

        // Map entry/exit to buy/sell for the webhook processor
        let webhookAction: string;
        if (input.action === "entry") {
          webhookAction = input.direction === "long" ? "buy" : "sell";
        } else {
          webhookAction = "exit";
        }

        const tokenFromEnv = process.env.TRADINGVIEW_WEBHOOK_TOKEN;

        const payload = {
          symbol: input.symbol,
          data: webhookAction,
          direction: input.direction,
          price: input.price,
          quantity: input.quantity,
          date: new Date().toISOString(),
          isTest: input.isTest,
          token: tokenFromEnv || "",
          _internalSimulation: true,
        };

        try {
          const result = await processWebhook(payload, correlationId);
          const processingTimeMs = Date.now() - startTime;

          return {
            success: result.success,
            message:
              result.message ||
              (result.success
                ? "Webhook processed successfully"
                : "Webhook processing failed"),
            correlationId,
            processingTimeMs,
            signalType: result.signalType,
          };
        } catch (error) {
          const processingTimeMs = Date.now() - startTime;
          return {
            success: false,
            message: "Webhook processing failed",
            correlationId,
            processingTimeMs,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
  }),

  // User subscription router for strategy subscriptions
  subscription: router({
    /**
     * Get all subscriptions for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return subscriptionService.getUserSubscriptions(ctx.user.id);
    }),

    /**
     * Subscribe to a strategy
     */
    subscribe: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          notificationsEnabled: z.boolean().optional().default(true),
          autoExecuteEnabled: z.boolean().optional().default(false),
          quantityMultiplier: z.number().optional().default(1),
          maxPositionSize: z.number().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return subscriptionService.subscribeToStrategy(
          ctx.user.id,
          input.strategyId,
          {
            notificationsEnabled: input.notificationsEnabled,
            autoExecuteEnabled: input.autoExecuteEnabled,
            quantityMultiplier: input.quantityMultiplier,
            maxPositionSize: input.maxPositionSize ?? null,
          }
        );
      }),

    /**
     * Unsubscribe from a strategy
     */
    unsubscribe: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return subscriptionService.unsubscribeFromStrategy(
          ctx.user.id,
          input.strategyId
        );
      }),

    /**
     * Update subscription settings
     */
    updateSettings: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          notificationsEnabled: z.boolean().optional(),
          autoExecuteEnabled: z.boolean().optional(),
          quantityMultiplier: z.number().optional(),
          maxPositionSize: z.number().nullable().optional(),
          accountValue: z.number().nullable().optional(),
          useLeveraged: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { strategyId, ...settings } = input;
        return subscriptionService.updateSubscriptionSettings(
          ctx.user.id,
          strategyId,
          settings
        );
      }),

    /**
     * Get user's pending signals
     */
    pendingSignals: protectedProcedure.query(async ({ ctx }) => {
      return subscriptionService.getUserPendingSignals(ctx.user.id);
    }),

    /**
     * Mark a signal as executed or skipped
     */
    updateSignal: protectedProcedure
      .input(
        z.object({
          signalId: z.number(),
          action: z.enum(["executed", "skipped"]),
          executionLogId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return subscriptionService.updateSignalAction(
          input.signalId,
          ctx.user.id,
          input.action,
          input.executionLogId
        );
      }),

    /**
     * Get subscription statistics
     */
    stats: protectedProcedure.query(async ({ ctx }) => {
      return subscriptionService.getUserSubscriptionStats(ctx.user.id);
    }),

    /**
     * Get all available strategies for subscription
     */
    availableStrategies: protectedProcedure.query(async () => {
      return getAllStrategies();
    }),

    /**
     * Get user's personalized portfolio analytics
     */
    portfolioAnalytics: protectedProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
        })
      )
      .query(async ({ ctx, input }) => {
        const { timeRange, startingCapital } = input;

        // Get user's subscriptions
        const subscriptions = await subscriptionService.getUserSubscriptions(
          ctx.user.id
        );
        if (subscriptions.length === 0) {
          return {
            hasData: false,
            message: "No subscribed strategies",
            subscriptions: [],
            equityCurve: [],
            underwaterCurve: [],
            metrics: null,
          };
        }

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;
        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 10);
              break;
          }
        }

        // Get strategy IDs from subscriptions
        const strategyIds = subscriptions.map(s => s.strategyId);

        // Get trades for all subscribed strategies
        const allTrades = await getTrades({
          strategyIds,
          startDate,
          endDate: now,
        });

        if (allTrades.length === 0) {
          return {
            hasData: false,
            message: "No trades in selected time range",
            subscriptions,
            equityCurve: [],
            underwaterCurve: [],
            metrics: null,
          };
        }

        // Apply user's multipliers to trades
        const adjustedTrades = allTrades.map((trade: any) => {
          const sub = subscriptions.find(
            s => s.strategyId === trade.strategyId
          );
          const multiplier = Number(sub?.quantityMultiplier) || 1;
          return {
            ...trade,
            pnl: trade.pnl * multiplier,
          };
        });

        // Calculate combined equity curve
        const equityCurve = analytics.calculateEquityCurve(
          adjustedTrades,
          startingCapital
        );

        // Calculate underwater curve (returns array directly)
        const underwaterCurve = analytics.calculateUnderwaterCurve(equityCurve);

        // Calculate performance metrics
        const metrics = analytics.calculatePerformanceMetrics(
          adjustedTrades,
          startingCapital
        );

        // Calculate monthly returns from equity curve
        const monthlyReturns =
          analytics.calculateMonthlyReturnsCalendar(equityCurve);

        // Calculate strategy correlation matrix if multiple strategies subscribed
        let strategyCorrelation: {
          strategyId: number;
          strategyName: string;
          correlations: { strategyId: number; correlation: number }[];
        }[] = [];
        if (strategyIds.length > 1) {
          // Get individual strategy equity curves for correlation
          const strategyCurves = await Promise.all(
            strategyIds.map(async sid => {
              const strategyTrades = await getTrades({
                strategyIds: [sid],
                startDate,
                endDate: now,
              });
              const sub = subscriptions.find(s => s.strategyId === sid);
              const multiplier = Number(sub?.quantityMultiplier) || 1;
              const adjustedStrategyTrades = strategyTrades.map((t: any) => ({
                ...t,
                pnl: t.pnl * multiplier,
              }));
              const curve = analytics.calculateEquityCurve(
                adjustedStrategyTrades,
                startingCapital
              );
              return { strategyId: sid, curve };
            })
          );

          // Calculate correlation matrix
          for (let i = 0; i < strategyCurves.length; i++) {
            const strategy = strategyCurves[i]!;
            const sub = subscriptions.find(
              s => s.strategyId === strategy.strategyId
            );
            const correlations: { strategyId: number; correlation: number }[] =
              [];

            for (let j = 0; j < strategyCurves.length; j++) {
              const otherStrategy = strategyCurves[j]!;
              const corr = analytics.calculateCorrelation(
                strategy.curve,
                otherStrategy.curve
              );
              correlations.push({
                strategyId: otherStrategy.strategyId,
                correlation: corr,
              });
            }

            strategyCorrelation.push({
              strategyId: strategy.strategyId,
              strategyName:
                (sub as any)?.strategy?.name ||
                `Strategy ${strategy.strategyId}`,
              correlations,
            });
          }
        }

        // Get today's trades for the "Today's Activity" section
        // Only show REAL trades from webhook activity, not historical backtest data
        // We identify real trades by checking the webhook_logs table for trades created today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Get today's webhook logs that resulted in trades
        const todayWebhookLogs = await db.getWebhookLogs({
          status: "success",
          startDate: todayStart,
          endDate: todayEnd,
          limit: 100,
        });

        // Extract trade IDs from successful webhooks
        const webhookTradeIds = new Set(
          todayWebhookLogs
            .filter((log: any) => log.tradeId != null)
            .map((log: any) => log.tradeId)
        );

        // Get today's open positions (active trades waiting for exit signals)
        // These are REAL positions from webhooks that haven't closed yet
        const allOpenPositions = await db.getAllOpenPositions();
        const todayOpenPositions = allOpenPositions.filter((pos: any) => {
          // Only include positions that:
          // 1. Were created today
          // 2. Belong to a strategy the user is subscribed to
          const posCreatedAt = new Date(pos.entryTime);
          return (
            posCreatedAt >= todayStart &&
            posCreatedAt <= todayEnd &&
            strategyIds.includes(pos.strategyId)
          );
        });

        // Filter allTrades to ONLY include those created by today's webhooks
        // Do NOT include backtest data based on createdAt - only real webhook trades
        const closedTodayTrades = allTrades
          .filter((t: any) => {
            // ONLY include trades that were created by a webhook today
            // This ensures backtest data (which has recent createdAt from import) is excluded
            return webhookTradeIds.has(t.id);
          })
          .map((t: any) => {
            const sub = subscriptions.find(s => s.strategyId === t.strategyId);
            return {
              id: t.id,
              strategyId: t.strategyId,
              strategyName:
                (sub as any)?.strategy?.name || `Strategy ${t.strategyId}`,
              symbol:
                (sub as any)?.strategy?.symbol || `Strategy ${t.strategyId}`,
              direction: t.direction,
              entryDate: t.entryDate,
              entryPrice: t.entryPrice / 100, // Convert from cents to dollars
              exitDate: t.exitDate,
              exitPrice: t.exitPrice ? t.exitPrice / 100 : null, // Convert from cents to dollars
              pnl: (t.pnl / 100) * (Number(sub?.quantityMultiplier) || 1), // Convert from cents to dollars
              isActive: false, // Closed trades are not active
            };
          });

        // Convert open positions to the same format as trades
        const openPositionTrades = todayOpenPositions.map((pos: any) => {
          const sub = subscriptions.find(s => s.strategyId === pos.strategyId);
          return {
            id: `open-${pos.id}`, // Prefix to distinguish from trade IDs
            strategyId: pos.strategyId,
            strategyName:
              (sub as any)?.strategy?.name || `Strategy ${pos.strategyId}`,
            symbol: pos.strategySymbol,
            direction: pos.direction,
            entryDate: pos.entryTime,
            entryPrice: pos.entryPrice / 100, // Convert from cents to dollars
            exitDate: null,
            exitPrice: null,
            pnl: 0, // No P&L yet for open positions
            isActive: true, // Open positions are active
          };
        });

        // Combine open positions and closed trades, with open positions first
        const todayTrades = [...openPositionTrades, ...closedTodayTrades];

        // Get S&P 500 benchmark data
        const benchmarkData = await db.getBenchmarkData({
          startDate,
          endDate: now,
        });
        const benchmarkEquityCurve =
          benchmarkData.length > 0
            ? benchmarkData.map((b, _idx) => {
                // Scale benchmark to match starting capital
                const firstClose = benchmarkData[0]!.close / 100; // cents to dollars
                const currentClose = b.close / 100;
                const scaledEquity =
                  startingCapital * (currentClose / firstClose);
                return {
                  date: b.date.toISOString().split("T")[0],
                  equity: scaledEquity,
                };
              })
            : [];

        // Calculate benchmark underwater curve
        const benchmarkUnderwaterCurve =
          benchmarkEquityCurve.length > 0
            ? analytics
                .calculateUnderwaterCurve(
                  benchmarkEquityCurve.map(b => ({
                    date: new Date(b.date),
                    equity: b.equity,
                    drawdown: 0,
                  }))
                )
                .map((p: { date: Date; drawdownPercent: number }) => ({
                  date: p.date.toISOString().split("T")[0],
                  drawdown: p.drawdownPercent,
                }))
            : [];

        return {
          hasData: true,
          subscriptions,
          todayTrades,
          equityCurve: equityCurve.map((p: { date: Date; equity: number }) => ({
            date: p.date.toISOString().split("T")[0],
            equity: p.equity,
          })),
          underwaterCurve: underwaterCurve.map(
            (p: { date: Date; drawdownPercent: number }) => ({
              date: p.date.toISOString().split("T")[0],
              drawdown: p.drawdownPercent,
            })
          ),
          benchmarkEquityCurve,
          benchmarkUnderwaterCurve,
          monthlyReturns: monthlyReturns.map(m => ({
            year: m.year,
            month: m.month,
            monthName: m.monthName,
            return: m.return,
          })),
          strategyCorrelation,
          metrics: {
            totalReturn: metrics.totalReturn,
            annualizedReturn: metrics.annualizedReturn,
            sharpeRatio: metrics.sharpeRatio,
            sortinoRatio: metrics.sortinoRatio,
            maxDrawdown: metrics.maxDrawdown,
            winRate: metrics.winRate,
            profitFactor: metrics.profitFactor,
            calmarRatio: metrics.calmarRatio,
            totalTrades: metrics.totalTrades,
            avgWin: metrics.avgWin,
            avgLoss: metrics.avgLoss,
          },
        };
      }),

    /**
     * Get individual strategy equity curves for comparison
     */
    strategyEquityCurves: protectedProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
          startingCapital: z.number().optional().default(100000),
        })
      )
      .query(async ({ ctx, input }) => {
        const { timeRange, startingCapital } = input;

        // Get user's subscriptions
        const subscriptions = await subscriptionService.getUserSubscriptions(
          ctx.user.id
        );
        if (subscriptions.length === 0) {
          return { curves: [] };
        }

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;
        if (timeRange) {
          const year = now.getFullYear();
          switch (timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(now.getFullYear() - 10);
              break;
          }
        }

        // Get equity curve for each subscribed strategy
        const curves = await Promise.all(
          subscriptions.map(async sub => {
            const trades = await getTrades({
              strategyIds: [sub.strategyId],
              startDate,
              endDate: now,
            });
            const multiplier = Number(sub.quantityMultiplier) || 1;
            const adjustedTrades = trades.map((t: any) => ({
              ...t,
              pnl: t.pnl * multiplier,
            }));
            const equityCurve = analytics.calculateEquityCurve(
              adjustedTrades,
              startingCapital
            );

            return {
              strategyId: sub.strategyId,
              strategyName:
                (sub as any).strategyName || `Strategy ${sub.strategyId}`,
              multiplier,
              curve: equityCurve.map(p => ({
                date: p.date.toISOString().split("T")[0],
                equity: p.equity,
              })),
            };
          })
        );

        return { curves };
      }),

    /**
     * Update advanced strategy settings (position sizing, variance, etc.)
     */
    updateAdvancedSettings: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          notificationsEnabled: z.boolean().optional(),
          autoExecuteEnabled: z.boolean().optional(),
          quantityMultiplier: z.number().optional(),
          maxPositionSize: z.number().nullable().optional(),
          accountValue: z.number().nullable().optional(),
          useLeveraged: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { strategyId, ...settings } = input;
        return subscriptionService.updateSubscriptionSettings(
          ctx.user.id,
          strategyId,
          settings
        );
      }),
  }),

  // Notification preferences router
  notifications: router({
    /**
     * Get user's notification preferences
     */
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getNotificationPreferences(ctx.user.id);
      const strategies = await db.getStrategiesWithNotificationSettings(
        ctx.user.id
      );

      return {
        global: prefs || {
          globalMute: false,
          muteTradeExecuted: false,
          muteTradeError: false,
          mutePositionOpened: false,
          mutePositionClosed: false,
          muteWebhookFailed: false,
          muteDailyDigest: false,
          emailEnabled: true,
          emailAddress: null,
          inAppEnabled: true,
          soundEnabled: true,
        },
        strategies,
      };
    }),

    /**
     * Update global notification preferences
     */
    updateGlobalPreferences: protectedProcedure
      .input(
        z.object({
          globalMute: z.boolean().optional(),
          muteTradeExecuted: z.boolean().optional(),
          muteTradeError: z.boolean().optional(),
          mutePositionOpened: z.boolean().optional(),
          mutePositionClosed: z.boolean().optional(),
          muteWebhookFailed: z.boolean().optional(),
          muteDailyDigest: z.boolean().optional(),
          emailEnabled: z.boolean().optional(),
          emailAddress: z.string().nullable().optional(),
          inAppEnabled: z.boolean().optional(),
          soundEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // @ts-expect-error TS2345
        await db.upsertNotificationPreferences(ctx.user.id, input);
        return { success: true };
      }),

    /**
     * Toggle notifications for a specific strategy
     */
    toggleStrategy: protectedProcedure
      .input(
        z.object({
          strategyId: z.number(),
          emailEnabled: z.boolean().optional(),
          pushEnabled: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { strategyId, ...settings } = input;
        await db.upsertStrategyNotificationSetting(
          ctx.user.id,
          strategyId,
          settings
        );
        return { success: true };
      }),

    /**
     * Bulk update strategy notification settings
     */
    bulkUpdateStrategies: protectedProcedure
      .input(
        z.object({
          strategies: z.array(
            z.object({
              strategyId: z.number(),
              emailEnabled: z.boolean(),
              pushEnabled: z.boolean(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await Promise.all(
          input.strategies.map(s =>
            db.upsertStrategyNotificationSetting(ctx.user.id, s.strategyId, {
              emailEnabled: s.emailEnabled,
              pushEnabled: s.pushEnabled,
            })
          )
        );
        return { success: true };
      }),
  }),

  // QA and Pipeline Health router for monitoring and diagnostics
  qa: router({
    /**
     * Get pipeline health status
     */
    healthCheck: adminProcedure.query(async () => {
      const { quickHealthCheck } = await import(
        "./services/dataIntegrityService"
      );
      return quickHealthCheck();
    }),

    /**
     * Run full data integrity validation
     */
    validateIntegrity: adminProcedure.query(async () => {
      const { validateDataIntegrity } = await import(
        "./services/dataIntegrityService"
      );
      return validateDataIntegrity();
    }),

    /**
     * Get reconciliation report
     */
    reconciliationReport: adminProcedure.query(async () => {
      const { getReconciliationReport } = await import(
        "./services/dataIntegrityService"
      );
      return getReconciliationReport();
    }),

    /**
     * Get webhook processing metrics
     */
    webhookMetrics: adminProcedure
      .input(
        z.object({
          hours: z.number().optional().default(24),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date(Date.now() - input.hours * 60 * 60 * 1000);
        const logs = await db.getWebhookLogs({
          startDate,
          endDate: new Date(),
          limit: 1000,
        });

        const total = logs.length;
        const successful = logs.filter(
          (l: any) => l.status === "success"
        ).length;
        const failed = logs.filter((l: any) => l.status === "failed").length;
        const duplicate = logs.filter(
          (l: any) => l.status === "duplicate"
        ).length;
        const pending = logs.filter(
          (l: any) => l.status === "pending" || l.status === "processing"
        ).length;

        // Calculate latency stats
        const latencies = logs
          .filter((l: any) => l.processingTimeMs != null)
          .map((l: any) => l.processingTimeMs);

        const avgLatency =
          latencies.length > 0
            ? latencies.reduce((a: number, b: number) => a + b, 0) /
              latencies.length
            : 0;
        const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
        const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;

        // Group by hour for trend
        const hourlyTrend: { hour: string; success: number; failed: number }[] =
          [];
        const hourMap = new Map<string, { success: number; failed: number }>();

        logs.forEach((log: any) => {
          const hour =
            new Date(log.createdAt).toISOString().slice(0, 13) + ":00";
          const existing = hourMap.get(hour) || { success: 0, failed: 0 };
          if (log.status === "success") existing.success++;
          else if (log.status === "failed") existing.failed++;
          hourMap.set(hour, existing);
        });

        hourMap.forEach((value, key) => {
          hourlyTrend.push({ hour: key, ...value });
        });
        hourlyTrend.sort((a, b) => a.hour.localeCompare(b.hour));

        // Group by strategy
        const byStrategy: {
          symbol: string;
          total: number;
          success: number;
          failed: number;
        }[] = [];
        const strategyMap = new Map<
          string,
          { total: number; success: number; failed: number }
        >();

        logs.forEach((log: any) => {
          const symbol = log.strategySymbol || "unknown";
          const existing = strategyMap.get(symbol) || {
            total: 0,
            success: 0,
            failed: 0,
          };
          existing.total++;
          if (log.status === "success") existing.success++;
          else if (log.status === "failed") existing.failed++;
          strategyMap.set(symbol, existing);
        });

        strategyMap.forEach((value, key) => {
          byStrategy.push({ symbol: key, ...value });
        });

        // Recent failures
        const recentFailures = logs
          .filter((l: any) => l.status === "failed")
          .slice(0, 10)
          .map((l: any) => ({
            id: l.id,
            strategySymbol: l.strategySymbol,
            errorMessage: l.errorMessage,
            createdAt: l.createdAt,
          }));

        return {
          period: `Last ${input.hours} hours`,
          summary: {
            total,
            successful,
            failed,
            duplicate,
            pending,
            successRate:
              total > 0 ? ((successful / total) * 100).toFixed(1) + "%" : "N/A",
          },
          latency: {
            avg: Math.round(avgLatency),
            max: maxLatency,
            min: minLatency,
          },
          hourlyTrend,
          byStrategy,
          recentFailures,
        };
      }),

    /**
     * Get open positions status
     */
    openPositionsStatus: adminProcedure.query(async () => {
      const positions = await db.getAllOpenPositions();
      const openPositions = positions.filter((p: any) => p.status === "open");

      return {
        count: openPositions.length,
        positions: openPositions.map((p: any) => ({
          id: p.id,
          strategySymbol: p.strategySymbol,
          direction: p.direction,
          entryPrice: p.entryPrice / 100,
          quantity: p.quantity,
          entryTime: p.entryTime,
          ageMinutes: Math.round(
            (Date.now() - new Date(p.entryTime).getTime()) / 60000
          ),
        })),
      };
    }),

    /**
     * Run end-to-end pipeline test
     */
    runPipelineTest: adminProcedure
      .input(
        z.object({
          strategySymbol: z.string().optional().default("ESTrend"),
        })
      )
      .mutation(async ({ input }) => {
        const steps: {
          step: string;
          status: "pass" | "fail";
          message: string;
          durationMs: number;
        }[] = [];
        const startTime = Date.now();

        // Step 1: Database connectivity
        let stepStart = Date.now();
        try {
          await getAllStrategies();
          steps.push({
            step: "Database Connectivity",
            status: "pass",
            message: "Connected to database",
            durationMs: Date.now() - stepStart,
          });
        } catch (error) {
          steps.push({
            step: "Database Connectivity",
            status: "fail",
            message:
              error instanceof Error ? error.message : "Connection failed",
            durationMs: Date.now() - stepStart,
          });
          return {
            success: false,
            steps,
            totalDurationMs: Date.now() - startTime,
          };
        }

        // Step 2: Strategy lookup
        stepStart = Date.now();
        const strategy = await db.getStrategyBySymbol(input.strategySymbol);
        if (strategy) {
          steps.push({
            step: "Strategy Lookup",
            status: "pass",
            message: `Found strategy: ${strategy.name}`,
            durationMs: Date.now() - stepStart,
          });
        } else {
          steps.push({
            step: "Strategy Lookup",
            status: "fail",
            message: `Strategy not found: ${input.strategySymbol}`,
            durationMs: Date.now() - stepStart,
          });
        }

        // Step 3: Check webhook settings
        stepStart = Date.now();
        const settings = await db.getWebhookSettings();
        steps.push({
          step: "Webhook Settings",
          status: settings?.paused ? "fail" : "pass",
          message: settings?.paused
            ? "Webhook processing is PAUSED"
            : "Webhook processing is active",
          durationMs: Date.now() - stepStart,
        });

        // Step 4: Check open positions
        stepStart = Date.now();
        const openPos = await db.getOpenPositionByStrategy(
          input.strategySymbol
        );
        steps.push({
          step: "Position Check",
          status: "pass",
          message: openPos
            ? `Open position exists (ID: ${openPos.id})`
            : "No open position",
          durationMs: Date.now() - stepStart,
        });

        // Step 5: Data integrity check
        stepStart = Date.now();
        const { quickHealthCheck } = await import(
          "./services/dataIntegrityService"
        );
        const health = await quickHealthCheck();
        steps.push({
          step: "Data Integrity",
          status: health.healthy ? "pass" : "fail",
          message: health.healthy
            ? "All integrity checks passed"
            : "Integrity issues detected",
          durationMs: Date.now() - stepStart,
        });

        const allPassed = steps.every(s => s.status === "pass");

        return {
          success: allPassed,
          steps,
          totalDurationMs: Date.now() - startTime,
          summary: allPassed
            ? "All pipeline tests passed"
            : `${steps.filter(s => s.status === "fail").length} test(s) failed`,
        };
      }),

    /**
     * Validate all data pipelines
     */
    validateAllPipelines: adminProcedure.query(async () => {
      const { validateAllPipelines } = await import(
        "./services/pipelineValidationService"
      );
      return validateAllPipelines();
    }),

    /**
     * Validate CSV import data before importing
     */
    validateCSVImport: adminProcedure
      .input(
        z.object({
          strategyId: z.number(),
          trades: z.array(
            z.object({
              entryDate: z.string(),
              exitDate: z.string(),
              direction: z.string(),
              entryPrice: z.number(),
              exitPrice: z.number(),
              quantity: z.number().optional().default(1),
              pnl: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const { validateCSVImport, checkDuplicatesAgainstDB } = await import(
          "./services/pipelineValidationService"
        );

        // Convert string dates to Date objects
        const tradesToValidate = input.trades.map(t => ({
          entryDate: new Date(t.entryDate),
          exitDate: new Date(t.exitDate),
          direction: t.direction,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          quantity: t.quantity,
          pnl: t.pnl,
        }));

        // Validate the trades
        const validation = validateCSVImport(tradesToValidate);

        // Check for duplicates against existing DB trades
        const duplicates = await checkDuplicatesAgainstDB(
          input.strategyId,
          tradesToValidate
        );

        return {
          ...validation,
          existingDuplicates: duplicates.duplicateCount,
          existingDuplicateIndices: duplicates.duplicateIndices,
        };
      }),

    /**
     * Repair orphaned positions (create missing trades)
     */
    repairOrphanedPositions: adminProcedure.mutation(async () => {
      const { repairOrphanedPositions } = await import(
        "./services/pipelineValidationService"
      );
      return repairOrphanedPositions();
    }),

    /**
     * Repair orphaned exit webhooks (link to trades)
     */
    repairOrphanedExitWebhooks: adminProcedure.mutation(async () => {
      const { repairOrphanedExitWebhooks } = await import(
        "./services/pipelineValidationService"
      );
      return repairOrphanedExitWebhooks();
    }),

    /**
     * Get webhook pipeline status
     */
    webhookPipelineStatus: adminProcedure.query(async () => {
      const { getWebhookPipelineStatus } = await import(
        "./services/pipelineValidationService"
      );
      return getWebhookPipelineStatus();
    }),

    /**
     * Get position pipeline status
     */
    positionPipelineStatus: adminProcedure.query(async () => {
      const { getPositionPipelineStatus } = await import(
        "./services/pipelineValidationService"
      );
      return getPositionPipelineStatus();
    }),
  }),

  // In-app notifications router for notification bell
  inAppNotifications: router({
    /**
     * Get user's notifications with optional filters
     */
    list: protectedProcedure
      .input(
        z.object({
          unreadOnly: z.boolean().optional().default(false),
          limit: z.number().optional().default(20),
          offset: z.number().optional().default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const { getNotifications, getUnreadCount } = await import(
          "./services/inAppNotificationService"
        );

        const notifications = await getNotifications({
          userId: ctx.user.id,
          unreadOnly: input.unreadOnly,
          limit: input.limit,
          offset: input.offset,
        });

        const unreadCount = await getUnreadCount(ctx.user.id);

        return {
          notifications,
          unreadCount,
          hasMore: notifications.length === input.limit,
        };
      }),

    /**
     * Get unread notification count only (for badge)
     */
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const { getUnreadCount } = await import(
        "./services/inAppNotificationService"
      );
      return { count: await getUnreadCount(ctx.user.id) };
    }),

    /**
     * Mark a single notification as read
     */
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { markAsRead } = await import(
          "./services/inAppNotificationService"
        );
        const success = await markAsRead(input.notificationId, ctx.user.id);
        return { success };
      }),

    /**
     * Mark all notifications as read
     */
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const { markAllAsRead } = await import(
        "./services/inAppNotificationService"
      );
      const count = await markAllAsRead(ctx.user.id);
      return { success: true, count };
    }),

    /**
     * Delete a notification
     */
    delete: deleteStrategyProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteNotification } = await import(
          "./services/inAppNotificationService"
        );
        const success = await deleteNotification(
          input.notificationId,
          // @ts-expect-error TS18047
          ctx.user.id
        );
        return { success };
      }),

    /**
     * Clear all read notifications
     */
    clearRead: protectedProcedure.mutation(async ({ ctx: _ctx }) => {
      const { deleteOldNotifications } = await import(
        "./services/inAppNotificationService"
      );
      // Delete read notifications older than 0 days (all read notifications)
      const count = await deleteOldNotifications(0);
      return { success: true, count };
    }),
  }),

  // Trade Source Analytics
  tradeSource: router({
    /**
     * Get breakdown of trades by source (csv_import, webhook, manual)
     */
    breakdown: viewAnalyticsProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
        })
      )
      .query(async ({ input }) => {
        const { getTradeSourceBreakdown } = await import(
          "./tradeSourceAnalytics"
        );

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (input.timeRange) {
          const year = now.getFullYear();
          switch (input.timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        const strategies = await getAllStrategies();
        const strategyIds = strategies.map(s => s.id);

        return getTradeSourceBreakdown({
          strategyIds,
          startDate,
          endDate: now,
        });
      }),

    /**
     * Get webhook signal performance metrics
     */
    webhookPerformance: protectedProcedure
      .input(
        z.object({
          timeRange: TimeRange.optional(),
        })
      )
      .query(async ({ input }) => {
        const { getWebhookSignalPerformance } = await import(
          "./tradeSourceAnalytics"
        );

        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;

        if (input.timeRange) {
          const year = now.getFullYear();
          switch (input.timeRange) {
            case "6M":
              startDate = new Date(now);
              startDate.setMonth(now.getMonth() - 6);
              break;
            case "YTD":
              startDate = new Date(year, 0, 1);
              break;
            case "1Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 1);
              break;
            case "3Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 3);
              break;
            case "5Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 5);
              break;
            case "10Y":
              startDate = new Date(now);
              startDate.setFullYear(year - 10);
              break;
            case "ALL":
              startDate = undefined;
              break;
          }
        }

        const strategies = await getAllStrategies();
        const strategyIds = strategies.map(s => s.id);

        return getWebhookSignalPerformance({
          strategyIds,
          startDate,
          endDate: now,
        });
      }),
  }),

  // Paper Trading
  paperTrading: router({
    /**
     * Get paper trading account summary
     */
    getAccount: protectedProcedure.query(async ({ ctx }) => {
      return paperTrading.getPaperAccountSummary(ctx.user.id);
    }),

    /**
     * Get open positions
     */
    getPositions: protectedProcedure.query(async ({ ctx }) => {
      return paperTrading.getOpenPositions(ctx.user.id);
    }),

    /**
     * Get trade history
     */
    getTradeHistory: protectedProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(500).optional().default(50),
        })
      )
      .query(async ({ ctx, input }) => {
        return paperTrading.getPaperTradeHistory(ctx.user.id, input.limit);
      }),

    /**
     * Execute a paper trade
     */
    executeTrade: protectedProcedure
      .input(
        z.object({
          symbol: z.string(),
          side: z.enum(["BUY", "SELL"]),
          quantity: z.number().min(1),
          orderType: z.enum(["MARKET", "LIMIT", "STOP"]),
          limitPrice: z.number().optional(),
          stopPrice: z.number().optional(),
          strategyId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return paperTrading.executePaperOrder({
          userId: ctx.user.id,
          ...input,
        });
      }),

    /**
     * Reset paper trading account
     */
    resetAccount: protectedProcedure.mutation(async ({ ctx }) => {
      return paperTrading.resetPaperAccount(ctx.user.id);
    }),
  }),

  // Test data management (admin only)
  testData: router({
    /**
     * Get counts of test data in the database
     */
    getCounts: adminProcedure.query(async () => {
      const { getTestDataCounts } = await import("./testDataCleanup");
      return getTestDataCounts();
    }),

    /**
     * Clean up all test data
     */
    cleanupAll: adminProcedure.mutation(async () => {
      const { cleanupAllTestData } = await import("./testDataCleanup");
      return cleanupAllTestData();
    }),

    /**
     * Clean up test data older than specified hours
     */
    cleanupOld: adminProcedure
      .input(z.object({ hoursOld: z.number().min(1).default(24) }))
      .mutation(async ({ input }) => {
        const { cleanupOldTestData } = await import("./testDataCleanup");
        return cleanupOldTestData(input.hoursOld);
      }),

    /**
     * Mark specific records as test data
     */
    markAsTest: adminProcedure
      .input(
        z.object({
          tradeIds: z.array(z.number()).optional(),
          webhookLogIds: z.array(z.number()).optional(),
          positionIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { markDataAsTest } = await import("./testDataCleanup");
        return markDataAsTest(input);
      }),
  }),

  // Contact form router for user inquiries
  contact: router({
    /**
     * Submit a new contact message (public - no auth required)
     */
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          email: z.string().email().max(320),
          subject: z.string().min(1).max(200),
          message: z.string().min(10).max(5000),
          category: z
            .enum([
              "general",
              "support",
              "billing",
              "feature_request",
              "bug_report",
              "partnership",
            ])
            .optional()
            .default("general"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { notifyOwner } = await import("./_core/notification");
        const { invokeLLM } = await import("./_core/llm");

        // Create the contact message
        const messageId = await db.createContactMessage({
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
          category: input.category,
          userId: ctx.user?.id || null,
          status: "new",
          priority: "normal",
        });

        if (!messageId) {
          return { success: false, error: "Failed to save message" };
        }

        // Generate AI response suggestion
        try {
          const aiResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a helpful customer support assistant for an intraday trading strategies dashboard platform. 
Generate a professional, friendly response to the following customer inquiry. 
Be concise but thorough. Address their specific concerns.
Do not make promises about features or timelines you cannot guarantee.
Sign off as "The Intraday Strategies Team".`,
              },
              {
                role: "user",
                content: `Category: ${input.category}\nSubject: ${input.subject}\n\nMessage:\n${input.message}`,
              },
            ],
          });

          const rawContent = aiResponse.choices?.[0]?.message?.content;
          const suggestedResponse =
            typeof rawContent === "string" ? rawContent : null;

          if (suggestedResponse) {
            await db.updateContactMessage(messageId, {
              aiSuggestedResponse: suggestedResponse,
              // @ts-expect-error TS2322
              aiResponseGeneratedAt: new Date(),
            });
          }
        } catch (error) {
          console.error("[Contact] Failed to generate AI response:", error);
        }

        // Notify the owner
        try {
          await notifyOwner({
            title: `New Contact: ${input.subject}`,
            content: `From: ${input.name} (${input.email})\nCategory: ${input.category}\n\n${input.message.substring(0, 500)}${input.message.length > 500 ? "..." : ""}`,
          });
        } catch (error) {
          console.error("[Contact] Failed to notify owner:", error);
        }

        return { success: true, messageId };
      }),

    /**
     * Get all contact messages (admin only)
     */
    list: adminProcedure
      .input(
        z.object({
          status: z
            .enum([
              "new",
              "read",
              "in_progress",
              "awaiting_response",
              "resolved",
              "closed",
            ])
            .optional(),
          category: z
            .enum([
              "general",
              "support",
              "billing",
              "feature_request",
              "bug_report",
              "partnership",
            ])
            .optional(),
          limit: z.number().min(1).max(100).optional().default(50),
          offset: z.number().min(0).optional().default(0),
        })
      )
      .query(async ({ input }) => {
        const messages = await db.getContactMessages(input);
        const stats = await db.getContactMessageStats();
        return { messages, stats };
      }),

    /**
     * Get a single contact message with responses (admin only)
     */
    get: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const message = await db.getContactMessageById(input.id);
        if (!message) {
          return { message: null, responses: [] };
        }

        // Mark as read if new
        if (message.status === "new") {
          await db.updateContactMessage(input.id, { status: "read" });
        }

        const responses = await db.getContactResponses(input.id);
        return { message, responses };
      }),

    /**
     * Update contact message status (admin only)
     */
    updateStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum([
            "new",
            "read",
            "in_progress",
            "awaiting_response",
            "resolved",
            "closed",
          ]),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await db.updateContactMessage(input.id, {
          status: input.status,
          priority: input.priority,
        });
        return { success };
      }),

    /**
     * Create a draft response (admin only)
     */
    createResponse: adminProcedure
      .input(
        z.object({
          messageId: z.number(),
          responseText: z.string().min(1),
          isAiGenerated: z.boolean().optional().default(false),
        })
      )
      .mutation(async ({ input }) => {
        const responseId = await db.createContactResponse({
          messageId: input.messageId,
          responseText: input.responseText,
          // @ts-expect-error TS2322
          isAiGenerated: input.isAiGenerated,
          deliveryStatus: "draft",
        });

        // Update message status
        await db.updateContactMessage(input.messageId, {
          status: "awaiting_response",
        });

        return { success: !!responseId, responseId };
      }),

    /**
     * Approve and send a response (admin only)
     */
    approveAndSend: adminProcedure
      .input(
        z.object({
          responseId: z.number(),
          responseText: z.string().optional(), // Allow editing before sending
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get the response and message
        const response = await db.getContactResponseById(input.responseId);
        if (!response) {
          return { success: false, error: "Response not found" };
        }

        const message = await db.getContactMessageById(response.messageId);
        if (!message) {
          return { success: false, error: "Message not found" };
        }

        // Update response text if provided
        if (input.responseText) {
          await db.updateContactResponse(input.responseId, {
            responseText: input.responseText,
          });
        }

        // Mark as approved
        await db.approveContactResponse(input.responseId, ctx.user.id);

        // TODO: Actually send the email here using a notification service
        // For now, just mark as sent
        await db.markContactResponseSent(input.responseId);

        // Update message status to resolved
        await db.updateContactMessage(response.messageId, {
          status: "resolved",
        });

        return { success: true };
      }),

    /**
     * Regenerate AI response suggestion (admin only)
     */
    regenerateAiResponse: adminProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");

        const message = await db.getContactMessageById(input.messageId);
        if (!message) {
          return { success: false, error: "Message not found" };
        }

        try {
          const aiResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a helpful customer support assistant for an intraday trading strategies dashboard platform. 
Generate a professional, friendly response to the following customer inquiry. 
Be concise but thorough. Address their specific concerns.
Do not make promises about features or timelines you cannot guarantee.
Sign off as "The Intraday Strategies Team".`,
              },
              {
                role: "user",
                content: `Category: ${message.category}\nSubject: ${message.subject}\n\nMessage:\n${message.message}`,
              },
            ],
          });

          const rawContent = aiResponse.choices?.[0]?.message?.content;
          const suggestedResponse =
            typeof rawContent === "string" ? rawContent : null;

          if (suggestedResponse) {
            await db.updateContactMessage(input.messageId, {
              aiSuggestedResponse: suggestedResponse,
              // @ts-expect-error TS2322
              aiResponseGeneratedAt: new Date(),
            });
            return { success: true, suggestedResponse };
          }

          return { success: false, error: "Failed to generate response" };
        } catch (error) {
          console.error("[Contact] Failed to regenerate AI response:", error);
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to generate",
          };
        }
      }),

    /**
     * Get contact message statistics (admin only)
     */
    stats: adminProcedure.query(async () => {
      return db.getContactMessageStats();
    }),
  }),
});

export type AppRouter = typeof appRouter;
