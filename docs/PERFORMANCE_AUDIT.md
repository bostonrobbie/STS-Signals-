# Performance Audit & Optimization Targets

Concrete, measurable targets for Core Web Vitals + page-load
performance. Run these audits after each deploy; fix anything outside
threshold.

## Targets (non-negotiable)

| Metric | Target | Threshold that triggers fix |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.0s | > 2.5s |
| CLS (Cumulative Layout Shift) | < 0.05 | > 0.1 |
| INP (Interaction to Next Paint) | < 150ms | > 200ms |
| FCP (First Contentful Paint) | < 1.5s | > 2.0s |
| TTFB (Time to First Byte) | < 600ms | > 900ms |
| Lighthouse Performance score | ≥ 90 | < 80 |
| Total page weight (homepage) | < 1.5MB | > 2.5MB |
| JavaScript bundle (initial) | < 400KB gzip | > 700KB gzip |

Measure on mobile + throttled connection (Lighthouse default: "Moderate mobile throttling"). Desktop numbers should beat the mobile thresholds comfortably.

## How to measure

### 1. Lighthouse (primary)
- Chrome DevTools → Lighthouse tab → "Analyze page load"
- Run for: `/`, `/pricing`, `/about`, `/how-it-works`, `/blog`, top blog post, `/admin/business` (authenticated)
- Device: "Mobile"; Categories: "Performance" + "Accessibility" + "SEO"
- Log scores in a Google Sheet weekly to track drift

### 2. PageSpeed Insights (public, shareable)
- https://pagespeed.web.dev/
- Runs same Lighthouse suite from Google's infrastructure
- Good for sharing results externally ("see our PageSpeed report")

### 3. Chrome DevTools Performance panel (for deep-dive)
- Record, reload, inspect what's blocking the main thread
- Useful when Lighthouse says "reduce main-thread work" without details

### 4. Real User Monitoring (optional)
- Sentry browser SDK captures Core Web Vitals from actual users
- Requires `VITE_SENTRY_DSN` set; see `docs/ANALYTICS_SETUP.md`

## Known optimizations already in place

These are shipped or effectively shipped:

| Optimization | Where |
|---|---|
| React code-splitting via `lazy()` | Every route in `App.tsx` |
| Manual chunking | `vite.config.ts` → `manualChunks` for react-vendor, router, ui, charts, trpc, utils |
| esbuild minification | `vite.config.ts` → `minify: "esbuild"` |
| HTTP/2 + Gzip (via Cloudflare) | Automatic on Manus deployment |
| Preconnect for fonts + GTM | `client/index.html` |
| Font-display: swap | Browser default; no web-font delay |
| Image lazy loading on non-critical | Needs audit — check `<img loading="lazy">` coverage |
| No render-blocking scripts | All `<script>` tags in head are async/module |
| Cache-Control on sitemap/robots | `server/seoRoutes.ts` → `max-age=86400` |
| Cache-Control on RSS | `server/rssRoute.ts` → `max-age=3600` |

## Optimizations to ship (prioritized)

### 🔴 Do first — highest impact per hour of work

1. **Preload the hero-section LCP element** — on `/`, the hero H1 and the
   equity-curve container are the LCP candidates. Add a `<link rel="preload">`
   hint in `index.html` for the hero font weight if a custom font is used,
   or ensure system-font rendering is locked in on load.

2. **Audit `<img loading="lazy">` + `width`/`height`** — every image
   outside the fold should have `loading="lazy"` AND explicit
   `width`/`height` to prevent CLS. Check:
   - `LandingPage.tsx` equity-curve preview
   - Blog post cover images if/when added
   - Logo in DashboardLayout (may or may not need this for the brand mark)

3. **Inline critical CSS for above-fold** — Vite doesn't do this by
   default. For a strongly LCP-sensitive landing page, consider a
   critters-style plugin or hand-extract the ~3KB of CSS the H1 + hero
   CTA uses and inline it into `index.html`.

4. **Subset fonts if any are custom** — we use system fonts in the
   emails; check that the site also uses system fonts exclusively. If
   Tailwind's default font stack pulls Inter via CDN, switch to
   self-hosted + preload.

### 🟡 Nice-to-have — measurable but smaller wins

5. **Service Worker strategy review** — the existing SW may be
   caching too aggressively and delivering stale dep chunks on
   deploys. Current `sw.js` stub (from the local-dev sprint) should be
   replaced with a proper Workbox runtime-caching setup for prod.
6. **Compress portfolio-preview.webp** — the OG image. Ensure < 200KB.
7. **Defer non-critical 3rd-party scripts** — GA4 / PostHog / Meta
   Pixel already load async via `analyticsInit.ts`; verify they're not
   blocking any render paths.
8. **Reduce chunk count** — Vite's manualChunks should ship ~6-8
   chunks total for the initial load. If Chrome shows >20, flatten.

### 🟢 Later — diminishing returns at current scale

9. HTTP/3 enablement (needs Cloudflare setting; already default on
   newer Cloudflare accounts)
10. Edge-worker pre-rendering for /blog/* static pages (only useful if
    blog traffic is large and TTFB becomes a bottleneck)
11. CDN-level optimization for images (Cloudflare Polish / Cloudinary
    if we ever add many hero images)
12. Image `<picture>` elements for AVIF fallback (needs multiple
    source files; overkill for current traffic)

## Accessibility (a11y) — companion to performance

Every perf audit should also look at:

- Lighthouse accessibility score ≥ 95
- Every image has meaningful `alt` text
- Color contrast ≥ 4.5:1 for body text, 3:1 for large text
- Every interactive element reachable via keyboard (tab order)
- Focus indicators visible on all focusable elements
- Form inputs have associated `<label>`
- ARIA landmarks on major page sections (main, nav, footer)

Full a11y checklist in `docs/ACCESSIBILITY_CHECKLIST.md`.

## Weekly perf review cadence

Monday morning: run Lighthouse on `/`, `/pricing`, `/about`,
`/how-it-works`, top blog post, and `/admin/business`. Record scores
in a sheet. If anything slipped more than 5 points since last week,
investigate that page first.

Biggest regression causes (in order of frequency):
1. New third-party script added (check if consent-gated and async)
2. New image added without `loading="lazy"` + dimensions
3. Bundle growth (check `manualChunks` still aligned)
4. CSS bloat from new components (use Tailwind's purge)
