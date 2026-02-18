import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  SubscriptionTier,
  SUBSCRIPTION_PRICING,
  SUBSCRIPTION_FEATURES,
  UserSubscription,
} from "../../shared/subscriptions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // @ts-expect-error TS2322
  apiVersion: "2024-01-01",
});

// Re-export for backward compatibility
export {
  SubscriptionTier,
  SUBSCRIPTION_PRICING,
  SUBSCRIPTION_FEATURES,
  UserSubscription,
};

// Create checkout session
export async function createCheckoutSession(
  userId: number,
  tier: SubscriptionTier,
  returnUrl: string
): Promise<string> {
  if (tier === SubscriptionTier.FREE) {
    throw new Error("Cannot create checkout session for free tier");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // @ts-expect-error TS2339
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  const pricing = SUBSCRIPTION_PRICING[tier];

  // @ts-expect-error TS2769
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    line_items: [
      {
        price: pricing.stripePriceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: returnUrl,
    metadata: {
      userId: userId.toString(),
      tier,
    },
  });

  return session.url || "";
}

// Handle subscription webhook
export async function handleSubscriptionWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionCanceled(
        event.data.object as Stripe.Subscription
      );
      break;

    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }
}

// Handle subscription update
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata as { userId?: string; tier?: string };
  const userId = parseInt(metadata.userId || "0");
  const tier = (metadata.tier as SubscriptionTier) || SubscriptionTier.FREE;

  if (!userId) return;

  // Update user subscription in database
  // This would depend on your schema
  console.log(
    `[Subscription] Updated subscription for user ${userId}: ${tier}`
  );
}

// Handle subscription canceled
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata as { userId?: string };
  const userId = parseInt(metadata.userId || "0");

  if (!userId) return;

  // Downgrade user to free tier
  console.log(`[Subscription] Canceled subscription for user ${userId}`);
}

// Handle payment succeeded
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`[Subscription] Payment succeeded for invoice ${invoice.id}`);
}

// Handle payment failed
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[Subscription] Payment failed for invoice ${invoice.id}`);
}

// Get user subscription
export async function getUserSubscription(
  // @ts-expect-error TS6133 unused
  userId: number
): Promise<SubscriptionTier> {
  // Query database for user subscription
  // For now, return free tier
  return SubscriptionTier.FREE;
}

// Check if user has feature access
export async function hasFeatureAccess(
  userId: number,
  feature: string
): Promise<boolean> {
  const tier = await getUserSubscription(userId);
  const features = SUBSCRIPTION_FEATURES[tier].features;
  return features.includes(feature);
}

// Check subscription limits
export async function checkSubscriptionLimits(
  userId: number,
  resource: string,
  count: number
): Promise<boolean> {
  const tier = await getUserSubscription(userId);
  const limits = SUBSCRIPTION_FEATURES[tier];

  switch (resource) {
    case "strategies":
      return limits.maxStrategies === -1 || count < limits.maxStrategies;
    case "trades":
      return limits.maxTrades === -1 || count < limits.maxTrades;
    case "exports":
      return limits.exportLimit === -1 || count < limits.exportLimit;
    default:
      return true;
  }
}

// Get subscription portal URL
export async function getPortalUrl(
  userId: number,
  returnUrl: string
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // @ts-expect-error TS2339
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get or create Stripe customer
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: userId.toString(),
      },
    });
    customerId = customer.id;
  }

  // Create portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// Upgrade subscription
export async function upgradeSubscription(
  userId: number,
  newTier: SubscriptionTier
): Promise<string> {
  if (newTier === SubscriptionTier.FREE) {
    throw new Error("Cannot upgrade to free tier");
  }

  return createCheckoutSession(userId, newTier, "/account/billing");
}

// Downgrade subscription
export async function downgradeSubscription(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // @ts-expect-error TS2339
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.stripeSubscriptionId) {
    throw new Error("No active subscription found");
  }

  // Cancel subscription at end of period
  await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  console.log(`[Subscription] Downgrade scheduled for user ${userId}`);
}

// Cancel subscription immediately
export async function cancelSubscription(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // @ts-expect-error TS2339
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user || !user.stripeSubscriptionId) {
    throw new Error("No active subscription found");
  }

  // Cancel subscription immediately
  // @ts-expect-error TS2339
  await stripe.subscriptions.del(user.stripeSubscriptionId);

  console.log(`[Subscription] Subscription canceled for user ${userId}`);
}

// Get subscription usage
export async function getSubscriptionUsage(userId: number) {
  const tier = await getUserSubscription(userId);
  const limits = SUBSCRIPTION_FEATURES[tier];

  // Query database for actual usage
  // This is a placeholder
  const strategiesCount = 0;
  const tradesCount = 0;
  const exportsCount = 0;

  return {
    tier,
    limits,
    usage: {
      strategies: strategiesCount,
      trades: tradesCount,
      exports: exportsCount,
    },
    percentageUsed: {
      strategies:
        limits.maxStrategies === -1
          ? 0
          : (strategiesCount / limits.maxStrategies) * 100,
      trades:
        limits.maxTrades === -1 ? 0 : (tradesCount / limits.maxTrades) * 100,
      exports:
        limits.exportLimit === -1
          ? 0
          : (exportsCount / limits.exportLimit) * 100,
    },
  };
}

export default {
  createCheckoutSession,
  handleSubscriptionWebhook,
  getUserSubscription,
  hasFeatureAccess,
  checkSubscriptionLimits,
  getPortalUrl,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  getSubscriptionUsage,
};
