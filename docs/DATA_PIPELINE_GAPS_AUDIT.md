# Data Pipeline Gaps Audit

## Executive Summary

This document identifies gaps in the data pipelines throughout the intraday trading dashboard and provides recommendations for fixes.

## Data Flow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ENTRY POINTS                                  │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  TradingView    │   CSV Import    │  Manual Entry   │   Broker Sync         │
│  Webhooks       │   (Admin)       │  (Staging)      │   (IBKR/Tradovate)    │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCESSING LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  webhookService.ts  │  db.uploadTradesForStrategy  │  reconciliationService │
│  webhookWal.ts      │  bulkInsertTrades            │  brokerService         │
│  batchProcessor.ts  │                              │                        │
└────────┬────────────┴──────────────┬───────────────┴───────────┬────────────┘
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE TABLES                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│  open_positions │     trades      │  webhook_logs   │  reconciliation_logs  │
│  staging_trades │  signal_batches │  webhook_wal    │  position_adjustments │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANALYTICS LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  analytics.ts (metrics calculation)                                          │
│  analytics.visual.ts (charts/visualizations)                                 │
│  dailyEquityCurve.ts (equity curve generation)                              │
│  breakdown.ts (performance breakdown)                                        │
└────────┬────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UI LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  Overview Dashboard  │  Strategy Detail  │  User Dashboard  │  Admin Panel  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Identified Gaps

### 1. CSV Import Pipeline

**Current State:**
- `uploadTradesForStrategy` in db.ts accepts trades and inserts them directly
- No validation of trade data before insertion
- No duplicate detection (relies on overwrite flag)
- No audit trail of imports

**Gaps:**
- [ ] **No data validation**: Trades are inserted without checking for invalid dates, negative prices, etc.
- [ ] **No duplicate detection**: If same trade is imported twice without overwrite, duplicates are created
- [ ] **No import audit log**: No record of who imported what and when
- [ ] **No rollback capability**: If import fails midway, partial data remains
- [ ] **No P&L recalculation verification**: Imported P&L not verified against entry/exit prices

**Recommended Fixes:**
1. Add validation using `dataValidation.validateTrade()` before insertion
2. Add duplicate detection based on entry/exit dates and prices
3. Create `import_logs` table to track all imports
4. Wrap imports in database transactions
5. Add P&L verification step

---

### 2. Webhook Processing Pipeline

**Current State:**
- Webhooks processed through `webhookService.ts`
- WAL (Write-Ahead Log) exists but not fully integrated
- Position tracking in `open_positions` table
- Trade creation on exit signals

**Gaps:**
- [ ] **WAL not replayed on startup**: Failed webhooks in WAL are not automatically retried
- [ ] **No idempotency key**: Same webhook can be processed multiple times
- [ ] **Exit without entry handling**: Exit signals for non-existent positions fail silently
- [ ] **Partial failure recovery**: If trade creation fails after position close, data is inconsistent
- [ ] **No webhook deduplication window**: Rapid duplicate webhooks not filtered

**Recommended Fixes:**
1. Add startup routine to replay pending WAL entries
2. Implement idempotency key based on correlation ID
3. Add explicit handling for orphan exit signals
4. Use database transactions for position close + trade create
5. Add deduplication window (e.g., 5 seconds)

---

### 3. Position Tracking Pipeline

**Current State:**
- Positions tracked in `open_positions` table
- Status transitions: open → closed
- Trade ID linked on close

**Gaps:**
- [ ] **No position history**: Only current state tracked, no history of changes
- [ ] **Stale position detection**: Positions open >24h flagged but not auto-resolved
- [ ] **No position lock**: Concurrent webhooks can modify same position
- [ ] **Missing position recovery**: No way to recreate position from trade history

**Recommended Fixes:**
1. Add `position_history` table for audit trail
2. Add configurable auto-close for stale positions
3. Implement optimistic locking on positions
4. Add position reconstruction from trades

---

### 4. Broker Synchronization Pipeline

**Current State:**
- `reconciliationService.ts` compares DB vs broker positions
- Discrepancies logged to `reconciliation_logs`
- Manual resolution through admin UI

**Gaps:**
- [ ] **No automatic sync**: Reconciliation is manual/scheduled, not real-time
- [ ] **One-way sync only**: Can detect differences but not auto-correct
- [ ] **No broker order tracking**: Orders placed but not tracked to completion
- [ ] **Missing fill price capture**: Actual fill prices not captured from broker

**Recommended Fixes:**
1. Add real-time position sync via broker WebSocket
2. Implement configurable auto-sync for minor discrepancies
3. Add order tracking table and status updates
4. Capture and store actual fill prices

---

### 5. Analytics Calculation Pipeline

**Current State:**
- Metrics calculated on-demand in `analytics.ts`
- Caching implemented for some endpoints
- Daily equity curve generation in `dailyEquityCurve.ts`

**Gaps:**
- [ ] **No incremental updates**: Full recalculation on every request
- [ ] **Cache invalidation**: Cache not invalidated when new trades added
- [ ] **No pre-computed aggregates**: Daily/weekly/monthly stats not pre-computed
- [ ] **Missing data handling**: Gaps in trade data not handled gracefully

**Recommended Fixes:**
1. Add incremental metric updates on new trades
2. Implement cache invalidation on data changes
3. Add pre-computed aggregates table
4. Add interpolation for missing data periods

---

### 6. Staging Trades Pipeline

**Current State:**
- Staging trades for review before approval
- Manual approval/rejection workflow

**Gaps:**
- [ ] **No auto-approval rules**: All trades require manual review
- [ ] **No batch operations**: Must approve/reject one at a time
- [ ] **No staging expiry**: Old staging trades never cleaned up
- [ ] **No staging notifications**: No alerts for pending reviews

**Recommended Fixes:**
1. Add configurable auto-approval rules
2. Implement batch approve/reject
3. Add staging trade expiry (e.g., 7 days)
4. Add notification for pending staging trades

---

### 7. Data Integrity Monitoring

**Current State:**
- `dataIntegrityService.ts` provides validation
- QA dashboard for monitoring
- Health checks available

**Gaps:**
- [ ] **No scheduled integrity checks**: Manual trigger only
- [ ] **No auto-repair**: Issues detected but not fixed
- [ ] **No alerting integration**: No notifications on integrity failures
- [ ] **Limited historical tracking**: No trend analysis of data quality

**Recommended Fixes:**
1. Add scheduled integrity checks (hourly/daily)
2. Implement auto-repair for common issues
3. Add alerting via notification service
4. Add data quality metrics over time

---

## Implementation Priority

### High Priority (Data Loss Prevention)
1. Database transactions for webhook processing
2. WAL replay on startup
3. CSV import validation
4. Position locking

### Medium Priority (Data Quality)
1. Duplicate detection
2. Cache invalidation
3. Scheduled integrity checks
4. Auto-repair for common issues

### Low Priority (Enhancements)
1. Pre-computed aggregates
2. Position history tracking
3. Auto-approval rules
4. Broker real-time sync

---

## Testing Requirements

Each fix should include:
1. Unit tests for the specific functionality
2. Integration tests for the full pipeline
3. Regression tests to ensure no existing functionality breaks
4. Load tests for concurrent access scenarios
