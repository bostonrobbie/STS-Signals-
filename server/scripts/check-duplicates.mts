import { getDb } from '../db.ts';
import { trades } from '../../drizzle/schema.ts';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log('\n=== CHECKING FOR DUPLICATE TRADES ===\n');

  // Get all trades
  const allTrades = await db.select().from(trades).orderBy(trades.id);
  
  console.log(`Total trades in database: ${allTrades.length}`);
  console.log(`Expected from CSV: 9,348\n`);

  // Create a map to find duplicates based on key fields
  const tradeMap = new Map<string, number>();
  const duplicates: any[] = [];

  for (const trade of allTrades) {
    // Create a unique key from the trade data
    const key = `${trade.strategyId}-${trade.entryDate.getTime()}-${trade.exitDate.getTime()}-${trade.entryPrice}-${trade.exitPrice}-${trade.pnl}`;
    
    if (tradeMap.has(key)) {
      const firstId = tradeMap.get(key)!;
      duplicates.push({
        key,
        firstId,
        duplicateId: trade.id,
        strategyId: trade.strategyId,
        entryDate: trade.entryDate.toISOString().split('T')[0],
        exitDate: trade.exitDate.toISOString().split('T')[0],
        pnl: trade.pnl,
      });
    } else {
      tradeMap.set(key, trade.id);
    }
  }

  if (duplicates.length > 0) {
    console.log(`⚠️  FOUND ${duplicates.length} DUPLICATE TRADES!\n`);
    console.log('First 20 duplicates:');
    console.log('─'.repeat(100));
    console.log('Original ID | Duplicate ID | Strategy | Entry Date | Exit Date  | P&L');
    console.log('─'.repeat(100));
    
    duplicates.slice(0, 20).forEach(d => {
      console.log(`${String(d.firstId).padStart(11)} | ${String(d.duplicateId).padStart(12)} | ${String(d.strategyId).padStart(8)} | ${d.entryDate} | ${d.exitDate} | ${d.pnl}`);
    });
    console.log('─'.repeat(100));
    
    console.log(`\n✅ SOLUTION: Delete ${duplicates.length} duplicate trades`);
    console.log(`This will bring total from ${allTrades.length} down to ${allTrades.length - duplicates.length}`);
  } else {
    console.log('✅ No exact duplicates found');
    console.log('\nBut we have 1,652 extra trades. Possible causes:');
    console.log('1. Seed script ran multiple times (partial duplicates)');
    console.log('2. Different CSV files were loaded');
    console.log('3. Manual trades were added');
  }

  // Check for partial duplicates (same date/strategy but different prices)
  console.log('\n\n=== CHECKING FOR PARTIAL DUPLICATES (same dates, different prices) ===\n');
  
  const dateMap = new Map<string, number>();
  let partialDups = 0;
  
  for (const trade of allTrades) {
    const key = `${trade.strategyId}-${trade.entryDate.getTime()}-${trade.exitDate.getTime()}`;
    dateMap.set(key, (dateMap.get(key) || 0) + 1);
  }
  
  for (const [key, count] of dateMap.entries()) {
    if (count > 1) {
      partialDups++;
    }
  }
  
  if (partialDups > 0) {
    console.log(`⚠️  Found ${partialDups} date combinations with multiple trades`);
    console.log('(This could be legitimate if multiple trades occurred on same dates)');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
