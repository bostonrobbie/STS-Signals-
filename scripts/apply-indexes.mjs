import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const indexes = [
  // trades table
  'CREATE INDEX IF NOT EXISTS idx_trades_strategy ON trades(strategyId)',
  'CREATE INDEX IF NOT EXISTS idx_trades_exit_date ON trades(exitDate)',
  'CREATE INDEX IF NOT EXISTS idx_trades_strategy_exit ON trades(strategyId, exitDate)',
  
  // webhook_logs table
  'CREATE INDEX IF NOT EXISTS idx_webhook_logs_strategy ON webhook_logs(strategyId)',
  'CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status)',
  'CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(createdAt)',
  
  // broker_connections table
  'CREATE INDEX IF NOT EXISTS idx_broker_connections_user ON broker_connections(userId)',
  'CREATE INDEX IF NOT EXISTS idx_broker_connections_status ON broker_connections(status)',
  
  // open_positions table
  'CREATE INDEX IF NOT EXISTS idx_open_positions_strategy ON open_positions(strategyId)',
  'CREATE INDEX IF NOT EXISTS idx_open_positions_status ON open_positions(status)',
  'CREATE INDEX IF NOT EXISTS idx_open_positions_strategy_status ON open_positions(strategyId, status)',
  
  // routing_rules table
  'CREATE INDEX IF NOT EXISTS idx_routing_rules_user ON routing_rules(userId)',
  'CREATE INDEX IF NOT EXISTS idx_routing_rules_broker ON routing_rules(brokerConnectionId)',
  
  // execution_logs table
  'CREATE INDEX IF NOT EXISTS idx_execution_logs_webhook ON execution_logs(webhookLogId)',
  'CREATE INDEX IF NOT EXISTS idx_execution_logs_broker ON execution_logs(brokerConnectionId)',
  'CREATE INDEX IF NOT EXISTS idx_execution_logs_status ON execution_logs(status)',
  
  // payment_history table
  'CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(userId)',
  'CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status)',
  'CREATE INDEX IF NOT EXISTS idx_payment_history_created ON payment_history(createdAt)',
];

console.log('Applying database indexes...');
console.log('='.repeat(60));

for (const sql of indexes) {
  try {
    await connection.execute(sql);
    const indexName = sql.match(/idx_\w+/)?.[0] || 'unknown';
    console.log(`✓ ${indexName}`);
  } catch (err) {
    if (err.code === 'ER_DUP_KEYNAME') {
      const indexName = sql.match(/idx_\w+/)?.[0] || 'unknown';
      console.log(`○ ${indexName} (already exists)`);
    } else {
      console.error(`✗ Error: ${err.message}`);
    }
  }
}

console.log('='.repeat(60));
console.log('Done!');

await connection.end();
