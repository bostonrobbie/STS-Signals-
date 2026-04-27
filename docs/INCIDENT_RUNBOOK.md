# Incident Runbook — When Prod Misbehaves

Step-by-step for "something's wrong on stsdashboard.com." Designed for
Rob to follow while on a phone and mildly panicked. Flip the kill
switch first, investigate second.

---

## 🚨 EMERGENCY — subscribers may be getting wrong signals right now

### Step 1 (30 seconds): flip the kill switch

On Manus → Project settings → Environment variables:

```
OUTBOUND_COMMS_ENABLED = false
```

Hit save → Manus restarts the app → **no more emails, no SSE pushes,
no signal notifications** of any kind. This is safe to set for any
length of time; subscribers just see no new signals on the dashboard
(no false alerts either).

### Step 2 (2 minutes): tell subscribers

Send one email from Resend dashboard (or `rgorham369@gmail.com`) to
whoever's affected. Template:

```
Subject: STS Futures — brief signal alert pause while we investigate

Hi,

We've temporarily paused signal email notifications while we
investigate a technical issue. Signals on the web dashboard at
stsdashboard.com are accurate and reliable — please check there if
you want to confirm current positions.

We'll email once signal emails resume. Typically within the hour.

— Rob
```

Post the same message in any Twitter/Discord/etc you have.

### Step 3 (5 minutes): assess what happened

Log in to Manus → view server logs for the last hour:

```
grep -i "error\|fail\|duplicate\|suppressed" [recent log window]
```

Also check `/admin/business` if it's accessible — look at:
- Webhook success rate (should be ≥ 95% normally)
- Pending Retries + Dead Letter (should be 0; non-zero means queue is stuck)
- Latest trade timestamp (should be recent if market is open)

### Step 4 (15 minutes): identify category of failure

| Symptom | Likely cause | Next step |
|---|---|---|
| No signals firing at all | Webhook auth broken, token rotated | Check `TRADINGVIEW_WEBHOOK_TOKEN` env var matches TV alert |
| Signals firing but emails not arriving | Resend API key rotated or rate-limited | Check Resend dashboard for bounces/blocks |
| Signals firing 2-3× for same trade | Dedupe failed OR retry queue stuck | Inspect `webhook_retry_queue` table; clear if needed |
| Dashboard showing wrong P&L | Trade data corruption | See `docs/DATA_INTEGRITY_AUDIT.md` §7 verification query |
| Page won't load | App crash OR DB connection lost | Server logs for uncaught error; DB connection count |
| Wrong trades/signals for wrong users | Database isolation breach | Immediately lock everything down, read §"shared DB breach" below |

### Step 5 (varies): fix the root cause

Follow the appropriate sub-runbook below. Only flip
`OUTBOUND_COMMS_ENABLED=true` once root cause is understood AND fixed.

---

## Sub-runbook: Shared-DB breach

Symptom: subscriber A is seeing subscriber B's trades / subscription
status, or a test entity showed up in real subscriber views.

1. Set `OUTBOUND_COMMS_ENABLED=false` (if not already)
2. Query the `users` table: any recent `subscriptionStatus` flips
   that shouldn't have happened?
3. Query the `trades` table: any rows with `isTest = 1` that are
   appearing in public queries?
4. Identify the breach vector — usually one of:
   - A query in `server/routers.ts` missing an `isTest` filter
   - A strategy row that should be TEST-* but isn't
   - Manus's test environment writing to real tables
5. **Patch the query** with an `isTest` filter (see Grep pattern below)
6. Deploy the patch (merge PR to main → Manus redeploys)
7. Re-enable outbound comms

Find query paths that might need isTest filter:

```
grep -rn "from(trades)" server/
grep -rn "from(users)" server/
```

Any SELECT that returns subscriber-visible trade rows should include
`WHERE isTest = 0` or `WHERE isTest = FALSE`.

---

## Sub-runbook: Signal double-fire (the incident pattern)

Symptom: subscribers received the same signal email 2+ times OR got
a signal for a trade that was already closed.

1. Flip kill switch `OUTBOUND_COMMS_ENABLED=false`
2. Query `webhook_logs` for the last hour:
   - Any rows with status "success" for the same `strategyId` +
     `direction` within 60s of each other?
   - Any rows with status "retrying" or "failed"?
3. Check `webhook_retry_queue` count — high count means queue is
   stuck
4. Check `dead_letter_queue` — non-zero means signals were
   permanently lost
5. The dedupe in `server/_core/commsGuard.ts` should have caught
   duplicate notifications within a 60s window. If it didn't:
   - Signal fingerprints differ by even 1 cent / 1 second? Adjust
     bucketing.
   - The DB-backed table `signal_fingerprints` survives restart. If
     it's missing, `drizzle/manual/0001_signal_fingerprints.sql` hasn't
     been applied — the code falls back to in-memory dedupe which
     resets on restart. Check the admin `/trpc/adminSafety.summary`
     endpoint — `dedupe.tableExists: false` means the migration is
     pending.
   - If the table exists, query it:
     ```sql
     SELECT * FROM signal_fingerprints
     WHERE strategySymbol = 'NQ_TREND_T3'
     ORDER BY firstSeenAt DESC LIMIT 10;
     ```
     If the fingerprint for the duplicate signal isn't in there, the
     insert probably raced or the price bucketing differs between calls.
6. Clear the retry queue manually if needed:
   ```sql
   DELETE FROM webhook_retry_queue WHERE createdAt < NOW() - INTERVAL 1 HOUR;
   ```
7. Re-enable comms

---

## Sub-runbook: Signal miss (silence during real move)

Symptom: NQ had a big move, the strategy should have fired, no
signal was published.

1. Check `webhook_logs` for the affected time window — was the
   webhook received at all?
2. If YES: status was probably "failed". Investigate the error in
   the log row.
3. If NO: the problem is upstream at TradingView. Log in to TV, check
   the alert history for that alert.
4. If TV shows the alert fired but our server didn't log it:
   - Check `TRADINGVIEW_WEBHOOK_TOKEN` — did Manus rotate it?
   - Check the destination URL in the TV alert — is it still
     `stsdashboard.com/api/webhook/tradingview`?
   - Check Cloudflare / Manus ingress logs for a 404/401/timeout
5. Once identified, patch the cause. Do NOT manually fire the missed
   signal via the dashboard simulator unless you're very sure — that's
   what caused the previous incident.

---

## Sub-runbook: Page won't load / 500 errors

1. `/api/health` — returns 200 or 503?
2. If 503, check memory / DB connection pool:
   - Log into Manus → metrics (if visible)
   - High memory → restart the container
   - Exhausted DB pool → check for a runaway query, restart
3. If 200 but pages still 500, check Sentry for the top error
4. Common fixes:
   - Env var missing → Manus config
   - DB schema drift → run migration (carefully)
   - Build artifact corrupted → redeploy the prior commit
5. If total mystery after 15 min → revert the latest merge via
   GitHub's one-click revert. Manus redeploys the prior state. Then
   investigate at leisure.

---

## Sub-runbook: Security alert

Symptom: Google Safe Browsing flags us, Search Console shows security
warning, or someone emails "your site is hacked"

1. Run the three-check matrix from `docs/GOOGLE_ADS_APPEAL.md` §
   Evidence:
   - Safe Browsing https://transparencyreport.google.com/safe-browsing/search?url=stsdashboard.com
   - Search Console Security & Manual Actions
   - VirusTotal https://www.virustotal.com/
2. If Search Console or Safe Browsing is clean, it's likely a
   classifier false positive (see our existing Ads disapproval
   history)
3. If genuinely flagged, check for:
   - Unexpected `<script>` tags on any page (compare against
     snapshot of known-good HTML)
   - Unexpected files in `client/public/`
   - Recent committer — was there a compromised GitHub account?
4. Rotate credentials:
   - Stripe keys
   - Resend API key
   - GitHub personal access tokens
   - Manus admin password
5. Contact Manus support if the injection vector is in their build
   pipeline

---

## Common diagnostic commands

### Recent webhook activity
```sql
SELECT id, strategySymbol, status, action, processingTimeMs, createdAt
FROM webhook_logs
ORDER BY createdAt DESC LIMIT 50;
```

### Subscribers who should have received a signal but didn't
```sql
SELECT u.id, u.email, u.subscriptionStatus, u.lastSignedIn
FROM users u
WHERE u.subscriptionStatus = 'active'
AND u.email IS NOT NULL
ORDER BY u.lastSignedIn DESC;
```

### Trade count consistency check
```sql
SELECT strategyId, COUNT(*) as trades, MIN(entryDate), MAX(exitDate),
       SUM(CASE WHEN isTest = 1 THEN 1 ELSE 0 END) as test_rows
FROM trades
GROUP BY strategyId;
```

### Last-24h retry queue health
```sql
SELECT status, COUNT(*) FROM webhook_retry_queue
WHERE createdAt > NOW() - INTERVAL 24 HOUR
GROUP BY status;
```

### Signal dedupe table health (is the safety net working?)
```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN expiresAt < NOW() THEN 1 ELSE 0 END) AS expired,
  MAX(firstSeenAt) AS most_recent_signal
FROM signal_fingerprints;
```
- If `total = 0` after a known-active market hour → the dedupe isn't
  writing. Either the table doesn't exist (migration pending) or the
  commsGuard path isn't reaching it. Check commsGuard logs.
- If `expired > 1000` → the 6h reaper isn't running. Check server
  restart or investigate `reapExpiredFingerprints` call site.

### Recent dedupe suppressions by strategy
```sql
SELECT strategySymbol, direction, signalType, COUNT(*) AS blocked
FROM signal_fingerprints
WHERE firstSeenAt > NOW() - INTERVAL 1 HOUR
GROUP BY strategySymbol, direction, signalType
ORDER BY blocked DESC;
```

---

## Kill-switch reference card

| Env var | Effect | When to flip |
|---|---|---|
| `OUTBOUND_COMMS_ENABLED=false` | No emails, no SSE, no push, no server conversion events | ANY suspected outbound-comms issue; before staging work |
| `RESEND_API_KEY=""` (unset) | No Resend emails (silent no-op) | Resend account emergency |
| `TRADINGVIEW_WEBHOOK_TOKEN=rotation_value` | Rejects all incoming TV webhooks until TV updated | Compromised token |

All three are single-env-var changes in Manus config. No deploy
required beyond the env var update.

**Kill-switch stale warning:** after 60 minutes of
`OUTBOUND_COMMS_ENABLED=false`, the server logs a ⚠️ STALE message
every 10 minutes and `trpc.adminSafety.killSwitchStatus` returns
`isStale: true`. Rob sees this on the admin dashboard banner.
Never leave the switch off for days on accident — re-check whenever
starting an admin session.

---

## After every incident

1. Log what happened in this file under a `## Incident log` section
   with date + symptom + root cause + fix
2. Update `docs/MANUS_CONTRACT.md` if you learned something new
   about Manus's infrastructure
3. Add a check to `docs/PR_MERGE_CHECKLIST.md` to prevent recurrence
4. Add a test if automatable

Learn forward. Don't let the same incident happen twice.

## Incident log

_(populate as incidents happen)_

### [DATE] — Subject line

- **Symptom:** _[what users experienced]_
- **Root cause:** _[what actually went wrong]_
- **Fix:** _[what was changed]_
- **Prevention added:** _[checklist item or code guard that would catch this next time]_

---

### 2026-04-18 (documented retroactively) — Test env suppressed exit alerts, fired fake duplicates

- **Symptom:** Subscribers did not receive exit alerts during test env activity; later received 2 duplicate alerts when Manus "fixed" the issue
- **Root cause (suspected):** Manus staging shares infra with prod. Test-env session suppressed real notifications; retry queue replayed cached signals after fix, duplicating them.
- **Fix:** Added `server/_core/commsGuard.ts` with kill-switch + test-prefix + dedupe. Rate-limited Resend in `server/services/resendEmail.ts`.
- **Prevention added:**
  - `OUTBOUND_COMMS_ENABLED=false` kill switch (see above)
  - Test-prefix symbol detection (`TEST-*`, `STAGING-*`, etc.)
  - 60s dedupe window on signal fingerprints
  - Per-recipient email rate limit (3 per 5 min per subject)
  - PR merge checklist item #2 (outbound comms) — every new notification must go through commsGuard
