/**
 * Cache Service for Dashboard Latency Optimization
 * 
 * Provides in-memory caching with TTL for frequently accessed data
 * to reduce database queries and improve response times.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private readonly defaultTTL = 60 * 1000; // 1 minute default
  private readonly maxEntries = 1000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get a cached value
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set a cached value with optional TTL
   */
  set<T>(key: string, data: T, ttlMs: number = this.defaultTTL): void {
    // Enforce max entries limit
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    });
  }

  /**
   * Get or set a cached value using a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;
    const entries = Array.from(this.cache.values());

    for (const entry of entries) {
      if (oldest === null || entry.createdAt < oldest) {
        oldest = entry.createdAt;
      }
      if (newest === null || entry.createdAt > newest) {
        newest = entry.createdAt;
      }
    }

    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache key generators for consistent key naming
export const cacheKeys = {
  portfolioOverview: (timeRange: string, startingCapital: number) =>
    `portfolio:overview:${timeRange}:${startingCapital}`,
  
  strategyMetrics: (strategyId: number, timeRange: string) =>
    `strategy:metrics:${strategyId}:${timeRange}`,
  
  strategyTrades: (strategyId: number, limit: number, offset: number) =>
    `strategy:trades:${strategyId}:${limit}:${offset}`,
  
  allStrategies: () => `strategies:all`,
  
  openPositions: () => `positions:open`,
  
  webhookMetrics: (hours: number) => `webhook:metrics:${hours}`,
  
  userPortfolio: (userId: number) => `user:portfolio:${userId}`,
  
  compareStrategies: (strategyIds: number[], timeRange: string) =>
    `compare:${strategyIds.sort().join('-')}:${timeRange}`,
};

// TTL presets for different data types
export const cacheTTL = {
  // Static data that rarely changes
  strategies: 10 * 60 * 1000, // 10 minutes
  
  // Semi-static data
  portfolioOverview: 5 * 60 * 1000, // 5 minutes
  strategyMetrics: 5 * 60 * 1000, // 5 minutes
  
  // Dynamic data
  openPositions: 30 * 1000, // 30 seconds
  webhookMetrics: 60 * 1000, // 1 minute
  
  // User-specific data
  userPortfolio: 2 * 60 * 1000, // 2 minutes
};
