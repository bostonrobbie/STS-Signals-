# IBKR Client Portal Gateway Connectivity Guide

## Overview

The IBKR (Interactive Brokers) integration requires the **Client Portal Gateway** to be running on the user's local machine. This creates a connectivity challenge when the dashboard is hosted in the cloud, as the cloud server cannot directly reach `localhost:5000` on the user's machine.

## The Problem

```
┌─────────────────────┐         ┌─────────────────────┐
│   Cloud Dashboard   │   ✗     │   User's Computer   │
│   (manus.space)     │ ──────> │   localhost:5000    │
│                     │ Cannot  │   (IBKR Gateway)    │
└─────────────────────┘ reach   └─────────────────────┘
```

The cloud-hosted dashboard cannot directly communicate with the IBKR Client Portal Gateway running on the user's local machine because:

1. `localhost` refers to the server's own loopback interface, not the user's machine
2. The user's local machine is typically behind NAT/firewall
3. There's no direct network path from cloud to local machine

## Solutions

### Solution 1: ngrok Tunnel (Recommended for Testing)

**Best for:** Individual users testing the integration

[ngrok](https://ngrok.com/) creates a secure tunnel from the internet to your local machine.

**Setup Steps:**

1. Install ngrok:
   ```bash
   # macOS
   brew install ngrok
   
   # Windows (via Chocolatey)
   choco install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. Create a free ngrok account and get your auth token

3. Configure ngrok:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

4. Start the IBKR Client Portal Gateway (default port 5000)

5. Create the tunnel:
   ```bash
   ngrok http 5000
   ```

6. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)

7. In the dashboard Admin → Brokers tab, enter the ngrok URL instead of `localhost:5000`

**Pros:**
- Quick setup
- Free tier available
- Works with any firewall configuration

**Cons:**
- URL changes each time (unless paid plan)
- Adds latency (~50-100ms)
- Free tier has connection limits

### Solution 2: Cloudflare Tunnel (Recommended for Production)

**Best for:** Users who want a permanent, secure connection

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) provides a more robust solution.

**Setup Steps:**

1. Create a Cloudflare account (free)

2. Install cloudflared:
   ```bash
   # macOS
   brew install cloudflared
   
   # Windows
   winget install --id Cloudflare.cloudflared
   ```

3. Authenticate:
   ```bash
   cloudflared tunnel login
   ```

4. Create a tunnel:
   ```bash
   cloudflared tunnel create ibkr-gateway
   ```

5. Configure the tunnel (create `~/.cloudflared/config.yml`):
   ```yaml
   tunnel: YOUR_TUNNEL_ID
   credentials-file: /path/to/credentials.json
   
   ingress:
     - hostname: ibkr.yourdomain.com
       service: http://localhost:5000
     - service: http_status:404
   ```

6. Route DNS:
   ```bash
   cloudflared tunnel route dns ibkr-gateway ibkr.yourdomain.com
   ```

7. Run the tunnel:
   ```bash
   cloudflared tunnel run ibkr-gateway
   ```

**Pros:**
- Permanent URL
- Better security (Cloudflare's network)
- Lower latency than ngrok
- Free tier is generous

**Cons:**
- Requires a domain name
- More complex setup

### Solution 3: VPN / Tailscale (For Advanced Users)

**Best for:** Users with technical expertise who want direct connectivity

[Tailscale](https://tailscale.com/) creates a mesh VPN that allows direct connectivity.

**Setup:**

1. Install Tailscale on both the server and your local machine
2. Both devices get stable IP addresses on the Tailscale network
3. Use the Tailscale IP of your local machine in the Gateway URL

**Pros:**
- Direct connection (lowest latency)
- No URL changes
- Encrypted end-to-end

**Cons:**
- Requires Tailscale on both ends
- More complex network setup

### Solution 4: Browser Extension Approach (Future)

A browser extension could act as a bridge between the cloud dashboard and local IBKR Gateway:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Cloud Dashboard │ ←→ │ Browser Extension│ ←→ │  IBKR Gateway   │
│  (WebSocket)     │    │ (Local Proxy)    │    │  localhost:5000 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

This approach is being considered for future development.

## Security Considerations

### SSL/TLS
- The IBKR Client Portal Gateway uses self-signed certificates by default
- ngrok and Cloudflare Tunnel handle SSL termination
- Always use HTTPS in production

### Authentication
- The IBKR Gateway requires authentication via the Client Portal
- Sessions expire after ~24 hours of inactivity
- Consider implementing session keep-alive

### Firewall Rules
- Only expose the IBKR Gateway through the tunnel
- Don't open port 5000 directly to the internet
- Use tunnel-specific authentication where available

## Recommended Setup for Production

For most users, we recommend:

1. **Cloudflare Tunnel** for the connection
2. **Systemd service** (Linux) or **Windows Service** to auto-start the tunnel
3. **Monitoring** to alert if the tunnel goes down

### Example Systemd Service

```ini
[Unit]
Description=Cloudflare Tunnel for IBKR Gateway
After=network.target

[Service]
Type=simple
User=your-username
ExecStart=/usr/local/bin/cloudflared tunnel run ibkr-gateway
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### "Cannot reach IBKR Gateway"
1. Verify the Client Portal Gateway is running
2. Check the Gateway URL is correct
3. Verify the tunnel is active
4. Check for firewall blocking

### "Gateway running but not authenticated"
1. Open the Client Portal in your browser
2. Log in with your IBKR credentials
3. Keep the browser tab open (session management)

### "Connection timeout"
1. Check tunnel latency
2. Verify network connectivity
3. Try restarting the tunnel

## Alternative: Tradovate

If IBKR connectivity proves challenging, consider using **Tradovate** as your broker:

- OAuth-based authentication (no local gateway needed)
- Direct cloud-to-cloud connectivity
- Simpler setup process
- Full futures trading support

The dashboard supports both brokers, and Tradovate may be easier for users who don't want to manage a local gateway.

## Support

For issues with:
- **IBKR Client Portal Gateway**: Contact IBKR support
- **ngrok/Cloudflare Tunnel**: Refer to their documentation
- **Dashboard Integration**: Contact us at support@example.com
