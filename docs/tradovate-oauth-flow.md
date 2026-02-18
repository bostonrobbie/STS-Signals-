# Tradovate OAuth Flow Implementation

## Overview
Tradovate uses standard OAuth 2.0 Authorization Code flow. This is how services like PickMyTrades implement their "Connect to Tradovate" button.

## Three-Step Process

### Step 1: Redirect to OAuth URL
Navigate user to Tradovate's OAuth URL with client credentials:
```
https://trader.tradovate.com/oauth
  ?response_type=code
  &client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
```

### Step 2: User Authenticates
- User sees Tradovate login screen
- User enters their Tradovate credentials
- Tradovate redirects back to our `redirect_uri` with a `code` parameter in the URL

### Step 3: Exchange Code for Access Token
POST to `https://live.tradovateapi.com/auth/oauthtoken` with:
```json
{
  "grant_type": "authorization_code",
  "client_id": "{CLIENT_ID}",
  "client_secret": "{CLIENT_SECRET}",
  "redirect_uri": "{REDIRECT_URI}",
  "code": "{CODE_FROM_CALLBACK}"
}
```

Response contains access token and expiration time.

## Required Environment Variables
- `TRADOVATE_CLIENT_ID` - Provided by Tradovate
- `TRADOVATE_CLIENT_SECRET` - Provided by Tradovate

## Implementation Notes
- The redirect_uri must be registered with Tradovate
- Access tokens expire and need to be renewed
- Store tokens securely (encrypted in database)
- Use demo API for testing: `https://demo.tradovateapi.com`
- Use live API for production: `https://live.tradovateapi.com`

## API Endpoints
- OAuth URL: `https://trader.tradovate.com/oauth`
- Token Exchange: `https://live.tradovateapi.com/auth/oauthtoken`
- Demo Token Exchange: `https://demo.tradovateapi.com/auth/oauthtoken`
