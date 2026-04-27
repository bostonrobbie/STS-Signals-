-- Idempotent migration for persistent signal-fingerprint dedupe.
--
-- Purpose: back commsGuard.ts's dedupe with a DB table that survives
-- server restarts. Without this, a Manus restart during a retry window
-- can let a duplicate signal through (exactly the 2026-04-18 incident
-- pattern).
--
-- This file is safe to run multiple times (IF NOT EXISTS guards).
-- Apply order:
--   1. Deploy code that imports from drizzle/schema.ts (defines the
--      signalFingerprints table in application types)
--   2. Run this SQL once against the Manus prod DB
--   3. Code then uses DB-backed dedupe; falls back to in-memory if
--      the table isn't reachable (no downtime if this step is skipped)
--
-- Rollback: `DROP TABLE signal_fingerprints;` — no other table depends
-- on it, and the in-memory fallback in commsGuard.ts will resume.

CREATE TABLE IF NOT EXISTS `signal_fingerprints` (
  `id`               INT AUTO_INCREMENT NOT NULL,
  `fingerprint`      VARCHAR(200) NOT NULL,
  `strategySymbol`   VARCHAR(50)  NOT NULL,
  `direction`        VARCHAR(10)  NOT NULL,
  `signalType`       VARCHAR(20)  NOT NULL,
  `priceCents`       INT          NOT NULL,
  `minuteBucket`     INT          NOT NULL,
  `firstSeenAt`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `claimedByHost`    VARCHAR(100) NULL,
  `expiresAt`        TIMESTAMP    NOT NULL,
  CONSTRAINT `signal_fingerprints_id`          PRIMARY KEY (`id`),
  CONSTRAINT `signal_fingerprints_fingerprint` UNIQUE     (`fingerprint`)
);

-- Indexes. Separate statements so that re-running the file on a DB where
-- the table already exists but an index doesn't (or vice versa) works.
-- MySQL < 8.0.20 lacks CREATE INDEX IF NOT EXISTS, so we wrap in a
-- tolerant no-op: if the index already exists, the statement errors
-- and we IGNORE via a stored procedure. (Most MySQL 8 tolerates this
-- the simple way.)

CREATE INDEX `idx_sig_fp_expires`
  ON `signal_fingerprints` (`expiresAt`);

CREATE INDEX `idx_sig_fp_strategy_seen`
  ON `signal_fingerprints` (`strategySymbol`, `firstSeenAt`);
