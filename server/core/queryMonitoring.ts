/**
 * Database Query Performance Monitoring
 * Tracks query execution times and identifies slow queries for optimization
 */

interface QueryMetric {
  query: string;
  duration: number;
  timestamp: Date;
  slowQuery: boolean;
}

const SLOW_QUERY_THRESHOLD = 1000; // 1 second in milliseconds
const MAX_METRICS_STORED = 1000;

class QueryMonitor {
  private metrics: QueryMetric[] = [];
  private enabled: boolean =
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_QUERY_MONITORING === "true";

  /**
   * Record a query execution
   */
  recordQuery(query: string, duration: number): void {
    if (!this.enabled) return;

    const isSlowQuery = duration > SLOW_QUERY_THRESHOLD;
    const metric: QueryMetric = {
      query: this.sanitizeQuery(query),
      duration,
      timestamp: new Date(),
      slowQuery: isSlowQuery,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics to avoid memory bloat
    if (this.metrics.length > MAX_METRICS_STORED) {
      this.metrics = this.metrics.slice(-MAX_METRICS_STORED);
    }

    // Log slow queries immediately
    if (isSlowQuery) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${metric.query}`);
    }
  }

  /**
   * Get query statistics
   */
  getStats() {
    if (!this.enabled || this.metrics.length === 0) {
      return null;
    }

    const slowQueries = this.metrics.filter(m => m.slowQuery);
    const avgDuration =
      this.metrics.reduce((sum, m) => sum + m.duration, 0) /
      this.metrics.length;
    const maxDuration = Math.max(...this.metrics.map(m => m.duration));
    const minDuration = Math.min(...this.metrics.map(m => m.duration));

    return {
      totalQueries: this.metrics.length,
      slowQueries: slowQueries.length,
      averageDuration: Math.round(avgDuration),
      maxDuration,
      minDuration,
      slowQueryPercentage: (
        (slowQueries.length / this.metrics.length) *
        100
      ).toFixed(2),
      recentSlowQueries: slowQueries.slice(-10).map(q => ({
        query: q.query,
        duration: q.duration,
        timestamp: q.timestamp,
      })),
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = [];
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    // Remove values but keep structure for pattern analysis
    return query
      .replace(/\d+/g, "?")
      .replace(/'[^']*'/g, "'?'")
      .substring(0, 200); // Limit length
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const queryMonitor = new QueryMonitor();

/**
 * Middleware to wrap query execution with monitoring
 */
export async function monitoredQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await queryFn();
    const duration = performance.now() - startTime;
    queryMonitor.recordQuery(queryName, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    queryMonitor.recordQuery(`[ERROR] ${queryName}`, duration);
    throw error;
  }
}
