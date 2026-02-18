/**
 * Stripe Products Configuration
 * Defines subscription tiers for the Intraday Trading Dashboard
 */

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  priceMonthly: number; // in cents
  priceYearly: number; // in cents (with discount)
  features: string[];
  strategyLimit: number; // -1 for unlimited
  signalDelay: number; // minutes delay for signals (0 = real-time)
  popular?: boolean;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  free: {
    id: "free",
    name: "Free",
    description: "Explore the platform",
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      "View public strategy performance",
      "Limited historical data",
      "Basic analytics overview",
    ],
    strategyLimit: 0,
    signalDelay: 1440, // 24 hours
  },
  pro: {
    id: "pro",
    name: "STS Pro",
    description: "Full access to everything",
    priceMonthly: 5000, // $50
    priceYearly: 50000, // $500 (save $100/year)
    features: [
      "Full historical data (14+ years)",
      "Real-time TradingView signals",
      "All strategies included",
      "Brokerage connector (Tradovate/IBKR)",
      "Advanced analytics & metrics",
      "Kelly criterion calculator",
      "Portfolio correlation tools",
      "Priority support",
      "Lock in your rate forever",
    ],
    strategyLimit: -1, // unlimited
    signalDelay: 0,
    popular: true,
  },
};

// Stripe Price IDs - Live mode
// Use the newer prices that are associated with the current products
export const STRIPE_PRICE_IDS = {
  pro_monthly: "price_1StFfRLQsJRtPDrZP1GqVTbZ", // $50/month - prod_TqxalBxw6gQ0qj
  pro_yearly: "price_1StFfSLQsJRtPDrZQ9Xk9xbi", // $500/year - prod_Tqxabsvgy1Yoi6
};

export function getTierByPriceId(priceId: string): SubscriptionTier | null {
  if (priceId.includes("pro")) {
    return SUBSCRIPTION_TIERS.pro;
  }
  return SUBSCRIPTION_TIERS.free;
}

export function getTierFeatures(tierId: string): string[] {
  return (
    SUBSCRIPTION_TIERS[tierId]?.features || SUBSCRIPTION_TIERS.free.features
  );
}

export function canAccessStrategy(
  tierId: string,
  currentSubscriptionCount: number
): boolean {
  const tier = SUBSCRIPTION_TIERS[tierId] || SUBSCRIPTION_TIERS.free;
  if (tier.strategyLimit === -1) return true;
  return currentSubscriptionCount < tier.strategyLimit;
}
