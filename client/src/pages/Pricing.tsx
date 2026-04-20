import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { SEOStructured } from "@/components/SEOStructured";
import { trackFunnelStep } from "@/lib/funnelTracking";
import { trackGACTAClick } from "@/components/GoogleAnalytics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Check,
  Zap,
  ArrowLeft,
  CreditCard,
  UserPlus,
  BarChart3,
  ShieldCheck,
  Lock as LockIcon,
  RotateCcw,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const createCheckout = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) {
        window.location.href = data.url;
        toast.success("Redirecting to checkout...", {
          description: "You are being redirected to the secure checkout page.",
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
    trackFunnelStep("checkout_view");
    trackGACTAClick("pricing_page", "Subscribe Now");
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
      <SEOHead {...SEO_CONFIG.pricing} />
      <SEOStructured
        path="/pricing"
        title="Pricing — STS Futures NQ Signals"
        description="Single-tier $50/month subscription. Cancel anytime. 15-day money-back guarantee. All signals, 15-year backtest history, full analytics."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Pricing", url: "/pricing" },
        ]}
        productOffer={{
          name: "STS Futures — NQ Trading Signals Subscription",
          price: 50,
          currency: "USD",
          sku: "sts-monthly",
        }}
        faqs={[
          {
            q: "How much does STS Futures cost?",
            a: "$50 per month. Single tier with full access to all signals, 15-year trade history, equity curve analytics, and real-time alerts. Cancel anytime — access continues until the end of the current billing period.",
          },
          {
            q: "Is there a free trial?",
            a: "There is no free trial, but every new subscription carries a 15-day money-back guarantee. If the strategy has not fired a signal you could act on within 15 days, email support for a full refund.",
          },
          {
            q: "Can I cancel anytime?",
            a: "Yes. Cancellation is self-service in your account settings — takes effect at the end of the current billing period with no cancellation fees or retention calls.",
          },
          {
            q: "What payment methods do you accept?",
            a: "All payments are processed securely by Stripe. Visa, Mastercard, American Express, and Discover are accepted. No banking or card data ever touches STS Futures servers.",
          },
          {
            q: "What's included in the subscription?",
            a: "Real-time NQ trading signals on the web dashboard, email notifications for every signal, complete 15-year trade history (7,960 trades), equity curve and drawdown analytics, Sharpe/Sortino/Calmar metrics, calendar P&L, position-sizing calculator, and optional broker auto-execution via IBKR, Tradovate, or TradeStation.",
          },
          {
            q: "Is STS Futures regulated?",
            a: "STS Futures publishes educational content and systematic trading signals but is not a registered investment advisor and does not manage customer funds. Subscribers trade their own brokerage accounts and are responsible for their own risk management decisions.",
          },
        ]}
      />
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
              <div className="text-center mb-2">
                <span className="text-4xl font-bold">$50</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <div className="text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-6 inline-flex items-center gap-1.5 justify-center w-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                15-day money-back guarantee
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

            <CardFooter className="flex-col gap-3">
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
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground w-full pt-1">
                <span className="inline-flex items-center gap-1">
                  <LockIcon className="h-3 w-3" /> Stripe Secure
                </span>
                <span className="inline-flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Cancel Anytime
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> 15-yr Verified Track Record
                </span>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* How It Works */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2">How It Works</h2>
          <p className="text-center text-muted-foreground mb-10">
            From sign-up to your first NQ trading signals in under 5 minutes
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Step <span>1</span>
              </span>
              <h3 className="font-semibold text-foreground mb-2">Subscribe</h3>
              <p className="text-sm text-muted-foreground">
                No account needed to start. Subscribe with any major credit card
                through Stripe's secure checkout.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Step <span>2</span>
              </span>
              <h3 className="font-semibold text-foreground mb-2">
                Create Account
              </h3>
              <p className="text-sm text-muted-foreground">
                After payment, create your account. Your subscription is
                automatically linked to your email — no manual activation
                needed.
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Step <span>3</span>
              </span>
              <h3 className="font-semibold text-foreground mb-2">
                Access Dashboard
              </h3>
              <p className="text-sm text-muted-foreground">
                Log in and get immediate full access to NQ trading signals, 15+
                years of trade history, and all analytics tools.
              </p>
            </div>
          </div>
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
