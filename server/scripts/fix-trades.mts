import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../db.ts";
import { trades, strategies } from "../../drizzle/schema.ts";
import { sql } from "drizzle-orm";

async function fixTrades() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('FIXING TRADE DATA');
  console.log('========================================\n');

  // Step 1: Count current trades
  const currentCount = await db.select({ count: sql<number>`COUNT(*)` }).from(trades);
  console.log(`Current trades in database: ${currentCount[0].count}`);

  // Step 2: Delete ALL trades
  console.log('\n🗑️  Deleting all trades...');
  await db.delete(trades);
  console.log('✅ All trades deleted');

  // Step 3: Load strategy mapping
  const strategyRecords = await db.select().from(strategies);
  const strategyMap = new Map(strategyRecords.map(s => [s.symbol, s.id]));
  
  console.log('\n📊 Strategy mapping:');
  strategyRecords.forEach(s => {
    console.log(`  ${s.id}. ${s.name} (${s.symbol})`);
  });

  // Step 4: Load CSV
  const csvPath = join(process.cwd(), "data/seed/trades.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`\n📁 Loaded ${records.length} trades from CSV`);

  // Step 5: Insert trades in batches
  let inserted = 0;
  let skipped = 0;
  const batchSize = 500;
  
  console.log('\n⏳ Inserting trades...\n');
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((record: any) => {
      const strategyId = strategyMap.get(record.strategyName);
      if (!strategyId) {
        skipped++;
        return null;
      }

      // Parse and validate numeric fields
      const entryPrice = parseFloat(record.entryPrice);
      const exitPrice = parseFloat(record.exitPrice);
      const pnl = parseFloat(record.pnl);
      const pnlPercent = parseFloat(record.pnlPercent);
      
      // Skip trades with NaN prices (e.g., during COVID oil crisis)
      if (isNaN(entryPrice) || isNaN(exitPrice) || isNaN(pnl) || isNaN(pnlPercent)) {
        skipped++;
        return null;
      }

      return {
        strategyId,
        entryDate: new Date(record.entryTime),
        exitDate: new Date(record.exitTime),
        direction: record.side === 'long' ? 'Long' : 'Short',
        entryPrice: Math.round(entryPrice * 100),
        exitPrice: Math.round(exitPrice * 100),
        quantity: parseInt(record.quantity) || 1,
        pnl: Math.round(pnl * 100),
        pnlPercent: Math.round(pnlPercent * 10000),
        commission: 0,
      };
    }).filter(Boolean);

    if (values.length > 0) {
      await db.insert(trades).values(values as any);
      inserted += values.length;
      const progress = ((inserted / records.length) * 100).toFixed(1);
      console.log(`  Progress: ${inserted}/${records.length} (${progress}%)`);
    }
  }

  // Step 6: Verify final count
  const finalCount = await db.select({ count: sql<number>`COUNT(*)` }).from(trades);
  
  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================');
  console.log(`✅ Inserted: ${inserted} trades`);
  console.log(`⚠️  Skipped: ${skipped} trades (invalid data or strategy not found)`);
  console.log(`📊 Final count: ${finalCount[0].count} trades`);
  console.log(`📁 CSV records: ${records.length} trades`);
  
  if (finalCount[0].count === inserted) {
    console.log('\n✅ SUCCESS: Database matches inserted count!');
  } else {
    console.log(`\n❌ MISMATCH: Database has ${finalCount[0].count} but inserted ${inserted}`);
  }
  
  console.log('========================================\n');
  process.exit(0);
}

fixTrades().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
