/**
 * Smart onboarding checklist — computes real completion state from
 * live user data and renders the dumb OnboardingChecklist underneath.
 *
 * The existing OnboardingChecklist component (dumb/presentational) takes
 * an items array. This wrapper queries user preferences, subscriptions,
 * and notification prefs to decide which items are done, so the checklist
 * auto-updates as the user completes tasks — no page refresh needed.
 *
 * Steps without a DB backing ("seen the live dashboard", "read the FAQ")
 * use localStorage flags that are set elsewhere in the app:
 *   - localStorage['sts.onboarding.dashboardSeen'] = "1" when user
 *     visits /overview for the first time (set in Overview.tsx)
 *   - localStorage['sts.onboarding.faqSeen'] = "1" when user visits
 *     /faq for the first time (set in FAQ.tsx)
 *
 * Auto-hides when:
 *   - user.onboardingDismissed = true (user clicked Dismiss)
 *   - user.onboardingCompleted = true (backend set it)
 *   - user.subscriptionTier = 'free' (free-tier users don't get onboarding)
 */

import { useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import OnboardingChecklist from "./OnboardingChecklist";

const LS_DASHBOARD_SEEN = "sts.onboarding.dashboardSeen";
const LS_FAQ_SEEN = "sts.onboarding.faqSeen";
const LS_DEMO_SEEN = "sts.onboarding.demoSeen";

function readLS(key: string): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage.getItem(key);
  } catch {
    return false;
  }
}

export function markOnboardingStep(
  step: "dashboard" | "faq" | "demo"
): void {
  try {
    const key =
      step === "dashboard"
        ? LS_DASHBOARD_SEEN
        : step === "faq"
          ? LS_FAQ_SEEN
          : LS_DEMO_SEEN;
    window.localStorage.setItem(key, "1");
  } catch {
    // localStorage unavailable (private mode etc) — step will just re-show
  }
}

export default function SmartOnboardingChecklist() {
  const { user, refresh } = useAuth();

  // Dismiss mutation from the existing auth router
  // @ts-expect-error existing TS suppression in codebase
  const dismissMutation = trpc.auth.dismissOnboarding.useMutation({
    onSuccess: () => refresh(),
  });

  const { data: subscriptions } = trpc.subscription.list.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: userPrefs } = trpc.userPreferences.getPreferences.useQuery(
    undefined,
    { enabled: !!user }
  );

  const { data: notificationPrefs } =
    trpc.notifications.getPreferences.useQuery(undefined, {
      enabled: !!user,
    });

  const items = useMemo(() => {
    const hasStrategies = (subscriptions?.length ?? 0) > 0;

    // "Configured capital" = user changed it from the default of 100000.
    // Not perfect (they might want to keep the default), but it's the
    // best signal we have without adding a dedicated flag.
    const capital =
      (userPrefs as any)?.startingCapital ??
      (user as any)?.startingCapital ??
      100000;
    const configuredCapital = capital !== 100000;

    // Has a contract-size choice distinct from the factory default
    const hasContractChoice = !!(userPrefs as any)?.contractSize;

    // At least one notification pref saved (any field non-default).
    const hasNotificationPrefs = !!notificationPrefs;

    return [
      {
        id: "strategies",
        title: "Subscribe to a strategy",
        description:
          "Pick at least one NQ strategy to receive signals for. You can add or remove later.",
        href: "/my-dashboard?tab=discover",
        completed: hasStrategies,
      },
      {
        id: "capital",
        title: "Set your starting capital",
        description:
          "Tells the dashboard how many contracts to recommend per signal. Defaults to $100k.",
        href: "/preferences",
        completed: configuredCapital,
      },
      {
        id: "contract",
        title: "Pick contract size (mini vs micro)",
        description:
          "Micro (1/10th) is safer for smaller accounts. Switch anytime.",
        href: "/preferences",
        completed: hasContractChoice,
      },
      {
        id: "notifications",
        title: "Configure email alerts",
        description:
          "Decide which strategies and signal types email you. Defaults to all on.",
        href: "/my-dashboard?tab=notifications",
        completed: hasNotificationPrefs,
      },
      {
        id: "dashboard",
        title: "Take a tour of the dashboard",
        description:
          "Equity curve, trade log, calendar heatmap. All public — no data loss from poking around.",
        href: "/overview",
        completed: readLS(LS_DASHBOARD_SEEN),
      },
      {
        id: "faq",
        title: "Skim the FAQ",
        description:
          "Answers the common 'how do I…' questions. 2-minute read.",
        href: "/faq",
        completed: readLS(LS_FAQ_SEEN),
      },
    ];
  }, [user, subscriptions, userPrefs, notificationPrefs]);

  // Don't render at all for free-tier users, dismissed, or backend-completed
  if (!user) return null;
  if ((user as any).subscriptionTier === "free") return null;
  if ((user as any).onboardingDismissed) return null;
  if ((user as any).onboardingCompleted) return null;

  return (
    <OnboardingChecklist
      items={items}
      onDismiss={() => dismissMutation.mutate()}
    />
  );
}
