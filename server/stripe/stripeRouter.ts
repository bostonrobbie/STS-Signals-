import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "./products";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Cache for price IDs to avoid repeated API calls
let cachedPriceIds: { monthly: string; yearly: string } | null = null;

/**
 * Dynamically fetch the correct price IDs from Stripe
 * This ensures we use prices that exist in the current Stripe account/mode
 */
async function getStripePriceIds(): Promise<{
  monthly: string;
  yearly: string;
}> {
  if (cachedPriceIds) {
    return cachedPriceIds;
  }

  try {
    // Fetch all active prices from Stripe
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      limit: 100,
    });

    // Find monthly price for our subscription
    // Look for $50/month (5000 cents)
    let monthlyPriceId = "";
    let yearlyPriceId = ""; // Keep for backward compatibility

    for (const price of prices.data) {
      if (price.unit_amount === 5000 && price.recurring?.interval === "month") {
        monthlyPriceId = price.id;
      }
      // Keep yearly lookup for backward compatibility
      if (price.unit_amount === 50000 && price.recurring?.interval === "year") {
        yearlyPriceId = price.id;
      }
    }

    // If we found monthly price, use it (yearly is optional now)
    if (monthlyPriceId) {
      cachedPriceIds = {
        monthly: monthlyPriceId,
        yearly: yearlyPriceId || monthlyPriceId,
      };
      console.log("[Stripe] Found price IDs:", cachedPriceIds);
      return cachedPriceIds;
    }

    // If prices don't exist, create them
    console.log("[Stripe] Creating new prices...");

    // First, find or create a product
    const products = await stripe.products.list({ active: true, limit: 10 });
    let productId = products.data.find(
      p => p.name.includes("STS") || p.name.includes("Pro")
    )?.id;

    if (!productId) {
      const product = await stripe.products.create({
        name: "STS Pro Subscription",
        description:
          "Full access to STS Dashboard - Automated futures trading signals",
      });
      productId = product.id;
    }

    // Create monthly price if not found
    if (!monthlyPriceId) {
      const monthlyPrice = await stripe.prices.create({
        product: productId,
        unit_amount: 5000, // $50
        currency: "usd",
        recurring: { interval: "month" },
      });
      monthlyPriceId = monthlyPrice.id;
    }

    // Create yearly price if not found
    if (!yearlyPriceId) {
      const yearlyPrice = await stripe.prices.create({
        product: productId,
        unit_amount: 50000, // $500
        currency: "usd",
        recurring: { interval: "year" },
      });
      yearlyPriceId = yearlyPrice.id;
    }

    cachedPriceIds = { monthly: monthlyPriceId, yearly: yearlyPriceId };
    console.log("[Stripe] Created price IDs:", cachedPriceIds);
    return cachedPriceIds;
  } catch (error) {
    console.error("[Stripe] Error fetching/creating prices:", error);
    throw new Error("Failed to get Stripe price configuration");
  }
}

export const stripeRouter = router({
  // Create checkout session for subscription
  createCheckoutSession: publicProcedure
    .input(
      z.object({
        priceId: z.string().optional(),
        interval: z.enum(["monthly", "yearly"]).default("monthly"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { interval, priceId } = input;
      const user = ctx.user;

      // Get the correct price ID dynamically
      const priceIds = await getStripePriceIds();
      const stripePriceId =
        priceId || (interval === "yearly" ? priceIds.yearly : priceIds.monthly);

      // If user is logged in, use their existing customer ID or create one
      let customerId: string | undefined = undefined;
      if (user) {
        customerId = user.stripeCustomerId || undefined;

        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email || undefined,
            name: user.name || undefined,
            metadata: {
              userId: user.id.toString(),
              openId: user.openId,
            },
          });
          customerId = customer.id;

          // Save customer ID to database
          const db = await getDb();
          if (db) {
            await db
              .update(users)
              .set({ stripeCustomerId: customerId })
              .where(eq(users.id, user.id));
          }
        }
      }

      // Create checkout session
      // For guest checkout, Stripe will collect email and create customer
      const session = await stripe.checkout.sessions.create({
        customer: customerId, // undefined for guests
        customer_email: !customerId && user?.email ? user.email : undefined,
        mode: "subscription",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        client_reference_id: user?.id.toString(),
        metadata: {
          user_id: user?.id.toString() || "",
          customer_email: user?.email || "",
          customer_name: user?.name || "",
          tier: "pro",
          interval: interval,
        },
        line_items: [
          {
            price: stripePriceId,
            quantity: 1,
          },
        ],
        success_url: `${ctx.req.headers.origin || "http://localhost:3000"}/checkout/success?tier=pro&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${ctx.req.headers.origin || "http://localhost:3000"}/pricing?payment=canceled`,
      });

      return { url: session.url };
    }),

  // Get current subscription status
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.user;

    // If user has a Stripe subscription, fetch details
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId
        );
        const subData = subscription as any;
        return {
          tier: user.subscriptionTier,
          status: subData.status,
          currentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: subData.cancel_at_period_end || false,
        };
      } catch (error) {
        // Subscription not found or error
        return {
          tier: user.subscriptionTier || "free",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }
    }

    return {
      tier: user.subscriptionTier || "free",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    if (!user.stripeSubscriptionId) {
      throw new Error("No active subscription to cancel");
    }

    // Cancel at period end (don't immediately cancel)
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { success: true };
  }),

  // Resume canceled subscription
  resumeSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    if (!user.stripeSubscriptionId) {
      throw new Error("No subscription to resume");
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    return { success: true };
  }),

  // Create billing portal session
  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    const user = ctx.user;

    if (!user.stripeCustomerId) {
      throw new Error("No Stripe customer found");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${ctx.req.headers.origin}/my-dashboard`,
    });

    return { url: session.url };
  }),

  // Get pricing tiers (public)
  getPricingTiers: publicProcedure.query(() => {
    return Object.values(SUBSCRIPTION_TIERS);
  }),
});
