import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../db";
import { benchmarks } from "../../drizzle/schema";

async function seedBenchmarks() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const csvPath = join(process.cwd(), "data/seed/spy_benchmark.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Seeding ${records.length} benchmark records...`);

  let inserted = 0;
  const batchSize = 500;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const values = batch.map((record: any) => ({
      date: new Date(record.date),
      open: Math.round(parseFloat(record.open) * 100),
      high: Math.round(parseFloat(record.high) * 100),
      low: Math.round(parseFloat(record.low) * 100),
      close: Math.round(parseFloat(record.close) * 100),
      volume: record.volume ? parseInt(record.volume) : null,
    }));

    await db.insert(benchmarks).values(values);
    
    inserted += values.length;
    console.log(`Inserted ${inserted}/${records.length} benchmark records...`);
  }

  console.log("✅ Benchmarks seeded successfully");
}

seedBenchmarks().catch(console.error);
