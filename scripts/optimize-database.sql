-- Production Database Optimization Script
-- Run this script to optimize the database for production use

-- ============================================================================
-- SECTION 1: ADD PERFORMANCE INDEXES
-- ============================================================================

-- Index for trades by user and strategy (frequently filtered together)
CREATE INDEX IF NOT EXISTS idx_trades_user_strategy 
ON trades(userId, strategyId);

-- Index for trades by entry date (time-range queries)
CREATE INDEX IF NOT EXISTS idx_trades_date 
ON trades(entryDate);

-- Index for user lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer 
ON users(stripeCustomerId);

-- Index for payment history lookups by user
CREATE INDEX IF NOT EXISTS idx_payment_history_user 
ON paymentHistory(userId);

-- Index for payment history lookups by status
CREATE INDEX IF NOT EXISTS idx_payment_history_status 
ON paymentHistory(status);

-- Index for strategies by user
CREATE INDEX IF NOT EXISTS idx_strategies_user 
ON strategies(userId);

-- ============================================================================
-- SECTION 2: ANALYZE TABLES
-- ============================================================================

-- Analyze tables to update statistics for query optimizer
ANALYZE TABLE users;
ANALYZE TABLE strategies;
ANALYZE TABLE trades;
ANALYZE TABLE paymentHistory;

-- ============================================================================
-- SECTION 3: OPTIMIZE TABLES
-- ============================================================================

-- Optimize tables to reclaim unused space
OPTIMIZE TABLE users;
OPTIMIZE TABLE strategies;
OPTIMIZE TABLE trades;
OPTIMIZE TABLE paymentHistory;

-- ============================================================================
-- SECTION 4: VERIFY INDEXES
-- ============================================================================

-- Show all indexes on trades table
SHOW INDEX FROM trades;

-- Show all indexes on users table
SHOW INDEX FROM users;

-- Show all indexes on paymentHistory table
SHOW INDEX FROM paymentHistory;

-- ============================================================================
-- SECTION 5: CHECK TABLE INTEGRITY
-- ============================================================================

-- Check table integrity
CHECK TABLE users;
CHECK TABLE strategies;
CHECK TABLE trades;
CHECK TABLE paymentHistory;

-- ============================================================================
-- SECTION 6: DISPLAY OPTIMIZATION RESULTS
-- ============================================================================

-- Show table sizes
SELECT 
    TABLE_NAME,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
    ROUND((data_free / 1024 / 1024), 2) AS 'Free (MB)',
    ROUND(((data_length) / 1024 / 1024), 2) AS 'Data (MB)',
    ROUND(((index_length) / 1024 / 1024), 2) AS 'Index (MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- Show query cache status
SHOW STATUS LIKE 'Qcache%';

-- Show connection statistics
SHOW STATUS LIKE 'Threads%';

-- ============================================================================
-- SECTION 7: CONFIGURE QUERY CACHE (if not already configured)
-- ============================================================================

-- Note: These require SUPER privilege and may need to be set in my.cnf
-- Uncomment to enable if needed:

-- SET GLOBAL query_cache_size = 268435456;  -- 256MB
-- SET GLOBAL query_cache_type = 1;          -- ON

-- ============================================================================
-- SECTION 8: ENABLE SLOW QUERY LOG (for monitoring)
-- ============================================================================

-- Note: These require SUPER privilege and may need to be set in my.cnf
-- Uncomment to enable if needed:

-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 2;  -- Log queries taking >2 seconds
-- SET GLOBAL log_queries_not_using_indexes = 'ON';

-- ============================================================================
-- SECTION 9: VERIFY OPTIMIZATION
-- ============================================================================

-- Show current database statistics
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN subscriptionTier = 'pro' THEN 1 ELSE 0 END) as pro_users,
    SUM(CASE WHEN subscriptionTier = 'enterprise' THEN 1 ELSE 0 END) as enterprise_users
FROM users;

SELECT 
    COUNT(*) as total_strategies
FROM strategies;

SELECT 
    COUNT(*) as total_trades,
    MIN(entryDate) as oldest_trade,
    MAX(entryDate) as newest_trade
FROM trades;

SELECT 
    COUNT(*) as total_payments,
    SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful_payments,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
    SUM(amount) / 100 as total_revenue_usd
FROM paymentHistory;

-- ============================================================================
-- SECTION 10: BACKUP VERIFICATION
-- ============================================================================

-- Verify database integrity
CHECKSUM TABLE users, strategies, trades, paymentHistory;

-- Show last modified time for each table
SELECT 
    TABLE_NAME,
    UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY UPDATE_TIME DESC;

-- ============================================================================
-- END OF OPTIMIZATION SCRIPT
-- ============================================================================

-- Summary of optimizations performed:
-- 1. Added 6 performance indexes for common queries
-- 2. Analyzed table statistics for query optimizer
-- 3. Optimized tables to reclaim unused space
-- 4. Verified index creation
-- 5. Checked table integrity
-- 6. Displayed optimization results
-- 7. Provided configuration for query cache
-- 8. Provided configuration for slow query log
-- 9. Verified database statistics
-- 10. Verified backup integrity

-- Expected results:
-- - All indexes created successfully
-- - All tables analyzed
-- - All tables optimized
-- - No integrity errors
-- - Query cache configured (if enabled)
-- - Slow query log enabled (if configured)
