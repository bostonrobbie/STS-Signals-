/**
 * Strategy Consolidation Script
 * 
 * This script:
 * 1. Archives all existing strategies (sets active=false)
 * 2. Creates/reactivates NQ Trend (Unleveraged) and NQ Trend (Leveraged) strategies
 * 3. Clears existing trades for these strategies
 * 4. Imports trades from the new CSV files
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

// CSV file paths
const UNLEVERAGED_CSV = '/home/ubuntu/upload/Triple_NQ_Variant_[Trend_+_ORB_+_Short]_%_Scaling_CME_MINI_NQ1!_2026-01-09.csv';
const LEVERAGED_CSV = '/home/ubuntu/upload/Triple_NQ_Variant_[Trend_+_ORB_+_Short]_%_Scaling_CME_MINI_NQ1!_2026-01-09(1).csv';

async function main() {
  console.log('Connecting to database...');
  
  // Use DATABASE_URL if available
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  const connection = await mysql.createConnection(dbUrl);

  try {
    // Step 1: Archive all existing strategies
    console.log('=== Step 1: Archiving existing strategies ===');
    const [activeStrategies] = await connection.execute(
      'SELECT id, symbol, name FROM strategies WHERE active = true'
    );
    console.log(`Found ${activeStrategies.length} active strategies to archive`);
    
    if (activeStrategies.length > 0) {
      await connection.execute('UPDATE strategies SET active = false WHERE active = true');
      console.log('All existing strategies archived (active=false)');
      for (const s of activeStrategies) {
        console.log(`  - Archived: ${s.symbol} (${s.name})`);
      }
    }

    // Step 2: Create or reactivate NQ Trend strategies
    console.log('=== Step 2: Creating new NQ Trend strategies ===');
    
    // Check if strategies already exist
    const [existingNQ] = await connection.execute(
      "SELECT id, symbol, name FROM strategies WHERE symbol IN ('NQTrend', 'NQTrendLeveraged')"
    );
    
    let unleveragedId, leveragedId;
    
    // Find or create unleveraged strategy
    const unleveraged = existingNQ.find(s => s.symbol === 'NQTrend');
    if (unleveraged) {
      unleveragedId = unleveraged.id;
      await connection.execute(
        "UPDATE strategies SET name = 'NQ Trend', active = true, description = 'NASDAQ-100 E-mini futures trend following strategy with fixed 1-3 contracts per trade' WHERE id = ?",
        [unleveragedId]
      );
      console.log(`Reactivated NQ Trend (Unleveraged) with ID: ${unleveragedId}`);
    } else {
      const [result] = await connection.execute(
        "INSERT INTO strategies (symbol, name, market, strategyType, description, active, microToMiniRatio) VALUES ('NQTrend', 'NQ Trend', 'NQ', 'Trend', 'NASDAQ-100 E-mini futures trend following strategy with fixed 1-3 contracts per trade', true, 10)",
      );
      unleveragedId = result.insertId;
      console.log(`Created NQ Trend (Unleveraged) with ID: ${unleveragedId}`);
    }
    
    // Find or create leveraged strategy
    const leveraged = existingNQ.find(s => s.symbol === 'NQTrendLeveraged');
    if (leveraged) {
      leveragedId = leveraged.id;
      await connection.execute(
        "UPDATE strategies SET name = 'NQ Trend (Leveraged)', active = true, description = 'Triple NQ Variant combining Trend, ORB, and Short strategies with percentage-based position sizing (33%/66%/100% equity scaling)' WHERE id = ?",
        [leveragedId]
      );
      console.log(`Reactivated NQ Trend (Leveraged) with ID: ${leveragedId}`);
    } else {
      const [result] = await connection.execute(
        "INSERT INTO strategies (symbol, name, market, strategyType, description, active, microToMiniRatio) VALUES ('NQTrendLeveraged', 'NQ Trend (Leveraged)', 'NQ', 'Trend', 'Triple NQ Variant combining Trend, ORB, and Short strategies with percentage-based position sizing (33%/66%/100% equity scaling)', true, 10)",
      );
      leveragedId = result.insertId;
      console.log(`Created NQ Trend (Leveraged) with ID: ${leveragedId}`);
    }
    
    console.log(`Strategy IDs: Unleveraged=${unleveragedId}, Leveraged=${leveragedId}`);

    // Step 3: Clear existing trades for these strategies
    console.log('=== Step 3: Clearing existing trades for NQ strategies ===');
    const [deleteResult] = await connection.execute(
      'DELETE FROM trades WHERE strategyId IN (?, ?)',
      [unleveragedId, leveragedId]
    );
    console.log(`Deleted ${deleteResult.affectedRows} existing trades`);

    // Step 4: Import trades from CSV files
    console.log('=== Step 4: Importing trades from CSV files ===');
    
    // Import unleveraged trades
    console.log('Importing unleveraged trades...');
    const unleveragedTrades = await importTradesFromCSV(connection, UNLEVERAGED_CSV, unleveragedId);
    console.log(`Imported ${unleveragedTrades} unleveraged trades`);
    
    // Import leveraged trades
    console.log('Importing leveraged trades...');
    const leveragedTrades = await importTradesFromCSV(connection, LEVERAGED_CSV, leveragedId);
    console.log(`Imported ${leveragedTrades} leveraged trades`);

    // Step 5: Verify
    console.log('=== Step 5: Verification ===');
    const [summary] = await connection.execute(`
      SELECT s.symbol, s.name, COUNT(t.id) as tradeCount, SUM(t.pnl) as totalPnl, MIN(t.entryDate) as firstTrade, MAX(t.exitDate) as lastTrade
      FROM strategies s
      LEFT JOIN trades t ON s.id = t.strategyId
      WHERE s.active = true
      GROUP BY s.id
    `);
    
    console.log('Active strategies summary:');
    for (const s of summary) {
      console.log(`  ${s.symbol} (${s.name}):`);
      console.log(`    Trades: ${s.tradeCount}`);
      console.log(`    Total P&L: $${(s.totalPnl / 100).toFixed(2)}`);
      console.log(`    Date range: ${s.firstTrade} to ${s.lastTrade}`);
    }

    console.log('=== Consolidation complete! ===');
    
  } finally {
    await connection.end();
  }
}

async function importTradesFromCSV(connection, csvPath, strategyId) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  
  // Skip header (and handle BOM)
  const dataLines = lines.slice(1);
  
  console.log(`  Processing ${dataLines.length} lines from CSV`);
  
  // Parse trades - CSV has Exit first, then Entry for each trade
  // We need to match them by trade number
  const tradeMap = new Map();
  
  for (const line of dataLines) {
    const parts = parseCSVLine(line);
    if (parts.length < 8) continue;
    
    // Trade #,Type,Date and time,Signal,Price USD,Position size (qty),Position size (value),Net P&L USD,...
    const tradeNum = parseInt(parts[0]);
    const type = parts[1];
    const dateTime = parts[2];
    const signal = parts[3];
    const price = parseFloat(parts[4]);
    const qty = parseInt(parts[5]);
    const pnlUsd = parseFloat(parts[7]);
    
    if (isNaN(tradeNum)) continue;
    
    if (!tradeMap.has(tradeNum)) {
      tradeMap.set(tradeNum, {});
    }
    
    const trade = tradeMap.get(tradeNum);
    
    if (type.includes('Entry')) {
      trade.entryTime = parseDateTime(dateTime);
      trade.entryPrice = price;
      trade.quantity = qty;
      trade.direction = type.toLowerCase().includes('long') ? 'Long' : 'Short';
      trade.signal = signal;
    } else if (type.includes('Exit')) {
      trade.exitTime = parseDateTime(dateTime);
      trade.exitPrice = price;
      trade.pnlUsd = pnlUsd;
    }
  }
  
  // Convert to array of complete trades
  const trades = [];
  for (const [tradeNum, trade] of tradeMap) {
    if (trade.entryTime && trade.exitTime && trade.entryPrice && trade.exitPrice) {
      // P&L is already in USD from CSV, convert to cents
      const pnlCents = Math.round(trade.pnlUsd * 100);
      
      trades.push({
        strategyId,
        direction: trade.direction,
        entryDate: trade.entryTime,
        exitDate: trade.exitTime,
        entryPrice: Math.round(trade.entryPrice * 100),
        exitPrice: Math.round(trade.exitPrice * 100),
        quantity: trade.quantity,
        pnl: pnlCents,
        pnlPercent: 0, // Will be calculated
        source: 'csv_import'
      });
    }
  }
  
  console.log(`  Found ${trades.length} complete trades`);
  
  // Batch insert trades
  if (trades.length > 0) {
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < trades.length; i += batchSize) {
      const batch = trades.slice(i, i + batchSize);
      const values = batch.map(t => [
        t.strategyId,
        t.direction,
        t.entryDate,
        t.exitDate,
        t.entryPrice,
        t.exitPrice,
        t.quantity,
        t.pnl,
        t.pnlPercent,
        t.source
      ]);
      
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await connection.execute(
        `INSERT INTO trades (strategyId, direction, entryDate, exitDate, entryPrice, exitPrice, quantity, pnl, pnlPercent, source) VALUES ${placeholders}`,
        flatValues
      );
      
      inserted += batch.length;
    }
    
    console.log(`  Imported ${inserted} trades total`);
  }
  
  return trades.length;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseDateTime(dateTimeStr) {
  // Format: "2011-01-17 10:25" -> MySQL datetime
  const parts = dateTimeStr.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}:00`;
  }
  return dateTimeStr;
}

main().catch(console.error);
