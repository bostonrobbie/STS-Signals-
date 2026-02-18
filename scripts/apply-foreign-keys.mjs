import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Foreign key constraints to add
// Note: Using SET NULL or CASCADE depending on the relationship
const foreignKeys = [
  // trades -> strategies
  {
    name: 'fk_trades_strategy',
    sql: `ALTER TABLE trades ADD CONSTRAINT fk_trades_strategy 
          FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE`
  },
  
  // broker_connections -> users
  {
    name: 'fk_broker_connections_user',
    sql: `ALTER TABLE broker_connections ADD CONSTRAINT fk_broker_connections_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // routing_rules -> users
  {
    name: 'fk_routing_rules_user',
    sql: `ALTER TABLE routing_rules ADD CONSTRAINT fk_routing_rules_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // routing_rules -> broker_connections
  {
    name: 'fk_routing_rules_broker',
    sql: `ALTER TABLE routing_rules ADD CONSTRAINT fk_routing_rules_broker 
          FOREIGN KEY (brokerConnectionId) REFERENCES broker_connections(id) ON DELETE CASCADE`
  },
  
  // execution_logs -> webhook_logs
  {
    name: 'fk_execution_logs_webhook',
    sql: `ALTER TABLE execution_logs ADD CONSTRAINT fk_execution_logs_webhook 
          FOREIGN KEY (webhookLogId) REFERENCES webhook_logs(id) ON DELETE CASCADE`
  },
  
  // execution_logs -> broker_connections
  {
    name: 'fk_execution_logs_broker',
    sql: `ALTER TABLE execution_logs ADD CONSTRAINT fk_execution_logs_broker 
          FOREIGN KEY (brokerConnectionId) REFERENCES broker_connections(id) ON DELETE CASCADE`
  },
  
  // user_subscriptions -> users
  {
    name: 'fk_user_subscriptions_user',
    sql: `ALTER TABLE user_subscriptions ADD CONSTRAINT fk_user_subscriptions_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // user_subscriptions -> strategies
  {
    name: 'fk_user_subscriptions_strategy',
    sql: `ALTER TABLE user_subscriptions ADD CONSTRAINT fk_user_subscriptions_strategy 
          FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE`
  },
  
  // user_payment_subscriptions -> users
  {
    name: 'fk_user_payment_subscriptions_user',
    sql: `ALTER TABLE user_payment_subscriptions ADD CONSTRAINT fk_user_payment_subscriptions_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // user_payment_subscriptions -> subscription_tiers
  {
    name: 'fk_user_payment_subscriptions_tier',
    sql: `ALTER TABLE user_payment_subscriptions ADD CONSTRAINT fk_user_payment_subscriptions_tier 
          FOREIGN KEY (tierId) REFERENCES subscription_tiers(id) ON DELETE RESTRICT`
  },
  
  // payment_history -> users
  {
    name: 'fk_payment_history_user',
    sql: `ALTER TABLE payment_history ADD CONSTRAINT fk_payment_history_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // open_positions -> strategies
  {
    name: 'fk_open_positions_strategy',
    sql: `ALTER TABLE open_positions ADD CONSTRAINT fk_open_positions_strategy 
          FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE`
  },
  
  // user_signals -> users
  {
    name: 'fk_user_signals_user',
    sql: `ALTER TABLE user_signals ADD CONSTRAINT fk_user_signals_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // user_signals -> webhook_logs
  {
    name: 'fk_user_signals_webhook',
    sql: `ALTER TABLE user_signals ADD CONSTRAINT fk_user_signals_webhook 
          FOREIGN KEY (webhookLogId) REFERENCES webhook_logs(id) ON DELETE CASCADE`
  },
  
  // user_signals -> strategies
  {
    name: 'fk_user_signals_strategy',
    sql: `ALTER TABLE user_signals ADD CONSTRAINT fk_user_signals_strategy 
          FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE`
  },
  
  // notification_preferences -> users
  {
    name: 'fk_notification_preferences_user',
    sql: `ALTER TABLE notification_preferences ADD CONSTRAINT fk_notification_preferences_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // strategy_notification_settings -> users
  {
    name: 'fk_strategy_notification_settings_user',
    sql: `ALTER TABLE strategy_notification_settings ADD CONSTRAINT fk_strategy_notification_settings_user 
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`
  },
  
  // strategy_notification_settings -> strategies
  {
    name: 'fk_strategy_notification_settings_strategy',
    sql: `ALTER TABLE strategy_notification_settings ADD CONSTRAINT fk_strategy_notification_settings_strategy 
          FOREIGN KEY (strategyId) REFERENCES strategies(id) ON DELETE CASCADE`
  },
];

console.log('Adding foreign key constraints...');
console.log('='.repeat(60));

for (const fk of foreignKeys) {
  try {
    await connection.execute(fk.sql);
    console.log(`✓ ${fk.name}`);
  } catch (err) {
    if (err.code === 'ER_DUP_KEY' || err.code === 'ER_FK_DUP_NAME' || err.message.includes('Duplicate')) {
      console.log(`○ ${fk.name} (already exists)`);
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      console.log(`⚠ ${fk.name} (orphan data exists - skipped)`);
    } else {
      console.error(`✗ ${fk.name}: ${err.message}`);
    }
  }
}

console.log('='.repeat(60));
console.log('Done!');

await connection.end();
