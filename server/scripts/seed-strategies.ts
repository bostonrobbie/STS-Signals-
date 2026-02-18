import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../db";
import { strategies } from "../../drizzle/schema";

async function seedStrategies() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const csvPath = join(process.cwd(), "data/seed/strategies-fixed.csv");
  const csvContent = readFileSync(csvPath, "utf-8");
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Seeding ${records.length} strategies...`);

  for (const record of records) {
    await db.insert(strategies).values({
      symbol: record.symbol,
      name: record.name,
      description: record.description || null,
      market: record.market || null,
      strategyType: record.strategy_type || null,
      active: record.active === "true" || record.active === "1",
    }).onDuplicateKeyUpdate({
      set: {
        name: record.name,
        description: record.description || null,
        market: record.market || null,
        strategyType: record.strategy_type || null,
        active: record.active === "true" || record.active === "1",
      },
    });
  }

  console.log("✅ Strategies seeded successfully");
}

seedStrategies().catch(console.error);
