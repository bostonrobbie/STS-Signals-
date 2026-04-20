/**
 * Cookie consent banner with 3-tier preferences: essential / analytics / marketing.
 *
 * Behavior:
 *   - First visit: shows minimal banner with "Accept all", "Essential only",
 *     and "Customize" options.
 *   - "Customize" expands to per-category toggles.
 *   - Choice stored in localStorage.sts_cookie_consent as {accepted, timestamp,
 *     preferences: {essential, analytics, marketing}}.
 *   - Respects DNT (Do Not Track) — auto-sets non-essential = false.
 *
 * Reads via:
 *   - useAnalyticsConsent() — true/false for analytics (GA4, PostHog, etc.)
 *   - useMarketingConsent() — true/false for marketing (Meta Pixel, ads retargeting)
 *
 * The analyticsInit.ts loader should gate tracker initialization on these
 * hooks. We keep this component framework-agnostic so any page can mount it.
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { X, Settings2 } from "lucide-react";

const COOKIE_CONSENT_KEY = "sts_cookie_consent";
const CONSENT_VERSION = 2; // Bump when categories change to re-prompt users

interface ConsentPreferences {
  essential: boolean; // Always true — not user-toggleable
  analytics: boolean;
  marketing: boolean;
}

interface ConsentRecord {
  accepted: boolean;
  version: number;
  timestamp: string;
  preferences: ConsentPreferences;
}

function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== CONSENT_VERSION) return null; // re-prompt after version bump
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(prefs: ConsentPreferences, accepted: boolean) {
  try {
    const record: ConsentRecord = {
      accepted,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      preferences: { ...prefs, essential: true },
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(record));
    // Broadcast so analytics-init modules can react immediately
    window.dispatchEvent(
      new CustomEvent("sts-consent-change", { detail: record })
    );
  } catch {
    /* localStorage disabled */
  }
}

function isDNT(): boolean {
  if (typeof navigator === "undefined") return false;
  // Major browsers historically deprecated DNT but still expose the value
  const dnt = (navigator as any).doNotTrack || (window as any).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [prefs, setPrefs] = useState<ConsentPreferences>({
    essential: true,
    analytics: !isDNT(),
    marketing: !isDNT(),
  });

  useEffect(() => {
    // Delay mount to avoid FOUC
    const timer = setTimeout(() => {
      const existing = readConsent();
      if (!existing) setShowBanner(true);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const acceptAll = () => {
    const p: ConsentPreferences = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    setPrefs(p);
    writeConsent(p, true);
    setShowBanner(false);
  };

  const essentialOnly = () => {
    const p: ConsentPreferences = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    setPrefs(p);
    writeConsent(p, false);
    setShowBanner(false);
  };

  const savePrefs = () => {
    writeConsent(prefs, prefs.analytics || prefs.marketing);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border shadow-2xl safe-area-bottom"
    >
      <div className="container max-w-5xl mx-auto">
        {!showDetails ? (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1 pr-4">
              <p className="text-sm text-foreground/90 font-medium mb-1">
                We use cookies to improve the platform
              </p>
              <p className="text-xs text-muted-foreground">
                Essential cookies keep you logged in and process payments.
                Analytics cookies help us understand how the site is used.
                Marketing cookies are used for ad attribution.{" "}
                <a
                  href="/privacy-policy"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Privacy policy
                </a>
                .
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(true)}
                className="text-xs"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                Customize
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={essentialOnly}
                className="text-xs"
              >
                Essential only
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Accept all
              </Button>
              <button
                onClick={essentialOnly}
                className="p-1 text-muted-foreground hover:text-foreground md:hidden"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-semibold mb-1">
                  Cookie preferences
                </p>
                <p className="text-xs text-muted-foreground">
                  Toggle the categories you're comfortable with. You can
                  change these anytime in settings.
                </p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 max-w-2xl">
              <div className="flex items-start justify-between gap-4 p-3 bg-muted/40 rounded-lg">
                <div className="flex-1">
                  <Label className="text-sm font-medium">
                    Essential{" "}
                    <span className="text-xs text-muted-foreground font-normal">
                      (required)
                    </span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Session cookies for login, payment processing, and
                    security. Cannot be disabled.
                  </p>
                </div>
                <Switch checked disabled />
              </div>

              <div className="flex items-start justify-between gap-4 p-3 rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="c-analytics" className="text-sm font-medium cursor-pointer">
                    Analytics
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Google Analytics 4 and PostHog — help us understand
                    which pages work. No personal identifiers shared.
                  </p>
                </div>
                <Switch
                  id="c-analytics"
                  checked={prefs.analytics}
                  onCheckedChange={v =>
                    setPrefs(p => ({ ...p, analytics: v }))
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-3 rounded-lg">
                <div className="flex-1">
                  <Label htmlFor="c-marketing" className="text-sm font-medium cursor-pointer">
                    Marketing
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meta Pixel and Google Ads conversion tracking — lets us
                    measure ad effectiveness and show you relevant
                    content.
                  </p>
                </div>
                <Switch
                  id="c-marketing"
                  checked={prefs.marketing}
                  onCheckedChange={v =>
                    setPrefs(p => ({ ...p, marketing: v }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={essentialOnly}
                className="text-xs"
              >
                Reject optional
              </Button>
              <Button
                size="sm"
                onClick={savePrefs}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** True if user has consented to analytics cookies. */
export function useAnalyticsConsent(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(readConsent()?.preferences.analytics === true);
    sync();
    window.addEventListener("sts-consent-change", sync);
    return () => window.removeEventListener("sts-consent-change", sync);
  }, []);
  return allowed;
}

/** True if user has consented to marketing cookies. */
export function useMarketingConsent(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    const sync = () => setAllowed(readConsent()?.preferences.marketing === true);
    sync();
    window.addEventListener("sts-consent-change", sync);
    return () => window.removeEventListener("sts-consent-change", sync);
  }, []);
  return allowed;
}
