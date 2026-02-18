import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Zap, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout...", {
          description: "Complete your payment in the new tab",
        });
      }
      setLoading(false);
    },
    onError: error => {
      toast.error("Failed to start checkout", {
        description: error.message,
      });
      setLoading(false);
    },
  });

  const handleSubscribe = () => {
    setLoading(true);
    createCheckout.mutate({
      interval: "monthly",
    });
  };

  const currentTier = user?.subscriptionTier || "free";
  const isCurrentPlan = currentTier === "pro";

  const features = [
    "NQ futures intraday trading signals",
    "15+ years of backtested performance data",
    "Real-time dashboard & sound alerts",
    "Equity curves & drawdown analysis",
    "Position sizing calculator with risk management",
    "Detailed performance analytics & metrics",
    "Calendar P&L & trade-by-trade history",
    "Strategy comparison tools",
    "Cancel anytime",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/50">
        <div className="container py-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero */}
      <div className="container py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          One plan, full access to everything. No hidden fees, no upsells.
        </p>
      </div>

      {/* Pricing Card */}
      <div className="container pb-24">
        <div className="flex justify-center max-w-6xl mx-auto">
          <Card className="relative flex flex-col max-w-md w-full border-primary shadow-lg shadow-primary/10">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">STS Dashboard</CardTitle>
              <CardDescription>
                Full access to all NQ futures trading signals and analytics
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <div className="text-center mb-6">
                <span className="text-4xl font-bold">$50</span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-3">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                disabled={(user && isCurrentPlan) || loading}
                onClick={handleSubscribe}
              >
                {loading
                  ? "Processing..."
                  : user && isCurrentPlan
                    ? "Current Plan"
                    : "Subscribe Now"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="p-6 rounded-lg bg-card border border-border/50">
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground text-sm">
                Yes, you can cancel your subscription at any time. You'll
                continue to have access until the end of your billing period.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-card border border-border/50">
              <h3 className="font-semibold mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-muted-foreground text-sm">
                We accept all major credit cards (Visa, Mastercard, American
                Express) through our secure Stripe payment processor.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-card border border-border/50">
              <h3 className="font-semibold mb-2">Is there a refund policy?</h3>
              <p className="text-muted-foreground text-sm">
                All sales are final. You can cancel your subscription at any
                time, and you'll continue to have access until the end of your
                billing period.
              </p>
            </div>
            <div className="p-6 rounded-lg bg-card border border-border/50">
              <h3 className="font-semibold mb-2">
                What do I get with my subscription?
              </h3>
              <p className="text-muted-foreground text-sm">
                Full access to the STS dashboard including real-time NQ futures
                trading signals, 15+ years of historical data, advanced
                analytics and risk metrics, portfolio tools, and email support.
              </p>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-8 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Secure payments</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-sm">Instant access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
