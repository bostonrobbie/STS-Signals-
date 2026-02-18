# TradingView Webhook Format Guide

This document explains the correct JSON format for TradingView alerts to work with the STS Futures Dashboard.

## Webhook URL

```
https://intradaydash-jfmy8c2b.manus.space/api/webhook/tradingview
```

## Authentication

All webhooks must include a `token` field with your secret token for authentication.

---

## Entry Signal Format

Use this format when opening a new position (buy/long or sell/short):

```json
{
  "symbol": "{{ticker}}",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "direction": "{{strategy.market_position}}",
  "token": "YOUR_SECRET_TOKEN"
}
```

### Entry Signal Examples

**Long Entry:**

```json
{
  "symbol": "NQTrend",
  "date": "2026-01-02T14:45:00Z",
  "data": "buy",
  "quantity": 1,
  "price": 25690.75,
  "direction": "Long",
  "token": "YOUR_SECRET_TOKEN"
}
```

**Short Entry:**

```json
{
  "symbol": "ESTrend",
  "date": "2026-01-02T10:30:00Z",
  "data": "sell",
  "quantity": 1,
  "price": 6050.25,
  "direction": "Short",
  "token": "YOUR_SECRET_TOKEN"
}
```

---

## Exit Signal Format

Use this format when closing an existing position:

```json
{
  "symbol": "{{ticker}}",
  "date": "{{timenow}}",
  "data": "exit",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "YOUR_SECRET_TOKEN"
}
```

### Exit Signal Examples

**Exit Long Position:**

```json
{
  "symbol": "NQTrend",
  "date": "2026-01-02T15:15:00Z",
  "data": "exit",
  "quantity": 1,
  "price": 25604.0,
  "token": "YOUR_SECRET_TOKEN"
}
```

**Exit Short Position:**

```json
{
  "symbol": "ESTrend",
  "date": "2026-01-02T11:45:00Z",
  "data": "exit",
  "quantity": 1,
  "price": 6025.5,
  "token": "YOUR_SECRET_TOKEN"
}
```

---

## Important Notes

### 1. Template Variables Must Resolve

**CRITICAL:** TradingView template variables like `{{strategy.position_avg_price}}` and `{{strategy.order.profit}}` must resolve to actual values. If you see literal strings like `{{strategy.position_avg_price}}` in your webhook logs, the template variables are not being resolved.

**Wrong (variables not resolved):**

```json
{
  "entryPrice": "{{strategy.position_avg_price}}",
  "pnl": "{{strategy.order.profit}}"
}
```

**Correct (actual values):**

```json
{
  "entryPrice": 25690.75,
  "pnl": -1720.0
}
```

### 2. Entry/Exit Signal Flow

The dashboard tracks positions using a two-step process:

1. **Entry Signal** → Creates an "open position" record
2. **Exit Signal** → Closes the open position and creates a completed trade

If you send an exit signal without a matching entry, you'll get an error:

> "No open position found for this strategy"

### 3. P&L Calculation

The dashboard calculates P&L using contract point values:

| Market | Point Value (Mini) | Point Value (Micro) |
| ------ | ------------------ | ------------------- |
| ES     | $50/point          | $5/point            |
| NQ     | $20/point          | $2/point            |
| CL     | $1,000/point       | $100/point          |
| GC     | $100/point         | $10/point           |
| YM     | $5/point           | $0.50/point         |
| BTC    | $5/point           | $0.10/point         |

**Example NQ Calculation:**

- Entry: 25690.75
- Exit: 25604.00
- Difference: -86.75 points
- P&L: -86.75 × $20 = **-$1,735.00**

### 4. Symbol Naming Convention

The `symbol` field should match your strategy name in the dashboard. The system extracts the market from the symbol prefix:

| Symbol   | Market Detected |
| -------- | --------------- |
| NQTrend  | NQ              |
| ESTrend  | ES              |
| NQORB    | NQ              |
| ESORB    | ES              |
| CLTrend  | CL              |
| BTCTrend | BTC             |

### 5. Data Field Values

The `data` field determines the signal type:

| Value   | Signal Type |
| ------- | ----------- |
| `buy`   | Entry Long  |
| `sell`  | Entry Short |
| `long`  | Entry Long  |
| `short` | Entry Short |
| `exit`  | Exit        |
| `close` | Exit        |
| `flat`  | Exit        |

---

## Complete TradingView Alert Template

### For Entry Alerts:

```
{
  "symbol": "{{ticker}}",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "direction": "{{strategy.market_position}}",
  "token": "YOUR_SECRET_TOKEN"
}
```

### For Exit Alerts:

```
{
  "symbol": "{{ticker}}",
  "date": "{{timenow}}",
  "data": "exit",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "YOUR_SECRET_TOKEN"
}
```

---

## Troubleshooting

### Error: "Invalid or missing authentication token"

- Ensure the `token` field is included and matches your configured token

### Error: "No open position found for this strategy"

- An exit signal was received but no entry was recorded
- Check that the entry signal was sent and processed successfully
- Verify the `symbol` field matches exactly

### Error: "NaN" in P&L

- Template variables are not resolving to numbers
- Check that `price`, `quantity`, and `entryPrice` are numeric values, not strings

### Error: "Duplicate trade detected"

- The same trade was already recorded
- This prevents double-counting trades

---

## Testing Webhooks

Use the Admin Control Center → Test Signals tab to test your webhook format before going live.

You can also test via curl:

```bash
curl -X POST https://intradaydash-jfmy8c2b.manus.space/api/webhook/tradingview \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "NQTrend",
    "date": "2026-01-02T14:45:00Z",
    "data": "buy",
    "quantity": 1,
    "price": 25690.75,
    "direction": "Long",
    "token": "YOUR_SECRET_TOKEN"
  }'
```
