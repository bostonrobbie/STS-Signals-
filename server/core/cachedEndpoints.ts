import {
  portfolioCache,
  strategyCache,
  tradesCache,
  analyticsCache,
  getOrCompute,
} from "./caching";
import { logger } from "./logger";

/**
 * Cached Endpoint Wrappers
 * Wraps high-traffic API endpoints with intelligent caching
 */

/**
 * Get cached portfolio overview
 */
export const getCachedPortfolioOverview = async (
  userId: string,
  // @ts-expect-error TS6133 unused
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `portfolio:overview:${userId}`;
  return getOrCompute(key, compute, { ttl: 5 * 60 }); // 5 minutes
};

/**
 * Get cached portfolio metrics
 */
export const getCachedPortfolioMetrics = async (
  userId: string,
  // @ts-expect-error TS6133 unused
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `portfolio:metrics:${userId}`;
  return getOrCompute(key, compute, { ttl: 5 * 60 }); // 5 minutes
};

/**
 * Get cached equity curve
 */
export const getCachedEquityCurve = async (
  userId: string,
  // @ts-expect-error TS6133 unused
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `portfolio:equity:${userId}`;
  return getOrCompute(key, compute, { ttl: 10 * 60 }); // 10 minutes
};

/**
 * Get cached trades list
 */
export const getCachedTrades = async (
  userId: string,
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `trades:list:${userId}:${JSON.stringify(params)}`;
  return getOrCompute(key, compute, { ttl: 3 * 60 }); // 3 minutes
};

/**
 * Get cached strategies list
 */
export const getCachedStrategies = async (
  userId: string,
  // @ts-expect-error TS6133 unused
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `strategies:list:${userId}`;
  return getOrCompute(key, compute, { ttl: 10 * 60 }); // 10 minutes
};

/**
 * Get cached strategy details
 */
export const getCachedStrategyDetails = async (
  strategyId: number,
  compute: () => Promise<any>
) => {
  const key = `strategy:details:${strategyId}`;
  return getOrCompute(key, compute, { ttl: 15 * 60 }); // 15 minutes
};

/**
 * Get cached analytics
 */
export const getCachedAnalytics = async (
  userId: string,
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `analytics:${userId}:${JSON.stringify(params)}`;
  return getOrCompute(key, compute, { ttl: 15 * 60 }); // 15 minutes
};

/**
 * Get cached platform statistics
 */
export const getCachedPlatformStats = async (
  params: Record<string, any>,
  compute: () => Promise<any>
) => {
  const key = `platform:stats:${JSON.stringify(params)}`;
  return getOrCompute(key, compute, { ttl: 30 * 60 }); // 30 minutes
};

/**
 * Invalidate user's portfolio cache
 */
export const invalidatePortfolioCache = async (userId: string) => {
  try {
    const keys = [
      `portfolio:overview:${userId}`,
      `portfolio:metrics:${userId}`,
      `portfolio:equity:${userId}`,
      `trades:list:${userId}:*`,
      `analytics:${userId}:*`,
    ];

    for (const _key of keys) {
      await portfolioCache.invalidate(userId);
    }

    logger.info(`Portfolio cache invalidated for user ${userId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate portfolio cache for user ${userId}`,
      error
    );
  }
};

/**
 * Invalidate strategy cache
 */
export const invalidateStrategyCache = async (strategyId: number) => {
  try {
    await strategyCache.invalidate(strategyId);
    logger.info(`Strategy cache invalidated for strategy ${strategyId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate strategy cache for strategy ${strategyId}`,
      error
    );
  }
};

/**
 * Invalidate trades cache
 */
export const invalidateTradesCache = async (userId: string) => {
  try {
    await tradesCache.invalidate(userId);
    logger.info(`Trades cache invalidated for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to invalidate trades cache for user ${userId}`, error);
  }
};

/**
 * Invalidate analytics cache
 */
export const invalidateAnalyticsCache = async (userId: string) => {
  try {
    await analyticsCache.invalidate(userId);
    logger.info(`Analytics cache invalidated for user ${userId}`);
  } catch (error) {
    logger.error(
      `Failed to invalidate analytics cache for user ${userId}`,
      error
    );
  }
};

/**
 * Invalidate all caches for a user
 */
export const invalidateAllUserCaches = async (userId: string) => {
  try {
    await Promise.all([
      invalidatePortfolioCache(userId),
      invalidateTradesCache(userId),
      invalidateAnalyticsCache(userId),
    ]);

    logger.info(`All caches invalidated for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to invalidate all caches for user ${userId}`, error);
  }
};

export default {
  getCachedPortfolioOverview,
  getCachedPortfolioMetrics,
  getCachedEquityCurve,
  getCachedTrades,
  getCachedStrategies,
  getCachedStrategyDetails,
  getCachedAnalytics,
  getCachedPlatformStats,
  invalidatePortfolioCache,
  invalidateStrategyCache,
  invalidateTradesCache,
  invalidateAnalyticsCache,
  invalidateAllUserCaches,
};
