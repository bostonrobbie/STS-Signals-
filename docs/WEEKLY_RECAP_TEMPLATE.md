# Weekly NQ Recap Template

This is the repeatable template for the Friday-afternoon market recap
post. Drop the week's actual numbers into the brackets. Aim for 400-700
words. Target cadence: every Friday around 4:30 PM ET.

## Filename convention

`client/public/blog/nq-recap-YYYY-MM-DD.md`

Where `YYYY-MM-DD` is the Friday of the week being recapped. Update
`client/public/blog/manifest.json` to include the new post.

## Manifest entry template

```json
{
  "slug": "nq-recap-YYYY-MM-DD",
  "title": "NQ Recap: Week of [Month D, YYYY]",
  "excerpt": "[One-sentence summary of the week's outcome and notable trades.]",
  "author": "Rob Gorham",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "category": "weekly-recap",
  "tags": ["nq futures", "weekly recap", "systematic trading"],
  "readingMinutes": 3,
  "ogImage": "/portfolio-preview.webp",
  "keywords": [
    "nq futures week of [date]",
    "nq trading recap",
    "nasdaq futures this week"
  ]
}
```

## Content template

```markdown
# NQ Recap: Week of [Month D, YYYY]

**Published:** [Month D, YYYY] · By Rob Gorham, Founder of STS Futures · 3 min read

[One-sentence summary: net P&L for the week, number of signals, headline note about the market regime.]

## The week in one number

- **Signals fired:** [N]
- **Net P&L (Micro):** $[+/- amount]
- **Net P&L (Mini):** $[+/- amount × 10]
- **Win rate this week:** [X]% ([wins] of [N])
- **Best trade:** [signal type] on [day], [entry → exit], +$[amount]
- **Worst trade:** [signal type] on [day], [entry → exit], -$[amount]
- **Max intraday NQ range:** [points] on [day]

## The market this week

[2-3 paragraphs on what happened in the market. Specific context: was it trending, choppy, news-driven, earnings-heavy, event-heavy (CPI, FOMC, NFP)? Keep it factual — no predictions about next week. The point is to make the subscriber feel oriented, not to impress.]

## How the strategy performed

[Which sub-types fired — Trend (T1/T2/T3), Drift, L-ORB, S-ORB, Short-ORB, Univ? Which performed well, which didn't? Reference specific trades by timestamp.]

**Notable setup of the week:** [Pick one trade that illustrates something — a great read, a stop-out that would have scared a discretionary trader, a drift entry that worked despite looking wrong.]

[Paragraph walking through the setup: time, price, entry logic, what the chart looked like, what the strategy's rules said to do, what the outcome was. This is the educational centerpiece of the post.]

## What didn't work

[One paragraph honest about a signal that stopped out, or a setup that was missed. This is the "no hype" signal to readers — subscribers respect the honesty more than a winning-only recap.]

## Context for subscribers

- Cumulative YTD (Micro, $10K base): $[amount] / [+/- pct]%
- Strategy max drawdown YTD: [pct]%
- Current Sharpe (trailing 12 months): [value]

## Setting up next week

[1-2 sentences on what to watch without being predictive. E.g., "Next week is FOMC on Wednesday — historically our Drift signals are reduced around rate decisions; expect lighter signal flow Tuesday overnight through Wednesday close."]

[Optional closing CTA to /pricing if the post is strong. Skip it on weeks where the performance was mediocre — pushing subscriptions after a bad week feels off.]

---

*Trading futures involves substantial risk of loss. Past performance is not indicative of future results. Week-to-week results vary significantly.*
```

## Publishing checklist

1. **Write the post** using the template, filename `nq-recap-YYYY-MM-DD.md`
2. **Add manifest entry** at the top of `posts` array in `manifest.json` (so it appears first on /blog)
3. **Update sitemap.xml** — add a new `<url>` entry for the post with `lastmod` = today
4. **Commit + push to GitHub** — Manus redeploys
5. **Ping IndexNow** — after deploy, run `pnpm exec tsx scripts/indexnow-submit.ts https://stsdashboard.com/blog/nq-recap-YYYY-MM-DD` (or call the admin tRPC endpoint from `/admin`)
6. **Share link** to X / LinkedIn / Reddit subreddits (organic) with UTM tags:
   - `?utm_source=twitter&utm_medium=social&utm_campaign=weekly-recap`
   - `?utm_source=reddit&utm_medium=social&utm_campaign=weekly-recap`
7. **Optional** — quote-tweet your own post with a standout number from the week

## Do NOT in the recap

- Don't predict next week's direction
- Don't name specific subscribers
- Don't guarantee returns
- Don't cherry-pick — cover the full week, losses included
- Don't post if NQ was closed all week (e.g., major holiday); skip instead

## Why these posts compound

Each post:

1. **Ranks for a long-tail query** ("NQ futures week of April 18 2026" has near-zero competition)
2. **Updates sitemap lastmod** → freshness signal to crawlers → boosts whole domain
3. **Gets cited by AI engines** that want current, factual trading commentary
4. **Generates social fodder** for 3 days of X posts from one piece of content
5. **Deepens E-E-A-T** by demonstrating actual current trading knowledge
6. **Builds archive** — after 12 months you have 50+ posts ranking for dozens of date-specific queries

The single highest-ROI weekly activity for the entire STS marketing plan. Do it even if traffic is zero for the first 8-12 weeks — it compounds exponentially after that.
