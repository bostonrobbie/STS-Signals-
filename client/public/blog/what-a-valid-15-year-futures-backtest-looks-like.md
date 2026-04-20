# What a Valid 15-Year Futures Backtest Actually Looks Like

**Published:** April 18, 2026 · By Rob Gorham, Founder of STS Futures · 8 min read

Most retail traders have never seen a legitimate long-running futures backtest. They've seen marketing screenshots. They've seen cherry-picked equity curves with impossibly smooth lines. They've seen "Since Jan 2023 I'm up 400%" boasts. What they haven't seen is a real 15-year, thousands-of-trades, every-loss-included, every-drawdown-documented backtest.

This post is a walk through what one actually looks like — including the parts that make it uncomfortable.

## Why 15 years matters (and why 2 years doesn't)

Two years of backtest data covers roughly one market regime. Maybe two if you're lucky. Most of the 2020s so far has been a high-volatility bull regime — a systematic long-biased strategy will look brilliant on 2020-2024 data and catastrophic on 2016 data, and if you only look at the recent stretch you will not see that.

Fifteen years of NQ data covers:
- The post-2008 grind higher (2011-2013)
- The first real correction regime (2015-2016)
- The volatility collapse of 2017
- The 2018 Q4 reversal
- The 2019 melt-up
- The 2020 COVID crash AND recovery
- The 2021 speculation peak
- The 2022 bear market
- The 2023-2024 bounce
- The current 2025-2026 regime

Any strategy that survived all of those is more likely to survive whatever comes next. A strategy that only knows how to trade the 2020s will break the first time we get a 2015-style low-volatility chop.

## What a real backtest looks like, at a glance

The STS Futures Triple NQ Variant backtest runs from April 25, 2011 through April 17, 2026. Here's the topline:

| Metric | Value |
|---|---|
| Total trades | 7,960 |
| Trading days | ~3,780 |
| Net P&L (Mini contracts) | +$1,123,141 |
| Net P&L (Micro, $10K base) | +$112,314 |
| Total return on Micro ($10K) | ~+1,100% |
| CAGR | ~17-18% annualized |
| Win rate | 46% (3,661 wins, 4,299 losses) |
| Profit factor | 1.26 |
| Sharpe ratio | 1.07 |
| Sortino ratio | ~1.22 |
| Calmar ratio | ~0.35 |
| Max drawdown (% of $100K base) | ~51% |
| Max drawdown (dollars, Mini) | ~$51,000 |
| Best single trade | +$32,650 |
| Worst single trade | -$13,088 |
| Longest losing streak | 11 trades |
| Longest winning streak | 9 trades |

Those are the numbers you should demand from any signal service. Not "our average winning trade is $180" without the average losing trade alongside it. Not "we're up +X% this year" without the drawdown. Not "Sharpe above 2.0" that was measured on 18 months of cherry-picked data.

## Year-by-year — including the bad ones

This is the hardest table to publish, because it includes a loss year and a flat year and a chop year. It's also the most important table to publish, because without it you don't know the distribution of returns.

| Year | Trades | Net P&L (Micro $10K base) | Return on base | Notable regime |
|---|---|---|---|---|
| 2011 | 320 | -$1,535 | -15% | Getting-started year, Europe crisis |
| 2012 | 515 | -$205 | -2% | Low-vol bull grind |
| 2013 | 541 | +$2,280 | +23% | Trend year, tapering fears |
| 2014 | 579 | +$2,703 | +27% | Strong bull, sector rotation |
| 2015 | 549 | +$1,144 | +11% | Flat year, China devaluation |
| 2016 | 488 | -$1,392 | -14% | **Chop year**, false breakouts |
| 2017 | 585 | +$1,646 | +16% | Lowest realized vol in decades |
| 2018 | 535 | +$7,073 | +71% | Q4 reversal, great for the strategy |
| 2019 | 538 | +$700 | +7% | Flat-ish, trade war chop |
| 2020 | 560 | +$9,571 | +96% | COVID volatility, great environment |
| 2021 | 565 | +$11,799 | +118% | Speculation peak |
| 2022 | 376 | +$10,806 | +108% | **Bear market** — shorts worked |
| 2023 | 560 | +$9,288 | +93% | Recovery rally |
| 2024 | 576 | +$20,597 | +206% | AI euphoria year |
| 2025 | 530 | +$29,023 | +290% | Strong continuation |
| 2026 YTD | 143 | +$8,816 | +88% | First 3.5 months |

Reading this table carefully tells you more than any marketing copy could:

**1.** **The first two years were down or flat.** That happens. A real strategy has a getting-started period where you're paying tuition to the market.

**2.** **2016 was a losing year.** False-breakout regimes are the hardest environment for a trend-plus-breakout strategy. If you only showed prospective subscribers the years from 2018 onward, they'd never know to expect this.

**3.** **Years 4 through 7 (2014-2017) averaged low-double-digit returns.** This is the "expected" outcome for a healthy strategy in a normal environment. If a signal service advertises a strategy that returns 200% every year, they're either lying or they're leveraged to the gills in a way that will eventually wipe out.

**4.** **The big years (2020, 2021, 2022, 2024, 2025) came when volatility was high.** This is a feature, not luck. The strategy is designed to catch directional moves, and high-volatility years have more directional moves.

**5.** **2022's bear market was a great year for the strategy.** That's because the system trades short setups too (S-ORB, Short-ORB, VWAP Exit variants). A long-only strategy would have been flat or down in 2022.

**6.** **Cumulative compound is where the return comes from.** +290% on 2025's starting balance is only possible because 2011-2024 compounded first. The first year of the strategy lost 15%. If you quit then, you'd have missed the subsequent 14 years.

## The drawdown you're signing up for

The maximum cumulative drawdown in the 15-year record was roughly **51% of base capital** — about $51,000 drawdown on the $100K Mini baseline, or $5,100 on the $10K Micro baseline. Peak-to-trough, from a high-water mark to a subsequent low.

Three things to understand about that number:

**1. It's not the worst-case, it's the worst observed.** A 15-year sample is large, but it's not infinite. A future 20-year period could show a larger drawdown. Size your positions accordingly.

**2. It's a percentage of the STARTING capital, not the current equity.** If the account has compounded from $10K to $100K over the years, a 51% drawdown of the $10K base is $5,100 — which is 5.1% of the current equity. That's a very different psychological experience than a drawdown measured off current equity.

**3. It happens during the "growth" years, not the "bad" years.** Counterintuitively, the largest drawdowns usually happen during strong periods because the position sizing is largest then. A losing streak in 2024 or 2025 hurts more in dollar terms than one in 2011 or 2012.

## How to validate a backtest for yourself

If you're evaluating a signal service — any signal service, not just STS Futures — here's what to demand:

1. **The full trade list with timestamps.** Not a summary. Every trade, exact entry time, exact exit time, exact entry price, exact exit price, and net P&L. If the service won't give you this, walk away.

2. **The methodology written in English.** "We use proprietary indicators" is not a methodology. "Enter long when price closes above the 20-day high AND the 50-period RSI is below 70" is a methodology.

3. **The assumptions in the backtest.** Did they include commissions? Slippage? Realistic fill prices? A backtest that assumes perfect fills at signal prices will overstate real-world performance by 20-40%.

4. **Independent reproduction.** Can you pull the trade list into a spreadsheet or Python script and reproduce the equity curve yourself? If not, you're trusting their math on their word.

5. **Losing periods shown transparently.** Every honest backtest has losing years, losing months, and losing streaks. If a service shows you a curve that never goes down, either the backtest is fake or the sample is too short.

At STS Futures every one of the 7,960 trades in our record is visible to subscribers in the dashboard with full detail. Pull them into Google Sheets, compute your own equity curve, verify the Sharpe ratio against the daily returns. We don't ask anyone to take the numbers on faith.

## FAQ

**Q: Does this include commissions and slippage?**
A: Yes. The backtest assumes $1.25 per side per contract commission (standard for retail futures brokers) and realistic slippage (1-2 ticks per entry/exit). Real-world results typically track the backtest within ±5% annualized.

**Q: Is the backtest in-sample or out-of-sample?**
A: The rules were developed using data through 2019. Data from 2020 onward is effectively out-of-sample. The strategy's performance in 2020-2026 closely matches what the in-sample period predicted, which is a decent validation signal.

**Q: Why NQ only?**
A: Because the rules were tuned to NQ's volatility profile and intraday session structure. Applying the same rules to ES, YM, or CL would produce different (and likely worse) results. Specialization > generalization for systematic strategies.

**Q: What about live trading vs backtest?**
A: Live trading has been running against these rules in real-time since 2019. Cumulative live results closely match the backtest projections. Subscribers can see both the historical backtest and the ongoing live record in the dashboard.

**Q: How often is the backtest updated?**
A: Continuously. Every new trade fired by the live system is appended to the record. There's no gap between backtest and live — they're the same dataset.

---

Want to see every one of the 7,960 trades yourself? [Subscribe to STS Futures for $50/month →](/pricing). 15-day money-back guarantee on your first month. Cancel anytime.

---

*Trading futures involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The signals and analytics provided are for informational purposes only and should not be considered personalized financial advice.*
