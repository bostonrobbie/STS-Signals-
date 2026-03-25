import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ArrowRight,
  Bell,
  Link2,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { mobileTracker } from "@/lib/mobileTracking";
import { trackGAConversion, trackGAEvent } from "@/components/GoogleAnalytics";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/");
    }
  }, [user, loading, setLocation]);

  // Track successful payment completion
  useEffect(() => {
    if (user && !loading) {
      // Detect payment method from URL or session storage
      const paymentMethod = (sessionStorage.getItem("paymentMethod") ||
        "card") as "card" | "apple_pay" | "google_pay";

      mobileTracker.trackPaymentCompleted(
        paymentMethod,
        50, // Pro tier monthly price
        "USD",
        user.id.toString()
      );

      // Fire GA4 purchase conversion event
      trackGAConversion(50, "USD", `sub_${user.id}_${Date.now()}`);
      trackGAEvent("purchase", {
        transaction_id: `sub_${user.id}_${Date.now()}`,
        value: 50,
        currency: "USD",
        items: [
          {
            item_id: "pro_monthly",
            item_name: "STS Futures Pro — Monthly",
            price: 50,
            quantity: 1,
          },
        ],
      });

      // Clear payment method from session
      sessionStorage.removeItem("paymentMethod");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const nextSteps = [
    {
      icon: BarChart3,
      title: "Select Your Strategies",
      description:
        "Choose between our NQ Trend strategy variants: unleveraged (fixed contracts) or leveraged (% equity scaling).",
      action: "Go to My Dashboard",
      href: "/my-dashboard",
    },
    {
      icon: Link2,
      title: "Connect Your Broker",
      description:
        "Link your Tradovate or IBKR account for automated trade execution.",
      action: "Connect Broker",
      href: "/admin?tab=brokers",
    },
    {
      icon: Bell,
      title: "Set Up Notifications",
      description:
        "Configure email and push notifications for trade signals and alerts.",
      action: "Configure Alerts",
      href: "/my-dashboard?tab=notifications",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        {/* Success Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-emerald-500/20 mb-6">
            <CheckCircle2 className="h-8 sm:h-10 w-8 sm:w-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
            Welcome to IntraDay Strategies!
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            Your Pro subscription is now active. You have full access to all
            trading strategies, real-time signals, and broker integrations.
          </p>
        </div>

        {/* Next Steps */}
        <div className="mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">
            Get Started in 3 Steps
          </h2>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {nextSteps.map((step, index) => (
              <Card
                key={index}
                className="bg-slate-800/50 border-slate-700/50 hover:border-emerald-500/30 transition-colors"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <step.icon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-emerald-400">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mb-4">
                    {step.description}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(step.href)}
                    className="w-full border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                  >
                    {step.action}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Access */}
        <div className="text-center mb-12">
          <Button
            size="lg"
            onClick={() => setLocation("/my-dashboard")}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg shadow-lg shadow-emerald-500/25"
          >
            Go to My Dashboard
            <ArrowRight className="ml-2 h-4 sm:h-5 w-4 sm:w-5" />
          </Button>
        </div>

        {/* Risk Disclaimer */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 sm:h-6 w-5 sm:w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-amber-400 mb-2">
                  Important Risk Disclosure
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Trading futures and other financial instruments involves
                  substantial risk of loss and is not suitable for all
                  investors.
                  <strong className="text-white">
                    {" "}
                    Past performance is not indicative of future results.
                  </strong>{" "}
                  The performance data shown is based on backtested results and
                  may not reflect actual trading conditions. You should
                  carefully consider whether trading is appropriate for you in
                  light of your financial condition. Never trade with money you
                  cannot afford to lose.
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-3">
                  By using this service, you acknowledge that you have read and
                  understood the risks involved in trading.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Info */}
        <div className="text-center mt-8">
          <p className="text-xs sm:text-sm text-slate-500">
            Need help getting started? Check out our{" "}
            <a
              href="/#faq"
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              FAQ
            </a>{" "}
            or contact support.
          </p>
        </div>
      </div>
    </div>
  );
}
