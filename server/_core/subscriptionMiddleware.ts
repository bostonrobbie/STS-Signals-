/**
 * Subscription Tier Middleware for tRPC
 *
 * Enforces subscription tier requirements on protected endpoints.
 * Prevents free users from accessing Pro/Enterprise features.
 */

import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";

export type SubscriptionTier = "free" | "pro" | "enterprise";

/**
 * Feature requirements by subscription tier
 */
export const SUBSCRIPTION_FEATURES = {
  free: {
    maxStrategies: 1,
    maxTrades: 1000,
    maxExportsPerMonth: 1,
    canReceiveWebhooks: false,
    canUseRealTimeAlerts: false,
    canAccessAdvancedAnalytics: false,
    canAccessAPI: false,
    canCompareStrategies: false,
    dataRetentionDays: 30,
  },
  pro: {
    maxStrategies: 10,
    maxTrades: 100000,
    maxExportsPerMonth: 50,
    canReceiveWebhooks: true,
    canUseRealTimeAlerts: true,
    canAccessAdvancedAnalytics: true,
    canAccessAPI: true,
    canCompareStrategies: true,
    dataRetentionDays: 365,
  },
  enterprise: {
    maxStrategies: -1, // unlimited
    maxTrades: -1,
    maxExportsPerMonth: -1,
    canReceiveWebhooks: true,
    canUseRealTimeAlerts: true,
    canAccessAdvancedAnalytics: true,
    canAccessAPI: true,
    canCompareStrategies: true,
    dataRetentionDays: -1, // unlimited
  },
};

/**
 * Check if a user has access to a specific feature
 */
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: keyof (typeof SUBSCRIPTION_FEATURES)["free"]
): boolean {
  const tierFeatures = SUBSCRIPTION_FEATURES[tier];
  const featureValue = tierFeatures[feature];

  // If feature is a boolean, return it directly
  if (typeof featureValue === "boolean") {
    return featureValue;
  }

  // If feature is a number (limit), return true if limit is -1 (unlimited) or > 0
  if (typeof featureValue === "number") {
    return featureValue === -1 || featureValue > 0;
  }

  return false;
}

/**
 * Get the subscription tier from a user object
 */
export function getUserSubscriptionTier(user: User | null): SubscriptionTier {
  if (!user) return "free";
  return (user.subscriptionTier as SubscriptionTier) || "free";
}

/**
 * Create an error message for subscription tier requirement
 */
export function getSubscriptionErrorMessage(
  requiredTier: SubscriptionTier
): string {
  const tierNames = {
    free: "Free",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return `This feature requires a ${tierNames[requiredTier]} subscription or higher. Please upgrade your subscription to continue.`;
}

/**
 * Subscription tier requirement types
 */
export type SubscriptionRequirement = {
  tier: SubscriptionTier;
  feature?: keyof (typeof SUBSCRIPTION_FEATURES)["free"];
};

/**
 * Check if user meets subscription requirement
 */
export function meetsSubscriptionRequirement(
  user: User | null,
  requirement: SubscriptionRequirement
): boolean {
  if (!user) return requirement.tier === "free";

  const userTier = getUserSubscriptionTier(user);
  const tierHierarchy: SubscriptionTier[] = ["free", "pro", "enterprise"];
  const userTierIndex = tierHierarchy.indexOf(userTier);
  const requiredTierIndex = tierHierarchy.indexOf(requirement.tier);

  // User must be at the required tier or higher
  const meetsMinimumTier = userTierIndex >= requiredTierIndex;

  // If specific feature is required, check it
  if (requirement.feature && meetsMinimumTier) {
    return hasFeatureAccess(userTier, requirement.feature);
  }

  return meetsMinimumTier;
}

/**
 * Throw an error if user doesn't meet subscription requirement
 */
export function requireSubscription(
  user: User | null,
  requirement: SubscriptionRequirement
): void {
  if (!meetsSubscriptionRequirement(user, requirement)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: getSubscriptionErrorMessage(requirement.tier),
    });
  }
}

/**
 * Get a human-readable description of subscription limits
 */
export function getSubscriptionLimitsDescription(
  tier: SubscriptionTier
): string {
  const features = SUBSCRIPTION_FEATURES[tier];
  const limits: string[] = [];

  if (features.maxStrategies > 0) {
    limits.push(`Up to ${features.maxStrategies} strategies`);
  } else if (features.maxStrategies === -1) {
    limits.push("Unlimited strategies");
  }

  if (features.maxTrades > 0) {
    limits.push(`${features.maxTrades.toLocaleString()} trades`);
  } else if (features.maxTrades === -1) {
    limits.push("Unlimited trades");
  }

  if (features.canReceiveWebhooks) {
    limits.push("Webhook signal reception");
  }

  if (features.canUseRealTimeAlerts) {
    limits.push("Real-time alerts");
  }

  if (features.canAccessAdvancedAnalytics) {
    limits.push("Advanced analytics");
  }

  if (features.canAccessAPI) {
    limits.push("API access");
  }

  return limits.join(", ");
}
