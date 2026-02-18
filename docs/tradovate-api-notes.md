# Tradovate API Integration Notes

## Authentication

Tradovate uses a credentials-based authentication system:

### Access Token Request
```bash
POST https://demo.tradovateapi.com/v1/auth/accesstokenrequest  # Demo
POST https://live.tradovateapi.com/v1/auth/accesstokenrequest  # Live

{
  "name": "username",
  "password": "password", 
  "appId": "Sample App",
  "appVersion": "1.0",
  "cid": 8,          
  "sec": "f03741b6-f634-48d6-9308-c8fb871150c2",
  "deviceId": "unique-device-id"
}
```

### Using Access Token
```
Authorization: Bearer <access_token>
```

## API Endpoints

- **Demo**: `https://demo.tradovateapi.com/v1/`
- **Live**: `https://live.tradovateapi.com/v1/`

## Key Endpoints

- `/account/list` - Get user accounts
- `/order/placeorder` - Place orders
- `/position/list` - Get positions
- `/contract/find` - Find contracts

## User Flow for Integration

1. User enters Tradovate credentials (username/password)
2. We request access token from Tradovate API
3. Store encrypted credentials/token in database
4. Use token for order placement when webhook signals arrive

## Security Considerations

- Store credentials encrypted (AES-256)
- Tokens expire - need refresh mechanism
- Use demo environment for testing
- Never log credentials


## Order Placement Details (from API docs)

### POST /order/placeorder

#### Market Order Example
```javascript
const body = {
  accountSpec: yourUserName,
  accountId: yourAcctId,
  action: "Buy",  // or "Sell"
  symbol: "MYMM1",  // Contract symbol
  orderQty: 1,
  orderType: "Market",
  isAutomated: true  // Required for API orders
}
```

#### Limit Order Example
```javascript
const body = {
  accountSpec: yourUserName,
  accountId: yourAcctId,
  action: "Sell",
  symbol: "MYMM1",
  orderQty: 1,
  orderType: "Limit",
  price: 35000,
  isAutomated: true
}
```

### Order Response Fields
- `accountSpec`: Account identifier
- `accountId`: Account ID
- `clOrdId`: Client order ID
- `action`: Buy/Sell
- `symbol`: Contract symbol
- `orderQty`: Quantity
- `orderType`: Market/Limit/Stop/StopLimit
- `price`: Price (for limit orders)
- `stopPrice`: Stop price (for stop orders)
- `timeInForce`: Day/GTC/IOC/FOK
- `isAutomated`: Boolean (required for API orders)

### Cancel Order
```
POST /order/cancelorder
Body: { orderId: <order_id> }
```

### Liquidate Position
```
POST /order/liquidateposition
Body: { accountId: <account_id>, contractId: <contract_id> }
```

## Rate Limits
- Hourly, minute, and second limits apply
- 429 status code when exceeded
- Time penalty response includes `p-ticket` and `p-time` fields

## Requirements for API Access
1. LIVE account with >$1000 equity
2. API Access subscription
3. Generated API Key (cid and sec)
