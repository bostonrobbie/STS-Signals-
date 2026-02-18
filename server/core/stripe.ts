import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(stripeSecretKey, {
  // @ts-expect-error TS2322
  apiVersion: "2024-04-10",
});

// Stripe product and price IDs
export const STRIPE_PRODUCTS = {
  free: {
    productId: process.env.STRIPE_PRODUCT_FREE || "prod_free",
    monthlyPriceId:
      process.env.STRIPE_PRICE_FREE_MONTHLY || "price_free_monthly",
    annualPriceId: process.env.STRIPE_PRICE_FREE_ANNUAL || "price_free_annual",
  },
  pro: {
    productId: process.env.STRIPE_PRODUCT_PRO || "prod_pro",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL || "price_pro_annual",
  },
  enterprise: {
    productId: process.env.STRIPE_PRODUCT_ENTERPRISE || "prod_enterprise",
    monthlyPriceId:
      process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "price_enterprise_monthly",
    annualPriceId:
      process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || "price_enterprise_annual",
  },
};

// Helper to get price ID
export function getPriceId(
  tier: "free" | "pro" | "enterprise",
  cycle: "monthly" | "annual"
) {
  const product = STRIPE_PRODUCTS[tier];
  return cycle === "monthly" ? product.monthlyPriceId : product.annualPriceId;
}

// Helper to handle webhook events
export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      return handleSubscriptionChange(event.data.object as Stripe.Subscription);

    case "customer.subscription.deleted":
      return handleSubscriptionCanceled(
        event.data.object as Stripe.Subscription
      );

    case "invoice.payment_succeeded":
      return handleInvoicePaid(event.data.object as Stripe.Invoice);

    case "invoice.payment_failed":
      return handleInvoiceFailed(event.data.object as Stripe.Invoice);

    case "charge.dispute.created":
      return handleDispute(event.data.object as Stripe.Dispute);

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  // Update user subscription in database
  console.log(`Subscription updated for user ${userId}:`, subscription.id);
  // TODO: Update database with subscription details
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  console.log(`Subscription canceled for user ${userId}:`, subscription.id);
  // TODO: Update database to mark subscription as canceled
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const userId = invoice.metadata?.userId;
  if (!userId) return;

  console.log(`Invoice paid for user ${userId}:`, invoice.id);
  // TODO: Log payment in database
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const userId = invoice.metadata?.userId;
  if (!userId) return;

  console.log(`Invoice failed for user ${userId}:`, invoice.id);
  // TODO: Send notification to user about failed payment
}

async function handleDispute(dispute: Stripe.Dispute) {
  console.log(`Dispute created:`, dispute.id);
  // TODO: Alert admin about dispute
}
