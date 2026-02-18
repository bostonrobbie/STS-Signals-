# TradingView Webhook API Contract

> **API Version**: 1.0.0  
> **Last Updated**: December 25, 2024  
> **Status**: STABLE - Breaking changes will increment major version

---

## Endpoint URL (LOCKED)

```
POST /api/webhook/tradingview
```

**This endpoint URL will NEVER change.** Your TradingView alerts configured with this URL will continue to work indefinitely.

---

## Authentication

Include your webhook token in the request body:

```json
{
  "token": "your-webhook-token-here",
  ...
}
```

The token is configured in your environment as `TRADINGVIEW_WEBHOOK_TOKEN`.

---

## Request Payload

### Required Fields

| Field              | Type   | Description                                            | Example                |
| ------------------ | ------ | ------------------------------------------------------ | ---------------------- |
| `symbol`           | string | Strategy identifier (must match a registered strategy) | `"ESTrend"`, `"NQORB"` |
| `price`            | number | Current price at signal time                           | `4500.25`              |
| `data` or `action` | string | Signal action (see Action Values below)                | `"buy"`, `"exit"`      |
| `token`            | string | Authentication token                                   | `"abc123..."`          |

### Optional Fields

| Field                 | Type    | Default              | Description                                       |
| --------------------- | ------- | -------------------- | ------------------------------------------------- |
| `date` or `timestamp` | string  | Current time         | Signal timestamp (ISO 8601 or TradingView format) |
| `quantity`            | number  | `1`                  | Number of contracts                               |
| `direction`           | string  | Inferred from action | `"Long"` or `"Short"`                             |
| `signalType`          | string  | Inferred             | `"entry"` or `"exit"`                             |
| `position`            | string  | -                    | Market position: `"long"`, `"short"`, `"flat"`    |
| `pnl`                 | number  | Calculated           | Override P&L calculation (in dollars)             |
| `comment`             | string  | -                    | Optional note for the trade                       |
| `isTest`              | boolean | `false`              | Mark as test data (excluded from analytics)       |

### Action Values (Case-Insensitive)

**Entry Actions (Open Position)**

- `buy`, `long`, `entry`, `enter`, `open`, `open_long`, `entry_long`

**Short Entry Actions**

- `sell`, `short`, `open_short`, `entry_short`

**Exit Actions (Close Position)**

- `exit`, `close`, `flat`, `cover`, `exit_long`, `exit_short`, `close_long`, `close_short`

---

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "Entry signal logged: ESTrend Long @ $4500.25",
  "logId": 123,
  "positionId": 45,
  "processingTimeMs": 85,
  "correlationId": "wh_abc123_def456",
  "signalType": "entry"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Human-readable error description",
  "error": "ERROR_CODE",
  "logId": 123,
  "processingTimeMs": 50,
  "correlationId": "wh_abc123_def456"
}
```

---

## Error Codes

| Code                  | HTTP Status | Description                | Resolution              |
| --------------------- | ----------- | -------------------------- | ----------------------- |
| `VALIDATION_ERROR`    | 400         | Invalid payload format     | Check required fields   |
| `TIMESTAMP_INVALID`   | 400         | Timestamp too old/future   | Use current timestamp   |
| `RATE_LIMIT_EXCEEDED` | 429         | Too many requests          | Wait and retry          |
| `SERVICE_UNAVAILABLE` | 503         | Circuit breaker open       | Wait 30 seconds         |
| `PAUSED`              | 503         | Webhook processing paused  | Contact admin           |
| `POSITION_EXISTS`     | 200         | Already have open position | Send exit signal first  |
| `NO_OPEN_POSITION`    | 200         | No position to close       | Send entry signal first |
| `DUPLICATE`           | 200         | Duplicate signal detected  | Add unique timestamp    |
| `INTERNAL_ERROR`      | 500         | Server error               | Contact support         |

---

## TradingView Alert Templates

### Universal Template (Recommended)

```json
{
  "symbol": "ESTrend",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "position": "{{strategy.market_position}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{close}}",
  "token": "YOUR_TOKEN_HERE"
}
```

### Entry-Only Template

```json
{
  "symbol": "ESTrend",
  "signalType": "entry",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "direction": "{{strategy.market_position}}",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{strategy.order.price}}",
  "token": "YOUR_TOKEN_HERE"
}
```

### Exit-Only Template

```json
{
  "symbol": "ESTrend",
  "signalType": "exit",
  "date": "{{timenow}}",
  "data": "exit",
  "position": "flat",
  "quantity": "{{strategy.order.contracts}}",
  "price": "{{strategy.order.price}}",
  "token": "YOUR_TOKEN_HERE"
}
```

---

## Registered Strategies

| Symbol     | Name                      | Instrument     |
| ---------- | ------------------------- | -------------- |
| `ESTrend`  | ES Trend Following        | E-mini S&P 500 |
| `ESORB`    | ES Opening Range Breakout | E-mini S&P 500 |
| `NQTrend`  | NQ Trend Following        | E-mini NASDAQ  |
| `NQORB`    | NQ Opening Range Breakout | E-mini NASDAQ  |
| `CLTrend`  | CL Trend Following        | Crude Oil      |
| `BTCTrend` | BTC Trend Following       | Bitcoin        |
| `GCTrend`  | GC Trend Following        | Gold           |
| `YMORB`    | YM Opening Range Breakout | E-mini Dow     |

---

## Rate Limits

| Limit  | Value       | Window   |
| ------ | ----------- | -------- |
| Per IP | 60 requests | 1 minute |
| Global | Unlimited   | -        |

Rate limit headers are included in responses:

- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Unix timestamp when window resets
- `Retry-After`: Seconds to wait (when rate limited)

---

## Security Features

1. **Token Authentication**: Required for all requests
2. **Rate Limiting**: 60 req/min per IP
3. **Replay Protection**: Timestamps must be within 5 minutes
4. **Idempotency**: Duplicate requests return cached result (24h)
5. **Input Validation**: SQL injection and XSS prevention
6. **Circuit Breaker**: Auto-recovery from database failures

---

## Testing

### Test Mode

Add `"isTest": true` to your payload to mark signals as test data:

```json
{
  "symbol": "ESTrend",
  "data": "buy",
  "price": 4500,
  "token": "YOUR_TOKEN",
  "isTest": true
}
```

Test data:

- Is logged and processed normally
- Creates positions and trades marked as test
- Is excluded from production analytics
- Can be cleaned up via admin panel

### Health Check

```
GET /api/webhook/health
```

Returns system status, success rates, and latency metrics.

### Weekend Testing (Market Closed)

You can test webhooks anytime, even when markets are closed:

1. **Use Test Mode**: Add `"isTest": true` to your payload - this marks trades as test data
2. **Use the Simulator**: Go to Admin → Test Signals to simulate webhooks without TradingView
3. **Paper Trading**: Use the Paper Trading feature in Broker Setup to practice order execution

Test data is:

- Processed through the full pipeline (validation, logging, position tracking)
- Excluded from production analytics and performance metrics
- Cleanable via Admin → Advanced → Settings → Clear Test Data

---

## Versioning Policy

- **Major version** (1.x.x → 2.x.x): Breaking changes to endpoint URL or required fields
- **Minor version** (1.0.x → 1.1.x): New optional fields or features
- **Patch version** (1.0.0 → 1.0.1): Bug fixes, no API changes

Current version is returned in response headers:

```
X-API-Version: 1.0.0
```

---

## Changelog

### v1.0.0 (December 25, 2024)

- Initial stable release
- Locked endpoint URL: `/api/webhook/tradingview`
- Added action aliases for flexibility
- Added test mode support
- Added comprehensive error messages
