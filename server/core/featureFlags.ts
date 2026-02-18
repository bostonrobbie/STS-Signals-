// @ts-expect-error TS2305
import { redis } from "../db";
import { logger } from "./logger";

/**
 * Feature Flags & Configuration Management
 * Enables dynamic feature toggling and configuration without redeployment
 */

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number; // 0-100
  targetUsers?: string[]; // Specific user IDs
  targetRoles?: string[]; // Admin, user, read-only
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag;
}

const FEATURE_FLAG_PREFIX = "feature:";

// Default feature flags
const DEFAULT_FLAGS: FeatureFlagConfig = {
  "advanced-analytics": {
    name: "advanced-analytics",
    enabled: true,
    description: "Enable advanced analytics features",
    rolloutPercentage: 100,
    targetRoles: ["admin", "user"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "data-export": {
    name: "data-export",
    enabled: true,
    description: "Enable data export functionality",
    rolloutPercentage: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "strategy-library": {
    name: "strategy-library",
    enabled: false,
    description: "Enable strategy library subscription",
    rolloutPercentage: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "real-time-signals": {
    name: "real-time-signals",
    enabled: false,
    description: "Enable real-time trading signals",
    rolloutPercentage: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "backtesting-engine": {
    name: "backtesting-engine",
    enabled: false,
    description: "Enable backtesting engine",
    rolloutPercentage: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "api-v2": {
    name: "api-v2",
    enabled: false,
    description: "Enable new API v2 endpoints",
    rolloutPercentage: 5,
    targetUsers: [], // Beta testers
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "mobile-app": {
    name: "mobile-app",
    enabled: false,
    description: "Enable mobile app access",
    rolloutPercentage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

/**
 * Initialize feature flags
 */
export const initializeFeatureFlags = async () => {
  try {
    for (const [name, flag] of Object.entries(DEFAULT_FLAGS)) {
      const key = `${FEATURE_FLAG_PREFIX}${name}`;
      const exists = await redis.exists(key);

      if (!exists) {
        await redis.set(key, JSON.stringify(flag));
        logger.info(`Feature flag initialized: ${name}`);
      }
    }
  } catch (error) {
    logger.error("Failed to initialize feature flags", error);
  }
};

/**
 * Get feature flag
 */
export const getFeatureFlag = async (
  name: string
): Promise<FeatureFlag | null> => {
  try {
    const key = `${FEATURE_FLAG_PREFIX}${name}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as FeatureFlag;
  } catch (error) {
    logger.error(`Failed to get feature flag: ${name}`, error);
    return null;
  }
};

/**
 * Check if feature is enabled for user
 */
export const isFeatureEnabled = async (
  featureName: string,
  userId?: string,
  userRole?: string
): Promise<boolean> => {
  try {
    const flag = await getFeatureFlag(featureName);

    if (!flag) {
      logger.warn(`Feature flag not found: ${featureName}`);
      return false;
    }

    // Check if globally enabled
    if (!flag.enabled) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = userId ? userId.charCodeAt(0) % 100 : Math.random() * 100;
      if (hash > flag.rolloutPercentage) {
        return false;
      }
    }

    // Check target users
    if (flag.targetUsers && flag.targetUsers.length > 0) {
      if (!userId || !flag.targetUsers.includes(userId)) {
        return false;
      }
    }

    // Check target roles
    if (flag.targetRoles && flag.targetRoles.length > 0) {
      if (!userRole || !flag.targetRoles.includes(userRole)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error(`Failed to check feature flag: ${featureName}`, error);
    return false;
  }
};

/**
 * Set feature flag
 */
export const setFeatureFlag = async (
  name: string,
  flag: Partial<FeatureFlag>
): Promise<boolean> => {
  try {
    const existing = await getFeatureFlag(name);
    const updated: FeatureFlag = {
      name,
      enabled: flag.enabled ?? existing?.enabled ?? false,
      description: flag.description ?? existing?.description ?? "",
      rolloutPercentage:
        flag.rolloutPercentage ?? existing?.rolloutPercentage ?? 0,
      targetUsers: flag.targetUsers ?? existing?.targetUsers,
      targetRoles: flag.targetRoles ?? existing?.targetRoles,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      metadata: flag.metadata ?? existing?.metadata,
    };

    const key = `${FEATURE_FLAG_PREFIX}${name}`;
    await redis.set(key, JSON.stringify(updated));

    logger.info(`Feature flag updated: ${name}`, {
      enabled: updated.enabled,
      rollout: updated.rolloutPercentage,
    });

    return true;
  } catch (error) {
    logger.error(`Failed to set feature flag: ${name}`, error);
    return false;
  }
};

/**
 * Enable feature flag
 */
export const enableFeatureFlag = async (name: string): Promise<boolean> => {
  return setFeatureFlag(name, { enabled: true });
};

/**
 * Disable feature flag
 */
export const disableFeatureFlag = async (name: string): Promise<boolean> => {
  return setFeatureFlag(name, { enabled: false });
};

/**
 * Set rollout percentage
 */
export const setRolloutPercentage = async (
  name: string,
  percentage: number
): Promise<boolean> => {
  if (percentage < 0 || percentage > 100) {
    logger.warn(`Invalid rollout percentage: ${percentage}`);
    return false;
  }

  return setFeatureFlag(name, { rolloutPercentage: percentage });
};

/**
 * Add target user
 */
export const addTargetUser = async (
  featureName: string,
  userId: string
): Promise<boolean> => {
  try {
    const flag = await getFeatureFlag(featureName);

    if (!flag) {
      return false;
    }

    const targetUsers = flag.targetUsers || [];

    if (!targetUsers.includes(userId)) {
      targetUsers.push(userId);
      return setFeatureFlag(featureName, { targetUsers });
    }

    return true;
  } catch (error) {
    logger.error(`Failed to add target user: ${featureName}`, error);
    return false;
  }
};

/**
 * Remove target user
 */
export const removeTargetUser = async (
  featureName: string,
  userId: string
): Promise<boolean> => {
  try {
    const flag = await getFeatureFlag(featureName);

    if (!flag) {
      return false;
    }

    const targetUsers = flag.targetUsers || [];
    const filtered = targetUsers.filter(u => u !== userId);

    return setFeatureFlag(featureName, { targetUsers: filtered });
  } catch (error) {
    logger.error(`Failed to remove target user: ${featureName}`, error);
    return false;
  }
};

/**
 * Get all feature flags
 */
export const getAllFeatureFlags = async (): Promise<FeatureFlagConfig> => {
  try {
    const keys = await redis.keys(`${FEATURE_FLAG_PREFIX}*`);
    const flags: FeatureFlagConfig = {};

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const flag = JSON.parse(data) as FeatureFlag;
        flags[flag.name] = flag;
      }
    }

    return flags;
  } catch (error) {
    logger.error("Failed to get all feature flags", error);
    return {};
  }
};

/**
 * Get feature flag status report
 */
export const getFeatureFlagReport = async () => {
  try {
    const flags = await getAllFeatureFlags();

    const report = {
      generatedAt: new Date().toISOString(),
      totalFlags: Object.keys(flags).length,
      enabledFlags: Object.values(flags).filter(f => f.enabled).length,
      disabledFlags: Object.values(flags).filter(f => !f.enabled).length,
      betaFeatures: Object.values(flags).filter(
        f => f.rolloutPercentage < 100 && f.rolloutPercentage > 0
      ),
      flags,
    };

    return report;
  } catch (error) {
    logger.error("Failed to generate feature flag report", error);
    throw error;
  }
};

export default {
  initializeFeatureFlags,
  getFeatureFlag,
  isFeatureEnabled,
  setFeatureFlag,
  enableFeatureFlag,
  disableFeatureFlag,
  setRolloutPercentage,
  addTargetUser,
  removeTargetUser,
  getAllFeatureFlags,
  getFeatureFlagReport,
};
