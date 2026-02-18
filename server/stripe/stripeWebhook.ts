/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for subscription management
 * with idempotency, error handling, and notifications.
 */

import { Router, raw } from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { users, paymentHistory } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  sendWelcomeEmail,
  isEmailConfigured,
  sendEmail,
} from "../services/resendEmail";

const router = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 */
router.post("/", raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  if (!sig || !webhookSecret) {
    console.error("[Stripe Webhook] Missing signature or webhook secret");
    return res.status(400).json({ error: "Missing signature" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
});

/**
 * Handle successful checkout session
 * - Update user subscription status
 * - Send welcome email
 * - Idempotent: safe to retry
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const db = await getDb();
  if (!db) return;

  const userId = session.client_reference_id
    ? parseInt(session.client_reference_id)
    : null;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const tier = session.metadata?.tier || "pro";

  console.log(
    `[Stripe Webhook] Checkout completed for user ${userId}, tier: ${tier}`
  );

  if (!userId) {
    console.error("[Stripe Webhook] No user ID in checkout session");
    return;
  }

  try {
    // Get user details
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      console.error(`[Stripe Webhook] User ${userId} not found`);
      return;
    }

    // Check if already processed (idempotency)
    if (
      user.stripeSubscriptionId === subscriptionId &&
      user.subscriptionStatus === "active"
    ) {
      console.log(
        `[Stripe Webhook] Checkout already processed for user ${userId}`
      );
      return;
    }

    // Update user subscription
    await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionTier: tier as "pro" | "premium" | "free",
        subscriptionStatus: "active",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, userId));

    console.log(
      `[Stripe Webhook] Updated user ${userId} subscription to ${tier}`
    );

    // Record payment in history (idempotent)
    try {
      await db.insert(paymentHistory).values({
        userId,
        stripePaymentIntentId:
          (session.payment_intent as string) || `checkout_${session.id}`,
        amount: session.amount_total || 0,
        currency: session.currency || "usd",
        status: "succeeded",
        description: `${tier} subscription`,
      });
    } catch (error) {
      // Ignore duplicate key errors (already recorded)
      if ((error as any).code !== "ER_DUP_ENTRY") {
        throw error;
      }
    }

    // Send welcome email
    if (isEmailConfigured() && user.email) {
      try {
        const result = await sendWelcomeEmail(
          user.email,
          user.name || "Trader"
        );
        if (result.success) {
          console.log(`[Stripe Webhook] Welcome email sent to ${user.email}`);
        } else {
          console.error(
            `[Stripe Webhook] Failed to send welcome email: ${result.error}`
          );
        }
      } catch (error) {
        console.error("[Stripe Webhook] Error sending welcome email:", error);
      }
    }
  } catch (error) {
    console.error(
      `[Stripe Webhook] Error handling checkout completion for user ${userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Handle subscription updates (upgrades, downgrades, renewals)
 * - Idempotent: safe to retry
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;

  try {
    // Find user by Stripe customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));

    if (!user) {
      console.error(
        `[Stripe Webhook] User not found for customer ${customerId}`
      );
      return;
    }

    // Update subscription status
    await db
      .update(users)
      .set({
        subscriptionStatus: subscription.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    console.log(
      `[Stripe Webhook] Updated subscription status for user ${user.id}: ${subscription.status}`
    );
  } catch (error) {
    console.error(
      `[Stripe Webhook] Error updating subscription for customer ${customerId}:`,
      error
    );
    throw error;
  }
}

/**
 * Handle subscription cancellation
 * - Downgrade user to free tier
 * - Idempotent: safe to retry
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const db = await getDb();
  if (!db) return;

  const customerId = subscription.customer as string;

  try {
    // Find user by Stripe customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));

    if (!user) {
      console.error(
        `[Stripe Webhook] User not found for customer ${customerId}`
      );
      return;
    }

    // Check if already downgraded (idempotency)
    if (
      user.subscriptionTier === "free" &&
      user.subscriptionStatus === "canceled"
    ) {
      console.log(
        `[Stripe Webhook] Subscription already canceled for user ${user.id}`
      );
      return;
    }

    // Downgrade to free tier
    await db
      .update(users)
      .set({
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    console.log(`[Stripe Webhook] Subscription canceled for user ${user.id}`);
  } catch (error) {
    console.error(
      `[Stripe Webhook] Error canceling subscription for customer ${customerId}:`,
      error
    );
    throw error;
  }
}

/**
 * Handle successful invoice payment (renewals)
 * - Record payment in history
 * - Update subscription status
 * - Idempotent: safe to retry
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const customerId = invoice.customer as string;

  try {
    // Find user by Stripe customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));

    if (!user) {
      console.error(
        `[Stripe Webhook] User not found for customer ${customerId}`
      );
      return;
    }

    // Record payment in history (idempotent)
    try {
      await db.insert(paymentHistory).values({
        userId: user.id,
        stripePaymentIntentId:
          ((invoice as any).payment_intent as string) ||
          `invoice_${invoice.id}`,
        amount: invoice.amount_paid || 0,
        currency: invoice.currency || "usd",
        status: "succeeded",
        description: `Subscription renewal`,
      });
    } catch (error) {
      // Ignore duplicate key errors (already recorded)
      if ((error as any).code !== "ER_DUP_ENTRY") {
        throw error;
      }
    }

    // Update subscription status to active (in case it was past_due)
    if (user.subscriptionStatus !== "active") {
      await db
        .update(users)
        .set({
          subscriptionStatus: "active",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, user.id));
    }

    console.log(`[Stripe Webhook] Payment recorded for user ${user.id}`);
  } catch (error) {
    console.error(
      `[Stripe Webhook] Error handling invoice payment for customer ${customerId}:`,
      error
    );
    throw error;
  }
}

/**
 * Handle failed invoice payment
 * - Record failed payment
 * - Mark subscription as past_due
 * - Send notification email
 * - Idempotent: safe to retry
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const db = await getDb();
  if (!db) return;

  const customerId = invoice.customer as string;

  try {
    // Find user by Stripe customer ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId));

    if (!user) {
      console.error(
        `[Stripe Webhook] User not found for customer ${customerId}`
      );
      return;
    }

    // Record failed payment (idempotent)
    try {
      await db.insert(paymentHistory).values({
        userId: user.id,
        stripePaymentIntentId:
          ((invoice as any).payment_intent as string) ||
          `invoice_${invoice.id}`,
        amount: invoice.amount_due || 0,
        currency: invoice.currency || "usd",
        status: "failed",
        description: `Payment failed`,
      });
    } catch (error) {
      // Ignore duplicate key errors (already recorded)
      if ((error as any).code !== "ER_DUP_ENTRY") {
        throw error;
      }
    }

    // Update subscription status
    await db
      .update(users)
      .set({
        subscriptionStatus: "past_due",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    // Send payment failure notification email
    if (isEmailConfigured() && user.email) {
      try {
        const result = await sendEmail({
          to: user.email,
          subject: "Payment Failed - Action Required",
          html: `
            <h2>Payment Failed</h2>
            <p>Hi ${user.name || "Trader"},</p>
            <p>Your recent subscription payment failed. Please update your payment method to continue using your subscription.</p>
            <p>Amount due: $${((invoice.amount_due || 0) / 100).toFixed(2)}</p>
            <p><a href="${process.env.VITE_FRONTEND_URL || "https://intradaydash.manus.space"}/billing">Update Payment Method</a></p>
            <p>If you have any questions, please contact our support team.</p>
          `,
          text: `Your payment failed. Please update your payment method at ${process.env.VITE_FRONTEND_URL || "https://intradaydash.manus.space"}/billing`,
        });
        if (result.success) {
          console.log(
            `[Stripe Webhook] Payment failure notification sent to ${user.email}`
          );
        } else {
          console.error(
            `[Stripe Webhook] Failed to send payment failure email: ${result.error}`
          );
        }
      } catch (error) {
        console.error(
          "[Stripe Webhook] Error sending payment failure email:",
          error
        );
      }
    }

    console.log(`[Stripe Webhook] Payment failed for user ${user.id}`);
  } catch (error) {
    console.error(
      `[Stripe Webhook] Error handling invoice payment failure for customer ${customerId}:`,
      error
    );
    throw error;
  }
}

export default router;
