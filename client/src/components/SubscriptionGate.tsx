import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Check, Crown, Loader2 } from "lucide-react";

interface SubscriptionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const STRIPE_PRICE_IDS = {
  pro_monthly: "price_1SjfvXLQsJRtPDrZBEMq9bWX",
  pro_yearly: "price_1SjfwvLQsJRtPDrZT0dxyReY",
};

export function SubscriptionGate({
  children,
  fallback,
}: SubscriptionGateProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: subscription, isLoading: subLoading } =
    trpc.stripe.getSubscription.useQuery(undefined, { enabled: !!user });

  // Still loading
  if (authLoading || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Check if user has an active pro subscription
  const hasActiveSubscription =
    subscription?.tier === "pro" && subscription?.status === "active";

  // Admin users always have access
  const isAdmin = user?.role === "admin";

  if (hasActiveSubscription || isAdmin) {
    return <>{children}</>;
  }

  // Show upgrade prompt
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full bg-slate-900/50 border-slate-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl text-white">
            Upgrade to STS Pro
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Unlock full access to the dashboard, all strategies, and real-time
            signals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {[
              "Full historical data (14+ years)",
              "Real-time TradingView signals",
              "All strategies included",
              "Portfolio customization tools",
              "Advanced analytics & metrics",
              "Lock in your rate forever",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-3">
            <Link
              href={`/checkout?priceId=${STRIPE_PRICE_IDS.pro_monthly}&interval=monthly`}
            >
              <Button className="w-full bg-emerald-600 hover:bg-emerald-500 h-12">
                <span className="font-semibold">
                  Subscribe Monthly - $50/mo
                </span>
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cancel anytime. All sales are final.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const { data: subscription, isLoading } =
    trpc.stripe.getSubscription.useQuery(undefined, { enabled: !!user });

  const hasActiveSubscription =
    subscription?.tier === "pro" && subscription?.status === "active";

  const isAdmin = user?.role === "admin";

  return {
    isLoading,
    hasAccess: hasActiveSubscription || isAdmin,
    subscription,
    isAdmin,
  };
}
