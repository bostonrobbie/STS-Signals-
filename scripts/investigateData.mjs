/**
 * Data Investigation Script
 * Run with: node scripts/investigateData.mjs
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

async function main() {
  const pool = mysql.createPool({
    uri: DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log('=== TODAY\'S WEBHOOK LOGS ===\n');
    
    // Get today's webhook logs
    const [webhookLogs] = await pool.execute(`
      SELECT id, strategySymbol, status, isTest, ipAddress, createdAt,
             SUBSTRING(payload, 1, 300) as payload_preview
      FROM webhook_logs 
      WHERE DATE(createdAt) = CURDATE()
      ORDER BY createdAt DESC
      LIMIT 50
    `);
    
    console.log(`Found ${webhookLogs.length} webhook logs today:\n`);
    
    for (const log of webhookLogs) {
      const testLabel = log.isTest ? '[TEST]' : '[REAL]';
      console.log(`${testLabel} ID: ${log.id} | Strategy: ${log.strategySymbol} | Status: ${log.status} | IP: ${log.ipAddress} | Time: ${log.createdAt}`);
      console.log(`  Payload: ${log.payload_preview}...\n`);
    }

    console.log('\n=== TODAY\'S OPEN POSITIONS ===\n');
    
    // Get today's open positions
    const [positions] = await pool.execute(`
      SELECT id, strategyId, strategySymbol, direction, entryPrice, quantity, status, isTest, createdAt
      FROM open_positions 
      WHERE DATE(createdAt) = CURDATE()
      ORDER BY createdAt DESC
      LIMIT 30
    `);
    
    console.log(`Found ${positions.length} open positions today:\n`);
    
    for (const pos of positions) {
      const testLabel = pos.isTest ? '[TEST]' : '[REAL]';
      console.log(`${testLabel} ID: ${pos.id} | Strategy: ${pos.strategySymbol} | Direction: ${pos.direction} | Status: ${pos.status} | Price: ${pos.entryPrice/100}`);
    }

    console.log('\n=== TODAY\'S TRADES ===\n');
    
    // Get today's trades
    const [trades] = await pool.execute(`
      SELECT t.id, t.strategyId, s.symbol, t.direction, t.entryPrice, t.exitPrice, t.pnl, t.isTest, t.source, t.createdAt
      FROM trades t
      LEFT JOIN strategies s ON t.strategyId = s.id
      WHERE DATE(t.createdAt) = CURDATE()
      ORDER BY t.createdAt DESC
      LIMIT 30
    `);
    
    console.log(`Found ${trades.length} trades today:\n`);
    
    for (const trade of trades) {
      const testLabel = trade.isTest ? '[TEST]' : '[REAL]';
      console.log(`${testLabel} ID: ${trade.id} | Strategy: ${trade.symbol} | Direction: ${trade.direction} | P&L: $${trade.pnl/100} | Source: ${trade.source}`);
    }

    console.log('\n=== SUMMARY ===\n');
    
    // Count test vs real
    const [testCounts] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM webhook_logs WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_webhooks,
        (SELECT COUNT(*) FROM webhook_logs WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_webhooks,
        (SELECT COUNT(*) FROM trades WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_trades,
        (SELECT COUNT(*) FROM trades WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_trades,
        (SELECT COUNT(*) FROM open_positions WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_positions,
        (SELECT COUNT(*) FROM open_positions WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_positions
    `);
    
    console.log('Today\'s data breakdown:');
    console.log(`  Webhook logs: ${testCounts[0].test_webhooks} test, ${testCounts[0].real_webhooks} real`);
    console.log(`  Trades: ${testCounts[0].test_trades} test, ${testCounts[0].real_trades} real`);
    console.log(`  Open positions: ${testCounts[0].test_positions} test, ${testCounts[0].real_positions} real`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
