import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
// @ts-expect-error TS2724
import { subscriptionSystem } from "../core/subscriptions";
import { stripe } from "../core/stripe";
import { TRPCError } from "@trpc/server";

export const billingRouter = router({
  // Get current subscription
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await subscriptionSystem.getUserSubscription(
        ctx.user.id
      );
      return subscription;
    } catch (error) {
      console.error("Failed to get subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscription",
      });
    }
  }),

  // Get usage statistics
  getUsage: protectedProcedure.query(async ({ ctx }) => {
    try {
      const usage = await subscriptionSystem.getUserUsage(ctx.user.id);
      return usage;
    } catch (error) {
      console.error("Failed to get usage:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch usage statistics",
      });
    }
  }),

  // Create checkout session for upgrade/downgrade
  createCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["free", "pro", "enterprise"]),
        billingCycle: z
          .enum(["monthly", "annual"])
          .optional()
          .default("monthly"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get or create Stripe customer
        let customerId = ctx.user.stripeCustomerId;
        if (!customerId) {
          // @ts-expect-error TS2769
          const customer = await stripe.customers.create({
            email: ctx.user.email,
            name: ctx.user.name,
            metadata: {
              userId: ctx.user.id.toString(),
            },
          });
          customerId = customer.id;
          // Save customer ID to database
          await subscriptionSystem.updateUserStripeCustomerId(
            ctx.user.id,
            customerId
          );
        }

        // Get price ID for the tier and billing cycle
        const priceId = subscriptionSystem.getPriceId(
          input.tier,
          input.billingCycle
        );

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url: `${ctx.req.headers.origin}/billing?success=true`,
          cancel_url: `${ctx.req.headers.origin}/billing?canceled=true`,
          metadata: {
            userId: ctx.user.id.toString(),
            tier: input.tier,
          },
        });

        return session.url;
      } catch (error) {
        console.error("Failed to create checkout session:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),

  // Get Stripe portal URL for managing subscription
  getPortalUrl: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.user.stripeCustomerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No subscription found",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: ctx.user.stripeCustomerId,
        return_url: `${ctx.req.headers.origin}/billing`,
      });

      return session.url;
    } catch (error) {
      console.error("Failed to get portal URL:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get billing portal URL",
      });
    }
  }),

  // Get billing history
  getBillingHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        if (!ctx.user.stripeCustomerId) {
          return {
            invoices: [],
            total: 0,
          };
        }

        const invoices = await stripe.invoices.list({
          customer: ctx.user.stripeCustomerId,
          limit: input.limit,
          starting_after: input.offset > 0 ? undefined : undefined,
        });

        return {
          invoices: invoices.data.map(invoice => ({
            id: invoice.id,
            number: invoice.number,
            date: new Date(invoice.created * 1000),
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: invoice.status,
            pdfUrl: invoice.invoice_pdf,
          })),
          total: invoices.data.length,
        };
      } catch (error) {
        console.error("Failed to get billing history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch billing history",
        });
      }
    }),

  // Get available plans
  getPlans: protectedProcedure.query(async () => {
    try {
      return subscriptionSystem.getPlans();
    } catch (error) {
      console.error("Failed to get plans:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch plans",
      });
    }
  }),

  // Estimate upgrade cost
  estimateUpgradeCost: protectedProcedure
    .input(
      z.object({
        newTier: z.enum(["free", "pro", "enterprise"]),
        billingCycle: z
          .enum(["monthly", "annual"])
          .optional()
          .default("monthly"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const currentSubscription =
          await subscriptionSystem.getUserSubscription(ctx.user.id);
        const cost = subscriptionSystem.estimateUpgradeCost(
          currentSubscription.tier,
          input.newTier,
          input.billingCycle
        );
        return cost;
      } catch (error) {
        console.error("Failed to estimate upgrade cost:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to estimate upgrade cost",
        });
      }
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      if (!ctx.user.stripeSubscriptionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active subscription",
        });
      }

      // @ts-expect-error TS2339
      await stripe.subscriptions.del(ctx.user.stripeSubscriptionId);
      await subscriptionSystem.updateUserSubscription(ctx.user.id, {
        tier: "free",
        status: "canceled",
        stripeSubscriptionId: null,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to cancel subscription",
      });
    }
  }),

  // Reactivate subscription
  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const subscription = await subscriptionSystem.getUserSubscription(
        ctx.user.id
      );

      if (subscription.status !== "canceled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subscription is not canceled",
        });
      }

      // Create new checkout session for reactivation
      const session = await stripe.checkout.sessions.create({
        customer: ctx.user.stripeCustomerId!,
        line_items: [
          {
            price: subscriptionSystem.getPriceId(subscription.tier, "monthly"),
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${ctx.req.headers.origin}/billing?reactivated=true`,
        cancel_url: `${ctx.req.headers.origin}/billing`,
      });

      return session.url;
    } catch (error) {
      console.error("Failed to reactivate subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reactivate subscription",
      });
    }
  }),
});
