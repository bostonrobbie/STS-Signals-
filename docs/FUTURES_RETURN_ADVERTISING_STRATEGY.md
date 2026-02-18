# Futures Portfolio Return Advertising Strategy

## The Challenge

Advertising returns for a futures portfolio is fundamentally different from stock portfolios because:

1. **Contract Size Variability**: Traders can use micros (1/10th size), minis, or full contracts
2. **Leverage Differences**: Different brokers offer different margin requirements
3. **Dollar Returns Are Misleading**: $100K profit means different things depending on account size
4. **Percentage Returns Are Problematic**: A 100% return on $50K starting capital is very different from 100% on $500K

## Industry-Standard Solutions

### 1. Points/Ticks Return (Recommended Primary Metric)

**What it is**: Express returns in contract points rather than dollars.

**Example for ES Trend**:
- Total Points Captured: 2,091 points (ES = $50/point)
- This translates to:
  - Mini contracts: $104,550 per contract traded
  - Micro contracts: $10,455 per contract traded

**Why it works**:
- Contract-agnostic: Same number regardless of mini vs micro
- Transparent: Users can multiply by their contract multiplier
- Industry standard: Professional traders think in points/ticks

**Implementation**:
```
ES: $50/point → 2,091 points = $104,550 (mini) or $10,455 (micro)
NQ: $20/point → 9,302 points = $186,040 (mini) or $18,604 (micro)
YM: $5/point → 22,195 points = $110,975 (mini) or $11,098 (micro)
CL: $10/tick → 12,133 ticks = $121,330 (mini) or $12,133 (micro)
GC: $10/tick → 14,915 ticks = $149,150 (mini) or $14,915 (micro)
BTC: $5/point → 37,860 points = $189,300 (mini) or $18,930 (micro)
```

### 2. R-Multiple Return (Risk-Adjusted)

**What it is**: Express returns as multiples of initial risk (R).

**Example**:
- If your average risk per trade is $500 (1R)
- And your total return is $100,000
- Your R-Multiple Return = 200R

**Why it works**:
- Scales with any account size
- Risk-normalized comparison
- Popular in trading education (Van Tharp methodology)

### 3. Return Per Contract Per Year

**What it is**: Annualized return divided by number of contracts traded.

**Example**:
- Total Return: $1,111,322 over 15 years
- Average contracts per year: ~625 trades
- Return per contract per year: ~$118/contract/year

**Why it works**:
- Easy to scale: "If I trade 10 contracts, expect ~$1,180/year"
- Accounts for trading frequency

### 4. Percentage Return with Clear Context

**What it is**: Show percentage but with explicit starting capital context.

**Example**:
> "1,111% total return based on $100K starting capital trading 1 mini contract per signal. Scale proportionally for your account size."

**Key additions**:
- Always state starting capital
- Always state contract size assumption
- Provide scaling guidance

## Recommended Advertising Approach

### Primary Metrics to Display

| Metric | Value | Why |
|--------|-------|-----|
| **Total Points Captured** | 98,496 pts | Contract-agnostic, professional |
| **Win Rate** | 38.8% | Universal, easy to understand |
| **Profit Factor** | 1.32 | Risk-adjusted, industry standard |
| **Sharpe Ratio** | 1.06 | Institutional credibility |
| **Max Drawdown** | $45K (mini) / $4.5K (micro) | Risk transparency |

### Secondary Metrics (with context)

| Metric | Mini Contracts | Micro Contracts |
|--------|---------------|-----------------|
| Total Return | $1,111,322 | $111,132 |
| Avg Annual Return | $74,088 | $7,409 |
| Per-Trade Expectancy | $118.64 | $11.86 |

### Landing Page Copy Suggestions

**Option A (Points-Based)**:
> "Our 8-strategy portfolio has captured **98,496 points** across ES, NQ, YM, CL, GC, and BTC futures over 15 years of backtesting. That's **$1.1M+ for mini contracts** or **$111K for micros** — scale to your account size."

**Option B (Risk-Adjusted)**:
> "With a **1.32 profit factor** and **1.06 Sharpe ratio**, our intraday strategies deliver consistent, risk-adjusted returns. Starting with just **$5,400** (micros) or **$54,000** (minis), you can follow every signal."

**Option C (Expectancy-Based)**:
> "Every trade has a **$118.64 expectancy** (mini contracts). Over 9,367 trades in 15 years, that compounds to **$1.1M in total returns**. Micro traders see **$11.86/trade** — same edge, smaller size."

## Implementation Recommendations

### 1. Add Points Column to Strategy Cards

For each strategy, show:
- Points Captured (primary)
- Dollar Return (mini)
- Dollar Return (micro)

### 2. Add Account Size Calculator

Let users input their account size and see projected returns:
- Input: $25,000 account
- Output: "With micros, expect ~$27,783/year based on historical performance"

### 3. Add Scaling Disclaimer

Always include:
> "Returns shown are based on backtested data trading 1 contract per signal. Actual results will vary based on execution, slippage, and market conditions. Past performance does not guarantee future results."

### 4. Show Both Mini and Micro Everywhere

Every dollar figure should have both:
- "$74K/year (mini) | $7.4K/year (micro)"

## Compliance Considerations

1. **Always state backtested vs live**: "15 years of backtested performance"
2. **Include risk disclaimers**: Max drawdown, risk of ruin calculations
3. **No guaranteed returns language**: Use "historical" and "backtested"
4. **Show losing periods**: Include worst year, longest drawdown

## Summary

The best approach for advertising futures returns:

1. **Lead with points/ticks** — universal, professional, contract-agnostic
2. **Show mini AND micro dollar values** — helps all account sizes
3. **Emphasize risk-adjusted metrics** — Sharpe, Sortino, profit factor
4. **Provide clear scaling guidance** — calculator or simple multipliers
5. **Be transparent about risk** — max drawdown, minimum account size

This approach builds trust while making the returns accessible to traders of all sizes.
