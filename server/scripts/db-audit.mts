import { getDb } from '../db.ts';
import { strategies, trades } from '../../drizzle/schema.ts';
import { eq, sql, count, and } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('DATABASE AUDIT REPORT');
  console.log('========================================\n');

  // Get trade counts per strategy
  const strategyCounts = await db
    .select({
      id: strategies.id,
      name: strategies.name,
      symbol: strategies.symbol,
      tradeCount: count(trades.id),
    })
    .from(strategies)
    .leftJoin(trades, eq(strategies.id, trades.strategyId))
    .groupBy(strategies.id, strategies.name, strategies.symbol)
    .orderBy(strategies.id);

  console.log('TRADE COUNTS BY STRATEGY:');
  console.log('─'.repeat(70));
  console.log('ID │ Name                     │ Symbol   │ Trades');
  console.log('─'.repeat(70));
  
  let totalTrades = 0;
  for (const s of strategyCounts) {
    console.log(`${String(s.id).padStart(2)} │ ${s.name.padEnd(24)} │ ${s.symbol.padEnd(8)} │ ${s.tradeCount}`);
    totalTrades += s.tradeCount;
  }
  
  console.log('─'.repeat(70));
  console.log(`   │ TOTAL                    │          │ ${totalTrades}`);
  console.log('─'.repeat(70));
  console.log(`\nExpected from CSV: 9,348 trades`);
  console.log(`Actual in database: ${totalTrades} trades`);
  
  if (totalTrades === 9348) {
    console.log('✅ Trade count matches!');
  } else if (totalTrades === 9348 * 2) {
    console.log('⚠️  DUPLICATE ISSUE: Exactly 2x expected (every trade duplicated)');
  } else {
    console.log(`❌ Mismatch: ${totalTrades - 9348} difference`);
  }

  // Check for duplicates
  console.log('\n\nCHECKING FOR DUPLICATE TRADES...\n');
  
  const duplicateCheck = await db.execute(sql`
    SELECT 
      strategyId,
      DATE(entryDate) as entry,
      DATE(exitDate) as exit,
      entryPrice,
      exitPrice,
      pnl,
      COUNT(*) as dup_count
    FROM trades
    GROUP BY strategyId, DATE(entryDate), DATE(exitDate), entryPrice, exitPrice, pnl
    HAVING COUNT(*) > 1
    LIMIT 10
  `);

  if (duplicateCheck.rows && duplicateCheck.rows.length > 0) {
    console.log('⚠️  DUPLICATES FOUND:');
    console.log('─'.repeat(90));
    console.log('Strategy │ Entry Date │ Exit Date  │ Entry Price │ Exit Price │ P&L      │ Count');
    console.log('─'.repeat(90));
    for (const row of duplicateCheck.rows) {
      console.log(`${String(row.strategyId).padStart(8)} │ ${row.entry} │ ${row.exit} │ ${String(row.entryPrice).padStart(11)} │ ${String(row.exitPrice).padStart(10)} │ ${String(row.pnl).padStart(8)} │ ${row.dup_count}`);
    }
    console.log('─'.repeat(90));
  } else {
    console.log('✅ No duplicates found');
  }

  // Get date ranges per strategy
  console.log('\n\nDATE RANGES BY STRATEGY:\n');
  console.log('─'.repeat(70));
  
  for (const s of strategyCounts) {
    if (s.tradeCount === 0) {
      console.log(`${s.symbol}: NO TRADES`);
      continue;
    }
    
    const dateRange = await db
      .select({
        earliest: sql<Date>`MIN(${trades.exitDate})`,
        latest: sql<Date>`MAX(${trades.exitDate})`,
      })
      .from(trades)
      .where(eq(trades.strategyId, s.id));
    
    if (dateRange[0]) {
      const earliest = dateRange[0].earliest;
      const latest = dateRange[0].latest;
      console.log(`${s.symbol.padEnd(10)}: ${earliest?.toISOString().split('T')[0] || 'N/A'} to ${latest?.toISOString().split('T')[0] || 'N/A'}`);
    }
  }
  
  console.log('\n========================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
