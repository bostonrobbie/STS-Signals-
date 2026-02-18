/**
 * Seed benchmark data (QQQ, IWM, GLD) into the database
 * Run with: npx tsx scripts/seed-benchmarks.ts
 */

import fs from "fs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { benchmarks } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Read the benchmark data
const dataFile = "./scripts/benchmark-data.json";
const data = JSON.parse(fs.readFileSync(dataFile, "utf-8")) as Record<
  string,
  Array<{
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>
>;

async function seedBenchmarks() {
  // Connect to database using DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  const pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
  });

  const db = drizzle(pool as any);

  console.log("Connected to database");

  try {
    for (const [symbol, records] of Object.entries(data)) {
      console.log(`\nSeeding ${symbol}: ${records.length} records`);

      // Delete existing data for this symbol
      await db.delete(benchmarks).where(eq(benchmarks.symbol, symbol));
      console.log(`  Deleted existing ${symbol} data`);

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        // Convert date strings to Date objects
        const values = batch.map(r => ({
          symbol: r.symbol,
          date: new Date(r.date),
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
        }));

        await db.insert(benchmarks).values(values);

        inserted += batch.length;
        process.stdout.write(
          `  Inserted ${inserted}/${records.length} records\r`
        );
      }

      console.log(`  Completed ${symbol}: ${inserted} records inserted`);
    }

    console.log("\nBenchmark seeding complete!");
  } catch (error) {
    console.error("Error seeding benchmarks:", error);
  } finally {
    await pool.end();
  }
}

seedBenchmarks();
