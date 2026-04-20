import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ContractSizeProvider } from "./contexts/ContractSizeContext";
import { TradeNotificationProvider } from "./contexts/TradeNotificationContext";
import { AccountValueProvider } from "./contexts/AccountValueContext";
import DashboardLayout from "./components/DashboardLayout";
import { CookieConsent } from "./components/CookieConsent";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { captureTrafficSource } from "./lib/trafficCapture";
import { initTimeTracking } from "./lib/analytics";
import { Loader2 } from "lucide-react";
// import { useAuth } from "@/contexts/AuthContext";

// Lazy load page components for better initial load performance
const Overview = lazy(() => import("./pages/Overview"));
const StrategyDetail = lazy(() => import("./pages/StrategyDetail"));
const StrategyComparison = lazy(() => import("./pages/StrategyComparison"));
// @ts-expect-error TS6133 unused lazy import
const _Strategies = lazy(() => import("./pages/Strategies"));
const Admin = lazy(() => import("./pages/Admin"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Login = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Billing = lazy(() => import("./pages/Billing"));
const UserPreferences = lazy(() => import("./pages/UserPreferences"));
const ContactMessages = lazy(() => import("./pages/admin/ContactMessages"));
const PasswordLogin = lazy(() => import("./pages/PasswordLogin"));
const PasswordSignup = lazy(() => import("./pages/PasswordSignup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const Disclaimer = lazy(() => import("./pages/Disclaimer"));
const RiskDisclosure = lazy(() => import("./pages/RiskDisclosure"));
// QADashboard available for future use
// const QADashboard = lazy(() => import("./pages/QADashboard"));
const FAQ = lazy(() => import("./pages/FAQ"));
const About = lazy(() => import("./pages/About"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const BusinessDashboard = lazy(
  () => import("./pages/admin/BusinessDashboard")
);
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const CompareSignalStack = lazy(
  () => import("./pages/compare/SignalStack")
);
const CompareTradersPost = lazy(
  () => import("./pages/compare/TradersPost")
);
const CompareGeneric = lazy(() => import("./pages/compare/Generic"));
const ImportTrades = lazy(() => import("./pages/admin/ImportTrades"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route
          path="/"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <LandingPage />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/landing"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <LandingPage />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/login"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Login />
            </Suspense>
          )}
        />

        <Route
          path="/password-login"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <PasswordLogin />
            </Suspense>
          )}
        />

        <Route
          path="/password-signup"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <PasswordSignup />
            </Suspense>
          )}
        />

        <Route
          path="/forgot-password"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <ForgotPassword />
            </Suspense>
          )}
        />

        <Route
          path="/reset-password"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <ResetPassword />
            </Suspense>
          )}
        />

        <Route
          path="/pricing"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Pricing />
            </Suspense>
          )}
        />

        <Route
          path="/about"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <About />
            </Suspense>
          )}
        />

        <Route
          path="/how-it-works"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <HowItWorks />
            </Suspense>
          )}
        />

        <Route
          path="/blog"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Blog />
            </Suspense>
          )}
        />

        <Route
          path="/blog/:slug"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <BlogPost />
            </Suspense>
          )}
        />

        <Route
          path="/compare/signalstack"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <CompareSignalStack />
            </Suspense>
          )}
        />

        <Route
          path="/compare/traderspost"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <CompareTradersPost />
            </Suspense>
          )}
        />

        <Route
          path="/compare/discord-signal-services"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <CompareGeneric />
            </Suspense>
          )}
        />

        <Route
          path="/admin/business"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <BusinessDashboard />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/admin/import"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <ImportTrades />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/onboarding"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Onboarding />
            </Suspense>
          )}
        />

        <Route
          path="/checkout"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Checkout />
            </Suspense>
          )}
        />

        <Route
          path="/checkout/success"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <CheckoutSuccess />
            </Suspense>
          )}
        />

        <Route
          path="/overview"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Overview />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/strategy/:id"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <StrategyDetail />
              </Suspense>
            </DashboardLayout>
          )}
        />

        {/* /strategies redirects to overview - page hidden from users */}
        <Route
          path="/strategies"
          component={() => {
            window.location.href = "/overview";
            return <PageLoader />;
          }}
        />

        {/* /dashboard redirects to /my-dashboard */}
        <Route
          path="/dashboard"
          component={() => {
            window.location.href = "/my-dashboard";
            return <PageLoader />;
          }}
        />

        <Route
          path="/compare"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <StrategyComparison />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/admin"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Admin />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/admin/messages"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <ContactMessages />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/my-dashboard"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <UserDashboard />
              </Suspense>
            </DashboardLayout>
          )}
        />

        {/* /broker-setup redirects to overview - not implemented yet */}
        <Route
          path="/broker-setup"
          component={() => {
            window.location.href = "/overview";
            return <PageLoader />;
          }}
        />

        <Route
          path="/billing"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Billing />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/preferences"
          component={() => (
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <UserPreferences />
              </Suspense>
            </DashboardLayout>
          )}
        />

        <Route
          path="/terms"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <TermsOfService />
            </Suspense>
          )}
        />

        <Route
          path="/privacy"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <PrivacyPolicy />
            </Suspense>
          )}
        />

        <Route
          path="/refund-policy"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <RefundPolicy />
            </Suspense>
          )}
        />

        <Route
          path="/disclaimer"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <Disclaimer />
            </Suspense>
          )}
        />

        <Route
          path="/risk-disclosure"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <RiskDisclosure />
            </Suspense>
          )}
        />

        {/* Redirect old paper-trading route to overview */}
        <Route
          path="/paper-trading"
          component={() => {
            window.location.href = "/overview";
            return <PageLoader />;
          }}
        />

        <Route
          path="/qa"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <FAQ />
            </Suspense>
          )}
        />

        <Route
          path="/404"
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <NotFound />
            </Suspense>
          )}
        />
        <Route
          component={() => (
            <Suspense fallback={<PageLoader />}>
              <NotFound />
            </Suspense>
          )}
        />
      </Switch>
    </Suspense>
  );
}

// Initialize all analytics systems on first mount
function initAnalytics() {
  initTimeTracking();
}

function App() {
  useEffect(() => {
    initAnalytics();
    captureTrafficSource();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <ContractSizeProvider>
          <TradeNotificationProvider>
            <AccountValueProvider>
              <TooltipProvider>
                <Toaster />
                <GoogleAnalytics />
                <Router />
                <CookieConsent />
              </TooltipProvider>
            </AccountValueProvider>
          </TradeNotificationProvider>
        </ContractSizeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
