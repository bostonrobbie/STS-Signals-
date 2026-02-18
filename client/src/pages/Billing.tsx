import React, { useState } from "react";
import { trpc } from "../lib/trpc";
import {
  Check,
  Zap,
  Loader2,
  AlertTriangle,
  XCircle,
  RotateCcw,
} from "lucide-react";

export default function BillingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { data: subscription, refetch } =
    trpc.stripe.getSubscription.useQuery();
  const createCheckout = trpc.stripe.createCheckoutSession.useMutation();
  const managePortal = trpc.stripe.createPortalSession.useMutation();
  const cancelSub = trpc.stripe.cancelSubscription.useMutation();
  const resumeSub = trpc.stripe.resumeSubscription.useMutation();

  const handleUpgrade = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const result = await createCheckout.mutateAsync({
        interval: "monthly",
      });
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
      setActionMessage({
        type: "error",
        text: "Failed to start checkout. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const result = await managePortal.mutateAsync();
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to get portal URL:", error);
      setActionMessage({
        type: "error",
        text: "Could not open billing portal. Use the cancel button below instead.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setActionMessage(null);
    try {
      await cancelSub.mutateAsync();
      setShowCancelConfirm(false);
      setActionMessage({
        type: "success",
        text: "Your subscription has been set to cancel at the end of the current billing period. You'll retain access until then.",
      });
      await refetch();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      setActionMessage({
        type: "error",
        text: "Failed to cancel subscription. Please try again or contact support.",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setResumeLoading(true);
    setActionMessage(null);
    try {
      await resumeSub.mutateAsync();
      setActionMessage({
        type: "success",
        text: "Your subscription has been resumed. You will continue to be billed normally.",
      });
      await refetch();
    } catch (error) {
      console.error("Failed to resume subscription:", error);
      setActionMessage({
        type: "error",
        text: "Failed to resume subscription. Please try again or contact support.",
      });
    } finally {
      setResumeLoading(false);
    }
  };

  const isSubscribed = subscription && subscription.tier !== "free";
  const isCanceling = subscription?.cancelAtPeriodEnd;
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Plans & Pricing
          </h1>
          <p className="text-lg text-foreground/70">
            Simple, transparent pricing for professional traders.
          </p>
        </div>

        {/* Action Messages */}
        {actionMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border ${
              actionMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-start gap-3">
              {actionMessage.type === "success" ? (
                <Check className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <p className="text-sm">{actionMessage.text}</p>
            </div>
          </div>
        )}

        {/* Current Subscription Banner */}
        {isSubscribed && (
          <div
            className={`border rounded-xl p-6 mb-10 ${
              isCanceling
                ? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20"
                : "bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/20"
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-sm font-medium ${isCanceling ? "text-amber-500" : "text-emerald-400"}`}
                  >
                    {isCanceling ? "Canceling" : "Active Subscription"}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  Pro Plan
                </h3>
                <p className="text-foreground/70 mt-1">
                  Status:{" "}
                  <span
                    className={`capitalize ${isCanceling ? "text-amber-500" : "text-emerald-400"}`}
                  >
                    {isCanceling
                      ? "Cancels at period end"
                      : subscription?.status || "active"}
                  </span>
                </p>
                {periodEnd && (
                  <p className="text-foreground/60 text-sm mt-1">
                    {isCanceling
                      ? `Access until: ${periodEnd}`
                      : `Next billing date: ${periodEnd}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Manage Subscription
                </button>
                {isCanceling ? (
                  <button
                    onClick={handleResumeSubscription}
                    disabled={resumeLoading}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {resumeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Resume Subscription
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 text-sm"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  Cancel Subscription?
                </h3>
              </div>
              <p className="text-gray-600 mb-2">
                Are you sure you want to cancel your Pro Plan subscription?
              </p>
              <ul className="text-sm text-gray-500 mb-6 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  You'll retain full access until the end of your current
                  billing period
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  You can resume your subscription at any time before it expires
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">•</span>
                  All sales are final — no refunds will be issued
                </li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Canceling...
                    </>
                  ) : (
                    "Yes, Cancel"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pro Plan Card */}
        <div className="relative group">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>

          {/* Card */}
          <div className="relative bg-white border-2 border-emerald-500 rounded-2xl p-8 hover:border-emerald-600 transition-colors shadow-lg">
            {/* Popular Badge */}
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
              POPULAR
            </div>

            {/* Icon */}
            <div className="mb-6 pt-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 rounded-xl">
                <Zap className="h-7 w-7 text-emerald-400" />
              </div>
            </div>

            {/* Plan name */}
            <h3 className="text-3xl font-bold text-foreground mb-2">
              Pro Plan
            </h3>
            <p className="text-foreground/70 mb-6">
              Everything you need to trade with confidence
            </p>

            {/* Price */}
            <div className="mb-8">
              <span className="text-5xl font-bold text-foreground">$50</span>
              <span className="text-foreground/70 ml-2">/month</span>
            </div>

            {/* Features */}
            <ul className="space-y-4 mb-8">
              <FeatureItem text="NQ Futures Intraday Trading Signals" />
              <FeatureItem text="15+ Years of Backtested Performance Data" />
              <FeatureItem text="Real-Time Dashboard & Sound Alerts" />
              <FeatureItem text="Equity Curves & Drawdown Analysis" />
              <FeatureItem text="Position Sizing Calculator with Risk Management" />
              <FeatureItem text="Detailed Performance Analytics & Metrics" />
              <FeatureItem text="Calendar P&L & Trade-by-Trade History" />
              <FeatureItem text="Strategy Comparison Tools" />
            </ul>

            {/* CTA Button */}
            {isSubscribed ? (
              <button
                disabled
                className="w-full bg-gray-300 text-foreground/70 px-6 py-3 rounded-lg font-semibold cursor-not-allowed"
              >
                Current Plan
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={isLoading || createCheckout.isPending}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                {isLoading || createCheckout.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Get Started"
                )}
              </button>
            )}
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-foreground/70 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Secure checkout via Stripe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-400" />
      </div>
      <span className="text-foreground/80 text-base">{text}</span>
    </li>
  );
}
