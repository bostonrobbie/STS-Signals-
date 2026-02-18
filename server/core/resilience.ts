import { logger } from "./logger";

/**
 * Error Recovery & Resilience System
 * Implements circuit breaker, retry logic, and graceful degradation
 */

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close
  timeout: number; // Time in ms before attempting reset
  name: string;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  jitter: boolean;
}

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        logger.info(
          `Circuit breaker ${this.config.name} entering HALF_OPEN state`
        );
      } else {
        throw new Error(`Circuit breaker ${this.config.name} is OPEN`);
      }
    }

    try {
      const result = await fn();

      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
          this.successCount = 0;
          logger.info(
            `Circuit breaker ${this.config.name} CLOSED after recovery`
          );
        }
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        logger.warn(
          `Circuit breaker ${this.config.name} OPEN after ${this.failureCount} failures`
        );
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.config.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info(`Circuit breaker ${this.config.name} reset`);
  }
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  operationName: string = "operation"
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      logger.info(
        `Attempting ${operationName} (attempt ${attempt}/${config.maxAttempts})`
      );
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(
        `${operationName} failed on attempt ${attempt}: ${lastError.message}`
      );

      if (attempt < config.maxAttempts) {
        // Calculate delay with optional jitter
        let actualDelay = Math.min(delay, config.maxDelay);
        if (config.jitter) {
          actualDelay = actualDelay * (0.5 + Math.random() * 0.5);
        }

        logger.info(`Retrying ${operationName} in ${actualDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, actualDelay));

        // Increase delay for next attempt
        delay *= config.backoffMultiplier;
      }
    }
  }

  throw new Error(
    `${operationName} failed after ${config.maxAttempts} attempts: ${lastError?.message}`
  );
}

/**
 * Fallback mechanism
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string = "operation"
): Promise<T> {
  try {
    logger.info(`Executing primary ${operationName}`);
    return await primary();
  } catch (error) {
    logger.warn(`Primary ${operationName} failed, using fallback`, error);
    try {
      logger.info(`Executing fallback ${operationName}`);
      return await fallback();
    } catch (fallbackError) {
      logger.error(`Fallback ${operationName} also failed`, fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = "operation"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Bulkhead pattern - limit concurrent operations
 */
export class Bulkhead {
  private activeCount = 0;
  private queue: Array<() => void> = [];
  private maxConcurrent: number;
  private name: string;

  constructor(maxConcurrent: number, name: string = "bulkhead") {
    this.maxConcurrent = maxConcurrent;
    this.name = name;
  }

  /**
   * Execute function with concurrency limit
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.activeCount >= this.maxConcurrent) {
      // @ts-expect-error TS2345
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.activeCount++;
    logger.debug(
      `${this.name} active: ${this.activeCount}/${this.maxConcurrent}`
    );

    try {
      return await fn();
    } finally {
      this.activeCount--;
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Get bulkhead status
   */
  getStatus() {
    return {
      name: this.name,
      activeCount: this.activeCount,
      maxConcurrent: this.maxConcurrent,
      queueLength: this.queue.length,
    };
  }
}

/**
 * Health check system
 */
export interface HealthCheckConfig {
  name: string;
  check: () => Promise<boolean>;
  interval: number; // ms
  timeout: number; // ms
}

export class HealthChecker {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private statuses: Map<
    string,
    { healthy: boolean; lastCheck: Date; error?: string }
  > = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register health check
   */
  register(config: HealthCheckConfig) {
    this.checks.set(config.name, config);
    this.statuses.set(config.name, {
      healthy: true,
      lastCheck: new Date(),
    });

    // Start periodic check
    this.startCheck(config);
  }

  /**
   * Start periodic health check
   */
  private startCheck(config: HealthCheckConfig) {
    const interval = setInterval(async () => {
      try {
        const result = await withTimeout(
          config.check(),
          config.timeout,
          `Health check: ${config.name}`
        );

        this.statuses.set(config.name, {
          healthy: result,
          lastCheck: new Date(),
        });

        if (!result) {
          logger.warn(`Health check ${config.name} failed`);
        }
      } catch (error) {
        logger.error(`Health check ${config.name} error`, error);
        this.statuses.set(config.name, {
          healthy: false,
          lastCheck: new Date(),
          error: (error as Error).message,
        });
      }
    }, config.interval);

    this.intervals.set(config.name, interval);
  }

  /**
   * Get health status
   */
  getStatus(name?: string) {
    if (name) {
      return this.statuses.get(name);
    }

    const allHealthy = Array.from(this.statuses.values()).every(s => s.healthy);
    return {
      healthy: allHealthy,
      checks: Object.fromEntries(this.statuses),
    };
  }

  /**
   * Stop health checks
   */
  stop() {
    // @ts-expect-error TS2802
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`Health check ${name} stopped`);
    }
    this.intervals.clear();
  }
}

/**
 * Create default circuit breakers for common operations
 */
export const createDefaultCircuitBreakers = () => {
  return {
    database: new CircuitBreaker({
      name: "database",
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000, // 1 minute
    }),
    cache: new CircuitBreaker({
      name: "cache",
      failureThreshold: 3,
      successThreshold: 1,
      timeout: 30000, // 30 seconds
    }),
    externalApi: new CircuitBreaker({
      name: "externalApi",
      failureThreshold: 10,
      successThreshold: 3,
      timeout: 120000, // 2 minutes
    }),
  };
};

/**
 * Create default retry config
 */
export const createDefaultRetryConfig = (): RetryConfig => ({
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
  jitter: true,
});

export default {
  CircuitBreaker,
  Bulkhead,
  HealthChecker,
  retryWithBackoff,
  withFallback,
  withTimeout,
  createDefaultCircuitBreakers,
  createDefaultRetryConfig,
};
