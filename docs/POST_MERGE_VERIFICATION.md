# Post-Merge Verification Checklist

Once the two PRs (`ads-classifier-fix` + `seo-aeo-sprint-1`) merge and
Manus redeploys, run through this checklist to confirm everything lines
up. Takes about 10 minutes.

## Step 1 — Confirm deploy is live

Visit https://stsdashboard.com and note the page's **build hash** in
DevTools → Sources (look for `index-<hash>.js`). Write down the hash.
If it changed vs before the merge, the new build is live.

## Step 2 — Hard-refresh to bust SW cache

Still on stsdashboard.com:
- Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac) → hard refresh
- OR DevTools → Application → Storage → Clear site data → reload

This ensures the browser isn't serving a stale cached HTML from the
service worker.

## Step 3 — Static-copy verification (1 min)

Paste `view-source:https://stsdashboard.com/` into the URL bar and
grep for the following strings. **None of these should appear** post-merge:

- `1,085%`
- `45.9%`
- `Sharpe 1.05`
- `22% peak-to-trough`
- `~22% maximum`

**All of these should appear**:

- `1,100%` (in meta/OG/Twitter descriptions)
- `46% win rate`
- `Sharpe 1.07`
- `~51%` max drawdown

Same check on https://stsdashboard.com/llms.txt and
https://stsdashboard.com/llms-full.txt.

## Step 4 — Landing page headline vs KPI

On https://stsdashboard.com/ check:

- **Hero H1:** "Returned +X%" — note the X
- **First KPI card:** "+X% Total Return" — note the X

**Post-merge both should match** (same source variable `totalReturnPct`).
If they still differ, the Manus build is modifying code between repo
main and deploy — escalate.

## Step 5 — Live-computed metrics spot-check

On https://stsdashboard.com/ visually confirm the KPI row values are
within the rough expected range. Small day-to-day drift is normal.

| KPI | Expected range | OK? |
|---|---|---|
| Total Return | +1,100% to +1,150% (Micro, $10K base) | |
| Max Drawdown | -49% to -53% | |
| Sharpe Ratio | 1.05 to 1.10 | |
| CAGR sub-text | 17.5% to 18.5% | |

Any value >10% outside this range = flag, we investigate.

## Step 6 — New pages render

- https://stsdashboard.com/about — Rob Gorham founder page loads, shows stats cards
- https://stsdashboard.com/how-it-works — 5-step process, 8-Q FAQ section
- https://stsdashboard.com/llms-full.txt — ~2,100 words of factual content
- Live signal preview widget appears below equity curve on landing page,
  shows 3 most recent trades

## Step 7 — JSON-LD schema validation

Paste these URLs into https://validator.schema.org/ one at a time:

| URL | Expected schemas |
|---|---|
| `https://stsdashboard.com/` | Organization, WebSite, SoftwareApplication, FAQPage, WebPage, BreadcrumbList, Product |
| `https://stsdashboard.com/about` | WebPage, BreadcrumbList, Person, FAQPage |
| `https://stsdashboard.com/how-it-works` | WebPage, BreadcrumbList, HowTo, FAQPage |
| `https://stsdashboard.com/pricing` | WebPage, BreadcrumbList, Product, FAQPage |

All should parse with **zero errors**. Warnings about missing optional
fields are fine.

## Step 8 — Google Ads disapproval re-check

- Open https://ads.google.com → your disapproved ad
- Click "Request review" if not already submitted
- Use the appeal text from `docs/GOOGLE_ADS_APPEAL.md`
- Flag ad blocker off in Chrome so you can see the actual policy detail

## Step 9 — Authenticated audit (login as admin)

After https://stsdashboard.com/password-login with rgorham369@gmail.com:

- `/overview` — main user dashboard
  - [ ] Equity curve renders
  - [ ] Drawdown chart underneath renders
  - [ ] Metrics row shows Sharpe/Sortino/Calmar (not 0s or NaN)
  - [ ] Monthly returns calendar has colored cells (green wins, red losses)
  - [ ] Major drawdowns table has entries (not empty)
  - [ ] Monte Carlo simulation renders (takes a second)
  - [ ] Rolling metrics chart renders
  - [ ] Trade count + win rate match canonical numbers

- `/admin/business` — NEW operator dashboard
  - [ ] Last Trade Closed card shows recent trade (real)
  - [ ] Strategy Metrics card shows Sharpe/Win rate/Trades (real)
  - [ ] Latest 10 Trades table populated (real)
  - [ ] 8+ "Not connected" stub cards labeled correctly

- `/admin` — system admin
  - [ ] Webhook management section loads
  - [ ] Test webhook simulator works

## Step 10 — Report back

Take screenshots of anything that:
- Shows empty data when it should have data
- Shows NaN, Infinity, undefined, or "Loading..." that doesn't resolve
- Has numbers outside the expected ranges in Step 5
- Throws a console error in DevTools

Paste here and I'll diagnose + patch.

## Known limitations (not bugs)

- **Stripe Checkout**: if you haven't set `STRIPE_SECRET_KEY` live on
  Manus, the "Subscribe Now" button redirects to an error. This is
  environment configuration, not a code bug.
- **Broker connections**: IBKR/Tradovate/TradeStation OAuth buttons
  need corresponding CLIENT_ID/SECRET env vars on Manus. Not a bug.
- **Email notifications**: require `RESEND_API_KEY`. Until set, email
  sends silently no-op (console warning only).
- **GA4 conversion pixel**: fires client-side with the existing ID.
  Server-side (Measurement Protocol) requires `GA4_API_SECRET`.

These are all configuration gaps that the user intentionally deferred
with "connect at a later date". The code is ready; the keys are pending.
