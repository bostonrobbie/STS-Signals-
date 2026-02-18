import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const COOKIE_CONSENT_KEY = "sts_cookie_consent";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay to prevent flash on page load
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const handleAccept = () => {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        accepted: true,
        timestamp: new Date().toISOString(),
        preferences: {
          necessary: true,
          analytics: true,
          marketing: false,
        },
      })
    );
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem(
      COOKIE_CONSENT_KEY,
      JSON.stringify({
        accepted: false,
        timestamp: new Date().toISOString(),
        preferences: {
          necessary: true,
          analytics: false,
          marketing: false,
        },
      })
    );
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-2xl safe-area-bottom">
      <div className="container max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 pr-4">
            <p className="text-sm text-foreground/80">
              We use cookies to enhance your experience on our platform. By
              continuing to use STS Futures, you agree to our use of cookies for
              analytics and essential functionality.{" "}
              <a
                href="/privacy"
                className="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 underline"
              >
                Learn more
              </a>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDecline}
              className="text-muted-foreground border-border hover:bg-muted"
            >
              Decline
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Accept Cookies
            </Button>
            <button
              onClick={handleDecline}
              className="p-1 text-muted-foreground hover:text-foreground sm:hidden"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check if analytics cookies are allowed
export function useAnalyticsConsent(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent) {
      try {
        const parsed = JSON.parse(consent);
        setAllowed(parsed.preferences?.analytics === true);
      } catch {
        setAllowed(false);
      }
    }
  }, []);

  return allowed;
}
