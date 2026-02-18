import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Strategy mapping based on CSV filename patterns
const strategyMapping = {
  // ES strategies
  'Timed_VWAP_Entry_–_NQ_1m_w__Short_ADX_Filter_CME_MINI_ES1': { id: 9, name: 'ES Trend Following' },
  'ES_OR+Gap_Combo_(RVOL+Hurst+VIX)_CME_MINI_ES1': { id: 10, name: 'ES Opening Range Breakout' },
  
  // NQ strategies
  'Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_CME_MINI_NQ1': { id: 11, name: 'NQ Trend Following' },
  'ES_OR+Gap_Combo_—_Modular_CME_MINI_NQ1': { id: 12, name: 'NQ Opening Range Breakout' },
  
  // CL strategy
  'Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_NYMEX_CL1': { id: 13, name: 'CL Trend Following' },
  
  // BTC strategy
  'Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_CME_BTC1': { id: 14, name: 'BTC Trend Following' },
  
  // GC strategy
  'Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_COMEX_GC1': { id: 15, name: 'GC Trend Following' },
  
  // YM strategy
  'ES_OR+Gap_Combo_—_Modular_CBOT_MINI_YM1': { id: 16, name: 'YM Opening Range Breakout' },
};

// Parse CSV content
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
  
  const trades = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx]?.trim() || '';
    });
    trades.push(row);
  }
  return trades;
}

// Group entry/exit pairs into complete trades
function groupTrades(rows) {
  const tradeMap = new Map();
  
  for (const row of rows) {
    const tradeNum = row['Trade #'];
    if (!tradeMap.has(tradeNum)) {
      tradeMap.set(tradeNum, { entry: null, exit: null });
    }
    
    const type = row['Type']?.toLowerCase() || '';
    if (type.includes('entry')) {
      tradeMap.get(tradeNum).entry = row;
    } else if (type.includes('exit')) {
      tradeMap.get(tradeNum).exit = row;
    }
  }
  
  return Array.from(tradeMap.values()).filter(t => t.entry && t.exit);
}

// Convert trade pair to database format
function convertTrade(tradePair, strategyId) {
  const { entry, exit } = tradePair;
  
  // Determine direction from entry type
  const entryType = entry['Type']?.toLowerCase() || '';
  const direction = entryType.includes('long') ? 'Long' : 'Short';
  
  // Parse dates
  const entryDate = new Date(entry['Date and time']);
  const exitDate = new Date(exit['Date and time']);
  
  // Parse prices (convert to cents - multiply by 100)
  const entryPrice = Math.round(parseFloat(entry['Price USD']) * 100);
  const exitPrice = Math.round(parseFloat(exit['Price USD']) * 100);
  
  // Parse P&L (convert to cents - multiply by 100)
  const pnlDollars = parseFloat(exit['Net P&L USD']) || 0;
  const pnl = Math.round(pnlDollars * 100);
  
  // Parse P&L percent (multiply by 10000, e.g., 1.5% = 15000)
  const pnlPercentRaw = parseFloat(exit['Net P&L %']) || 0;
  const pnlPercent = Math.round(pnlPercentRaw * 10000);
  
  // Parse quantity
  const quantity = parseInt(entry['Position size (qty)']) || 1;
  
  return {
    strategyId,
    entryDate,
    exitDate,
    direction,
    entryPrice,
    exitPrice,
    quantity,
    pnl,
    pnlPercent,
    commission: 0,
    isTest: false,
    source: 'csv_import'
  };
}

async function main() {
  const uploadDir = '/home/ubuntu/upload';
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.csv') && !f.includes('recommended_leads'));
  
  console.log(`Found ${files.length} CSV files to process`);
  
  // Connect to database
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  let totalImported = 0;
  let totalDeleted = 0;
  
  for (const file of files) {
    // Find matching strategy
    let matchedStrategy = null;
    for (const [pattern, strategy] of Object.entries(strategyMapping)) {
      if (file.includes(pattern.replace(/[!]/g, '!'))) {
        matchedStrategy = strategy;
        break;
      }
    }
    
    // Try alternative matching by checking file content
    if (!matchedStrategy) {
      // Match by instrument in filename
      if (file.includes('ES1!') && file.includes('Timed_VWAP')) {
        matchedStrategy = strategyMapping['Timed_VWAP_Entry_–_NQ_1m_w__Short_ADX_Filter_CME_MINI_ES1'];
      } else if (file.includes('ES1!') && file.includes('OR+Gap')) {
        matchedStrategy = strategyMapping['ES_OR+Gap_Combo_(RVOL+Hurst+VIX)_CME_MINI_ES1'];
      } else if (file.includes('NQ1!') && file.includes('Timed_VWAP')) {
        matchedStrategy = strategyMapping['Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_CME_MINI_NQ1'];
      } else if (file.includes('NQ1!') && file.includes('OR+Gap')) {
        matchedStrategy = strategyMapping['ES_OR+Gap_Combo_—_Modular_CME_MINI_NQ1'];
      } else if (file.includes('CL1!')) {
        matchedStrategy = strategyMapping['Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_NYMEX_CL1'];
      } else if (file.includes('BTC1!')) {
        matchedStrategy = strategyMapping['Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_CME_BTC1'];
      } else if (file.includes('GC1!')) {
        matchedStrategy = strategyMapping['Timed_VWAP_Entry_–_NQ_1m_w__Long_&_Short_ADX_Filters_+_Distance_Cap_COMEX_GC1'];
      } else if (file.includes('YM1!')) {
        matchedStrategy = strategyMapping['ES_OR+Gap_Combo_—_Modular_CBOT_MINI_YM1'];
      }
    }
    
    if (!matchedStrategy) {
      console.log(`⚠️  No strategy match for: ${file}`);
      continue;
    }
    
    console.log(`\n📁 Processing: ${file}`);
    console.log(`   → Strategy: ${matchedStrategy.name} (ID: ${matchedStrategy.id})`);
    
    // Read and parse CSV
    const content = fs.readFileSync(path.join(uploadDir, file), 'utf-8');
    const rows = parseCSV(content);
    const tradePairs = groupTrades(rows);
    
    console.log(`   → Found ${tradePairs.length} complete trades`);
    
    if (tradePairs.length === 0) continue;
    
    // Get date range from new trades
    const trades = tradePairs.map(tp => convertTrade(tp, matchedStrategy.id));
    const minDate = new Date(Math.min(...trades.map(t => t.exitDate.getTime())));
    const maxDate = new Date(Math.max(...trades.map(t => t.exitDate.getTime())));
    
    console.log(`   → Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
    
    // Delete existing trades in this date range for this strategy
    const deleteQuery = `
      DELETE FROM trades 
      WHERE strategyId = ? 
      AND exitDate >= ? 
      AND exitDate <= ?
    `;
    const [deleteResult] = await conn.execute(deleteQuery, [
      matchedStrategy.id,
      minDate.toISOString().slice(0, 19).replace('T', ' '),
      maxDate.toISOString().slice(0, 19).replace('T', ' ')
    ]);
    console.log(`   → Deleted ${deleteResult.affectedRows} existing trades in date range`);
    totalDeleted += deleteResult.affectedRows;
    
    // Insert new trades
    const insertQuery = `
      INSERT INTO trades (strategyId, entryDate, exitDate, direction, entryPrice, exitPrice, quantity, pnl, pnlPercent, commission, isTest, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    for (const trade of trades) {
      try {
        await conn.execute(insertQuery, [
          trade.strategyId,
          trade.entryDate.toISOString().slice(0, 19).replace('T', ' '),
          trade.exitDate.toISOString().slice(0, 19).replace('T', ' '),
          trade.direction,
          trade.entryPrice,
          trade.exitPrice,
          trade.quantity,
          trade.pnl,
          trade.pnlPercent,
          trade.commission,
          trade.isTest ? 1 : 0,
          trade.source
        ]);
        totalImported++;
      } catch (err) {
        console.error(`   ❌ Error inserting trade: ${err.message}`);
      }
    }
    
    console.log(`   ✅ Imported ${trades.length} trades`);
  }
  
  console.log(`\n========================================`);
  console.log(`Total deleted: ${totalDeleted} trades`);
  console.log(`Total imported: ${totalImported} trades`);
  console.log(`========================================`);
  
  await conn.end();
}

main().catch(console.error);
