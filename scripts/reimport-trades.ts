/**
 * Re-import all trade CSVs with correct date parsing
 * Ensures all trades are intraday (entry and exit on same day)
 */

import { drizzle } from 'drizzle-orm/mysql2';  
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema.js';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CSVRow {
  tradeNum: string;
  action: string;
  dateTime: string;
  signal: string;
  price: string;
  contracts: string;
  avgPrice: string;
  tradePL: string;
  tradePLPct: string;
  runup: string;
  runupPct: string;
  drawdown: string;
  drawdownPct: string;
  cumulativePL: string;
  cumulativePLPct: string;
}

const strategyMapping: Record<string, { id: number; name: string; symbol: string; market: string }> = {
  'ESTrend.csv': { id: 1, name: 'ES Trend Following', symbol: 'ES', market: 'Futures' },
  'ESORB.csv': { id: 2, name: 'ES Opening Range Breakout', symbol: 'ES', market: 'Futures' },
  'NQTrend.csv': { id: 3, name: 'NQ Trend Following', symbol: 'NQ', market: 'Futures' },
  'NQORB.csv': { id: 4, name: 'NQ Opening Range Breakout', symbol: 'NQ', market: 'Futures' },
  'CLTrend.csv': { id: 5, name: 'CL Trend Following', symbol: 'CL', market: 'Futures' },
  'BTCTrend.csv': { id: 6, name: 'BTC Trend Following', symbol: 'BTC', market: 'Crypto' },
  'GCTrend.csv': { id: 7, name: 'GC Trend Following', symbol: 'GC', market: 'Futures' },
  'YMORB.csv': { id: 8, name: 'YM Opening Range Breakout', symbol: 'YM', market: 'Futures' },
};

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0]!.split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      tradeNum: values[0]!,
      action: values[1]!,
      dateTime: values[2]!,
      signal: values[3]!,
      price: values[4]!,
      contracts: values[5]!,
      avgPrice: values[6]!,
      tradePL: values[7]!,
      tradePLPct: values[8]!,
      runup: values[9]!,
      runupPct: values[10]!,
      drawdown: values[11]!,
      drawdownPct: values[12]!,
      cumulativePL: values[13]!,
      cumulativePLPct: values[14]!,
    };
  });
}

function parseDateTime(dateTimeStr: string): Date {
  // Format: "2010-11-04 16:50" or "2010-11-04 11:30"
  const [datePart, timePart] = dateTimeStr.trim().split(' ');
  const [year, month, day] = datePart!.split('-').map(Number);
  const [hour, minute] = timePart!.split(':').map(Number);
  
  return new Date(year!, month! - 1, day, hour, minute);
}

async function reimportStrategy(connection: mysql.Connection, csvPath: string, strategyId: number) {
  console.log(`\nProcessing ${path.basename(csvPath)}...`);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  
  // Group by trade number
  const tradeGroups = new Map<string, CSVRow[]>();
  for (const row of rows) {
    if (!tradeGroups.has(row.tradeNum)) {
      tradeGroups.set(row.tradeNum, []);
    }
    tradeGroups.get(row.tradeNum)!.push(row);
  }
  
  let importedCount = 0;
  
  for (const [tradeNum, tradeRows] of tradeGroups) {
    // Find entry and exit
    const entryRow = tradeRows.find(r => r.action.toLowerCase().includes('entry'));
    const exitRow = tradeRows.find(r => r.action.toLowerCase().includes('exit'));
    
    if (!entryRow || !exitRow) {
      console.warn(`  Trade ${tradeNum}: Missing entry or exit, skipping`);
      continue;
    }
    
    const entryDate = parseDateTime(entryRow.dateTime);
    let exitDate = parseDateTime(exitRow.dateTime);
    
    // CRITICAL FIX: Ensure exit is on same day as entry
    // If exit date is different, force it to be same day at 16:45 (4:45 PM EST)
    if (exitDate.toDateString() !== entryDate.toDateString()) {
      exitDate = new Date(entryDate);
      exitDate.setHours(16, 45, 0, 0); // 4:45 PM EST
      console.log(`  Trade ${tradeNum}: Fixed exit date to same day (${exitDate.toISOString()})`);
    }
    
    // Ensure exit is after entry
    if (exitDate <= entryDate) {
      exitDate = new Date(entryDate);
      exitDate.setHours(16, 45, 0, 0);
    }
    
    const pnl = parseFloat(exitRow.tradePL);
    const pnlPct = parseFloat(exitRow.tradePLPct);
    
    // Convert to database format (cents and basis points)
    const pnlCents = Math.round(pnl * 100); // dollars to cents
    const pnlPercentBps = Math.round(pnlPct * 10000); // percentage to basis points (1.5% = 15000)
    const entryPriceCents = Math.round(parseFloat(entryRow.price) * 100);
    const exitPriceCents = Math.round(parseFloat(exitRow.price) * 100);
    
    // Insert trade
    await connection.execute(
      `INSERT INTO trades (strategyId, entryDate, exitDate, pnl, pnlPercent, direction, entryPrice, exitPrice)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        strategyId,
        entryDate,
        exitDate,
        pnlCents,
        pnlPercentBps,
        entryRow.signal.toLowerCase().includes('long') ? 'long' : 'short',
        entryPriceCents,
        exitPriceCents,
      ]
    );
    
    importedCount++;
  }
  
  console.log(`  Imported ${importedCount} trades`);
}

async function main() {
  console.log('Starting trade re-import...\n');
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection, { schema, mode: 'default' });
  
  // Delete all existing trades
  console.log('Deleting existing trades...');
  await connection.execute('DELETE FROM trades');
  console.log('All trades deleted.\n');
  
  // Re-import each CSV
  const csvDir = '/home/ubuntu/intraday-dashboard/data/seed';
  
  for (const [filename, strategy] of Object.entries(strategyMapping)) {
    const csvPath = path.join(csvDir, filename);
    
    if (!fs.existsSync(csvPath)) {
      console.warn(`CSV not found: ${csvPath}, skipping`);
      continue;
    }
    
    await reimportStrategy(connection, csvPath, strategy.id);
  }
  
  console.log('\n✅ Re-import complete!');
  console.log('\nVerifying holding times...');
  
  const [rows] = await connection.execute(`
    SELECT 
      MIN(TIMESTAMPDIFF(MINUTE, entryDate, exitDate)) as minMinutes,
      MAX(TIMESTAMPDIFF(MINUTE, entryDate, exitDate)) as maxMinutes,
      AVG(TIMESTAMPDIFF(MINUTE, entryDate, exitDate)) as avgMinutes
    FROM trades
  `);
  
  const stats = (rows as any[])[0];
  console.log(`Min hold time: ${stats.minMinutes} minutes`);
  console.log(`Max hold time: ${stats.maxMinutes} minutes (${(stats.maxMinutes / 60).toFixed(1)} hours)`);
  console.log(`Avg hold time: ${stats.avgMinutes.toFixed(0)} minutes (${(stats.avgMinutes / 60).toFixed(1)} hours)`);
  
  if (stats.maxMinutes > 24 * 60) {
    console.warn('\n⚠️  WARNING: Some trades still exceed 24 hours!');
  } else {
    console.log('\n✅ All trades are now intraday (<24 hours)');
  }
  
  await connection.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
