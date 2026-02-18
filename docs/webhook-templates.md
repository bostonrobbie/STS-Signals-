# TradingView Webhook Templates

## Overview

The Setup page now includes three template types for TradingView alerts:

1. **Unified Template** (Recommended) - Auto-detects entry/exit based on `position` field
2. **Entry Only Template** - Explicitly marks signals as entries with `signalType: "entry"`
3. **Exit Only Template** - Explicitly marks signals as exits with `signalType: "exit"`

## Template Examples

### Unified Signal Template
```json
{
  "symbol": "ESTrend",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "position": "{{strategy.market_position}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "entryPrice": "{{strategy.position_avg_price}}",
  "pnl": "{{strategy.order.profit}}",
  "token": "YOUR_TOKEN"
}
```

### Entry Signal Template
```json
{
  "symbol": "ESTrend",
  "signalType": "entry",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "position": "{{strategy.market_position}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "token": "YOUR_TOKEN"
}
```

### Exit Signal Template
```json
{
  "symbol": "ESTrend",
  "signalType": "exit",
  "date": "{{timenow}}",
  "data": "exit",
  "position": "flat",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "entryPrice": "{{strategy.position_avg_price}}",
  "pnl": "{{strategy.order.profit}}",
  "token": "YOUR_TOKEN"
}
```

## TradingView Placeholder Variables

| Variable | Description |
|----------|-------------|
| `{{timenow}}` | Current timestamp |
| `{{close}}` | Current price |
| `{{strategy.order.action}}` | buy/sell/exit |
| `{{strategy.order.contracts}}` | Quantity |
| `{{strategy.market_position}}` | long/short/flat |
| `{{strategy.position_avg_price}}` | Entry price |
| `{{strategy.order.profit}}` | P&L in dollars |

## Signal Detection Logic

The webhook handler determines signal type using this priority:

1. Explicit `signalType` field ("entry" or "exit")
2. `position` field value ("flat" = exit)
3. `data`/`action` field ("exit", "close" = exit; "buy", "sell" = entry)
4. Existing open position check (if position exists, treat as exit)

## Notifications

When webhooks are processed:
- **Entry signals** trigger a notification: "📈 Long Entry: ESTrend"
- **Exit signals** trigger a notification: "✅ Trade Closed: ESTrend +$20.00" (or ❌ for losses)

Notifications are sent asynchronously and do not block webhook processing.
