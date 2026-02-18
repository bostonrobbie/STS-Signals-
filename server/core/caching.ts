// @ts-expect-error TS6133 unused
import { redis, isRedisConnected } from "./redis";
import { logger } from "./logger";

/**
 * Redis Caching Layer
 * Implements intelligent caching for frequently accessed data
 * Reduces database load and improves response times
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

const DEFAULT_TTL = 5 * 60; // 5 minutes
const CACHE_PREFIX = "cache:";

/**
 * Cache key generator
 */
export const generateCacheKey = (
  namespace: string,
  identifier: string | number,
  params?: Record<string, any>
): string => {
  let key = `${CACHE_PREFIX}${namespace}:${identifier}`;

  if (params && Object.keys(params).length > 0) {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("|");
    key += `:${paramStr}`;
  }

  return key;
};

/**
 * Get value from cache
 */
export const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache hit: ${key}`);
      return JSON.parse(cached) as T;
    }
    logger.debug(`Cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error(`Cache retrieval error for ${key}`, error);
    return null;
  }
};

/**
 * Set value in cache
 */
export const setCached = async <T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> => {
  try {
    const ttl = options.ttl || DEFAULT_TTL;
    const serialized = JSON.stringify(value);

    await redis.setex(key, ttl, serialized);
    logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    logger.error(`Cache set error for ${key}`, error);
    return false;
  }
};

/**
 * Delete cache entry
 */
export const deleteCached = async (key: string): Promise<boolean> => {
  try {
    await redis.del(key);
    logger.debug(`Cache deleted: ${key}`);
    return true;
  } catch (error) {
    logger.error(`Cache deletion error for ${key}`, error);
    return false;
  }
};

/**
 * Clear all cache entries matching a pattern
 */
export const clearCachePattern = async (pattern: string): Promise<number> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Cache cleared: ${keys.length} entries matching ${pattern}`);
    }
    return keys.length;
  } catch (error) {
    logger.error(`Cache pattern clear error for ${pattern}`, error);
    return 0;
  }
};

/**
 * Get or compute value with caching
 */
export const getOrCompute = async <T>(
  key: string,
  compute: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> => {
  try {
    // Try to get from cache first
    const cached = await getCached<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value if not in cache
    const value = await compute();

    // Store in cache
    await setCached(key, value, options);

    return value;
  } catch (error) {
    logger.error(`Get or compute error for ${key}`, error);
    throw error;
  }
};

/**
 * Cache invalidation strategies
 */
export const cacheInvalidation = {
  // Invalidate portfolio cache when trades change
  invalidatePortfolioCache: async (userId: string) => {
    const pattern = `${CACHE_PREFIX}portfolio:${userId}:*`;
    return clearCachePattern(pattern);
  },

  // Invalidate strategy cache when strategy changes
  invalidateStrategyCache: async (strategyId: number) => {
    const pattern = `${CACHE_PREFIX}strategy:${strategyId}:*`;
    return clearCachePattern(pattern);
  },

  // Invalidate trade cache when trades change
  invalidateTradeCache: async (userId: string) => {
    const pattern = `${CACHE_PREFIX}trades:${userId}:*`;
    return clearCachePattern(pattern);
  },

  // Invalidate analytics cache
  invalidateAnalyticsCache: async (userId: string) => {
    const pattern = `${CACHE_PREFIX}analytics:${userId}:*`;
    return clearCachePattern(pattern);
  },

  // Clear all user caches
  clearUserCache: async (userId: string) => {
    const pattern = `${CACHE_PREFIX}*:${userId}:*`;
    return clearCachePattern(pattern);
  },

  // Clear all caches
  clearAllCaches: async () => {
    const pattern = `${CACHE_PREFIX}*`;
    return clearCachePattern(pattern);
  },
};

/**
 * Specific cache getters/setters for common data
 */

export const portfolioCache = {
  get: async (userId: string, params: Record<string, any>) => {
    const key = generateCacheKey("portfolio", userId, params);
    return getCached(key);
  },

  set: async (userId: string, params: Record<string, any>, value: any) => {
    const key = generateCacheKey("portfolio", userId, params);
    return setCached(key, value, { ttl: 5 * 60 }); // 5 minutes
  },

  invalidate: (userId: string) =>
    cacheInvalidation.invalidatePortfolioCache(userId),
};

export const strategyCache = {
  get: async (strategyId: number) => {
    const key = generateCacheKey("strategy", strategyId);
    return getCached(key);
  },

  set: async (strategyId: number, value: any) => {
    const key = generateCacheKey("strategy", strategyId);
    return setCached(key, value, { ttl: 10 * 60 }); // 10 minutes
  },

  invalidate: (strategyId: number) =>
    cacheInvalidation.invalidateStrategyCache(strategyId),
};

export const tradesCache = {
  get: async (userId: string, params: Record<string, any>) => {
    const key = generateCacheKey("trades", userId, params);
    return getCached(key);
  },

  set: async (userId: string, params: Record<string, any>, value: any) => {
    const key = generateCacheKey("trades", userId, params);
    return setCached(key, value, { ttl: 3 * 60 }); // 3 minutes
  },

  invalidate: (userId: string) =>
    cacheInvalidation.invalidateTradeCache(userId),
};

export const analyticsCache = {
  get: async (userId: string, params: Record<string, any>) => {
    const key = generateCacheKey("analytics", userId, params);
    return getCached(key);
  },

  set: async (userId: string, params: Record<string, any>, value: any) => {
    const key = generateCacheKey("analytics", userId, params);
    return setCached(key, value, { ttl: 15 * 60 }); // 15 minutes
  },

  invalidate: (userId: string) =>
    cacheInvalidation.invalidateAnalyticsCache(userId),
};

/**
 * Cache statistics
 */
export const getCacheStats = async () => {
  try {
    const info = await redis.info("stats");
    const keys = await redis.keys(`${CACHE_PREFIX}*`);

    return {
      totalCachedKeys: keys.length,
      info: info,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Failed to get cache stats", error);
    return null;
  }
};

/**
 * Cache warming - preload frequently accessed data
 */
export const warmCache = async () => {
  try {
    logger.info("Starting cache warming...");

    // Warm up common queries
    // This would be implemented based on actual usage patterns

    logger.info("Cache warming completed");
  } catch (error) {
    logger.error("Cache warming failed", error);
  }
};

export default {
  generateCacheKey,
  getCached,
  setCached,
  deleteCached,
  clearCachePattern,
  getOrCompute,
  cacheInvalidation,
  portfolioCache,
  strategyCache,
  tradesCache,
  analyticsCache,
  getCacheStats,
  warmCache,
};
