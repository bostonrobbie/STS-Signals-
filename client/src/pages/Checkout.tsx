import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { mobileTracker } from "@/lib/mobileTracking";

export default function Checkout() {
  const { loading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Get URL params
  const urlParams = new URLSearchParams(window.location.search);
  const priceId = urlParams.get("priceId");
  const interval =
    (urlParams.get("interval") as "monthly" | "yearly") || "monthly";

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) {
        // Track successful checkout initiation
        mobileTracker.trackCheckoutInitiated(user?.id.toString());
        window.location.href = data.url;
      } else {
        setError("Failed to create checkout session");
        mobileTracker.trackPaymentFailed(
          "card",
          "Failed to create checkout session",
          user?.id.toString()
        );
      }
    },
    onError: err => {
      const errorMsg = err.message || "Failed to create checkout session";
      setError(errorMsg);
      mobileTracker.trackPaymentFailed("card", errorMsg, user?.id.toString());
    },
  });

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Create checkout session for both authenticated and guest users
    if (!hasInitialized && !createCheckout.isPending && !error) {
      setHasInitialized(true);
      createCheckout.mutate({
        priceId: priceId || undefined,
        interval,
      });
    }
  }, [authLoading, hasInitialized, createCheckout.isPending, error]);

  // Track checkout abandonment on unmount
  useEffect(() => {
    return () => {
      if (!createCheckout.isSuccess && error) {
        mobileTracker.trackCheckoutAbandoned(user?.id.toString());
      }
    };
  }, [createCheckout.isSuccess, error, user?.id]);

  if (authLoading || createCheckout.isPending) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="h-10 sm:h-12 w-10 sm:w-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-sm sm:text-base text-muted-foreground">
            Redirecting to checkout...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-red-400 mb-2">
              Checkout Error
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              {error}
            </p>
            <button
              onClick={() => setLocation("/")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base font-medium transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
