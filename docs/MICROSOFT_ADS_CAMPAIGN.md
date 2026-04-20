# Microsoft Advertising Campaign Package

Ready-to-launch pack for Bing + Microsoft Copilot search ads. Different
classifier than Google Ads — financial/trading products typically approve
same-day, and Copilot surfaces Bing results to AI-search users.

## Why Microsoft Ads right now

- Our Google Ads account currently has a disapproved ad under the
  malicious-software policy (pending appeal). Microsoft has a different
  ad-review classifier and is much less likely to block us.
- Microsoft Copilot uses Bing's index + ads. Ranking in Bing search ads
  = showing up in Copilot answers.
- CPC in financial / trading niches on Bing is roughly **40-60% of
  Google's** for comparable keywords. Less competition.
- Bing has a one-click import from Google Ads — we can re-use any
  campaign structure later if we want parity.

## Account setup (30 min total)

1. https://ads.microsoft.com → Sign in with your Microsoft account (same
   email as Google, or a new one — your choice). Create account.
2. Fill in basic details — business name "STS Futures", website
   `stsdashboard.com`, timezone Pacific, currency USD.
3. Billing → add card (or PayPal). You're charged after spend, no
   upfront.
4. **Import from Google Ads** (optional) → Tools → Import from Google
   Ads → sign in with the Google account that owns `AW-862612449` →
   pick which campaigns to import. This brings over campaigns, ad
   groups, keywords, and ads in one shot.
5. If not importing, build from scratch (structure below).
6. **Add UET Tag** (Microsoft's equivalent of the GA conversion
   pixel) — Tools → UET tag → create → copy the tag ID → add env var
   `VITE_MS_UET_ID=<id>` → we wire this into `analyticsInit.ts` on
   the next commit. Until then you'll see campaign clicks but no
   conversion attribution.

## Recommended initial campaign structure

Single campaign to start. One ad group per keyword-intent cluster. $25
daily budget. Manual CPC bidding with max $2.50 per click.

### Campaign: "STS Futures — NQ Signals"

- Goal: drive paid subscribers (primary) + email signups (secondary)
- Daily budget: $25 (ramp to $50 after 2 weeks if CAC < $150)
- Bid strategy: Manual CPC, max $2.50
- Geographic: United States + Canada only (start narrow)
- Ad schedule: Sunday 4 PM – Friday 5 PM ET (skip weekend evenings)
- Device targeting: All (but watch mobile conversion rate — may need to
  exclude if poor)
- Audiences: no custom audience at launch; use UET remarketing after 30
  days of data

### Ad Group 1: "NQ Signals — high intent"

Keywords (phrase + exact match):
```
nq futures signals
nq trading signals
nasdaq-100 futures signals
emini nq signals
futures signals subscription
systematic nq trading
nq futures alerts
nq signals service
best nq futures signals
```

Negative keywords (exclude):
```
free
telegram
discord free
demo
jobs
reviews scam
youtube
crypto
```

### Ad Group 2: "NQ Signals — comparison intent"

Keywords (phrase match):
```
signalstack review
traderspost review
best futures signal service
nq signals review
nq futures signals review
futures signals comparison
```

### Ad Group 3: "Informational — top of funnel"

Keywords (broad match modified):
```
how to trade nq futures
nq futures strategy
systematic futures trading
nq backtest
what is nq futures
best way to trade nq
```

Lower bid (max $1.50) since this is top-of-funnel and won't convert
same-session.

## Ad copy — Responsive Search Ads

Microsoft Ads accepts the same Responsive Search Ad format as Google.
Provide 15 headlines + 4 descriptions; Microsoft mixes and matches.

### Headlines (15 — rotate into every ad group)

1. NQ Futures Signals That Actually Work
2. Real-Time NQ & MNQ Alerts — $50/mo
3. Stop Guessing. Start Trading Signals.
4. Verified 15-Year NQ Backtest
5. 7,960 Trades. Every One Visible.
6. Day Trading NQ, Systematically
7. No BS. No Hype. Just Signals.
8. Cancel Anytime · 15-Day Money Back
9. Built by a Systematic Trader
10. Trade NQ Like a Quant
11. $50/mo — Less Than One Tick
12. Beat the Discord Signal Chaos
13. 15-Year Backtest + Live Signals
14. NQ Signals. Cancel Anytime.
15. Proven NQ Strategy. $50/mo.

### Descriptions (4)

1. Real-time NQ futures signals with exact entry, stop, and target. 15 years of backtested data, 7,960 trades, full transparency. $50/month — cancel anytime.
2. Stop paying for Discord noise. STS Futures delivers clean systematic NQ setups with a documented 15-year track record. 15-day money-back guarantee on your first month.
3. Join traders using STS Futures for systematic NQ setups. Full 15-year backtest, real-time dashboard alerts, optional broker auto-execution via IBKR / Tradovate / TradeStation.
4. Professional-grade NQ futures signals at a retail price. One transparent tier: $50/mo. No upsells, no VIP. Cancel anytime.

### Final URL

Always: `https://stsdashboard.com/pricing?utm_source=bing&utm_medium=cpc&utm_campaign=nq-signals-us&utm_content={AdId}&utm_term={keyword}`

(Microsoft Ads auto-substitutes `{AdId}` and `{keyword}` dynamically.)

### Display URL paths

Path 1: `nq-signals`
Path 2: `50-per-month`

## Ad Extensions

- **Sitelinks** (4): `15-Year Backtest`, `Live Signals`, `Pricing`,
  `How It Works`
- **Callouts** (6): "15-Year Verified Backtest", "Cancel Anytime",
  "15-Day Money Back", "Real-Time Alerts", "NQ Futures Focus", "No
  Upsells"
- **Structured snippets**: Services = "Signals", "Analytics",
  "Dashboard", "Broker Connect"
- **Review extension**: skip until real 3rd-party reviews exist

## Expected performance (first 30 days)

Conservative estimates based on Bing financial-niche benchmarks:

| Metric | Estimate |
|---|---|
| Impressions | 2,000 – 5,000 / day |
| CTR | 3-5% |
| Clicks | 60 – 250 / day |
| Avg CPC | $1.00 – $1.80 |
| Conversion rate (click → signup) | 2-4% |
| Signup-to-paid conversion | 15-25% |
| **Net CAC target** | $60 – $120 |

If CAC comes in under $120 in the first 2 weeks, scale budget 25-50%
per week while CAC holds. If CAC trends above $150 after 2 weeks of
optimization, pause and review ad copy / landing page.

## Tracking

Conversions to track (UET tag events):

1. **Signup** — `/password-signup` success → fires `sign_up` event
   (value $0)
2. **Checkout Started** — `/pricing` → Subscribe click → fires
   `begin_checkout` (value $0)
3. **Purchase** — `/checkout/success` load → fires `purchase`
   (value $50)

Once `VITE_MS_UET_ID` is set in env, the client-side tracking
infrastructure (already in place via `analyticsInit.ts`) can push these
to Microsoft. Server-side purchase fires via our existing Stripe
webhook (same pattern as GA4 / Meta CAPI) — we'd add a `sendToMicrosoft`
function in `server/services/serverConversions.ts` when we want to wire
it server-side for full attribution.

## Environment variables to set when launching

```bash
# Microsoft Ads / UET
VITE_MS_UET_ID=<from UET tag setup>
# server-side conversion forwarding (optional, recommended)
MS_ADS_CUSTOMER_ID=<from account settings>
MS_ADS_ACCESS_TOKEN=<OAuth token from Bing Ads API portal>
MS_ADS_DEVELOPER_TOKEN=<from API access request>
```

The API tokens are needed only for server-side conversion upload; client-
side UET works with just `VITE_MS_UET_ID`.

## Day-one checklist before launching the campaign

- [ ] All three comparison pages live (`/compare/signalstack`, `/compare/traderspost`, `/compare/discord-signal-services`)
- [ ] Pricing page's trust row + money-back badge merged (sprint-1 PR)
- [ ] UET tag installed (via `VITE_MS_UET_ID`)
- [ ] Conversion goals configured in Microsoft Ads UI
- [ ] Sitelinks + callouts added to the campaign
- [ ] Device bid adjustments: +0% mobile, 0% desktop initially (adjust after 14 days of data)
- [ ] Geographic targeting narrowed to US + Canada only
- [ ] Search partner network enabled (Microsoft audience + Yahoo/AOL) — lower bid on these (-30%)
- [ ] Ad schedule set to skip low-conversion hours (weekend evenings)
- [ ] Landing page UTM tagging verified by visiting the final URL
  directly and checking `/admin/business` (or GA4 DebugView) shows
  `utm_source=bing` captured

## What NOT to do

- Don't enable Microsoft Audience Network (MSAN) display ads initially
  — display is low-intent and burns budget fast
- Don't bid on competitor brand terms (SignalStack, TradersPost) — they
  disapprove pretty often and it's a low-win strategy at our spend level
- Don't target worldwide — US + Canada English-speaking only
- Don't run with broad-match keywords on day 1 — start phrase/exact
  match until you have data on what matches actually convert

## Post-launch: 30-day review

After 30 days:
- **If CAC < $100**: scale budget to $100/day, enable remarketing to
  site visitors
- **If CAC $100-150**: keep spend flat, optimize ad copy on lowest-CTR
  headlines, add negative keywords based on search-term report
- **If CAC > $150**: pause, investigate. Usually a landing-page problem
  (bounce rate too high) or a match-type problem (broad match wasting
  budget on off-intent searches)

After 90 days:
- If campaign is cash-flow positive at scale, import structure back
  into Google Ads (once the malicious-software appeal clears)
- Consider adding a Microsoft Shopping campaign if we ever productize
  into a "starter pack" (unlikely for trading signals)

## What ships with this doc

This doc is the playbook — no code changes needed to launch on
Microsoft Ads. The required landing page infrastructure
(`/compare/*`, pricing trust row, conversion events) is already live
as of the seo-aeo-sprint-1 branch.

To actually launch: create the account, build the campaign above,
paste in the ad copy + keywords, set the UET tag env var, ship. Total
time start to live ads: ~90 minutes.
