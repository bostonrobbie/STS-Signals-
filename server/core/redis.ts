/**
 * Redis Client Initialization
 * Provides a singleton Redis instance for caching
 */

import Redis from "ioredis";
import { logger } from "./logger";

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Initialize Redis client
 */
function initializeRedis(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  };

  redisClient = new Redis(redisConfig);

  // Connect to Redis
  redisClient
    .connect()
    .then(() => {
      isConnected = true;
      logger.info("[Redis] Connected successfully");
    })
    .catch(err => {
      logger.error("[Redis] Connection failed:", err.message);
      logger.warn("[Redis] Falling back to in-memory cache only");
      isConnected = false;
    });

  redisClient.on("error", err => {
    logger.error("[Redis] Error:", err.message);
    isConnected = false;
  });

  redisClient.on("reconnecting", () => {
    logger.info("[Redis] Reconnecting...");
  });

  redisClient.on("ready", () => {
    isConnected = true;
    logger.info("[Redis] Ready");
  });

  return redisClient;
}

/**
 * Get Redis client instance
 */
export function getRedis(): Redis {
  if (!redisClient) {
    return initializeRedis();
  }
  return redisClient;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isConnected = false;
    logger.info("[Redis] Connection closed");
  }
}

// Export singleton instance
export const redis = getRedis();
