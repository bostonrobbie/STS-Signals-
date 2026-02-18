// Shared subscription constants that can be imported by both client and server

// Subscription tiers
export enum SubscriptionTier {
  FREE = "free",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

// Subscription features by tier
export const SUBSCRIPTION_FEATURES = {
  [SubscriptionTier.FREE]: {
    maxStrategies: 1,
    maxTrades: 1000,
    dataRetention: 30, // days
    exportLimit: 1, // per month
    apiCallsPerMinute: 10,
    features: ["portfolio_overview", "basic_analytics"],
  },
  [SubscriptionTier.PRO]: {
    maxStrategies: 10,
    maxTrades: 100000,
    dataRetention: 365,
    exportLimit: 50,
    apiCallsPerMinute: 100,
    features: [
      "portfolio_overview",
      "advanced_analytics",
      "real_time_alerts",
      "custom_reports",
      "api_access",
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    maxStrategies: -1, // unlimited
    maxTrades: -1,
    dataRetention: -1,
    exportLimit: -1,
    apiCallsPerMinute: 1000,
    features: [
      "portfolio_overview",
      "advanced_analytics",
      "real_time_alerts",
      "custom_reports",
      "api_access",
      "white_label",
      "dedicated_support",
      "sso",
    ],
  },
};

// Subscription pricing (client-safe - no process.env)
// Stripe price IDs should be configured on the server side
export const SUBSCRIPTION_PRICING = {
  [SubscriptionTier.FREE]: {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    stripePriceId: null,
  },
  [SubscriptionTier.PRO]: {
    name: "Pro",
    monthlyPrice: 50,
    annualPrice: 500,
    stripePriceId: null, // Set on server side
  },
  [SubscriptionTier.ENTERPRISE]: {
    name: "Enterprise",
    monthlyPrice: 999,
    annualPrice: 9990,
    stripePriceId: null, // Set on server side
  },
};

export interface UserSubscription {
  userId: number;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: "active" | "canceled" | "past_due" | "unpaid";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}
