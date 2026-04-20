# Manus Compatibility Contract

The single source of truth for **what Manus expects from our codebase**
and **what our codebase must never change without coordination**. Every
PR merges through `main`, Manus builds from `main`, and any assumption
documented here must hold after the merge.

If Manus changes their side (rotates a key, adds an env var, changes
how they inject scripts), **update this file first**, THEN adjust our
code to match. Do not make assumptions — verify against current prod.

Last verified against prod: **2026-04-20** (see `docs/DATA_INTEGRITY_AUDIT.md`
for how to re-verify).

**Manual-migration note:** `drizzle/manual/*.sql` files exist for schema
changes that can't flow through `drizzle-kit migrate` on Manus's build
(because Manus's deploy does not reliably run post-deploy hooks). They
are idempotent (safe to re-run) and must be applied once per migration
by hand against the Manus prod DB. See `drizzle/manual/README.md` for
the list and instructions.

---

## 1. What Manus hosts / owns

| Resource | Manus-owned | Notes |
|---|---|---|
| Domain (`stsdashboard.com`) | ✅ | DNS managed by Manus |
| TLS certificate | ✅ | Auto-renewed by Manus |
| CDN / edge | ✅ Cloudflare sits in front; Manus controls origin | Confirmed `Server: cloudflare` header |
| Application runtime | ✅ | Node + MySQL + Redis stack |
| Production database (TiDB/MySQL) | ✅ | See `CEO_PLAYBOOK.md` |
| Stripe integration | 🟡 Owned by Rob (rgorham369@gmail.com) | Manus hosts the webhook handler but account is ours |
| Resend (email) | 🟡 Owned by Rob | Manus hosts but API key is ours |
| TradingView webhook endpoint | 🟡 Owned by Rob | Webhook URL is on `stsdashboard.com` but the TradingView alerts point there |
| GitHub repo (main) | 🟡 Owned by Rob | Manus pulls from here on each deploy |

## 2. What Manus injects at build time (NOT in GitHub)

These exist in production but are invisible in the GitHub source tree.
When we edit our source, Manus still overlays these on top at build
time. Change to any of these requires a Manus-side action.

| Injected asset | Where it shows up | Why we care |
|---|---|---|
| `files.manuscdn.com/manus-space-dispatcher/spaceEditor-*.js` | Every page `<script>` | Runtime editor — flagged by ads classifiers |
| `manus-analytics.com/script.js` (Umami, website-id `622a1ccc-...`) | Every page | Tracks subscribers → Manus's dashboard, not ours |
| `plausible.io` with `data-domain="manus.space"` | Every page | Tracks subscribers → Manus's Plausible |
| Amplitude SDK with key `46ac3f9abb41dd2d17a5785e052bc6d3` | Window global `__manus__global_env.amplitudeKey` | Tracks subscribers → Manus's Amplitude |
| CloudFront image host `d2xsxph8kpxj0f.cloudfront.net/110198424/...` | Landing page hero images | Our `LandingPage.tsx` references these URLs directly |
| `@/lib/funnelTracking` module | Source imports it, but file lives only on Manus | Build pipeline resolves this out of our source tree |
| `@/hooks/useHomepageAnalytics` module | Same — imports reference it, file not in repo | Build pipeline resolves out of source |
| `.manus/db/*` | Build metadata Manus uses for incremental deploys | Gitignored |
| `VITE_MANUS_*` env vars | Runtime config Manus sets automatically | We must read, never write |

**Critical implication:** pulling `main` locally and trying to build will
hit import errors for `funnelTracking` and `useHomepageAnalytics`.
We've stubbed those in the local sandbox (`C:\sts-local`) but they
should NOT be committed to GitHub — Manus will overwrite them.

## 3. Environment variables Manus sets (we read, never write)

| Var | Manus sets | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | MySQL/TiDB connection string |
| `STRIPE_SECRET_KEY` | ✅ | Set from Rob's Stripe account |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Set from Rob's Stripe webhook config |
| `RESEND_API_KEY` | ✅ | Set from Rob's Resend account |
| `JWT_SECRET` | ✅ | Session signing key |
| `ENCRYPTION_MASTER_KEY` | ✅ | At-rest field encryption |
| `TRADINGVIEW_WEBHOOK_TOKEN` | ✅ | Shared secret for TradingView → our webhook |
| `OAUTH_SERVER_URL` | ✅ | Manus OAuth backend URL |
| `VITE_APP_ID` | ✅ | Manus app identifier |
| `OWNER_EMAIL` | 🟡 | Defaults to `rgorham369@gmail.com` in `server/_core/env.ts` |
| `MANUS_APP_DOMAIN` | ✅ | Webhook URL generation |
| `BUILT_IN_FORGE_API_URL` | ✅ | LLM fallback URL |
| `BUILT_IN_FORGE_API_KEY` | ✅ | LLM API key |
| `NODE_ENV` | ✅ | `production` for live, `staging` for staging |

## 4. Environment variables WE control (must ask Manus to set)

Any new env var we want to use must be added to Manus's environment
config. These are the ones we've added on our side:

| Var | Purpose | Default if unset |
|---|---|---|
| `VITE_GA4_MEASUREMENT_ID` | GA4 tracking ID | falls back to hardcoded `G-LVFVPLWCVP` |
| `GA4_API_SECRET` | server-side conversion | no server MP events |
| `VITE_GTM_CONTAINER_ID` | Google Tag Manager | GTM doesn't load |
| `VITE_META_PIXEL_ID` | Meta Pixel | Pixel doesn't load |
| `META_CAPI_ACCESS_TOKEN` | Meta CAPI | no server CAPI events |
| `VITE_POSTHOG_KEY` | PostHog SDK | PostHog doesn't load |
| `VITE_SENTRY_DSN` | browser Sentry | no browser error capture |
| `SENTRY_DSN` | server Sentry | no server error capture |
| `INDEXNOW_KEY` | Bing/Yandex IndexNow | IndexNow doesn't work |
| **`OUTBOUND_COMMS_ENABLED`** | **🔴 master kill-switch for all emails/SSE/push** | **defaults to `true`** — set to `false` before any test work |

## 5. What we must NOT change without coordination

Changing any of these will break Manus's build or staging OR their
shared prod infrastructure. Require a coordinated Manus-side update
BEFORE merging the change.

- ❌ Removing `vite-plugin-manus-runtime` from `package.json` — Manus's
  build pipeline expects it
- ❌ Removing `@builder.io/vite-plugin-jsx-loc` — same
- ❌ Removing `registerOAuthRoutes` call in `server/_core/index.ts` —
  existing subscribers may have sessions tied to Manus OAuth
- ❌ Removing CORS allowlists for `.manus.computer` / `.manus.space` /
  `.manusvm.computer` — Manus dashboard iframes / test tools may break
- ❌ Removing `api.manus.im` from CSP `connect-src` — OAuth breaks for
  existing Manus-authenticated users
- ❌ Renaming `users.loginMethod`, `users.openId`, `users.subscriptionStatus`
  columns — Manus writes to these directly
- ❌ Removing `public/privacy-policy.md`, `public/refund-policy.md`, etc —
  Manus's CMS may serve these
- ⚠️ Changing the Stripe webhook URL pattern (`/api/stripe/webhook`) —
  Stripe config must be updated in lockstep
- ⚠️ Changing the TradingView webhook URL pattern (`/api/webhook/tradingview`)
  — every subscriber's TradingView alert config must be updated

## 6. What we CAN safely change

- ✅ Anything in `client/src/` (React components, pages, hooks, lib)
- ✅ Anything under `client/public/` (static assets, blog markdown,
  sitemap.xml, robots.txt, llms.txt, llms-full.txt)
- ✅ `server/routers/` — new additive routers (safe if they only read)
- ✅ `server/services/` — new additive services
- ✅ `server/_core/commsGuard.ts` (new — our invention)
- ✅ Anything under `docs/`
- ✅ Scripts in `scripts/`
- ✅ Meta tags and structured data in `client/index.html`
- ✅ `server/webhookService.ts` — as long as the external API contract
  (request/response shapes) stays the same

## 7. Staging/prod isolation (the incident context)

**Confirmed leakage:** Manus's staging environment can affect real
subscribers. Specific incident: test-env session suppressed real exit
alerts, then a retry fired duplicate alerts. Root causes suspected:

1. Shared database between staging and prod
2. Shared webhook retry queue
3. Shared Resend / SSE broadcast state

**Our mitigations in code (as of safety-nets-persistent-dedupe branch):**

- `OUTBOUND_COMMS_ENABLED=false` env flip = no outbound comms at all.
  Use before every test session on Manus.
- Strategy symbols prefixed with `TEST-`, `STAGING-`, `DEV-`, `SANDBOX-`
  bypass all notifications regardless of other flags.
- Signal dedupe by fingerprint (strategy+direction+price+60s bucket).
  The same signal cannot fire twice within a minute, defeating the
  retry-storm pattern from the incident.
  - DB-backed (`signal_fingerprints` table) is the primary path —
    survives restarts and works across replicas.
  - In-memory fallback if the table doesn't exist yet.
- Per-recipient email rate limit (3/5min per subject). Even if a
  retry escapes dedupe, a user can't receive 5 emails for 1 signal.
- Kill-switch health monitor: if `OUTBOUND_COMMS_ENABLED=false` for
  >60 minutes, logs every 10 minutes and the admin-dashboard banner
  turns red. Prevents Rob from forgetting to flip the switch back.
- `getTrades()` + `getTradeSourceBreakdown()` + daily-digest query
  default to `isTest = 0` — a missing isTest filter was the specific
  leak vector called out in the incident runbook §"shared DB breach".

## 8. Manus features we RELY on

- GitHub → Manus auto-deploy on push to `main`
- Manus's TLS, DNS, CDN
- Manus's managed database (backups are Manus's responsibility)
- Manus's uptime (outages are Manus's responsibility)
- Manus's email sending infrastructure (they manage Resend billing)

## 9. Migration-exit plan (when Manus becomes untenable)

If we eventually need to leave Manus:

1. Export DB (mysqldump or via Manus's export UI if one exists)
2. Export Stripe (customers + subscriptions are portable — ours)
3. Export Resend (sender domain is ours; API key re-issued on new host)
4. Host stack lifted via Docker Compose to Hetzner (see `Migration_Plan/01_HOSTING_MIGRATION.md`)
5. DNS cutover at registrar (assumes we regain DNS control from Manus)
6. Migrate subscribers' sessions (force password reset for Manus-OAuth
   users, since we can't port OAuth tokens)

Current branch state protects us from hard lock-in: every safety-net
piece works identically on Manus and on Hetzner.

## 10. Review cadence

**Update this file when:**
- Manus adds a new env var we need to read
- Manus changes how they inject scripts (new CDN, new tracker)
- We add a new external dependency with a secret
- We discover a new production-only file that isn't in GitHub
- Production behavior changes unexpectedly post-merge (investigate + document)

**Verify this file when:**
- Before any major merge (see `docs/PR_MERGE_CHECKLIST.md`)
- After any production incident
- Quarterly, even if nothing seemed to change
