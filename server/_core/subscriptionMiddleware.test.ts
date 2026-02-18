import { describe, it, expect } from "vitest";
import {
  hasFeatureAccess,
  getUserSubscriptionTier,
  meetsSubscriptionRequirement,
  getSubscriptionErrorMessage,
  getSubscriptionLimitsDescription,
  SUBSCRIPTION_FEATURES,
  type SubscriptionTier,
} from "./subscriptionMiddleware";
import type { User } from "../../drizzle/schema";

describe("Subscription Middleware", () => {
  describe("hasFeatureAccess", () => {
    it("should deny webhook access for free tier", () => {
      expect(hasFeatureAccess("free", "canReceiveWebhooks")).toBe(false);
    });

    it("should allow webhook access for pro tier", () => {
      expect(hasFeatureAccess("pro", "canReceiveWebhooks")).toBe(true);
    });

    it("should allow webhook access for enterprise tier", () => {
      expect(hasFeatureAccess("enterprise", "canReceiveWebhooks")).toBe(true);
    });

    it("should deny real-time alerts for free tier", () => {
      expect(hasFeatureAccess("free", "canUseRealTimeAlerts")).toBe(false);
    });

    it("should allow real-time alerts for pro tier", () => {
      expect(hasFeatureAccess("pro", "canUseRealTimeAlerts")).toBe(true);
    });

    it("should allow advanced analytics for pro tier", () => {
      expect(hasFeatureAccess("pro", "canAccessAdvancedAnalytics")).toBe(true);
    });

    it("should deny advanced analytics for free tier", () => {
      expect(hasFeatureAccess("free", "canAccessAdvancedAnalytics")).toBe(
        false
      );
    });

    it("should allow API access for pro tier", () => {
      expect(hasFeatureAccess("pro", "canAccessAPI")).toBe(true);
    });

    it("should deny API access for free tier", () => {
      expect(hasFeatureAccess("free", "canAccessAPI")).toBe(false);
    });

    it("should allow strategy comparison for pro tier", () => {
      expect(hasFeatureAccess("pro", "canCompareStrategies")).toBe(true);
    });

    it("should deny strategy comparison for free tier", () => {
      expect(hasFeatureAccess("free", "canCompareStrategies")).toBe(false);
    });
  });

  describe("getUserSubscriptionTier", () => {
    it("should return free for null user", () => {
      expect(getUserSubscriptionTier(null)).toBe("free");
    });

    it("should return user's subscription tier", () => {
      const user = { subscriptionTier: "pro" } as User;
      expect(getUserSubscriptionTier(user)).toBe("pro");
    });

    it("should return free if user has no subscription tier", () => {
      const user = { subscriptionTier: null } as any;
      expect(getUserSubscriptionTier(user)).toBe("free");
    });

    it("should return enterprise tier", () => {
      const user = { subscriptionTier: "enterprise" } as User;
      expect(getUserSubscriptionTier(user)).toBe("enterprise");
    });
  });

  describe("meetsSubscriptionRequirement", () => {
    it("should allow free users to access free features", () => {
      const user = { subscriptionTier: "free" } as User;
      expect(meetsSubscriptionRequirement(user, { tier: "free" })).toBe(true);
    });

    it("should deny free users to access pro features", () => {
      const user = { subscriptionTier: "free" } as User;
      expect(meetsSubscriptionRequirement(user, { tier: "pro" })).toBe(false);
    });

    it("should allow pro users to access pro features", () => {
      const user = { subscriptionTier: "pro" } as User;
      expect(meetsSubscriptionRequirement(user, { tier: "pro" })).toBe(true);
    });

    it("should deny pro users to access enterprise features", () => {
      const user = { subscriptionTier: "pro" } as User;
      expect(meetsSubscriptionRequirement(user, { tier: "enterprise" })).toBe(
        false
      );
    });

    it("should allow enterprise users to access all features", () => {
      const user = { subscriptionTier: "enterprise" } as User;
      expect(meetsSubscriptionRequirement(user, { tier: "free" })).toBe(true);
      expect(meetsSubscriptionRequirement(user, { tier: "pro" })).toBe(true);
      expect(meetsSubscriptionRequirement(user, { tier: "enterprise" })).toBe(
        true
      );
    });

    it("should check specific features", () => {
      const freeUser = { subscriptionTier: "free" } as User;
      const proUser = { subscriptionTier: "pro" } as User;

      expect(
        meetsSubscriptionRequirement(freeUser, {
          tier: "pro",
          feature: "canReceiveWebhooks",
        })
      ).toBe(false);

      expect(
        meetsSubscriptionRequirement(proUser, {
          tier: "pro",
          feature: "canReceiveWebhooks",
        })
      ).toBe(true);
    });

    it("should allow null user only for free tier", () => {
      expect(meetsSubscriptionRequirement(null, { tier: "free" })).toBe(true);
      expect(meetsSubscriptionRequirement(null, { tier: "pro" })).toBe(false);
    });
  });

  describe("getSubscriptionErrorMessage", () => {
    it("should return error message for pro tier", () => {
      const message = getSubscriptionErrorMessage("pro");
      expect(message).toContain("Pro");
      expect(message).toContain("subscription");
    });

    it("should return error message for enterprise tier", () => {
      const message = getSubscriptionErrorMessage("enterprise");
      expect(message).toContain("Enterprise");
      expect(message).toContain("subscription");
    });

    it("should return error message for free tier", () => {
      const message = getSubscriptionErrorMessage("free");
      expect(message).toContain("Free");
    });
  });

  describe("getSubscriptionLimitsDescription", () => {
    it("should describe free tier limits", () => {
      const description = getSubscriptionLimitsDescription("free");
      expect(description).toContain("1 strategies");
      expect(description).toContain("1,000 trades");
      expect(description).not.toContain("Webhook");
    });

    it("should describe pro tier limits", () => {
      const description = getSubscriptionLimitsDescription("pro");
      expect(description).toContain("10 strategies");
      expect(description).toContain("100,000 trades");
      expect(description).toContain("Webhook");
      expect(description).toContain("Real-time alerts");
    });

    it("should describe enterprise tier limits", () => {
      const description = getSubscriptionLimitsDescription("enterprise");
      expect(description).toContain("Unlimited strategies");
      expect(description).toContain("Unlimited trades");
      expect(description).toContain("Webhook");
    });
  });

  describe("SUBSCRIPTION_FEATURES", () => {
    it("should have correct free tier features", () => {
      expect(SUBSCRIPTION_FEATURES.free.maxStrategies).toBe(1);
      expect(SUBSCRIPTION_FEATURES.free.maxTrades).toBe(1000);
      expect(SUBSCRIPTION_FEATURES.free.canReceiveWebhooks).toBe(false);
      expect(SUBSCRIPTION_FEATURES.free.canUseRealTimeAlerts).toBe(false);
      expect(SUBSCRIPTION_FEATURES.free.dataRetentionDays).toBe(30);
    });

    it("should have correct pro tier features", () => {
      expect(SUBSCRIPTION_FEATURES.pro.maxStrategies).toBe(10);
      expect(SUBSCRIPTION_FEATURES.pro.maxTrades).toBe(100000);
      expect(SUBSCRIPTION_FEATURES.pro.canReceiveWebhooks).toBe(true);
      expect(SUBSCRIPTION_FEATURES.pro.canUseRealTimeAlerts).toBe(true);
      expect(SUBSCRIPTION_FEATURES.pro.dataRetentionDays).toBe(365);
    });

    it("should have correct enterprise tier features", () => {
      expect(SUBSCRIPTION_FEATURES.enterprise.maxStrategies).toBe(-1);
      expect(SUBSCRIPTION_FEATURES.enterprise.maxTrades).toBe(-1);
      expect(SUBSCRIPTION_FEATURES.enterprise.canReceiveWebhooks).toBe(true);
      expect(SUBSCRIPTION_FEATURES.enterprise.canUseRealTimeAlerts).toBe(true);
      expect(SUBSCRIPTION_FEATURES.enterprise.dataRetentionDays).toBe(-1);
    });
  });
});
