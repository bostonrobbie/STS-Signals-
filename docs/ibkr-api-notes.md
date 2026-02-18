# Interactive Brokers (IBKR) API Integration Notes

## Overview

IBKR's Web API uses OAuth 2.0 with **private_key_jwt** authentication (RFC 7521/7523).
This is more complex than Tradovate but more secure.

## Authentication Method

- Uses signed JWT tokens (client_assertion)
- Client authenticates by presenting a signed JWT token
- Authorization server validates against public key(s) provided during registration
- No client secret passed in requests (more secure)

## API Communication

- All requests use HTTPS
- JSON format for requests/responses
- Standard HTTP verbs (GET, POST, PUT, DELETE)

## Access Types

1. **Organizations** - For businesses/trading firms
2. **Individuals** - For personal accounts
3. **Third Parties** - For apps serving multiple users

## Key Considerations

1. **Registration Required**: Need to register as a third-party application with IBKR
2. **OAuth Flow**: Users authorize our app to access their IBKR account
3. **JWT Signing**: Need to generate and sign JWT tokens with private key
4. **Public Key Registration**: Must provide public key to IBKR during registration

## Implementation Approach

For individual users connecting their own accounts:

1. User clicks "Connect IBKR" button
2. Redirect to IBKR OAuth authorization page
3. User logs in and authorizes our app
4. IBKR redirects back with authorization code
5. Exchange code for access token
6. Use access token for API calls

## Alternative: Client Portal Gateway

For simpler integration (but requires user to run gateway):

- User runs IBKR Client Portal Gateway locally
- Gateway handles authentication
- Our app connects to localhost gateway
- Not ideal for web-based solution

## Recommendation

Given complexity of IBKR OAuth registration for third-party apps,
consider starting with a "manual connection" approach where users:

1. Generate API credentials in their IBKR account
2. Enter credentials in our dashboard
3. We use those credentials for API access

This avoids the OAuth registration process while still enabling automation.

## Updated Research (Dec 27, 2025)

### Third-Party Approval Process (BARRIER)

IBKR requires a formal approval process for third-party integrations:

1. Submit onboarding questionnaire
2. Initial screening (2-3 weeks)
3. Compliance enhanced due diligence (3-6 weeks)
4. Legal agreement signing (3-5 weeks)

**Total time: 8-14 weeks minimum**

Requirements:

- Established business entity
- Public website with product details
- Proof of concept build
- Registration with financial authorities (for automated trading)

### Conclusion

Due to these barriers, we should:

1. **Build paper trading mode first** - No broker required
2. **Create guided onboarding** - Help users set up their own broker accounts
3. **Support manual credential entry** - For Tradovate (simpler API access)
4. **Consider IBKR approval later** - If platform grows significantly

### Futures Contract IDs (for reference)

```
GET /trsrv/futures?symbols=ES
GET /trsrv/futures?symbols=NQ
GET /trsrv/futures?symbols=CL
```

### Order Placement Example

```json
POST /iserver/account/{accountId}/orders
{
  "conid": 495512557,
  "side": "BUY",
  "orderType": "LMT",
  "price": 5000,
  "quantity": 1,
  "tif": "DAY"
}
```
