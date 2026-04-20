# 14-Day Email Nurture Sequence

Drop-in templates for the STS Futures new-subscriber / trial lifecycle.
Paste each into MailerLite (or Mailchimp, ConvertKit, or any ESP that
supports delayed-trigger sequences). Trigger event is either
**account created** or **subscription purchased**.

## Design principles

- **Every email either teaches or proves the strategy** — no pure sales asks
- **Most emails go to ALL new signups** (free + paid); emails 7, 10, 14 branch by paid state
- **Single CTA per email** — clicking one thing is easier than choosing
- **Plain-text feel even when HTML** — no flashy graphics; the product is financial, not consumer
- **Dev email guard still applies** — in `NODE_ENV !== production` every email is redirected to rgorham369@gmail.com (see `server/services/resendEmail.ts`)

## Sequence overview

| Day | Audience | Subject | Goal |
|---|---|---|---|
| 0 | New signup | Welcome to STS Futures — next steps | Onboard, set expectations |
| 1 | All | The story behind the Triple NQ Variant | Build founder authority |
| 3 | All | What a real 15-year backtest actually looks like | Credibility / methodology |
| 5 | Trial only | Saw your first signal yet? | Engagement check |
| 7 | Trial only | The 3 mistakes I made early trading NQ | Content value + soft close |
| 10 | Trial only | Trial ending in 5 days — here's what you've missed | Conversion push |
| 14 | Trial expired | Last chance — 20% off your first month | Recovery / retargeting |

For paid subscribers the sequence branches: emails 5, 7, 10, 14 are
replaced with engagement content ("Your first trade walkthrough", "How
to size positions", "Monthly performance recap") instead of
conversion nudges.

---

## Email 0 — Welcome (Day 0, sent immediately on signup)

**Subject:** Welcome to STS Futures — 3 things to do first

**Preview text:** Everything you need to be ready when the first signal fires.

**Body:**

Hi {{name}},

Thanks for creating your STS Futures account. I'm Rob Gorham, the founder and the person actually trading these signals day-to-day. This is the first of a few short emails to get you oriented.

**Here's what to do in the next 10 minutes:**

1. **Bookmark your dashboard** — it's at [stsdashboard.com/overview](https://stsdashboard.com/overview). Signals appear here in real time.
2. **Turn on email notifications** — go to Settings → Notifications and flip the switch. You'll get an email the moment a signal fires so you never miss one.
3. **Review the 15-year backtest** — the dashboard shows every one of the 7,960 trades we've published. It's worth spending 5 minutes getting a feel for the pattern of wins and losses before you trade live.

**Two things worth knowing:**

- **We only trade NQ.** Not ES, not crude, not crypto. NQ (Nasdaq-100 E-mini) and its Micro counterpart MNQ.
- **Signals fire during the US session.** Roughly 9:30 AM – 4:00 PM Eastern, plus an overnight "Drift" window from 6 PM ET for next-morning setups.

Reply to this email if you hit any snags. I read every reply personally.

Talk soon,
Rob

---

## Email 1 — The founder story (Day 1)

**Subject:** Why STS Futures exists

**Body:**

Hi {{name}},

Quick story for you.

I've been trading futures systematically for over a decade. Early on I did the whole retail trader progression — discretionary setups, mentorship programs, a couple of Discord rooms, one very expensive algorithmic trading course that did not work. What finally worked for me personally was a small set of mechanical rules I could walk away from and let run.

The strategy behind STS Futures — the Triple NQ Variant — is the result of that process. It combines four setup families:

1. **Trend breakouts** across multiple timeframes (T1, T2, T3 variants)
2. **Drift** — overnight residual strength → NY-open exit
3. **Opening Range Breakout** — long + short variants
4. **Short-ORB** — rejection-pattern shorts with tight stops

I publish the full 15-year backtest because I think that's what a legitimate signal service should do. Every one of the 7,960 historical trades is visible in your dashboard with entry price, exit price, and net P&L. Pull them into a spreadsheet and verify the numbers yourself.

That's my pitch: the backtest is real, the rules are real, and there are no upsells coming. It's $50/month for the signals and the dashboard, forever.

Next email: what a valid 15-year backtest actually looks like — including the years it lost money.

Rob

---

## Email 2 — Methodology deep-dive (Day 3)

**Subject:** What a real 15-year backtest looks like (including the losing years)

**Body:**

Hi {{name}},

A lot of signal services advertise performance that looks too smooth. The numbers slope up and to the right with no setbacks, the win rate is 80%+, and the "worst drawdown" is somehow 4%. That's a cherry-picked sample, or an unrealistic backtest, or both.

Here's what a real 15-year systematic NQ strategy actually looks like:

- **Trades:** 7,960 from April 2011 through April 2026
- **Win rate:** 46% (so yes, more trades lose than win)
- **Profit factor:** 1.26 (the winning trades are bigger than the losing ones by 26%, on average)
- **Best single trade:** +$32,650
- **Worst single trade:** -$13,088
- **Max drawdown:** ~51% of base capital (roughly $51K peak-to-trough on a $100K Mini baseline)
- **CAGR:** ~17-18% annualized

**The important part — by year:**

- 2011, 2012: flat to slightly negative (getting started years)
- 2016: negative (false-breakout regime, strategy gave back profits)
- 2020-onward: most of the cumulative return, because higher-volatility years reward the approach

If you're expecting every year to be positive, you'll quit in the first drawdown. If you understand that the edge plays out over a 15-year arc, you'll stay through the bad stretches and collect the good ones.

Your dashboard shows the full equity curve with the drawdown overlay — worth a 5-minute look.

Rob

---

## Email 3 — Trial engagement check (Day 5, trial users only)

**Subject:** Saw your first signal yet?

**Body:**

Hi {{name}},

Quick one — have you received a signal since signing up?

If yes: did you execute it in your broker, or paper-trade it, or just watch? Reply with whichever; any answer is a useful signal to me about how to make the product better.

If no: that's normal. Signal frequency averages 1-3 per day but can cluster. Blank days happen. If you haven't seen one by end of this week, reply and I'll take a look.

If you haven't logged in since signing up: [here's the dashboard →](https://stsdashboard.com/overview)

Rob

---

## Email 4 — Education + soft close (Day 7, trial users only)

**Subject:** The 3 mistakes I made early trading NQ

**Body:**

Hi {{name}},

If you're like most new NQ traders, you're about to make one of the three mistakes that cost me real money in my first 18 months. Skip-ahead version:

**Mistake 1: Cherry-picking signals.**
"This one looks ugly, I'll skip it." You can't. A systematic strategy's edge comes from taking every setup — winners and losers both. Skipping "bad-looking" signals statistically deletes the winning ones you would have found later.

**Mistake 2: Doubling size when confident.**
"This one looks great, I'll take 2 contracts instead of 1." This is how you blow up. Position size is decided once, based on account size. It doesn't flex on signal strength.

**Mistake 3: Bending exits.**
"The target's $22,400 but it's screaming higher, I'll let it run." The exit rules are part of the edge. If you move the target, you break the statistical properties of the strategy and the backtest stops predicting your results.

Full deep-dive on these (plus 3 more) in the blog: [How to Trade NQ Futures Signals →](https://stsdashboard.com/blog/how-to-trade-nq-futures-signals).

Your trial runs for a few more days. If you haven't had the chance to fully test the signals yet, here's the [direct link to subscribe →](https://stsdashboard.com/pricing) — 15-day money-back guarantee, cancel anytime.

Rob

---

## Email 5 — Trial-ending reminder (Day 10, trial users only)

**Subject:** Trial ending in 5 days — here's what you've missed

**Body:**

Hi {{name}},

Just a heads-up — your STS Futures trial ends in 5 days.

Since you signed up, our Triple NQ Variant fired **{{signal_count_since_signup}}** signals with a cumulative net P&L of **${{period_pnl}}** on Micro contracts.

I'd rather you not subscribe than subscribe and be unhappy — so here's an honest take on whether this is right for you:

**Good fit if:**
- You have a futures-enabled broker + at least $5K in Micro-contract-sized capital
- You can watch the dashboard or email between 9:30 AM and 4 PM Eastern, at least some days
- You're OK following systematic rules even when the setup looks "obviously wrong"
- You can stomach periodic drawdowns without stopping mid-strategy

**Not a good fit if:**
- You want someone else to manage a trading account for you (STS is not a managed account service)
- You can't reliably execute manually during US market hours
- You want a guarantee (there are none — only statistical edge over a long arc)
- You're looking to 10x your account in 3 months (not what this is)

If you're on the "good fit" side: [$50/mo, cancel anytime, 15-day money-back →](https://stsdashboard.com/pricing).

If it's not the right moment: no hard feelings. The backtest will still be public, the blog will still publish weekly, and you're welcome back anytime.

Rob

---

## Email 6 — Last-chance discount (Day 14, trial expired)

**Subject:** Last chance — 20% off your first month

**Body:**

Hi {{name}},

Your STS Futures trial ended a couple of days ago without converting, so I wanted to take one more shot.

Here's a 20% discount code for your first month if you'd like to come back: **COMEBACK20** — applies at checkout.

That takes the first month from $50 to $40. If you don't like it, the 15-day money-back guarantee still applies on the discounted price.

[Use the code →](https://stsdashboard.com/pricing?promo=COMEBACK20)

If the timing just isn't right: no problem. I'll send one or two low-frequency updates with market commentary and strategy deep-dives in the future, no sales asks. You can unsubscribe any time from the link at the bottom of every email.

Thanks for giving STS Futures a look.

Rob

---

## Subscriber-track variants (for paid subscribers — replaces emails 3, 4, 5, 6)

### Day 5 (paid) — First trade walkthrough

**Subject:** Here's how to execute your first STS signal

**Body:** Step-by-step walkthrough: signal arrives → bracket order in broker → monitor → automatic exit. Includes a screenshot of the dashboard signal card and a practice bracket-order template. Encourages the subscriber to paper-trade the first one if they haven't used their broker for futures yet.

### Day 7 (paid) — Position sizing deep-dive

**Subject:** How I decide position size (and why it's not what you think)

**Body:** Explain the position-sizing calculator in the dashboard. Translate the 1% risk rule into Micro vs Mini contract counts. Include a table of "for account size X, the sizing calculator recommends Y contracts per signal."

### Day 14 (paid) — Monthly performance recap

**Subject:** {{month_name}} recap: what fired, what worked

**Body:** First monthly recap email — same content as the weekly blog recaps but scoped to the full month. Tabulates signals by sub-type (Trend T3, Drift, ORB variants), shows net P&L, and calls out any notable outliers. Sets the rhythm that monthly-recap emails land on the 1st of every month.

---

## Setup notes

- All emails should include a plain-text footer with company info, mailing address (US CAN-SPAM requirement), and unsubscribe link
- Trigger emails from the authenticated domain (stsdashboard.com) — never from `noreply@` ESP subdomains, which hurt deliverability
- Set up SPF + DKIM + DMARC properly on the sending domain before launching
- Tag the audience in MailerLite: `signup` at trigger, `trial_paid` on paid conversion, `trial_expired` on 14-day-no-convert, `churned` on cancel
- Double-opt-in is not required for post-signup transactional sequences, but single opt-in must be for the account signup itself (which you have via the signup form submission)
- Measure open rate, click rate, and conversion-to-paid per email. Kill underperformers after 50+ deliveries

## What lives where

- **Static content** (bodies above): this file, version-controlled
- **Dynamic personalization tokens** ({{name}}, {{signal_count_since_signup}}, {{period_pnl}}): MailerLite merge fields, populated from the STS user table via webhook or API sync
- **Discount codes**: managed in Stripe, referenced by URL param in Email 6 (`?promo=COMEBACK20`)
- **Analytics**: UTM tag every link in every email with `utm_source=email&utm_medium=nurture&utm_campaign=<day>-<theme>` so dashboard attribution ties email clicks back to the sequence
