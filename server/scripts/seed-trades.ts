import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../db";
import { trades, strategies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

async function seedTrades() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Load strategy mapping (symbol -> id)
  const strategyRecords = await db.select().from(strategies);
  const strategyMap = new Map(strategyRecords.map(s => [s.symbol, s.id]));

  const csvPath = join(process.cwd(), "data/seed/trades.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Seeding ${records.length} trades...`);

  let inserted = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((record: any) => {
      const strategyId = strategyMap.get(record.strategyName);
      if (!strategyId) {
        console.warn(`Strategy not found: ${record.strategyName}`);
        return null;
      }

      return {
        strategyId,
        entryDate: new Date(record.entryTime),
        exitDate: new Date(record.exitTime),
        direction: record.side === 'long' ? 'Long' : 'Short',
        entryPrice: Math.round(parseFloat(record.entryPrice) * 100),
        exitPrice: Math.round(parseFloat(record.exitPrice) * 100),
        quantity: parseInt(record.quantity) || 1,
        pnl: Math.round(parseFloat(record.pnl) * 100),
        pnlPercent: Math.round(parseFloat(record.pnlPercent) * 10000),
        commission: 0,
      };
    }).filter(Boolean);

    if (values.length > 0) {
      await db.insert(trades).values(values as any);
      inserted += values.length;
      console.log(`Inserted ${inserted}/${records.length} trades...`);
    }
  }

  console.log("✅ Trades seeded successfully");
}

seedTrades().catch(console.error);
