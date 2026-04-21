import { useAuth } from "@/_core/hooks/useAuth";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import {
  StructuredData,
  productSchema,
  organizationSchema,
  faqSchema,
} from "@/components/StructuredData";
import { Button } from "@/components/ui/button";
import {
  Zap,
  BarChart3,
  ArrowRight,
  Target,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Shield,
  TrendingUp,
  Lock,
  Cpu,
  Menu,
  Moon,
  Sun,
  MessageSquare,
  Bell,
  Mail,
} from "lucide-react";

import { HomeEquityCurve } from "@/components/HomeEquityCurve";
import { ContactForm } from "@/components/ContactForm";
import {
  trackCTAClick,
  initTimeTracking,
  trackScrollDepth,
} from "@/lib/analytics";
import { trackFunnelStep } from "@/lib/funnelTracking";
import { useHomepageAnalytics } from "@/hooks/useHomepageAnalytics";
import { trackGACTAClick, trackGAEvent } from "@/components/GoogleAnalytics";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

// ─── CDN image URLs — clean retakes, no sidebar/preview banner ──────────────
const IMG_EQUITY_DRAWDOWN_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/equity-drawdown-dark-clean_72780038.webp";
const IMG_EQUITY_DRAWDOWN_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/equity-drawdown-light-clean_b272c047.webp";
const IMG_DAY_OF_WEEK_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/day-of-week-light-v2_902e48a4.png";
const IMG_DAY_OF_WEEK_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/day-of-week-dark-v2_bf703547.png";
const IMG_CALENDAR_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/calendar-trade-stats-light_421748de.png";
const IMG_CALENDAR_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/calendar-trade-stats-dark_c35a56f4.png";
const IMG_TRADES_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/trades-light-v2_15b4ceed.png";
const IMG_TRADES_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/trades-dark-v2_a8b888cd.png";
const IMG_STRATEGY_DETAIL_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/strategy-detail-dark-clean_720b01aa.webp";
const IMG_STRATEGY_DETAIL_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/strategy-detail-light-clean_555211b7.webp";
const IMG_RISK_ANALYSIS_DARK =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/risk-analysis-dark-clean_9609618c.webp";
const IMG_RISK_ANALYSIS_LIGHT =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/risk-analysis-light-clean_97b50407.webp";
const IMG_EMAIL_ALERT_V2 =
  "https://d2xsxph8kpxj0f.cloudfront.net/110198424/jFmY8c2b9B6TEBRxmcJws8/email-alert-screenshot_763b590c.png";

// ─── FAQ data ────────────────────────────────────────────────────────────────
const faqs = [
  {
    question: "What exactly do I get with an STS subscription?",
    answer:
      "Full access to the STS dashboard, which tracks the performance of our NQ (Nasdaq-100) futures intraday trading strategies. You get 15+ years of backtested historical data, real-time trade signal notifications, equity curves, drawdown analysis, and risk metrics — all for $50/month.",
  },
  {
    question: "Which markets do the signals cover?",
    answer:
      "STS focuses exclusively on NQ (Nasdaq-100 E-mini) futures contracts. All signals are intraday — targeting moves that typically play out within the same trading session.",
  },
  {
    question: "How are signals delivered?",
    answer:
      "All signals appear on the STS web dashboard in real time. No Telegram, Discord, or third-party software is required. Just log in from any browser on desktop or mobile. You can also enable sound alerts and email notifications from your dashboard settings.",
  },
  {
    question: "How much does it cost? Is there a free trial?",
    answer:
      "STS is $50 per month or $500 per year ($42/mo). There is no free trial. You get immediate full access to all strategies, historical data, and analytics upon subscribing. You can cancel anytime.",
  },
  {
    question: "Is STS suitable for beginners?",
    answer:
      "The dashboard is designed to be straightforward and easy to navigate. However, trading NQ futures involves significant risk and requires a funded futures brokerage account. STS provides the signals and data — it is your responsibility to understand the risks before placing any trades.",
  },
  {
    question: "How do I get support?",
    answer:
      "You can reach us via the contact form on this page or through the in-dashboard support link. We respond to inquiries as quickly as possible.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes, you can cancel anytime from your account settings. Your access continues until the end of your current billing period. All sales are final — no refunds are issued for partial billing periods.",
  },
];

// ─── Comparison data ─────────────────────────────────────────────────────────
const comparisonFeatures = [
  {
    feature: "Backtested strategies (15+ years)",
    sts: true,
    discretionary: false,
    diy: "Months of work",
  },
  {
    feature: "Real-time TradingView signals",
    sts: true,
    discretionary: false,
    diy: "Build yourself",
  },
  {
    feature: "Kelly criterion position sizing",
    sts: true,
    discretionary: false,
    diy: "Build yourself",
  },
  {
    feature: "Risk-adjusted metrics (Sharpe, Sortino)",
    sts: true,
    discretionary: false,
    diy: "Build yourself",
  },
  {
    feature: "Portfolio correlation analysis",
    sts: true,
    discretionary: false,
    diy: "Build yourself",
  },
  {
    feature: "Personal dashboard & portfolio builder",
    sts: true,
    discretionary: false,
    diy: "Build yourself",
  },
  {
    feature: "Emotion-free execution",
    sts: true,
    discretionary: false,
    diy: true,
  },
  {
    feature: "Time investment",
    sts: "Minutes/day",
    discretionary: "Hours/day",
    diy: "Months to build",
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [landingBilling, setLandingBilling] = useState<"monthly" | "yearly">(
    "yearly"
  );
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const hpAnalytics = useHomepageAnalytics();

  useEffect(() => {
    document.title = "NQ Futures Signals — $50/mo | STS Futures";
    initTimeTracking();
    trackFunnelStep("landing_view");

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY /
          (document.documentElement.scrollHeight - window.innerHeight)) *
          100
      );
      if (scrollPercent >= 25 && scrollPercent < 50) trackScrollDepth(25);
      else if (scrollPercent >= 50 && scrollPercent < 75) trackScrollDepth(50);
      else if (scrollPercent >= 75 && scrollPercent < 90) trackScrollDepth(75);
      else if (scrollPercent >= 90) trackScrollDepth(100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  trpc.platform.stats.useQuery();
  trpc.subscription.availableStrategies.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Fetch live ALL-time stats for the stats row (no timeRange = ALL)
  // Use Micro contract multiplier (0.1) to match dashboard default
  const { data: overviewData } = trpc.publicApi.overview.useQuery(
    { startingCapital: 100000, contractMultiplier: 0.1 },
    { staleTime: 10 * 60 * 1000 }
  );

  // Derive live stats row values; fall back to verified static values while loading
  // Homepage uses $10K starting capital for Micro (1 micro = 0.1x mini)
  // This gives the accurate +1,086% total return figure matching the dashboard
  const MICRO_MULTIPLIER = 0.1;
  const STARTING_CAPITAL = 10000; // $10K starting capital for Micro contracts
  const liveStats = overviewData?.metrics;

  // totalReturn from API is raw % for 1 mini contract on $100K
  // Micro dollar return = mini_pct * $100K * 0.1 (micro multiplier)
  // Micro % return on $10K starting = micro_dollar_return / $10K * 100
  const microReturnDollars = liveStats
    ? (liveStats.totalReturn / 100) * 100000 * MICRO_MULTIPLIER
    : null;
  const microReturnPct =
    microReturnDollars !== null
      ? (microReturnDollars / STARTING_CAPITAL) * 100
      : null;
  const totalReturnPct =
    microReturnPct !== null ? `+${microReturnPct.toFixed(0)}%` : "+1,085%";
  const totalReturnDollars =
    microReturnDollars !== null
      ? `+$${(microReturnDollars / 1000).toFixed(1)}K on $10K starting`
      : "+$108.4K on $10K starting";

  // Max DD: use maxDrawdownFromCurve from API (computed from full unsampled curve)
  // This matches the underwater chart exactly; sampling can miss the exact trough
  type MetricsWithDD = NonNullable<typeof overviewData>["metrics"] & {
    maxDrawdownFromCurve?: number;
  };
  const metricsAny = overviewData?.metrics as MetricsWithDD | undefined;
  const liveMaxDD =
    metricsAny?.maxDrawdownFromCurve != null
      ? metricsAny.maxDrawdownFromCurve
      : null;
  const maxDDValue =
    liveMaxDD !== null ? `-${liveMaxDD.toFixed(1)}%` : "-51.2%";
  const maxDDSub =
    liveMaxDD !== null
      ? `$${(((liveMaxDD / 100) * 100000 * MICRO_MULTIPLIER) / 1000).toFixed(1)}K peak-to-trough`
      : "$5.1K peak-to-trough";

  const sharpeValue = liveStats ? liveStats.sharpeRatio.toFixed(2) : "1.06";
  // annualizedReturn from API is already a % — no multiplier scaling needed
  const cagrSub = liveStats
    ? `${liveStats.annualizedReturn.toFixed(2)}% annualized CAGR`
    : "17.87% annualized CAGR";
  const liveKeyStats = [
    { value: totalReturnPct, label: "Total Return", sub: totalReturnDollars },
    { value: "15 Yrs", label: "Track Record", sub: "Feb 2011 to present" },
    { value: maxDDValue, label: "Max Drawdown", sub: maxDDSub, negative: true },
    { value: sharpeValue, label: "Sharpe Ratio", sub: cagrSub },
  ];

  const handleCTAClick = (location: "hero" | "pricing" | "nav" | "footer") => {
    trackCTAClick(location);
    trackGACTAClick(
      location,
      isAuthenticated ? "Go to Dashboard" : "See Live Signals"
    );
    if (!isAuthenticated) {
      trackGAEvent("begin_checkout", {
        currency: "USD",
        value: 50,
        items: [
          {
            item_id: "sts-monthly-subscription",
            item_name: "STS Futures Subscription",
            item_category: "subscription",
            price: 50,
            quantity: 1,
          },
        ],
        cta_location: location,
      });
    }
    if (!isAuthenticated) {
      window.location.href = "/pricing";
    } else {
      const tier = user?.subscriptionTier?.toLowerCase();
      const entitled =
        tier === "pro" || tier === "premium" || user?.role === "admin";
      window.location.href = entitled ? "/overview" : "/checkout";
    }
  };

  return (
    <>
      <SEOHead {...SEO_CONFIG.home} />
      <StructuredData id="product" data={productSchema} />
      <StructuredData id="organization" data={organizationSchema} />
      <StructuredData id="faq" data={faqSchema} />

      <div className="min-h-screen bg-background" role="main">
        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="container flex items-center justify-between h-16 px-4">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <img
                  src="https://files.manuscdn.com/user_upload_by_module/session_file/110198424/sLgasntqXJoSfWmA.png"
                  alt="STS"
                  className="w-9 h-9"
                />
                <span className="text-xl font-bold text-foreground tracking-tight">
                  STS
                </span>
                <span className="hidden sm:inline text-[10px] text-emerald-400/80 font-medium tracking-wider uppercase">
                  Futures
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  toggleTheme?.();
                  hpAnalytics.trackThemeToggle(
                    theme === "dark" ? "light" : "dark"
                  );
                }}
                className="border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Moon className="h-5 w-5 text-emerald-600" />
                )}
              </Button>
              <ContactForm
                trigger={
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact
                  </Button>
                }
              />
              {isAuthenticated ? (
                <Button
                  onClick={() => (window.location.href = "/overview")}
                  className="bg-emerald-500 hover:bg-emerald-600 text-foreground"
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => (window.location.href = getLoginUrl())}
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Sign In
                  </Button>
                  <Button
                    onClick={() => handleCTAClick("nav")}
                    className="bg-emerald-500 hover:bg-emerald-600 text-foreground"
                  >
                    See Live Signals <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden bg-background/95 backdrop-blur-lg border-b border-border">
              <div className="container px-4 py-4 flex flex-col gap-3">
                <Button
                  variant="outline"
                  onClick={toggleTheme}
                  className="w-full border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="h-5 w-5 text-emerald-400 mr-2" /> Light
                      Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5 text-emerald-600 mr-2" /> Dark
                      Mode
                    </>
                  )}
                </Button>
                <ContactForm
                  trigger={
                    <Button
                      variant="outline"
                      className="w-full border-emerald-500/30 text-muted-foreground hover:text-foreground hover:bg-emerald-500/10"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Contact Us
                    </Button>
                  }
                />
                {isAuthenticated ? (
                  <Button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      window.location.href = "/overview";
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-foreground"
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        window.location.href = getLoginUrl();
                      }}
                      variant="ghost"
                      className="w-full text-muted-foreground hover:text-foreground"
                    >
                      Sign In
                    </Button>
                    <Button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleCTAClick("nav");
                      }}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-foreground"
                    >
                      See Live Signals <ArrowRight className="ml-1 w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <header
          data-track-section="hero"
          className="relative pt-24 pb-10 px-4 sm:pt-32 sm:pb-16 md:pt-40 md:pb-20 overflow-hidden"
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <div className="container max-w-4xl mx-auto text-center">
            {/* Pill badge */}
            <div className="mb-5 inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-medium text-emerald-400">
                Live NQ Futures Signals
              </span>
            </div>

            {/* H1 — outcome-led */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-5 leading-tight tracking-tight">
              <span className="block">NQ Futures Signals</span>
              <span className="block text-emerald-400">
                Returned {totalReturnPct}
              </span>
              <span className="block">Over 15 Years</span>
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg md:text-xl text-foreground/75 mb-8 max-w-2xl mx-auto leading-relaxed">
              Every trade. Every win and loss. 15 years of transparent data, all
              on one dashboard. Real-time alerts when the algo fires. No
              Discord. No guesswork.
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
              {isAuthenticated ? (
                <Button
                  onClick={() => (window.location.href = "/overview")}
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald-500/20"
                >
                  Go to Dashboard
                </Button>
              ) : (
                <Button
                  onClick={() => handleCTAClick("hero")}
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald-500/20"
                >
                  See Live Signals - $50/mo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              )}
            </div>
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground">
                No contracts &middot; Cancel anytime &middot; Instant access
              </p>
            )}
          </div>

          {/* ── STATS ROW ── */}
          <div className="container max-w-4xl mx-auto mt-10 sm:mt-14">
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-border rounded-2xl overflow-hidden bg-card/80 backdrop-blur shadow-lg">
              {liveKeyStats.map((stat, i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center px-3 py-4 sm:px-4 sm:py-6 text-center ${
                    i > 0 ? "border-l border-border" : ""
                  } ${i >= 2 ? "border-t sm:border-t-0 border-border" : ""}`}
                >
                  <p
                    className={`text-2xl sm:text-3xl font-extrabold tracking-tight leading-none ${"negative" in stat && stat.negative ? "text-amber-400" : "text-emerald-400"}`}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[11px] font-semibold text-foreground uppercase tracking-widest mt-1.5">
                    {stat.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── EQUITY CURVE (live interactive) ── */}
          <div className="container max-w-5xl mx-auto mt-8 sm:mt-12">
            <div className="bg-card rounded-xl border border-border p-3 sm:p-5 shadow-xl shadow-black/20">
              <HomeEquityCurve />
            </div>
          </div>
        </header>

        {/* ── TRUST BAR ───────────────────────────────────────────────────── */}
        <section
          data-track-section="social-proof"
          className="py-8 px-4 border-y border-border bg-muted/30"
        >
          <div className="container max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 items-center text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Secure checkout via Stripe</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Quant-driven, no discretion</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>Real-time signal alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Full trade history since 2011</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── DASHBOARD PREVIEW ───────────────────────────────────────────── */}
        <section
          id="preview"
          data-track-section="preview"
          className="py-16 sm:py-24 px-4"
        >
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                Inside The Dashboard
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3">
                See Exactly What You Get
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
                No guessing. Here's what your dashboard looks like from day one.
              </p>
            </div>

            {/* Feature 1: Full dashboard overview */}
            <div className="mb-12 sm:mb-20">
              <div className="rounded-xl overflow-hidden border border-border shadow-2xl shadow-black/30">
                <img
                  src={
                    isDark
                      ? IMG_EQUITY_DRAWDOWN_DARK
                      : IMG_EQUITY_DRAWDOWN_LIGHT
                  }
                  alt="STS Futures dashboard showing equity curve, underwater drawdown chart, current positions, and recent alerts panel"
                  className="w-full h-auto max-h-[60vh] sm:max-h-none object-cover object-top"
                  loading="lazy"
                />
              </div>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: TrendingUp,
                    title: "Live Equity Curve",
                    desc: "Tracks every dollar in real time. Zoom from 6 months to the full 15-year history.",
                  },
                  {
                    icon: BarChart3,
                    title: "Risk Metrics at a Glance",
                    desc: "Sharpe, Sortino, Calmar, win rate, and max drawdown — all updated automatically.",
                  },
                  {
                    icon: Target,
                    title: "Day-of-Week Breakdown",
                    desc: "See which days make the most money and how win rates vary across the trading week.",
                  },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={i}
                      className="bg-card rounded-lg border border-border p-5"
                    >
                      <Icon className="w-6 h-6 text-emerald-400 mb-3" />
                      <h4 className="font-semibold text-foreground mb-1">
                        {item.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feature 2: Real-Time Signal Alerts */}
            <div className="mb-12 sm:mb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <Bell className="w-3.5 h-3.5" />
                    Real-Time Alerts
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    Know the Moment the Algo Fires
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Every signal is logged the instant TradingView fires it. You
                    see the symbol, direction, entry price, P&amp;L, and
                    timestamp — and an email lands in your inbox within seconds.
                    No Discord. No Telegram. No missed messages.
                  </p>
                  <div className="space-y-2">
                    {[
                      "Instant email on every entry and exit",
                      "Full signal log with P&L and timestamps",
                      "Powered by TradingView webhooks",
                    ].map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20 bg-slate-200 dark:bg-slate-700 p-4 flex justify-center">
                  <img
                    src={IMG_EMAIL_ALERT_V2}
                    alt="STS trade alert email showing LONG EXIT with P&L, entry price, exit price, duration, and timestamp"
                    className="w-full max-w-sm h-auto rounded-lg shadow-md"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            {/* Feature 3: Email alert + Trades side by side */}
            <div className="mb-12 sm:mb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
                {/* Email alert */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <Mail className="w-3.5 h-3.5" />
                    Email Alerts
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    Instant Email Notifications
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Every trade entry and exit triggers an instant email alert.
                    You get the symbol, direction, contracts, entry/exit price,
                    P&amp;L, duration, and time — delivered straight to your
                    inbox so you never miss a signal.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20">
                    <img
                      src={
                        isDark
                          ? IMG_STRATEGY_DETAIL_DARK
                          : IMG_STRATEGY_DETAIL_LIGHT
                      }
                      alt="NQ Triple Variant strategy detail showing detailed performance statistics, Kelly Criterion analysis, and equity curve vs S&P 500"
                      className="w-full h-auto max-h-[50vh] sm:max-h-none object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
                {/* Trades section */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Trade History
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    Every Trade, Fully Transparent
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Browse the complete trade log — entry date, exit date,
                    direction, entry price, exit price, P&amp;L, and P&amp;L
                    percentage. Filter by date range or export to CSV. No
                    cherry-picking, no hidden losses.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20">
                    <img
                      src={isDark ? IMG_TRADES_DARK : IMG_TRADES_LIGHT}
                      alt="STS Futures dashboard trades section showing recent trades table with entry/exit dates, direction, prices, and P&L"
                      className="w-full h-auto max-h-[60vh] sm:max-h-none object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 4: Day-of-week + Yearly heatmap side by side */}
            <div className="mb-12 sm:mb-20">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <Zap className="w-3.5 h-3.5" />
                    Day-of-Week Performance
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    Know Your Best Days
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Thursday and Friday are the strongest days, each averaging
                    +$20 per trade with a 45-46% win rate. The dashboard shows
                    you exactly when the edge is sharpest so you can plan around
                    it.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20">
                    <img
                      src={
                        isDark ? IMG_DAY_OF_WEEK_DARK : IMG_DAY_OF_WEEK_LIGHT
                      }
                      alt="Day-of-Week Performance showing average P&L and win rate by trading day"
                      className="w-full h-auto max-h-[50vh] sm:max-h-none object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Yearly P&amp;L Calendar
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    15 Years of Transparent Results
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Every year laid out in full. From $1.5K in 2011 to $44.9K in
                    2025, the calendar shows you exactly how each year performed
                    with no cherry-picking.
                  </p>
                  <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20">
                    <img
                      src={isDark ? IMG_CALENDAR_DARK : IMG_CALENDAR_LIGHT}
                      alt="Calendar P&L showing yearly performance heatmap and Trade & Risk Statistics"
                      className="w-full h-auto max-h-[50vh] sm:max-h-none object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 5: Trade & Risk Statistics */}
            <div className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                <div className="order-2 lg:order-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold mb-4">
                    <Cpu className="w-3.5 h-3.5" />
                    Performance Metrics
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3">
                    Every Metric at a Glance
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Total return, annualized CAGR, Sharpe ratio, win rate, and
                    max drawdown are all computed from the full trade history
                    and updated in real time as new signals come in.
                  </p>
                  <div className="mt-4 space-y-2">
                    {[
                      "Sortino, Sharpe, Calmar ratios at a glance",
                      "Win rate and total return updated in real time",
                      "Micro or Mini contract sizing",
                    ].map((t, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="rounded-xl overflow-hidden border border-border shadow-xl shadow-black/20">
                    <img
                      src={
                        isDark
                          ? IMG_RISK_ANALYSIS_DARK
                          : IMG_RISK_ANALYSIS_LIGHT
                      }
                      alt="Trade & Risk Statistics Risk Analysis tab showing payoff ratio, Kelly %, risk of ruin, recovery factor, MAR ratio, and Ulcer Index"
                      className="w-full h-auto max-h-[50vh] sm:max-h-none object-cover object-top"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mid-page CTA */}
            <div className="text-center mt-14">
              <Button
                onClick={() => handleCTAClick("pricing")}
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald-500/20"
              >
                {isAuthenticated
                  ? "Go to Dashboard"
                  : "Get Full Access — $50/mo"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              {!isAuthenticated && (
                <p className="text-xs text-muted-foreground mt-3">
                  No contracts · Cancel anytime · Instant access
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
        <section
          id="features"
          data-track-section="features"
          className="py-16 sm:py-24 px-4 bg-muted/30 border-y border-border"
        >
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-2">
                Simple Process
              </p>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
                How It Works
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
                From sign-up to your first signal in under 5 minutes
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-16">
              {[
                {
                  step: "01",
                  title: "Subscribe",
                  description:
                    "No downloads. No complicated setup. Subscribe, log in, and your full trading command center is ready immediately.",
                },
                {
                  step: "02",
                  title: "Review the Track Record",
                  description:
                    "15 years of real trades. Every win. Every loss. Full transparency so you can trade with confidence, not hope.",
                },
                {
                  step: "03",
                  title: "Trade with Clarity",
                  description:
                    "Get real-time alerts with exact entry, stop, and target levels. No guesswork. Just execute.",
                },
              ].map((item, idx) => (
                <div key={idx} className="relative group">
                  <div className="bg-card rounded-2xl p-6 sm:p-7 border border-border h-full hover:border-emerald-500/30 transition-colors duration-200">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-4xl font-black text-emerald-500/20 leading-none select-none">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  {idx < 2 && (
                    <div className="hidden md:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                      <ArrowRight className="w-5 h-5 text-emerald-500/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Why STS — differentiators */}
            <div className="mt-2">
              <div className="text-center mb-8">
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-2">
                  Why STS
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                  Built Different
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Lock,
                    title: "No Discord. No Telegram.",
                    description:
                      "Everything lives in one clean web dashboard. No noise, no group chats, no missed messages.",
                  },
                  {
                    icon: Shield,
                    title: "15 Years of Auditable Data",
                    description:
                      "Every trade from 2010 to today is in the database. Filter, export, verify — nothing is hidden.",
                  },
                  {
                    icon: Bell,
                    title: "Alerts You Can Act On",
                    description:
                      "Email alerts include entry price, stop, target, and P&L. You get exactly what you need to execute.",
                  },
                ].map((feature, idx) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={idx}
                      className="group bg-card rounded-2xl p-5 border border-border hover:border-emerald-500/30 hover:shadow-sm transition-all duration-200 flex gap-4 items-start"
                    >
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mt-0.5">
                        <Icon className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground text-sm mb-1">
                          {feature.title}
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ─────────────────────────────────────────────────────── */}
        <section
          id="pricing"
          data-track-section="pricing"
          className="py-16 sm:py-24 px-4"
        >
          <div className="container max-w-4xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
                Simple, Transparent Pricing
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground">
                One plan. Everything included. No hidden fees.
              </p>
            </div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(["monthly", "yearly"] as const).map(plan => (
                <button
                  key={plan}
                  onClick={() => {
                    setLandingBilling(plan);
                    hpAnalytics.trackPricingToggle(plan);
                  }}
                  className={`text-sm font-medium px-5 py-2 rounded-full transition-all ${
                    landingBilling === plan
                      ? "bg-emerald-500 text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {plan === "monthly" ? (
                    "Monthly"
                  ) : (
                    <>
                      Annual{" "}
                      <span className="text-xs font-bold text-emerald-400 ml-1">
                        Save 17%
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>

            {/* Pricing card */}
            <div className="relative bg-gradient-to-br from-card to-muted rounded-2xl border border-emerald-500/30 p-6 sm:p-10 max-w-md mx-auto shadow-2xl shadow-emerald-500/5">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-emerald-500 text-foreground text-xs font-bold px-5 py-1.5 rounded-full shadow-lg">
                  MOST POPULAR
                </span>
              </div>

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Professional Plan
                </h3>
                {landingBilling === "yearly" ? (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-xl line-through text-muted-foreground">
                        $50
                      </span>
                      <span className="text-5xl font-bold text-foreground">
                        $42
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-emerald-400 mt-2">
                      $500/year · Billed annually
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-foreground">
                        $50
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Billed monthly
                    </p>
                  </>
                )}
              </div>

              <div className="space-y-3.5 mb-8">
                {[
                  "Real-time NQ futures trading signals",
                  "Full access to STS web dashboard",
                  "15+ years of backtested trade history",
                  "Risk metrics: Sharpe, Sortino, Calmar, drawdown",
                  "Day-of-week & monthly P&L breakdowns",
                  "All updates and new strategies included",
                  "Email support & onboarding guide",
                ].map((feat, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/80 text-sm">{feat}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => handleCTAClick("pricing")}
                size="lg"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-foreground py-6 text-lg font-semibold mb-6 shadow-lg shadow-emerald-500/20"
              >
                {isAuthenticated ? "Go to Dashboard" : "Subscribe Now"}
              </Button>

              <div className="space-y-2.5 text-center text-sm text-muted-foreground border-t border-border pt-6">
                <p>✓ Cancel anytime, no questions asked</p>
                <p>✓ Secure 256-bit encrypted checkout via Stripe</p>
                <p>✓ Instant access to all features</p>
              </div>
            </div>

            <p className="text-center mt-6 text-sm text-muted-foreground">
              We accept all major credit cards · Powered by Stripe
            </p>
          </div>
        </section>

        {/* ── COMPARISON ──────────────────────────────────────────────────── */}
        <section
          id="compare"
          data-track-section="compare"
          className="py-16 sm:py-24 px-4 bg-muted/30 border-y border-border"
        >
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                Compare
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mt-2 mb-3">
                STS vs. the alternatives
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground">
                See how we stack up.
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-4 px-5 text-muted-foreground font-semibold">
                      Feature
                    </th>
                    <th className="text-center py-4 px-5 text-emerald-400 font-semibold">
                      STS
                    </th>
                    <th className="text-center py-4 px-5 text-muted-foreground font-semibold">
                      Discretionary
                    </th>
                    <th className="text-center py-4 px-5 text-muted-foreground font-semibold">
                      DIY
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-border ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
                      <td className="py-3.5 px-5 text-foreground/80 text-sm">
                        {item.feature}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {item.sts === true ? (
                          <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {item.sts}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {item.discretionary === true ? (
                          <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        {item.diy === true ? (
                          <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                        ) : typeof item.diy === "string" ? (
                          <span className="text-muted-foreground text-sm">
                            {item.diy}
                          </span>
                        ) : (
                          <X className="w-5 h-5 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3">
              {comparisonFeatures.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-xl p-4 bg-card"
                >
                  <p className="text-sm font-semibold text-foreground mb-3">
                    {item.feature}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-emerald-400 font-medium mb-1">
                        STS
                      </p>
                      {item.sts === true ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.sts}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        Discretionary
                      </p>
                      {item.discretionary === true ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">
                        DIY
                      </p>
                      {item.diy === true ? (
                        <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : typeof item.diy === "string" ? (
                        <span className="text-xs text-muted-foreground">
                          {item.diy}
                        </span>
                      ) : (
                        <X className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section
          id="faq"
          data-track-section="faq"
          className="py-16 sm:py-24 px-4"
        >
          <div className="container max-w-3xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
                Frequently Asked Questions
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground">
                Everything you need to know about STS
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => {
                      const action = openFaq === idx ? "collapse" : "expand";
                      setOpenFaq(openFaq === idx ? null : idx);
                      hpAnalytics.trackFAQInteraction(
                        idx,
                        faq.question,
                        action
                      );
                    }}
                    className="w-full px-5 sm:px-6 py-4 flex items-center justify-between hover:bg-accent transition-colors text-left"
                  >
                    <span className="font-semibold text-foreground text-sm sm:text-base pr-4">
                      {faq.question}
                    </span>
                    {openFaq === idx ? (
                      <ChevronUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  {openFaq === idx && (
                    <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/50">
                      <p className="text-foreground/80 leading-relaxed text-sm sm:text-base">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <p className="text-muted-foreground mb-4 text-sm">
                Still have questions?
              </p>
              <ContactForm
                trigger={
                  <Button
                    variant="outline"
                    className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Us
                  </Button>
                }
              />
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
        <section
          data-track-section="final-cta"
          className="py-16 sm:py-24 px-4 bg-gradient-to-b from-transparent to-card border-t border-border"
        >
          <div className="container max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to trade smarter?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join traders who've replaced guesswork with proven, algorithmic
              signals backed by 15 years of data.
            </p>
            <Button
              onClick={() => handleCTAClick("footer")}
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-foreground px-8 py-6 text-lg font-semibold shadow-lg shadow-emerald-500/20"
            >
              {isAuthenticated ? "Go to Dashboard" : "Subscribe Now — $50/mo"}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground mt-3">
                No contracts · Cancel anytime · Instant access
              </p>
            )}
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-muted py-12 px-4 pb-24 md:pb-12">
          <div className="container max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src="https://files.manuscdn.com/user_upload_by_module/session_file/110198424/sLgasntqXJoSfWmA.png"
                    alt="STS"
                    className="w-6 h-6"
                  />
                  <span className="font-bold text-foreground">STS Futures</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Real-time NQ futures trading signals powered by algorithmic
                  analysis.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="#preview"
                      className="hover:text-foreground transition-colors"
                    >
                      Dashboard Preview
                    </a>
                  </li>
                  <li>
                    <a
                      href="#features"
                      className="hover:text-foreground transition-colors"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="hover:text-foreground transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="hover:text-foreground transition-colors"
                    >
                      FAQ
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="/terms"
                      className="hover:text-foreground transition-colors"
                    >
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a
                      href="/privacy"
                      className="hover:text-foreground transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/refund-policy"
                      className="hover:text-foreground transition-colors"
                    >
                      Cancellation Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/disclaimer"
                      className="hover:text-foreground transition-colors"
                    >
                      Disclaimer
                    </a>
                  </li>
                  <li>
                    <a
                      href="/risk-disclosure"
                      className="hover:text-foreground transition-colors"
                    >
                      Risk Disclosure
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Support</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="#faq"
                      className="hover:text-foreground transition-colors"
                    >
                      Help Center
                    </a>
                  </li>
                  <li>
                    <ContactForm
                      trigger={
                        <button className="hover:text-foreground transition-colors text-sm text-muted-foreground text-left">
                          Email Support
                        </button>
                      }
                      defaultCategory="support"
                    />
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
              <p>© 2026 STS Futures. All rights reserved.</p>
              <p className="mt-2 text-xs">
                Past performance is not indicative of future results. Trading
                involves substantial risk of loss.
              </p>
            </div>
          </div>
        </footer>

        {/* ── STICKY MOBILE CTA ───────────────────────────────────────────── */}
        {!isAuthenticated && (
          <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-sm border-t border-emerald-500/30 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                STS Futures Pro
              </p>
              <p className="text-xs text-muted-foreground">
                $50/mo · Cancel anytime
              </p>
            </div>
            <Button
              onClick={() => handleCTAClick("footer")}
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-foreground font-semibold px-5 shrink-0"
            >
              Subscribe <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
