# STS Futures Brand Guidelines

Voice, tone, color, and copy rules so every page, email, ad, and
blog post feels like it came from the same person.

## Voice — what we sound like

**Three words:** direct, honest, unembellished.

**We are:**
- A trader explaining a trade to another trader
- Specific with numbers (not "high win rate" — "46% win rate")
- Transparent about what doesn't work (our losing years are published, not hidden)
- Technical without being jargon-heavy

**We are not:**
- Hype-y (never "guaranteed returns", never "10x your account")
- Sales-y (no fake urgency, no fake scarcity, no countdown timers)
- Preachy (we don't moralize about discretionary traders)
- Hedge-y (we state our opinion clearly; a bad recommendation is worse than a clear one)
- Casual (no memes in marketing copy; no "LMAO" in support replies)

## Tone by context

### Landing page / pricing / about — **confident-professional**
Example:
> "Systematic NQ futures trading signals, backed by a 15-year verified backtest of 7,960 trades. $50/month. Cancel anytime."

Short sentences. Numbers prominent. No adjectives that aren't necessary.

### Blog — **expert-friendly**
Example:
> "Most retail traders have never seen a legitimate long-running futures backtest. They've seen marketing screenshots. They've seen cherry-picked equity curves with impossibly smooth lines."

Slightly longer sentences. Assumes the reader is smart enough to handle specifics. Uses specific examples and named concepts (Sharpe, Sortino, VWAP) without over-explaining.

### Email — **personal-direct**
Example:
> "Hi {{name}} — quick one. Have you received a signal since signing up?"

First person (I, my). Reads like a trader emailing another trader. Never "Dear valued customer". Every email ends with "— Rob".

### Customer support / contact replies — **responsive-practical**
Example:
> "Looks like the webhook failed at 10:15 — I'm seeing a 500 in the log. Can you paste the exact error you saw in the dashboard?"

Technical where appropriate. Admits what we don't know. Avoids corporate-speak ("I apologize for the inconvenience"). Under-promise, over-deliver.

### Legal / ToS / Privacy — **clear-obligation**
Standard legal tone. Plain English where possible, legalese where required. Never buries important clauses.

## Words we use / don't use

### Use
- "signals" (not "picks" or "calls")
- "systematic" (not "proprietary" which is meaningless)
- "backtest" (not "track record" which is vague)
- "drawdown" (not "dip")
- "entry / stop / target" (the trio, always together)
- "NQ" and "MNQ" (not "Nasdaq futures" in technical copy)
- "subscribe" (not "join" — this is a transactional product)
- "cancel anytime" (clear)
- "Rob" (not "I am", not "we" when it's really just Rob)

### Avoid
- "guaranteed" — literally never
- "proprietary" — meaningless; use "systematic" or "rules-based"
- "algorithm" — use "strategy" or "rules" unless the context is literally ML
- "edge" — only when followed by "comes from [specific thing]"
- "traders love this" — empty social proof; be specific
- "insider" / "secret" / "exclusive" — never
- "limited time" unless it literally is
- "up to X%" — if the max is 1,127%, say 1,127% and the range

## Numbers rule — always cite a source window

Every percentage or dollar figure in copy should be traceable to a
specific window of data. When the data updates, update the copy too
(see `docs/DATA_INTEGRITY_AUDIT.md`).

Current canonical numbers (verified 2026-04-18):
- Total return: approximately +1,100% (Micro, $10K base)
- Win rate: approximately 46%
- Sharpe ratio: 1.07
- Max drawdown: approximately 51% of base capital
- CAGR: approximately 18%
- Trades: 7,960
- Date range: April 2011 – April 2026

Use rounded "approximately X%" so the copy doesn't drift day-to-day.
Use precise numbers only in live-computed UI (KPI cards, equity curve).

## Color palette

### Primary — emerald
- `emerald-500` `#10b981` — CTAs, links, highlights
- `emerald-600` `#059669` — primary buttons
- `emerald-700` `#047857` — button hover
- `emerald-400` `#34d399` — dark-mode accents

### Secondary — cyan (gradient pair)
- `cyan-700` `#0e7490` — gradient terminus paired with emerald-600

### Text
- Light mode: `slate-900` / `#0f172a` for body; `slate-600` / `#475569` for muted
- Dark mode: `slate-50` / `#f8fafc` for body; `slate-400` / `#94a3b8` for muted

### Status
- Success green: `#059669`
- Warning amber: `#d97706`
- Error red: `#dc2626`
- Info cyan: `#0891b2`

### Backgrounds
- Page background: `background` CSS variable (semantic; auto dark/light)
- Card: `card` CSS variable
- Muted: `muted` (for subtle panels)

## Typography

- **Stack:** system font stack only — no web fonts (faster, a11y-friendlier, never flashes)
  - `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif`
- **Headlines:** `font-bold` `tracking-tight`
- **Body:** regular weight, `leading-relaxed` (1.625 line-height)
- **Code / mono:** `font-mono` — used for prices, timestamps, ticker symbols
- **Sizes:** Tailwind defaults (text-sm 14px, text-base 16px, text-lg 18px, text-xl 20px, 2xl 24px, 3xl 30px, 4xl 36px, 5xl 48px)

## Logo + brand mark

- Current logo at `/logo.png` (self-hosted, was from Manus CDN before cleanup)
- Favicon at `/favicon.svg` (SVG, scales any size)
- When logo and wordmark appear together: logo 24-32px on nav, 48-64px on footer, wordmark "STS Futures" next to it

## Copy examples — good vs bad

### Hero headline
- ✅ "NQ Futures Signals Returned +1,100% Over 15 Years"
- ❌ "Unlock the Secret to Profitable Futures Trading"

### CTA button
- ✅ "Subscribe — $50/month" · "See how it works →"
- ❌ "Start Your Journey" · "Get Access"

### Social proof
- ✅ "7,960 historical trades, every one verifiable"
- ❌ "Trusted by traders worldwide"

### Risk disclosure
- ✅ "Trading futures involves substantial risk of loss. Past performance is not indicative of future results."
- ❌ "Some risk may be involved in certain circumstances."

## Ad copy guidelines

- Lead with a specific number (a return, win rate, or trade count)
- Second line: the proof ("15-year verified backtest" / "every trade visible")
- Third line: the action ("$50/mo — cancel anytime")
- Headline char limit varies by platform; most support 30-char headlines in search ads
- Always include the 15-day money-back guarantee for first-time subscribers (reduces cold-ad friction)

## Visual consistency across pages

Every page should have:
- Same nav (or DashboardLayout for admin pages)
- Same footer with legal links
- Same emerald CTA button style
- Same card hover behavior (subtle shadow lift)
- Same spacing rhythm (container max-widths: 3xl for text, 4xl for pricing, 5xl for dashboards)

Deviations should be justified in the PR description.

## When this doc gets out of date

Update this file before publishing anything major that changes voice
or visual identity. If a new pattern emerges that's different from
the rules above, decide: codify here, or revert the new pattern.
