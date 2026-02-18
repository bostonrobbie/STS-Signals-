# Webhook-to-Trade Data Pipeline Audit

## Executive Summary

This document provides a comprehensive audit of the TradingView webhook processing pipeline, identifying potential failure points and recommending reliability improvements to ensure trades are always logged correctly.

## Current Architecture

### Signal Flow
```
TradingView Alert → Webhook Endpoint → Validation → Processing → Database
                                                         ↓
                                              Entry Signal: Create Position
                                              Exit Signal: Close Position + Create Trade
```

### Key Components

1. **Webhook Endpoint** (`server/webhooks.ts`)
   - Rate limiting (60 req/min per IP)
   - Input validation and sanitization
   - Token authentication
   - Circuit breaker for database failures

2. **Webhook Service** (`server/webhookService.ts`)
   - Payload normalization
   - Signal type detection (entry/exit)
   - Position management
   - Trade creation

3. **Database Layer** (`server/db.ts`)
   - Position CRUD operations
   - Trade insertion
   - Webhook logging

4. **Write-Ahead Log** (`server/webhookWal.ts`)
   - Pre-processing persistence
   - Crash recovery support

---

## Identified Issues

### Critical Issues

#### 1. Non-Atomic Exit Signal Processing
**Location:** `webhookService.ts` lines 280-350
**Severity:** CRITICAL
**Description:** Exit signal processing involves multiple database operations that are NOT wrapped in a transaction:
- Close open position
- Create trade record
- Update webhook log

**Risk:** If any operation fails mid-way, the database can be left in an inconsistent state:
- Position closed but no trade created
- Trade created but position still shows as open
- Webhook log shows success but trade missing

**Recommendation:** Wrap all exit signal operations in a database transaction.

#### 2. Trade ID Retrieval Race Condition
**Location:** `webhookService.ts` lines 320-330
**Severity:** HIGH
**Description:** After inserting a trade, the code queries for the trade ID using `getLatestTradeForStrategy()`. In high-concurrency scenarios, this could return a different trade's ID.

**Recommendation:** Use `insertId` from the INSERT result instead of querying.

#### 3. WAL Not Integrated with Main Processing
**Location:** `webhookWal.ts` vs `webhookService.ts`
**Severity:** HIGH
**Description:** The Write-Ahead Log (WAL) infrastructure exists but is not integrated with the main webhook processing flow. Webhooks are processed without WAL protection.

**Recommendation:** Integrate WAL into the main processing flow:
1. Write to WAL before processing
2. Process webhook
3. Mark WAL entry as completed/failed

### Medium Issues

#### 4. Silent Failures in Position Creation
**Location:** `webhookService.ts` lines 180-220
**Severity:** MEDIUM
**Description:** Some error paths return `{ success: false }` without throwing errors, making it difficult to track failures.

**Recommendation:** Throw errors for all failure cases and handle them at the router level.

#### 5. No Retry Logic for Database Operations
**Location:** `server/db.ts`
**Severity:** MEDIUM
**Description:** Database operations don't have retry logic for transient failures (connection drops, timeouts).

**Recommendation:** Add retry wrapper with exponential backoff for critical operations.

#### 6. Idempotency Key Not Persisted
**Location:** `webhookSecurity.ts`
**Severity:** MEDIUM
**Description:** Idempotency keys are stored in memory and lost on server restart.

**Recommendation:** Persist idempotency keys to database or Redis.

### Low Issues

#### 7. No P&L Validation
**Location:** `webhookService.ts` lines 290-310
**Severity:** LOW
**Description:** When TradingView provides P&L in the payload, it's used directly without validation against calculated P&L.

**Recommendation:** Compare provided P&L with calculated P&L and log discrepancies.

#### 8. Missing Database Health Check
**Location:** `webhooks.ts`
**Severity:** LOW
**Description:** Webhooks are processed without checking database connectivity first.

**Recommendation:** Add database health check before processing.

---

## Existing Safeguards

### Working Well

1. **Rate Limiting** - Prevents abuse and DoS attacks
2. **Circuit Breaker** - Protects against cascading failures
3. **Input Validation** - Sanitizes and validates all inputs
4. **Token Authentication** - Verifies webhook authenticity
5. **Structured Logging** - Correlation IDs for tracing
6. **Webhook Logs Table** - Audit trail of all webhooks

### Partially Implemented

1. **WAL System** - Infrastructure exists but not integrated
2. **Retry Logic** - Exists in `upsertUser` but not in webhook processing
3. **Connection Pooling** - Configured but no reconnection handling

---

## Recommended Improvements

### Phase 1: Critical Fixes (Immediate)

1. **Add Database Transactions for Exit Signals**
   ```typescript
   // Wrap in transaction
   await withTransaction(async (connection) => {
     // 1. Insert trade
     const tradeId = await insertTradeInTransaction(connection, tradeData);
     // 2. Close position
     await closePositionInTransaction(connection, positionId, tradeId);
     // 3. Update webhook log
     await updateWebhookLogInTransaction(connection, logId, tradeId);
   });
   ```

2. **Fix Trade ID Retrieval**
   ```typescript
   // Use insertId instead of query
   const [result] = await db.insert(trades).values(tradeData);
   const tradeId = result.insertId;
   ```

3. **Integrate WAL with Processing**
   ```typescript
   // Before processing
   const walId = await writeToWal(payload);
   await markProcessing(walId);
   
   // After processing
   if (success) {
     await markCompleted(walId, logId);
   } else {
     await markFailed(walId, error);
   }
   ```

### Phase 2: Reliability Improvements (Short-term)

4. **Add Retry Logic to Critical Operations**
   ```typescript
   const result = await withRetry(
     () => insertTrade(tradeData),
     { maxRetries: 3, backoff: 'exponential' }
   );
   ```

5. **Add Database Health Check**
   ```typescript
   if (!await checkDatabaseHealth()) {
     return { success: false, error: 'DATABASE_UNAVAILABLE' };
   }
   ```

6. **Improve Error Handling**
   - Throw errors instead of returning false
   - Add error codes for different failure types
   - Include stack traces in logs

### Phase 3: Monitoring & Alerting (Medium-term)

7. **Add Processing Metrics**
   - Success/failure rates
   - Processing latency
   - Database operation timing

8. **Add Alerting**
   - Alert on high failure rate
   - Alert on processing delays
   - Alert on WAL backlog

9. **Add Diagnostic Tools**
   - WAL replay functionality
   - Position reconciliation
   - Trade audit tools

---

## Test Coverage Gaps

### Missing Tests

1. **Transaction Rollback Scenarios**
   - Test that partial failures roll back completely
   - Test that positions aren't left in inconsistent state

2. **Concurrent Webhook Processing**
   - Test race conditions with multiple webhooks
   - Test idempotency under load

3. **Database Failure Scenarios**
   - Test behavior when database is unavailable
   - Test recovery after database reconnection

4. **WAL Recovery**
   - Test replay of failed webhooks
   - Test recovery after crash

### Recommended Test Additions

```typescript
describe('Exit Signal Transaction Safety', () => {
  it('should rollback all changes if trade insertion fails', async () => {
    // Mock trade insertion to fail
    // Verify position is still open
    // Verify no partial trade record exists
  });

  it('should rollback all changes if position close fails', async () => {
    // Mock position close to fail
    // Verify trade is not created
    // Verify position state unchanged
  });
});

describe('Concurrent Webhook Handling', () => {
  it('should handle simultaneous entry and exit signals', async () => {
    // Send entry and exit at same time
    // Verify correct final state
  });

  it('should reject duplicate webhooks', async () => {
    // Send same webhook twice
    // Verify only one is processed
  });
});
```

---

## Implementation Priority

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| P0 | Add transactions for exit signals | Medium | Critical |
| P0 | Fix trade ID retrieval | Low | High |
| P1 | Integrate WAL with processing | Medium | High |
| P1 | Add retry logic | Low | Medium |
| P2 | Add database health check | Low | Medium |
| P2 | Improve error handling | Medium | Medium |
| P3 | Add monitoring metrics | Medium | Low |
| P3 | Add alerting | Medium | Low |

---

## Conclusion

The current webhook processing pipeline has several reliability gaps that could cause trades to not be logged correctly. The most critical issues are:

1. **Non-atomic exit signal processing** - Can leave database in inconsistent state
2. **Trade ID race condition** - Could associate wrong trade ID
3. **WAL not integrated** - No crash recovery protection

Implementing the recommended improvements, particularly database transactions and WAL integration, will significantly improve the reliability of trade logging.

---

## Appendix: Database Schema Reference

### Key Tables

- `webhook_logs` - Audit trail of all webhooks
- `open_positions` - Currently open positions
- `trades` - Completed trades
- `webhook_wal` - Write-ahead log for crash recovery

### Relationships

```
webhook_logs.tradeId → trades.id
open_positions.tradeId → trades.id (when closed)
open_positions.entryWebhookLogId → webhook_logs.id
open_positions.exitWebhookLogId → webhook_logs.id
```
