# TradingView Webhook Integration

## Webhook URL

**Production URL:**

```
https://intradaydash-jfmy8c2b.manus.space/api/webhook/tradingview
```

## Authentication

All webhook requests must include the secret token in the JSON payload:

```
"token": "RobTradingDashWebhookToken32K"
```

## JSON Format for TradingView Alerts

### Entry Signal (Buy/Long)

```json
{
  "symbol": "NQTrend",
  "date": "{{timenow}}",
  "data": "buy",
  "position": "long",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "RobTradingDashWebhookToken32K"
}
```

### Entry Signal (Sell/Short)

```json
{
  "symbol": "NQTrend",
  "date": "{{timenow}}",
  "data": "sell",
  "position": "short",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "RobTradingDashWebhookToken32K"
}
```

### Exit Signal

```json
{
  "symbol": "NQTrend",
  "date": "{{timenow}}",
  "data": "exit",
  "position": "flat",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "RobTradingDashWebhookToken32K"
}
```

## Complete Copy-Paste Template for TradingView

### For NQ Trend Strategy

**Alert Message (JSON):**

```json
{
  "symbol": "NQTrend",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "position": "{{strategy.market_position}}",
  "quantity": {{strategy.order.contracts}},
  "price": {{close}},
  "token": "RobTradingDashWebhookToken32K",
  "direction": "{{strategy.order.action}}",
  "comment": "{{strategy.order.comment}}"
}
```

**Webhook URL:**

```
https://intradaydash-jfmy8c2b.manus.space/api/webhook/tradingview
```

## Field Descriptions

| Field       | Type   | Required | Description                                               |
| ----------- | ------ | -------- | --------------------------------------------------------- |
| `symbol`    | string | Yes      | Strategy identifier (e.g., "NQTrend", "NQTrendLeveraged") |
| `date`      | string | Yes      | Timestamp from TradingView `{{timenow}}`                  |
| `data`      | string | Yes      | Order action: "buy", "sell", or "exit"                    |
| `position`  | string | Yes      | Market position: "long", "short", or "flat"               |
| `quantity`  | number | Yes      | Number of contracts from `{{strategy.order.contracts}}`   |
| `price`     | number | Yes      | Current price from `{{close}}`                            |
| `token`     | string | Yes      | Authentication token                                      |
| `direction` | string | No       | Optional explicit direction                               |
| `comment`   | string | No       | Optional trade comment                                    |

## Supported Strategy Symbols

| Symbol             | Strategy Name              | Contract Type      |
| ------------------ | -------------------------- | ------------------ |
| `NQTrend`          | NQ Trend Following         | E-mini NASDAQ (NQ) |
| `NQTrendLeveraged` | NQ Trend Leveraged         | E-mini NASDAQ (NQ) |
| `NQ`               | NQ Trend (alias)           | E-mini NASDAQ (NQ) |
| `MNQ`              | Micro NQ (maps to NQTrend) | Micro NASDAQ (MNQ) |

## Position Sizing

The webhook automatically calculates position sizes based on:

- **Contract Size**: Number of contracts in the signal
- **Equity Percent**: Percentage of account equity to risk (configurable per user)

### User-Specific Position Sizing

Each user can configure their account settings:

- Account value
- Contract type preference (mini vs micro)
- Risk percentage per trade

The system will scale the signal quantity based on these settings.

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Entry signal logged: NQTrend Long @ $21500.50",
  "logId": 4050002,
  "tradeId": 12345,
  "signalType": "entry",
  "processingTimeMs": 83
}
```

### Error Response

```json
{
  "success": false,
  "message": "Webhook processing failed",
  "error": "Invalid or missing authentication token",
  "logId": 4050001,
  "processingTimeMs": 51
}
```

## Health Check Endpoint

```
GET https://intradaydash-jfmy8c2b.manus.space/api/webhook/tradingview/health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-29T22:19:16.811Z",
  "endpoint": "/api/webhook/tradingview"
}
```

## Testing

To test the webhook without creating real trades, add `"isTest": true` to the payload:

```json
{
  "symbol": "NQTrend",
  "date": "2026-01-29T22:20:00Z",
  "data": "buy",
  "position": "long",
  "quantity": 1,
  "price": 21500.5,
  "token": "RobTradingDashWebhookToken32K",
  "isTest": true
}
```

## Troubleshooting

1. **Invalid token error**: Ensure the token matches exactly (case-sensitive)
2. **Unknown strategy**: Check that the symbol is in the supported list
3. **Duplicate trade**: The system prevents duplicate entries within a short time window
4. **Processing paused**: Check the admin dashboard if webhook processing is paused
