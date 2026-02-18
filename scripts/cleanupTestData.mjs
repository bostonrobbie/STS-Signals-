/**
 * Test Data Cleanup Script
 * 
 * This script identifies and marks test data based on:
 * 1. IP address patterns (test-simulator, ::1, 127.0.0.1)
 * 2. Payload patterns (isTest: true in payload)
 * 3. Linked trades and positions from test webhooks
 * 
 * Run with: node scripts/cleanupTestData.mjs
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
    console.log('=== MARKING TEST DATA ===\n');
    
    // Step 1: Mark webhook logs from test sources as test data
    console.log('Step 1: Marking webhook logs from test sources...');
    
    const [webhookResult] = await pool.execute(`
      UPDATE webhook_logs 
      SET isTest = 1 
      WHERE (
        ipAddress IN ('test-simulator', '::1', '127.0.0.1', 'localhost')
        OR payload LIKE '%"isTest":true%'
        OR payload LIKE '%"isTest": true%'
      )
      AND isTest = 0
    `);
    console.log(`  Marked ${webhookResult.affectedRows} webhook logs as test data`);

    // Step 2: Get the trade IDs linked to test webhook logs
    console.log('\nStep 2: Finding trades linked to test webhooks...');
    
    const [testTradeIds] = await pool.execute(`
      SELECT DISTINCT tradeId 
      FROM webhook_logs 
      WHERE isTest = 1 
      AND tradeId IS NOT NULL
    `);
    console.log(`  Found ${testTradeIds.length} trades linked to test webhooks`);

    // Step 3: Mark those trades as test data
    if (testTradeIds.length > 0) {
      const tradeIds = testTradeIds.map(r => r.tradeId).join(',');
      const [tradesResult] = await pool.execute(`
        UPDATE trades 
        SET isTest = 1 
        WHERE id IN (${tradeIds})
        AND isTest = 0
      `);
      console.log(`  Marked ${tradesResult.affectedRows} trades as test data`);
    }

    // Step 4: Mark open positions from test webhooks
    console.log('\nStep 3: Marking open positions from test webhooks...');
    
    const [positionsResult] = await pool.execute(`
      UPDATE open_positions op
      INNER JOIN webhook_logs wl ON op.entryWebhookLogId = wl.id
      SET op.isTest = 1
      WHERE wl.isTest = 1
      AND op.isTest = 0
    `);
    console.log(`  Marked ${positionsResult.affectedRows} open positions as test data`);

    // Step 5: Also mark trades that were created today from test-simulator
    console.log('\nStep 4: Marking additional test trades from today...');
    
    // Find trades that match test webhook patterns (same entry/exit times as test webhooks)
    const [additionalTrades] = await pool.execute(`
      UPDATE trades t
      INNER JOIN (
        SELECT DISTINCT tradeId 
        FROM webhook_logs 
        WHERE DATE(createdAt) = CURDATE()
        AND ipAddress = 'test-simulator'
        AND tradeId IS NOT NULL
      ) tw ON t.id = tw.tradeId
      SET t.isTest = 1
      WHERE t.isTest = 0
    `);
    console.log(`  Marked ${additionalTrades.affectedRows} additional trades as test data`);

    // Step 6: Verify the cleanup
    console.log('\n=== VERIFICATION ===\n');
    
    const [counts] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM webhook_logs WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_webhooks,
        (SELECT COUNT(*) FROM webhook_logs WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_webhooks,
        (SELECT COUNT(*) FROM trades WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_trades,
        (SELECT COUNT(*) FROM trades WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_trades,
        (SELECT COUNT(*) FROM open_positions WHERE DATE(createdAt) = CURDATE() AND isTest = 1) as test_positions,
        (SELECT COUNT(*) FROM open_positions WHERE DATE(createdAt) = CURDATE() AND isTest = 0) as real_positions
    `);
    
    console.log('After cleanup - Today\'s data breakdown:');
    console.log(`  Webhook logs: ${counts[0].test_webhooks} test, ${counts[0].real_webhooks} real`);
    console.log(`  Trades: ${counts[0].test_trades} test, ${counts[0].real_trades} real`);
    console.log(`  Open positions: ${counts[0].test_positions} test, ${counts[0].real_positions} real`);

    // Step 7: Show what real data remains
    console.log('\n=== REMAINING REAL DATA ===\n');
    
    const [realWebhooks] = await pool.execute(`
      SELECT id, strategySymbol, status, ipAddress, createdAt
      FROM webhook_logs 
      WHERE DATE(createdAt) = CURDATE() 
      AND isTest = 0
      AND status = 'success'
      ORDER BY createdAt DESC
      LIMIT 20
    `);
    
    console.log(`Real successful webhooks today (${realWebhooks.length}):`);
    for (const wh of realWebhooks) {
      console.log(`  ID: ${wh.id} | Strategy: ${wh.strategySymbol} | IP: ${wh.ipAddress} | Time: ${wh.createdAt}`);
    }

    const [realTrades] = await pool.execute(`
      SELECT t.id, s.symbol, t.direction, t.pnl, t.source, t.createdAt
      FROM trades t
      LEFT JOIN strategies s ON t.strategyId = s.id
      WHERE DATE(t.createdAt) = CURDATE() 
      AND t.isTest = 0
      ORDER BY t.createdAt DESC
      LIMIT 20
    `);
    
    console.log(`\nReal trades today (${realTrades.length}):`);
    for (const trade of realTrades) {
      console.log(`  ID: ${trade.id} | Strategy: ${trade.symbol} | Direction: ${trade.direction} | P&L: $${trade.pnl/100} | Source: ${trade.source}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
