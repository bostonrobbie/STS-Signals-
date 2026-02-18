#!/usr/bin/env node
/**
 * Seed benchmark data (QQQ, IWM, GLD) into the database
 */

import fs from 'fs';
import mysql from 'mysql2/promise';

// Read the benchmark data
const dataFile = '/home/ubuntu/intraday-dashboard/scripts/benchmark-data.json';
const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));

async function seedBenchmarks() {
  // Connect to database
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'intraday_dashboard',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  console.log('Connected to database');

  try {
    for (const [symbol, records] of Object.entries(data)) {
      console.log(`\nSeeding ${symbol}: ${records.length} records`);

      // Delete existing data for this symbol
      await connection.execute('DELETE FROM benchmarks WHERE symbol = ?', [symbol]);
      console.log(`  Deleted existing ${symbol} data`);

      // Insert in batches of 500
      const batchSize = 500;
      let inserted = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        
        // Build the INSERT statement
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap(r => [
          r.symbol,
          r.date,
          r.open,
          r.high,
          r.low,
          r.close,
          r.volume
        ]);

        await connection.execute(
          `INSERT INTO benchmarks (symbol, date, open, high, low, close, volume) VALUES ${placeholders}`,
          values
        );

        inserted += batch.length;
        process.stdout.write(`  Inserted ${inserted}/${records.length} records\r`);
      }

      console.log(`  Completed ${symbol}: ${inserted} records inserted`);
    }

    console.log('\nBenchmark seeding complete!');
  } catch (error) {
    console.error('Error seeding benchmarks:', error);
  } finally {
    await connection.end();
  }
}

seedBenchmarks();
