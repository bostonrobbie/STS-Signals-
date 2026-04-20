# NQ vs ES Futures: Which Should You Trade?

**Published:** April 18, 2026 · By Rob Gorham, Founder of STS Futures · 7 min read

New futures traders almost always ask some version of the same question: should I trade NQ (Nasdaq-100 E-mini) or ES (S&P 500 E-mini)? Both are the most liquid index futures in the world. Both have Micro versions (MNQ and MES) for smaller accounts. Both trade near 24 hours a day. So what's different, and which one should you actually pick?

Short answer: **if you're systematically-inclined, NQ. If you're a swing/position trader using price action, ES.** Longer answer below.

## The basics

Both NQ and ES are futures contracts on the CME that track US stock indices:

- **NQ** tracks the Nasdaq-100 (the 100 largest non-financial companies listed on the Nasdaq)
- **ES** tracks the S&P 500 (500 large-cap US companies across sectors)

Contract specs:

| Spec | NQ | ES | MNQ | MES |
|---|---|---|---|---|
| Index | Nasdaq-100 | S&P 500 | Nasdaq-100 | S&P 500 |
| Multiplier | $20 × index | $50 × index | $2 × index | $5 × index |
| Tick size | 0.25 | 0.25 | 0.25 | 0.25 |
| Tick value | $5 | $12.50 | $0.50 | $1.25 |
| Typical daily range | 100-300 pts | 30-80 pts | same | same |
| Initial margin | ~$25K | ~$15K | ~$2.5K | ~$1.5K |
| Session | 23 hrs | 23 hrs | same | same |

## The meaningful differences

### 1. Volatility — NQ is 2-3x more volatile than ES

Over the 15-year STS backtest window, NQ's average daily range is roughly 2.5x ES's in percentage terms. That's because the Nasdaq-100 is concentrated in higher-beta tech stocks (Apple, Microsoft, Nvidia, Meta, Amazon, Google, Tesla) while the S&P 500 is diversified across sectors.

**What that means practically:**
- If you're systematic (our approach) — NQ's wider ranges create more setup opportunities per day. Trend breakouts, opening range breakouts, and intraday reversions all fire more often and travel farther.
- If you're discretionary / swing — ES's slower movement gives you more time to think. It's harder to get emotionally shaken out.
- If you're new — ES is forgiving. NQ punishes mistakes faster.

### 2. Dollar-per-point — ES is more "efficient" for index exposure

One ES point = $50. One NQ point = $20. But NQ moves ~2.5x more points per day. Net: a single NQ contract and a single ES contract both expose you to roughly similar dollar-amount daily swings, but NQ traders see bigger point moves on the ticker, which can be psychologically challenging.

If you're newer, consider starting with **Micro** contracts (MNQ or MES). One MNQ tick is $0.50; one MES tick is $1.25. You can trade position sizing and strategy execution without the emotional weight of a $5 or $12 tick.

### 3. Sector concentration — NQ is a tech bet

The Nasdaq-100 is roughly 60% information technology and communications. The S&P 500 is roughly 30% tech. If you trade NQ, you're effectively making a directional tech bet; if you trade ES, you're making a broader US equity bet.

During tech booms (2020-2021, 2023-2025), NQ outperforms massively. During tech drawdowns (2022), NQ underperforms. For a systematic strategy that trades both directions (long AND short setups), this doesn't necessarily matter — you capture moves either way. For a long-only or "buy the dip" discretionary trader, NQ's volatility can be scary during tech corrections.

### 4. Liquidity during slow sessions — ES wins

Both instruments are deeply liquid during US market hours. But in the Asian session (roughly 8 PM – 2 AM ET) and during low-volume holidays, ES maintains tighter spreads and better depth than NQ. If your strategy fires overnight or near session opens, test both on the specific times you care about.

At STS Futures, our Triple NQ Variant includes a "Drift" setup that fires during the pre-open window (6 PM ET onwards). We've specifically tested that this setup has sufficient liquidity in NQ for retail contract sizes. For larger institutional positions, ES would likely be a better fit.

### 5. Earnings-event behavior

Because 7 of the top 10 Nasdaq-100 names (Apple, Microsoft, Nvidia, Meta, Amazon, Google, Tesla) all report earnings within a 2-3 week window every quarter, NQ experiences massive concentrated volatility around those reports. An NQ position held through a MAG7 earnings print is effectively a bet on those few names.

ES is smoother around earnings because the reports spread across 500 companies over 6-8 weeks.

**Systematic rule at STS Futures:** on days with a MAG7 after-hours earnings report, we reduce position sizing on the following day's setups by 50%. You can see this reflected in the backtest — the strategy intentionally takes smaller bets on known high-volatility events.

## Which one should YOU pick?

### Pick NQ if:
- You're systematic / rules-based
- You want more setup opportunities per day
- You can handle seeing bigger point swings on the ticker
- You're primarily interested in tech-sector directional moves
- You have a broker that supports the MNQ micro contract (most do)

### Pick ES if:
- You're discretionary / price-action / swing-focused
- You want broader US equity exposure
- You prefer smoother intraday volatility
- You trade during Asian or European sessions
- Your strategy relies on high liquidity during low-volume windows

### Pick both if:
- You have enough capital for it ($25K+ for MNQ + MES at a comfortable level, $100K+ for NQ + ES at a comfortable level)
- Your strategies have low correlation between NQ and ES setups (rare for index futures)
- You want to diversify single-instrument risk

## Why STS Futures focuses only on NQ

We trade NQ exclusively. Three reasons:

1. **Specialization beats generalization.** The Triple NQ Variant's rules are tuned to NQ's specific volatility profile, intraday range behavior, and session structure. The same rules on ES would produce mediocre results — we've tested it. A specialist strategy is almost always better than a generalist one.

2. **Higher volatility = more opportunity for systematic edge.** NQ's wider daily ranges create more breakout, drift, and mean-reversion setups that our rules can exploit. ES's calmer ranges would generate fewer signals per month.

3. **One market, deeply understood, beats five markets superficially known.** Rob has traded NQ personally for over a decade. A 15-year backtest on NQ captures a dataset Rob has lived through. Attempting to replicate that depth across 5 different instruments would dilute the edge.

If you want systematic ES signals, we'd suggest finding a service that specializes in ES. If you want systematic NQ signals, [that's us](/pricing).

## FAQ

**Q: Which is more profitable to trade?**
A: Neither. Both are zero-sum games from which skilled traders extract edge and unskilled traders lose money. The instrument is neutral; the strategy is what makes money.

**Q: Is MNQ just as good as NQ for real trading?**
A: Yes for learning and small accounts. The Micro contracts have nearly identical price action to their full-size counterparts — they just cost 1/10 as much per point. For accounts under $50K, MNQ is strictly better than NQ because you can size positions more precisely.

**Q: Do STS Futures signals work for MES if I translate them?**
A: No. Don't do this. The entry/stop/target prices are calibrated to NQ's behavior; translating to ES changes the statistical properties of every trade in unpredictable ways.

**Q: Can I hedge NQ with ES?**
A: Technically yes, but for retail traders it's usually not worth the complexity. Correlation between NQ and ES is ~0.85 most days, so hedging one with the other provides only partial risk reduction. Simpler: size positions smaller.

**Q: What about YM (Dow), RTY (Russell 2000), or NKD (Nikkei)?**
A: All three are traded, none as liquid as NQ or ES. YM (Dow Jones Industrial Average) trades in similar volatility range to ES; RTY has higher volatility than NQ but lower liquidity; NKD (Nikkei 225) is a Japanese-hours product. For US retail systematic strategies, NQ and ES are the standard choices.

---

If you want to see the systematic NQ approach in action: [how STS Futures works →](/how-it-works) or [start the signals for $50/month →](/pricing). 15-day money-back guarantee on your first subscription.

---

*Trading futures involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The signals and analytics provided are for informational purposes only and should not be considered personalized financial advice.*
