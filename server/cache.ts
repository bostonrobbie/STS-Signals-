/**
 * Server-side caching for expensive computations
 * Uses in-memory cache with TTL for portfolio analytics
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get cached value or compute and cache it
   */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlMs: number = 60000 // Default 1 minute TTL
  ): Promise<T> {
    const existing = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (existing && existing.expiresAt > Date.now()) {
      return existing.data;
    }

    // Compute new value
    const data = await compute();
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });

    return data;
  }

  /**
   * Get cached value synchronously
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data;
    }
    return undefined;
  }

  /**
   * Set cached value
   */
  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate all portfolio-related caches
   */
  invalidatePortfolio(): void {
    this.invalidatePattern('^portfolio:');
    this.invalidatePattern('^strategy:');
    this.invalidatePattern('^trades:');
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Destroy the cache instance
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton cache instance
export const cache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  portfolioOverview: (timeRange: string, capital: number) => 
    `portfolio:overview:${timeRange}:${capital}`,
  
  strategyDetail: (strategyId: number, timeRange: string) => 
    `strategy:detail:${strategyId}:${timeRange}`,
  
  strategyList: () => 'portfolio:strategies',
  
  allTrades: (strategyIds: string, startDate?: string, endDate?: string) => 
    `trades:${strategyIds}:${startDate || 'all'}:${endDate || 'now'}`,
  
  benchmarkData: (startDate?: string, endDate?: string) => 
    `benchmark:${startDate || 'all'}:${endDate || 'now'}`,
  
  platformStats: () => 'platform:stats',
  
  webhookLogs: (status?: string, limit?: number) => 
    `webhook:logs:${status || 'all'}:${limit || 100}`,
};

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  // Portfolio data - cache for 2 minutes (trades don't change frequently)
  portfolioOverview: 2 * 60 * 1000,
  
  // Strategy details - cache for 2 minutes
  strategyDetail: 2 * 60 * 1000,
  
  // Strategy list - cache for 5 minutes (rarely changes)
  strategyList: 5 * 60 * 1000,
  
  // Platform stats - cache for 5 minutes
  platformStats: 5 * 60 * 1000,
  
  // Trades - cache for 1 minute
  trades: 60 * 1000,
  
  // Benchmark data - cache for 10 minutes (rarely changes)
  benchmarkData: 10 * 60 * 1000,
  
  // Webhook logs - cache for 30 seconds (need fresher data)
  webhookLogs: 30 * 1000,
};
