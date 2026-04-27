# Accessibility + Performance Audit

A static (read-only) audit of stsdashboard.com's React client. Last
performed 2026-04-20 against the `main` branch plus the in-flight
feature branches:

- feature-demo-page
- feature-onboarding-checklist
- feature-competitor-pages
- feature-status-page
- feature-getting-started
- feature-risk-management-guide
- feature-search-console-integration

A static audit is not a substitute for a live Lighthouse run or an
axe-core scan against the deployed site. It catches structural issues
(landmarks, heading order, alt text, focus management, lazy-loading
gaps, bundle bloat) that are obvious from reading source, and flags
the specific lines + patches needed to fix them.

---

## 🟢 What's already good (don't change)

- **Lazy route loading** — every page is `React.lazy(() => import(...))`
  in `client/src/App.tsx`, wrapped in `<Suspense>` with a `PageLoader`
  fallback. First-paint bundle size stays bounded.
- **Radix + shadcn UI primitives** — `Button`, `Tabs`, `Dialog`,
  `Select`, `Table`, `Card`, etc. all come from Radix under the hood
  with WAI-ARIA roles + keyboard navigation built in. Don't replace
  these with hand-rolled HTML.
- **SEO meta tags** — `client/src/components/SEOHead.tsx` updates
  `<title>`, description, canonical, Open Graph, Twitter Card on every
  route navigation. Good for crawlability.
- **Sitemap.xml + robots.txt** — present and updated by every PR that
  adds a route.
- **Pre-render middleware** — `server/prerenderMiddleware.ts` serves
  fully-rendered HTML to crawler user-agents, so SEO doesn't depend on
  client-side JS execution.
- **Theme tokens via Tailwind** — text colors use semantic tokens
  (`text-foreground`, `text-muted-foreground`, `text-destructive`)
  rather than raw hex codes. Keeps contrast ratios correct in both
  light and dark modes by construction.
- **Wouter `<Link>`** — renders as a plain `<a>`, so middle-click /
  cmd-click / right-click open-in-new-tab all work.

---

## 🔴 Critical findings

### C1. Landing page `<img>` tags lack `width` + `height`

**File:** `client/src/pages/LandingPage.tsx`
**Issue:** All 9 `<img>` tags use only `className` for sizing. No
`width` / `height` attributes means the browser doesn't know the
image's intrinsic aspect ratio until after the image starts
downloading — causes Cumulative Layout Shift (CLS), which Google's
Core Web Vitals downrank.

**Fix:**
```tsx
<img
  src="..."
  alt="STS"
  width={36}
  height={36}
  className="w-9 h-9"
/>
```
Apply to every `<img>` on the landing page (lines 309, 611, 693,
722, 750, 779, 803, 848, 1370). Use the actual rendered px size.

### C2. `<img>` `loading="lazy"` not used for below-the-fold images

**File:** `client/src/pages/LandingPage.tsx`
**Issue:** Below-the-fold images on the landing page are eagerly
loaded (default `loading="eager"`). Wastes bandwidth on first paint
and can delay LCP.

**Fix:** Add `loading="lazy"` on every `<img>` that's not in the
initial viewport (anything below the fold ~600px).

```tsx
<img src="..." alt="..." loading="lazy" width={...} height={...} />
```
Hero images at the very top stay eager; product screenshots and
trust-badges further down become lazy.

### C3. External CDN dependency for hero logo

**File:** `client/src/pages/LandingPage.tsx` line 310
**Issue:** Hero logo loads from `files.manuscdn.com`. If Manus's CDN
goes down, the logo is broken on the landing page. Also makes the
page slower (extra DNS lookup + TLS handshake to a third-party
domain).

**Fix:** Self-host the logo under `client/public/`. Reference it
relatively: `<img src="/logo-sts.png" ... />`. Saves the round-trip
and removes the external dependency.

This is also called out in `docs/MANUS_CONTRACT.md` (on the safety-
nets branch) under the "Manus-injected" section — the asset is
listed as "should be self-hosted" already.

---

## 🟡 Minor findings

### M1. `<main>` landmark missing on most pages

**Files affected:** all pages in `client/src/pages/`
**Issue:** Pages render their content inside generic `<div>`
wrappers. Screen readers benefit from explicit landmarks (`<main>`,
`<nav>`, `<header>`, `<footer>`) for "skip to content" navigation.

**Fix:** Wrap each page's primary content in `<main>` instead of a
plain `<div>`. Example for `Demo.tsx`:

```tsx
return (
  <>
    <SEOHead {...SEO_CONFIG.demo} />
    <main className="container max-w-6xl mx-auto px-4 py-8 ...">
      {/* page content */}
    </main>
  </>
);
```

This is a one-line change per page. Affects pages built in this
sprint:
- Demo.tsx
- GettingStarted.tsx
- RiskManagement.tsx
- StsVsTopstep.tsx + StsVsCannon.tsx (via CompetitorComparison)
- Status.tsx

### M2. Decorative icons should have `aria-hidden="true"`

**Files affected:** all pages using `lucide-react` icons next to text
**Issue:** When an icon sits next to a text label, the icon is
decorative — it shouldn't add to the screen reader's announcement.
Lucide icons render as `<svg>` and by default get announced as
"image" by some screen readers.

**Fix:** Add `aria-hidden="true"` on decorative icons. The lucide-
react components accept this prop and pass it through.

```tsx
<CheckCircle2 aria-hidden="true" className="h-4 w-4 text-green-500" />
```

Skip this on icons that ARE the only content of a button (e.g. an
icon-only "close" button — those need `aria-label` instead).

### M3. Some interactive elements lack visible focus styles

**Files affected:** custom buttons in `Status.tsx`, panels using
plain `<button>` rather than the `Button` primitive.

**Issue:** Plain `<button>` without `focus-visible:` styles show no
focus ring on keyboard tab. Keyboard users can't tell where they are.

**Fix:** Either use the `Button` primitive (already has focus
styles), or add `focus-visible:outline-2 focus-visible:outline-primary
focus-visible:outline-offset-2` to the className.

In `Status.tsx`, the "refresh" button at the top should use
`<Button variant="ghost" size="sm">` instead of plain `<button>`.

### M4. Form inputs without explicit `<label htmlFor>`

**Files affected:** `UserPreferences.tsx`, `Onboarding.tsx`,
`PasswordSignup.tsx`
**Issue:** Many `<Input>` components have a sibling `<Label>` but no
`htmlFor` / `id` linkage. Screen readers don't know which label goes
with which input.

**Fix:** Use the `<Label htmlFor="x">` + `<Input id="x">` pair, OR
wrap the input inside the label, OR (cleanest) use the `Field`
primitive from `client/src/components/ui/field.tsx` which handles
this for you.

### M5. Tab order on `/admin` admin page

**File:** `client/src/pages/Admin.tsx`
**Issue:** With 7+ tabs, keyboard users tabbing through have to go
through every tab before reaching the tab content. Radix's `Tabs`
handles arrow-key navigation between tab triggers, but `Tab` jumps
all the way through. This is acceptable per WAI-ARIA spec but feels
slow.

**Fix:** None required. Document the behavior: ↑/↓/←/→ to move
between tab triggers; Tab to jump from tablist into the panel.

---

## 🟢 Performance findings

### P1. Bundle size — `recharts` is the largest single import

**Files:** anywhere that imports `recharts` (Overview, UserDashboard,
StrategyDetail, StrategyComparison, TradeSourceBreakdown, etc.)
**Observation:** `recharts` ~250KB minified. Already lazy-loaded via
the route-level `lazy()` so it's not on the critical path for the
landing page or marketing pages — that's good. But it does show up
on the first dashboard route the user visits.

**No action required** as long as marketing pages don't import any
chart components. Confirmed: Demo / GettingStarted / RiskManagement
/ Status / Vs pages have zero recharts imports.

### P2. Service worker caches stale bundles

**File:** `client/public/sw.js`
**Issue:** Already documented in summary — service worker is a stub
that self-unregisters in dev mode. In production, no service worker
runs, so no caching issues.
**No action required.**

### P3. Font loading

**Issue:** Looks like the project relies on system fonts via
Tailwind's default sans-serif stack. No external font requests = no
FOUT/FOIT issues to address.
**No action required.**

### P4. Image format

**Files:** `client/public/portfolio-preview.webp` and similar.
**Observation:** Project already uses `.webp` for the OG image (good
— smaller than PNG/JPG). If new screenshots are added for the
`/demo` page video placeholder, use WebP or AVIF.

**Action item for future:** When the demo video placeholder is
replaced with a real screenshot reel, output to AVIF (preferred) or
WebP. Provide `<picture>` element with a PNG fallback for older
browsers.

### P5. Polling intervals on admin tabs

**Files:** `Status.tsx` (30s), `SafetyPanel.tsx` (30-60s),
`SearchConsolePanel.tsx` (no polling — query-on-mount)
**Observation:** All polls are 30s+ intervals. Reasonable. Could
reduce server load slightly by pausing polls when the tab is
backgrounded, but `React.useQuery` already does this via
`refetchOnWindowFocus`.
**No action required.**

---

## ✅ Quick-win patches (apply across the new pages)

These are mechanical, high-leverage:

1. **Wrap each new page's body in `<main>`** instead of `<div>`. (M1)
2. **Add `aria-hidden="true"`** to every decorative `<lucide-icon>`
   that sits next to a text label. (M2)
3. **Self-host the landing-page logo** to remove the manuscdn
   dependency. (C3)
4. **Add `width` / `height`** to every `<img>` on the landing page
   to eliminate CLS. (C1)
5. **Add `loading="lazy"`** to below-the-fold landing-page images.
   (C2)

Items 3-5 only touch `LandingPage.tsx`. Items 1-2 are page-by-page
but each touches one or two lines.

---

## 🔬 Next steps (live audits)

Once at least one feature branch is deployed to staging, run:

1. **Lighthouse** (Chrome DevTools → Lighthouse tab) on:
   - `/` (landing)
   - `/demo`
   - `/getting-started`
   - `/guides/risk-management`
   - `/vs/topstep`
   - `/status`

   Target scores (mobile, simulated 4G):
   - Performance: 90+
   - Accessibility: 95+
   - Best Practices: 95+
   - SEO: 100

2. **axe DevTools** (browser extension) on the same routes. Should
   show zero "serious" violations after the quick-win patches above.

3. **Mobile device check** — load each new page on a real phone (or
   responsive-mode in DevTools at 375×667). Confirm:
   - All text readable without horizontal scroll
   - Touch targets ≥ 44×44 px
   - Buttons stack vertically rather than getting cramped on narrow
     screens

4. **Screen reader spot-check** — VoiceOver (Cmd+F5 on macOS) or
   NVDA (Windows). Tab through `/demo` and `/getting-started`.
   Confirm the heading hierarchy makes sense and decorative icons
   are not announced.

---

## Owner / cadence

Update this doc:
- After every batch of 3+ new pages
- After any reported a11y issue from a subscriber
- Quarterly, regardless

Maintain critical-findings-zero as a hard rule before each PR merge
to `main`. Minor findings can ride into subsequent PRs.
