/**
 * Database Transaction Utilities
 * 
 * Provides atomic transaction support for critical database operations
 * to ensure data consistency in the webhook-to-trade pipeline.
 */

import mysql from 'mysql2/promise';

// Get the connection pool from the main db module
let _pool: mysql.Pool | null = null;

/**
 * Initialize the transaction pool
 * Must be called after the main db pool is created
 */
export function initTransactionPool(pool: mysql.Pool) {
  _pool = pool;
}

/**
 * Get a connection from the pool for transactions
 */
export async function getConnection(): Promise<mysql.PoolConnection> {
  if (!_pool) {
    throw new Error('[Transaction] Pool not initialized. Call initTransactionPool first.');
  }
  return await _pool.getConnection();
}

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on error
 * 
 * @param fn - The function to execute within the transaction
 * @returns The result of the function
 * @throws Rethrows any error after rolling back
 */
export async function withTransaction<T>(
  fn: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();
    console.log('[Transaction] Started');
    
    const result = await fn(connection);
    
    await connection.commit();
    console.log('[Transaction] Committed');
    
    return result;
  } catch (error) {
    await connection.rollback();
    console.error('[Transaction] Rolled back due to error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Retry wrapper for database operations
 * Handles transient connection errors with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay between retries in ms (default: 500)
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 500
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is retryable
      const isRetryable = 
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('Connection lost') ||
        errorMessage.includes('ER_LOCK_DEADLOCK') ||
        errorMessage.includes('ER_LOCK_WAIT_TIMEOUT');
      
      if (isRetryable && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(
          `[Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`,
          errorMessage
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`[Retry] All ${maxRetries} attempts failed:`, errorMessage);
        throw error;
      }
    }
  }
  
  throw lastError;
}

/**
 * Execute a raw SQL query within a transaction connection
 * Useful for operations that need direct SQL access
 */
export async function executeInTransaction(
  connection: mysql.PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<[mysql.QueryResult, mysql.FieldPacket[]]> {
  return await connection.execute(sql, params);
}

/**
 * Insert a record and return the inserted ID
 * Works within a transaction connection
 */
export async function insertWithId(
  connection: mysql.PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<number> {
  const [result] = await connection.execute(sql, params);
  const insertResult = result as mysql.ResultSetHeader;
  return insertResult.insertId;
}

/**
 * Health check for the database connection
 * Returns true if database is reachable
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  if (!_pool) {
    return false;
  }
  
  try {
    const connection = await _pool.getConnection();
    try {
      await connection.ping();
      return true;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}

/**
 * Generate an idempotency key from webhook payload
 * Used to prevent duplicate processing
 */
export function generateIdempotencyKey(payload: unknown): string {
  const crypto = require('crypto');
  const payloadStr = JSON.stringify(payload);
  return crypto.createHash('sha256').update(payloadStr).digest('hex').substring(0, 32);
}
