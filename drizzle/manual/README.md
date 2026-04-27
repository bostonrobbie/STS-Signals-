# Manual migrations

Migrations in this folder are **not** tracked by `drizzle-kit`'s
automated journal. They are plain idempotent SQL files meant to be run
by hand against the Manus production database at deploy time.

## Why manual?

Our repo has a mixed history: some schema changes were applied via
`drizzle-kit push` locally (which updates the snapshot but doesn't
emit a SQL file), and Manus's build pipeline does not reliably run
`drizzle-kit migrate` on deploy. Relying on `drizzle/*.sql` alone
therefore isn't safe — some state only exists in `drizzle/meta/*.json`.

For changes that need to land cleanly on Manus's prod DB without
reconciling the journal gap, add an idempotent SQL file here and note
it in the PR description.

## Applying a migration

1. Merge the PR that includes both the `drizzle/schema.ts` change and
   the matching file in this folder.
2. Manus redeploys the app. The new schema.ts ships but the DB isn't
   touched yet.
3. Either:
   - (Preferred) Rob opens the Manus DB console (or connects via his
     MySQL client of choice using `DATABASE_URL`) and runs the SQL in
     this folder, top-to-bottom.
   - Or: set up `drizzle-kit migrate` to run as a post-deploy hook on
     Manus (requires Manus-side configuration).

All files here are written to be safe to re-run — `IF NOT EXISTS`,
`ON DUPLICATE KEY UPDATE`, etc. Running twice is a no-op.

## Why not just always use drizzle-kit?

Long-term, yes. This folder is a bridge until one of:

- Manus lets us run a post-deploy hook reliably → drizzle-kit migrate
  becomes automated
- We own the host (post-migration off Manus) → drizzle-kit migrate
  runs as part of the container startup

Either way, code in `server/` that depends on a new table should
gracefully fall back when the table isn't reachable (see
`server/_core/commsGuard.ts` for an example) so that forgetting step 3
above never takes the site down — it just downgrades safety.

## Index

| File | Purpose | Run once? |
|---|---|---|
| `0001_signal_fingerprints.sql` | Persistent dedupe table for commsGuard | Yes |
| `0002_trades_istest_indexes.sql` | Composite (isTest, strategyId) + (isTest, exitDate) indexes on `trades`. Speeds up subscriber `getTrades()` queries (~120ms → <10ms) after the data-isolation audit forced isTest=0 to lead every filter. | Yes |

## Pending apply on Manus prod

As of 2026-04-26, both files above ship in `main` (commit `1f14b12`) but
have **not** been applied to the Manus prod DB yet. Apply both, in
order, the next time you have the Manus DB console open. Until applied:

- `0001` → commsGuard falls back to in-memory dedupe (works, but a
  Manus restart during a duplicate retry window would let one through)
- `0002` → subscriber dashboard queries are ~10x slower than they need
  to be (still correct, just slow)

