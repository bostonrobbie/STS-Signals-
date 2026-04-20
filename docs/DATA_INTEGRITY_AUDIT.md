# Data Integrity Audit — 2026-04-18

## The canonical numbers (ground truth)

Computed from the 7,960-trade CSV import verified on 2026-04-18 against
the live production database (accessed via `trpc.publicApi.overview`):

| Metric | Value (Mini contracts) | Value (Micro @ $10K start) |
|---|---|---|
| Trades | 7,960 | same |
| Net P&L | $1,123,141 | $112,314 |
| Total return | +1,127% | +1,127% |
| Annualized (CAGR) | ~17.97% | same |
| Win rate | 45.98% (≈46%) | same |
| Profit factor | 1.26 | same |
| Sharpe ratio | 1.07 | same |
| Sortino ratio | ~1.22 | same |
| Max drawdown | **51.2%** ($51,200) | **51.2%** ($5,120) |
| Date range | 2011-04-25 → 2026-04-17 | same |

Percentages match between Mini and Micro because the drawdown is
reported as a % of starting capital, and the capital is scaled 10:1
with the contract multiplier.

## What's displayed where — and the discrepancies

### 🔴 Public landing page (`/`)

**Observed live on 2026-04-18:**

| Element | Displayed value | Correct? |
|---|---|---|
| H1 hero: "Returned +X%" | +1,108% | ❌ Stale — should be +1,127% |
| First KPI card (Total Return) | +1,127% | ✅ Correct |
| KPI card sub-text | +$112.7K on $10K starting | ✅ Correct |
| Max Drawdown KPI | -51.2% | ✅ Correct |
| Max DD sub-text | $5.1K peak-to-trough | ✅ Correct |
| Sharpe KPI | 1.07 | ✅ Correct |
| CAGR sub-text | 17.97% annualized | ✅ Correct |

**Discrepancy diagnosis:** The hero H1 and the KPI card both reference
the same `totalReturnPct` variable in the source code (`LandingPage.tsx`
line 230 → 524 and 260). The fact that they show different values on
the same rendered page implies the **live Manus build contains code that
is NOT in the GitHub main branch** — i.e., Manus is running a diverged
version, OR a stale service-worker cache is serving an older H1.

When the `seo-aeo-sprint-1` PR merges to main and Manus redeploys, the
H1 and KPI should converge because the single source of `totalReturnPct`
in main feeds both.

### 🔴 Static SEO/AEO copy (stale across multiple files)

All of these reference outdated backtest figures and need updating:

| File | Stated return | Stated Win Rate | Stated Sharpe | Stated Max DD |
|---|---|---|---|---|
| `client/index.html` (meta/OG) | +1,085% | 45.9% | 1.05 | (not stated) |
| `client/index.html` (JSON-LD Article/Software) | +1,085% | 45.9% | — | — |
| `client/public/llms.txt` | +1,085% | 45.9% | 1.05 | ~22% |
| `client/public/llms-full.txt` | +1,085% | 45.9% | 1.05 | 22% |
| `client/src/pages/About.tsx` | +1,085% | 45.9% | 1.05 | 22% |
| `client/src/pages/HowItWorks.tsx` (indirectly via FAQs) | — | — | — | — |
| **Correct value** | **+1,127%** | **45.98%** | **1.07** | **51.2%** |

The 22% "Max Drawdown" figure that appears across llms.txt, CEO_PLAYBOOK,
and everywhere else is wrong — it does not match any computation on the
current database. The live calculation consistently returns ~51%.

**Likely origin of the 22% figure:** an older version of the backtest,
a different strategy variant, or a drawdown-as-%-of-peak-equity
calculation (vs the current % of starting capital). Either way, the
live site now shows 51% and our documentation should match.

### 🟢 Dashboard pages (require login)

Not yet audited in this pass — requires authenticated session. Will
verify after `seo-aeo-sprint-1` merges and `/admin/business` is live.

### ⚠️ Four different values for "return" on one page

At one point during the audit the live page showed four distinct
return values simultaneously:
- `+1,085%` in `<meta>` og:description (cached crawl fallback)
- `+1,085%` in llms.txt (static)
- `+1,108%` in H1 (diverged Manus prod code OR SW cache)
- `+1,127%` in KPI card (correct live)

Plus implicit sources:
- `+1,086%` in a code comment (line 215 of LandingPage.tsx)
- Multiple marketing docs with various older figures

This is confusing for users, search engines, AI retrievers, and Google
Ads classifiers (inconsistent claims are a signal of low-trust content).

## What this PR fixes

Updates all static copy to point at a **verified pinned snapshot**
from 2026-04-18 with conservative rounding:

- Total return: **+1,100%** (verified 2026-04-18)
- Win rate: **46%**
- Sharpe: **1.07**
- Max drawdown: **~51%**
- CAGR: **~18%**
- Trades: **7,960**
- Date range: **April 2011 – April 2026**

Using approximate values (~51% vs 51.2%) lets the static copy remain
stable as live data drifts a few basis points day-to-day without
requiring constant content updates.

The **live computation** on the landing page still shows precise
live numbers from `publicApi.overview`. Static copy in meta tags and
content files uses the rounded figures.

## Recommended operating procedure going forward

1. **Live calculations render live** — landing page hero, KPIs,
   equity curve all pull from `trpc.publicApi.overview` and compute
   from the current DB. These auto-update as new trades land.
2. **Static copy uses rounded pinned numbers** — llms.txt, meta tags,
   /about, /how-it-works, OG descriptions — update only once per
   quarter to rounded figures with a "verified [date]" footnote.
3. **Every copy change gets a verified-snapshot date** — prevents
   future drift between files.
4. **Anytime the backtest updates** — run `scripts/import-csv-trades.mts`,
   then open this doc and bump the canonical numbers, then grep the
   repo for the OLD numbers and replace with NEW. Takes 10 minutes.

## Verification query (any time)

Run against local or prod DB to get the current canonical numbers:

```sql
SELECT COUNT(*) AS trades,
       MIN(entryDate) AS first,
       MAX(exitDate)  AS last,
       ROUND(SUM(pnl)/100, 0)      AS pnl_usd_mini,
       ROUND(SUM(pnl)/1000, 0)     AS pnl_usd_micro,
       ROUND(100.0 * SUM(CASE WHEN pnl>0 THEN 1 ELSE 0 END) / COUNT(*), 1)
            AS win_rate_pct,
       ROUND(SUM(CASE WHEN pnl>0 THEN pnl ELSE 0 END)
             / NULLIF(ABS(SUM(CASE WHEN pnl<0 THEN pnl ELSE 0 END)), 0), 2)
            AS profit_factor
FROM trades
WHERE strategyId = (SELECT id FROM strategies WHERE symbol='NQTrend')
  AND isTest = 0;
```

Expected output (as of 2026-04-18):

```
trades=7960, first=2011-04-25, last=2026-04-17
pnl_usd_mini=1123141, pnl_usd_micro=112314
win_rate_pct=46.0, profit_factor=1.26
```

Sharpe/Sortino/max-drawdown require time-series analysis (done by
`analytics.calculatePerformanceMetrics` in `server/analytics.ts`).

## Chart audit status

| Chart | Status | Notes |
|---|---|---|
| Landing equity curve (HomeEquityCurve) | ⏳ Loading observed at scrape time; needs a re-visit with scroll | Uses publicApi.overview |
| Landing underwater curve | ⏳ Same | Uses same equity curve dataset |
| Overview dashboard charts | ⏳ Needs auth | 7+ charts to audit |
| Monthly Returns Calendar | ⏳ Needs auth | |
| Major Drawdowns Table | ⏳ Needs auth | |
| Calendar P&L | ⏳ Needs auth | |
| Rolling Metrics | ⏳ Needs auth | |
| Monte Carlo | ⏳ Needs auth | |
| Admin /admin/business (new) | ⏳ Will audit after first merge | |

Once the `seo-aeo-sprint-1` PR is merged and Rob logs in, we do a
dashboard-wide pass and append findings to this file.
