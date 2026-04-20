# Pre-Merge Checklist — Read This Before Every Merge to `main`

Every PR merge to `main` triggers a Manus production deploy. If
anything on this list isn't green, **don't merge yet**. Re-queue the
PR or fix the issue first.

Takes 5 minutes. Saves incidents like the test-env-broke-prod one.

---

## 🔴 Hard blockers — must pass, no exceptions

### 1. Manus Contract check
- [ ] Read `docs/MANUS_CONTRACT.md` section 5 ("must NOT change")
- [ ] Does the PR touch any forbidden file/field? If yes → do not merge.
- [ ] Does the PR add a new env var? If yes → confirm it's documented
  in section 4 AND you've sent Manus the value to configure.

### 2. Outbound communications
If the PR touches ANY of:
`server/webhookService.ts`, `server/services/resendEmail.ts`,
`server/stripe/stripeWebhook.ts`, `server/_core/notification.ts`,
`server/sseNotifications.ts`, `server/services/email.service.ts`:

- [ ] Confirm the `commsGuard.decideSubscriberNotify()` call is present
  before any subscriber notification
- [ ] Confirm the `outboundCommsEnabled()` check is present in any new
  email send path
- [ ] Verify `payload.isTest` is respected in the flow
- [ ] If you added a new notification type, wire it through `commsGuard`

### 3. Database migrations / schema
- [ ] No column renames in `drizzle/schema.ts` (see contract §5)
- [ ] New columns are nullable (don't break existing rows)
- [ ] No new migration files without testing `drizzle-kit push` locally

### 4. Data integrity
- [ ] Numbers in meta descriptions / llms.txt / about page match the
  current live backtest (see `docs/DATA_INTEGRITY_AUDIT.md` §1 for
  canonical numbers)
- [ ] Re-run the verification SQL from `DATA_INTEGRITY_AUDIT.md` §7 if
  the PR touches the trades / strategy tables

### 5. Type check
- [ ] `pnpm check` passes locally (zero errors)
- [ ] If TypeScript warnings changed significantly, investigate

### 6. Manus-injected modules
- [ ] PR does NOT add `client/src/lib/funnelTracking.ts` — Manus overlays this
- [ ] PR does NOT add `client/src/hooks/useHomepageAnalytics.ts` — Manus overlays this
- [ ] PR does NOT commit stubs for the above (they'll conflict with
  Manus's real files at build time)

## 🟡 Soft blockers — strongly recommended

### 7. Staging-friendliness
- [ ] Set `OUTBOUND_COMMS_ENABLED=false` on Manus staging BEFORE
  deploying any PR that touches webhook/email logic
- [ ] Wait 10 min post-deploy, check staging `/api/health` returns 200
- [ ] Check staging `/admin/business` — no stack traces in log

### 8. SEO/AEO
- [ ] If new public routes added, `sitemap.xml` updated (or
  `scripts/generate-sitemap.mts` run)
- [ ] New pages have `<SEOStructured>` or at minimum `<SEOHead>`
- [ ] Blog posts have entries in `manifest.json`

### 9. Tests (when they exist)
- [ ] `pnpm test` passes — no new regressions

## 🟢 Recommended but optional

### 10. Documentation
- [ ] If the PR adds a new external integration, `MANUS_CONTRACT.md`
  updated (new env var, new service dependency)
- [ ] If behavior observable-to-customers changes, `CHANGELOG` updated
  (we don't have one — consider starting)

### 11. Performance
- [ ] No new `<img>` tags without `loading="lazy"` + width/height
- [ ] No new external script in `<head>` without justification
- [ ] Bundle size didn't grow > 50KB for this PR (check `pnpm build`
  output)

### 12. Accessibility
- [ ] New interactive elements are keyboard-accessible
- [ ] New images have meaningful `alt` text
- [ ] Color-only info has a non-color secondary signal

---

## Post-merge verification (first 15 min after Manus redeploys)

Within 5 minutes:
- [ ] `https://stsdashboard.com/api/health` returns 200
- [ ] Landing page loads, equity curve renders
- [ ] Admin dashboard loads (`/admin`)
- [ ] No alarm from Sentry / Grafana if configured

Within 15 minutes:
- [ ] Test webhook from TradingView (or `isTest: true` curl):
  signal appears in `webhook_logs`, NO email fires (dev-guard
  catches `isTest`)
- [ ] Check `/admin/business` webhook success rate is ≥ previous
  value
- [ ] No error spike in server log

If anything above fails → **revert the PR** via GitHub's "Revert pull
request" button → Manus redeploys to the prior commit. Revert is
always safe; it's a single-click operation.

## The test-env incident — how this checklist would have caught it

The incident:
> Test environment session → suppressed real exit alert → retry fired
> duplicate alerts later

What this checklist adds that would have prevented it:

1. Step 2: **"commsGuard wired into every notification path"** →
   the test-env session's signal would have been blocked by the
   test-prefix check OR the dedupe, depending on how the leak
   happened
2. Post-merge: **"Set OUTBOUND_COMMS_ENABLED=false on staging before
   deploying"** → if Rob had flipped the kill switch before starting
   his test work, no real subscribers could have been touched
3. Step 10 in the branch itself: **rate limit** → even if the guard
   missed, the same user couldn't have received duplicate alerts
   for the same signal

All three layers are now in code. Future versions of this
incident should be impossible.

---

## One-click checklist (copy into every PR description)

```
## Pre-merge checklist

- [ ] 🔴 Manus Contract §5 not violated
- [ ] 🔴 commsGuard wired for any notification change
- [ ] 🔴 No forbidden schema changes
- [ ] 🔴 Data integrity numbers match
- [ ] 🔴 `pnpm check` clean
- [ ] 🔴 No stub modules committed (funnelTracking, useHomepageAnalytics)
- [ ] 🟡 Staging OUTBOUND_COMMS_ENABLED=false if touching notifications
- [ ] 🟡 sitemap.xml updated if new routes
- [ ] 🟢 Performance delta reviewed
- [ ] 🟢 Accessibility checked
```
