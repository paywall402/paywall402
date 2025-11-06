import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isDevelopment = process.env.NODE_ENV === 'development';
const useMockDB = process.env.USE_MOCK_DB === 'true';

let query, transaction, healthCheck, close, pool;

// Use mock database if enabled
if (useMockDB) {
  console.log('⚠️  Using mock in-memory database (data will be lost on restart)');
  const mockDB = await import('./mock.js');
  query = mockDB.query;
  transaction = mockDB.transaction;
  healthCheck = mockDB.healthCheck;
  close = mockDB.close;
} else {

// Database connection pool with improved configuration
pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'paywall402',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Wait up to 5 seconds for connection
  // Enable SSL in production (disable for local development)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Don't exit in development to allow hot reloading
  if (process.env.NODE_ENV === 'production') {
    process.exit(-1);
  }
});

/**
 * Enhanced query helper with logging and error handling
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters (prevents SQL injection)
 * @returns {Promise<Object>} - Query result
 */
query = async (text, params = []) => {
  const start = Date.now();
  const client = await pool.connect();

  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;

    if (isDevelopment) {
      // Truncate long queries for logging
      const queryPreview = text.length > 100 ? text.substring(0, 100) + '...' : text;
      console.log('📊 Query executed', {
        query: queryPreview,
        duration: `${duration}ms`,
        rows: res.rowCount
      });
    }

    return res;
  } catch (error) {
    console.error('❌ Database query error:', {
      message: error.message,
      query: text.substring(0, 100),
      params: params?.length || 0
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Transaction helper with proper error handling
 * @param {Function} callback - Function to execute within transaction
 * @returns {Promise<any>} - Transaction result
 */
transaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🔄 Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    console.log('✅ Transaction committed');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Health check function
 * @returns {Promise<boolean>} - True if database is healthy
 */
healthCheck = async () => {
  try {
    const result = await query('SELECT NOW()');
    return result.rows.length > 0;
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return false;
  }
};

/**
 * Gracefully close all database connections
 */
close = async () => {
  try {
    await pool.end();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error.message);
  }
};

}

export { query, transaction, healthCheck, close };
export default pool;
