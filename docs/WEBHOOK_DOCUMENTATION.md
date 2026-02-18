# TradingView Webhook Integration Documentation

## Overview

This document provides comprehensive documentation for the TradingView webhook integration in the Intraday Strategies Dashboard. The webhook system receives trade signals from TradingView alerts and automatically logs them to your trading database.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Webhook Configuration](#webhook-configuration)
3. [TradingView Setup](#tradingview-setup)
4. [Security Features](#security-features)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Error Codes](#error-codes)

---

## Quick Start

### 1. Get Your Webhook URL

Navigate to the **Webhooks** page in your dashboard. Your unique webhook URL will be displayed:

```
https://your-domain.com/api/webhook/tradingview
```

### 2. Configure Authentication Token

Set up your `TRADINGVIEW_WEBHOOK_TOKEN` in the Settings → Secrets panel. This token authenticates incoming webhooks.

### 3. Create TradingView Alert

In TradingView, create an alert with the webhook URL and use the JSON message templates provided in the dashboard.

---

## Webhook Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TRADINGVIEW_WEBHOOK_TOKEN` | Yes | Secret token for authenticating webhook requests |
| `TRADINGVIEW_VALIDATE_IP` | No | Set to `true` to only accept requests from TradingView IPs |

### Supported Strategies

The webhook system supports the following strategy symbols:

| TradingView Symbol | Mapped Strategy | Description |
|-------------------|-----------------|-------------|
| ES, ES1!, ESH2024 | ESTrend | E-mini S&P 500 Trend Following |
| ES_ORB | ESORB | E-mini S&P 500 Opening Range Breakout |
| NQ, NQ1! | NQTrend | E-mini Nasdaq Trend Following |
| NQ_ORB | NQORB | E-mini Nasdaq Opening Range Breakout |
| CL, CL1! | CLTrend | Crude Oil Trend Following |
| BTC, BTCUSD | BTCTrend | Bitcoin Trend Following |
| GC, GC1! | GCTrend | Gold Trend Following |
| YM, YM1! | YMORB | E-mini Dow Opening Range Breakout |

---

## TradingView Setup

### Entry Signal Template

Use this JSON template for entry signals (buy/sell):

```json
{
  "symbol": "ESTrend",
  "date": "{{timenow}}",
  "data": "{{strategy.order.action}}",
  "quantity": 1,
  "price": "{{close}}",
  "token": "YOUR_SECRET_TOKEN"
}
```

### Exit Signal Template

Use this JSON template for exit signals:

```json
{
  "symbol": "ESTrend",
  "date": "{{timenow}}",
  "data": "exit",
  "quantity": 1,
  "price": "{{close}}",
  "direction": "Long",
  "entryPrice": "{{strategy.position_avg_price}}",
  "token": "YOUR_SECRET_TOKEN"
}
```

### TradingView Variables

| Variable | Description |
|----------|-------------|
| `{{timenow}}` | Current timestamp |
| `{{close}}` | Current close price |
| `{{strategy.order.action}}` | Order action (buy/sell) |
| `{{strategy.position_avg_price}}` | Average entry price |
| `{{strategy.order.price}}` | Order execution price |

### Creating an Alert in TradingView

1. Open your chart with the strategy applied
2. Click "Create Alert" (Alt+A)
3. Set your alert conditions
4. In the "Notifications" tab:
   - Enable "Webhook URL"
   - Paste your webhook URL
5. In the "Message" field, paste the JSON template
6. Click "Create"

---

## Security Features

### Authentication

All webhook requests must include a valid `token` field matching your `TRADINGVIEW_WEBHOOK_TOKEN`.

### Rate Limiting

- **Limit**: 60 requests per minute per IP address
- **Response**: HTTP 429 with `Retry-After` header when exceeded

### Input Validation

All incoming payloads are validated for:
- Maximum payload size (10KB)
- Maximum string length (1000 characters)
- Valid number ranges
- SQL injection patterns
- XSS attack patterns

### Replay Attack Prevention

Timestamps are validated to be within 5 minutes of server time to prevent replay attacks.

### Idempotency

Duplicate requests (same symbol, date, action, price) within 24 hours are automatically detected and return the cached result.

### Circuit Breaker

If the database experiences multiple failures, the circuit breaker opens to prevent cascading failures. Requests will receive HTTP 503 until the circuit resets.

### IP Validation (Optional)

When `TRADINGVIEW_VALIDATE_IP=true`, only requests from TradingView's official IP addresses are accepted:
- 52.89.214.238
- 34.212.75.30
- 54.218.53.128
- 52.32.178.7

---

## API Reference

### POST /api/webhook/tradingview

Main webhook endpoint for receiving trade signals.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "symbol": "string (required)",
  "date": "string (ISO 8601 timestamp)",
  "data": "string (buy|sell|exit|long|short)",
  "quantity": "number (default: 1)",
  "price": "number (required)",
  "token": "string (required if auth enabled)",
  "direction": "string (Long|Short, optional)",
  "entryPrice": "number (for exit signals)",
  "entryTime": "string (for exit signals)",
  "pnl": "number (optional)"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Trade created for ESTrend: Long +$150.00",
  "logId": 123,
  "tradeId": 456,
  "processingTimeMs": 45,
  "correlationId": "wh_abc123_def456"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid request payload",
  "errors": ["Missing \"price\" field"],
  "correlationId": "wh_abc123_def456"
}
```

### GET /api/webhook/health

Health check endpoint with detailed diagnostics.

**Response:**
```json
{
  "status": "healthy",
  "service": "tradingview-webhook",
  "version": "2.0.0",
  "timestamp": "2024-01-15T12:00:00Z",
  "security": {
    "rateLimitEnabled": true,
    "tokenAuthEnabled": true,
    "ipValidationEnabled": false
  },
  "diagnostics": {
    "isPaused": false,
    "last24Hours": {
      "total": 50,
      "success": 48,
      "failed": 2,
      "successRate": "96.0%"
    },
    "performance": {
      "avgProcessingTimeMs": 42,
      "maxProcessingTimeMs": 150,
      "p95ProcessingTimeMs": 85
    }
  }
}
```

### GET /api/webhook/templates

Get all strategy alert message templates.

### GET /api/webhook/status

Get current webhook processing status and statistics.

---

## Troubleshooting

### Common Issues

#### "Invalid or missing authentication token"

**Cause:** The `token` field in your webhook payload doesn't match `TRADINGVIEW_WEBHOOK_TOKEN`.

**Solution:**
1. Check your token in Settings → Secrets
2. Ensure the token in your TradingView alert matches exactly
3. Verify there are no extra spaces or characters

#### "Unknown strategy: XYZ"

**Cause:** The symbol in your webhook doesn't map to a known strategy.

**Solution:**
1. Check the [Supported Strategies](#supported-strategies) table
2. Use the exact symbol format (e.g., "ESTrend" not "ES Trend")
3. Add a custom symbol mapping if needed

#### "Exit signal received but no matching entry found"

**Cause:** An exit signal was received without a corresponding entry signal.

**Solution:**
1. Ensure entry signals are sent before exit signals
2. Include `entryPrice` and `entryTime` in exit signals
3. Check if the entry signal was processed successfully

#### "Rate limit exceeded"

**Cause:** Too many requests from your IP address.

**Solution:**
1. Wait for the `Retry-After` period
2. Reduce alert frequency in TradingView
3. Check for duplicate alerts

#### "Service temporarily unavailable" (503)

**Cause:** Circuit breaker is open due to database issues.

**Solution:**
1. Wait 30 seconds for automatic recovery
2. Check database connectivity
3. Contact support if issue persists

### Debugging Tips

1. **Check the Activity Log**: View recent webhook activity in the Webhooks page
2. **Use Test Simulator**: Send test webhooks from the dashboard to verify configuration
3. **Validate Payload**: Use the payload validator to check your JSON format
4. **Check Correlation ID**: Use the `X-Correlation-ID` header to trace requests in logs

---

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait and retry |
| `VALIDATION_ERROR` | Invalid payload format | Check payload structure |
| `TIMESTAMP_INVALID` | Request timestamp too old/new | Sync system time |
| `DUPLICATE` | Duplicate trade detected | Normal - request was already processed |
| `NO_ENTRY` | Exit without matching entry | Send entry signal first or include entry data |
| `PAUSED` | Processing is paused | Resume processing in dashboard |
| `SERVICE_UNAVAILABLE` | Circuit breaker open | Wait for recovery |
| `INTERNAL_ERROR` | Server error | Contact support |

---

## Support

For additional support:
- Check the webhook health endpoint: `/api/webhook/health`
- Review the activity log in your dashboard
- Use the test simulator to debug issues
- Contact support with your correlation ID for faster resolution
