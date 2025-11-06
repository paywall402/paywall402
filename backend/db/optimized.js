import pkg from 'pg';
const { Pool } = pkg;
import { logger } from '../utils/errorHandler.js';
import { cache, cacheKeys } from '../utils/cache.js';

/**
 * Optimized Database Manager with connection pooling and query optimization
 */

class DatabaseManager {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: parseInt(config.port || process.env.DB_PORT || 5432),
      database: config.database || process.env.DB_NAME || 'paywall402',
      user: config.user || process.env.DB_USER || 'postgres',
      password: config.password || process.env.DB_PASSWORD,

      // Connection pool settings
      max: parseInt(process.env.DB_POOL_MAX || 20),
      min: parseInt(process.env.DB_POOL_MIN || 2),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || 30000),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || 2000),

      // Statement timeout to prevent long-running queries
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || 30000),

      // Enable SSL in production
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      } : false
    };

    this.pool = null;
    this.preparedStatements = new Map();
    this.queryStats = new Map();
  }

  /**
   * Initialize connection pool
   */
  async connect() {
    try {
      this.pool = new Pool(this.config);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Setup event handlers
      this.pool.on('error', (err, client) => {
        logger.error('Unexpected database error on idle client', err);
      });

      this.pool.on('connect', (client) => {
        logger.debug('New client connected to database pool');
      });

      this.pool.on('acquire', (client) => {
        logger.debug('Client acquired from pool');
      });

      this.pool.on('remove', (client) => {
        logger.debug('Client removed from pool');
      });

      logger.info('Database connection pool initialized successfully');

      // Initialize prepared statements
      await this.initializePreparedStatements();

      return true;
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  /**
   * Initialize commonly used prepared statements
   */
  async initializePreparedStatements() {
    const statements = {
      getContent: `
        SELECT id, content_type, content_path, original_filename,
               file_mimetype, price_usdc, creator_wallet, views,
               payments, expires_at, created_at, updated_at,
               title, description
        FROM content
        WHERE id = $1
      `,

      updateContentViews: `
        UPDATE content
        SET views = views + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING views
      `,

      createPayment: `
        INSERT INTO payment_logs
        (id, content_id, payer_wallet, amount_usdc, transaction_signature, payment_status, paid_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *
      `,

      getPaymentBySignature: `
        SELECT * FROM payment_logs
        WHERE transaction_signature = $1
      `,

      updatePaymentCount: `
        UPDATE content
        SET payments = payments + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING payments
      `,

      getContentStats: `
        SELECT
          COUNT(*) as total_content,
          SUM(views) as total_views,
          SUM(payments) as total_payments,
          SUM(price_usdc * payments) as total_revenue
        FROM content
        WHERE creator_wallet = $1
        AND ($2::timestamp IS NULL OR created_at >= $2)
        AND ($3::timestamp IS NULL OR created_at <= $3)
      `,

      getTopContent: `
        SELECT id, content_type, price_usdc, views, payments,
               (price_usdc * payments) as revenue, created_at, title
        FROM content
        WHERE creator_wallet = $1
        ORDER BY payments DESC, views DESC
        LIMIT $2 OFFSET $3
      `,

      deleteExpiredContent: `
        DELETE FROM content
        WHERE expires_at IS NOT NULL
        AND expires_at < CURRENT_TIMESTAMP
        RETURNING id
      `,

      searchContent: `
        SELECT id, content_type, price_usdc, creator_wallet,
               views, payments, created_at, title, description
        FROM content
        WHERE
          ($1::text IS NULL OR LOWER(title) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1))
          AND ($2::varchar IS NULL OR content_type = $2)
          AND ($3::decimal IS NULL OR price_usdc >= $3)
          AND ($4::decimal IS NULL OR price_usdc <= $4)
          AND ($5::varchar IS NULL OR creator_wallet = $5)
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        ORDER BY
          CASE WHEN $6 = 'price_asc' THEN price_usdc END ASC,
          CASE WHEN $6 = 'price_desc' THEN price_usdc END DESC,
          CASE WHEN $6 = 'views' THEN views END DESC,
          CASE WHEN $6 = 'payments' THEN payments END DESC,
          CASE WHEN $6 = 'created' THEN created_at END DESC
        LIMIT $7 OFFSET $8
      `
    };

    for (const [name, query] of Object.entries(statements)) {
      this.preparedStatements.set(name, query);
    }
  }

  /**
   * Execute a query with automatic retries and caching
   */
  async query(text, params = [], options = {}) {
    const {
      cache: useCache = false,
      cacheKey = null,
      cacheTTL = 300,
      retries = 2,
      client = null
    } = options;

    // Check cache if enabled
    if (useCache && cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for query: ${cacheKey}`);
        return cached;
      }
    }

    const startTime = Date.now();
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const queryClient = client || this.pool;
        const result = await queryClient.query(text, params);

        // Log query statistics
        const duration = Date.now() - startTime;
        this.logQueryStats(text, duration, result.rowCount);

        // Cache if enabled
        if (useCache && cacheKey && result.rows) {
          await cache.set(cacheKey, result.rows, cacheTTL);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          logger.warn(`Query failed (attempt ${attempt + 1}/${retries + 1}):`, error.message);
          await this.delay(100 * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    logger.error('Query failed after all retries:', lastError);
    throw lastError;
  }

  /**
   * Execute a prepared statement
   */
  async executePrepared(name, params = [], options = {}) {
    const query = this.preparedStatements.get(name);

    if (!query) {
      throw new Error(`Prepared statement '${name}' not found`);
    }

    return this.query(query, params, options);
  }

  /**
   * Execute a transaction
   */
  async transaction(callback) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch insert with optimal performance
   */
  async batchInsert(table, columns, values, options = {}) {
    const {
      chunkSize = 1000,
      onConflict = null,
      returning = null
    } = options;

    const results = [];

    for (let i = 0; i < values.length; i += chunkSize) {
      const chunk = values.slice(i, i + chunkSize);

      // Build parameterized query
      const placeholders = chunk.map((_, rowIndex) =>
        `(${columns.map((_, colIndex) =>
          `$${rowIndex * columns.length + colIndex + 1}`
        ).join(', ')})`
      ).join(', ');

      let query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

      if (onConflict) {
        query += ` ON CONFLICT ${onConflict}`;
      }

      if (returning) {
        query += ` RETURNING ${returning}`;
      }

      // Flatten values for parameterized query
      const flatValues = chunk.flat();

      const result = await this.query(query, flatValues);
      results.push(...(result.rows || []));
    }

    return results;
  }

  /**
   * Optimized content retrieval with caching
   */
  async getContent(id, options = {}) {
    const cacheKey = cacheKeys.content(id);

    const result = await this.executePrepared('getContent', [id], {
      cache: true,
      cacheKey,
      cacheTTL: 300,
      ...options
    });

    return result.rows[0] || null;
  }

  /**
   * Update content views with debouncing
   */
  async incrementViews(id) {
    // Use cache to debounce view updates
    const viewKey = `views:pending:${id}`;
    const pendingViews = (await cache.get(viewKey)) || 0;

    if (pendingViews < 10) {
      // Increment in cache
      await cache.set(viewKey, pendingViews + 1, 60);
    } else {
      // Flush to database
      await this.executePrepared('updateContentViews', [id]);
      await cache.del(viewKey);

      // Invalidate content cache
      await cache.del(cacheKeys.content(id));
    }
  }

  /**
   * Create payment with duplicate check
   */
  async createPayment(paymentData) {
    const { transactionSignature } = paymentData;

    // Check for duplicate payment
    const existing = await this.executePrepared(
      'getPaymentBySignature',
      [transactionSignature]
    );

    if (existing.rows.length > 0) {
      logger.warn('Duplicate payment attempt:', transactionSignature);
      return existing.rows[0];
    }

    // Create payment in transaction
    return await this.transaction(async (client) => {
      // Insert payment
      const payment = await this.query(
        this.preparedStatements.get('createPayment'),
        [
          paymentData.id,
          paymentData.contentId,
          paymentData.payerWallet,
          paymentData.amountUsdc,
          paymentData.transactionSignature,
          paymentData.paymentStatus
        ],
        { client }
      );

      // Update content payment count
      await this.query(
        this.preparedStatements.get('updatePaymentCount'),
        [paymentData.contentId],
        { client }
      );

      // Invalidate caches
      await cache.del(cacheKeys.content(paymentData.contentId));
      await cache.del(cacheKeys.contentStats(paymentData.contentId));

      return payment.rows[0];
    });
  }

  /**
   * Get creator statistics with caching
   */
  async getCreatorStats(creatorWallet, startDate = null, endDate = null) {
    const cacheKey = `stats:${creatorWallet}:${startDate}:${endDate}`;

    const result = await this.executePrepared(
      'getContentStats',
      [creatorWallet, startDate, endDate],
      {
        cache: true,
        cacheKey,
        cacheTTL: 600 // 10 minutes
      }
    );

    return result.rows[0];
  }

  /**
   * Search content with full-text search
   */
  async searchContent(filters = {}) {
    const {
      query: searchQuery = null,
      type = null,
      minPrice = null,
      maxPrice = null,
      creator = null,
      sort = 'created',
      limit = 20,
      offset = 0
    } = filters;

    // Add wildcards for LIKE search
    const searchPattern = searchQuery ? `%${searchQuery}%` : null;

    const result = await this.executePrepared(
      'searchContent',
      [searchPattern, type, minPrice, maxPrice, creator, sort, limit, offset],
      {
        cache: true,
        cacheKey: `search:${JSON.stringify(filters)}`,
        cacheTTL: 120
      }
    );

    return result.rows;
  }

  /**
   * Clean up expired content
   */
  async cleanupExpired() {
    const result = await this.executePrepared('deleteExpiredContent');

    if (result.rows.length > 0) {
      logger.info(`Deleted ${result.rows.length} expired content items`);

      // Invalidate caches for deleted items
      for (const row of result.rows) {
        await cache.del(cacheKeys.content(row.id));
      }
    }

    return result.rows;
  }

  /**
   * Get database statistics
   */
  async getStats() {
    const stats = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM content) as total_content,
        (SELECT COUNT(*) FROM payment_logs) as total_payments,
        (SELECT SUM(price_usdc * payments) FROM content) as total_revenue,
        (SELECT COUNT(DISTINCT creator_wallet) FROM content) as unique_creators,
        pg_database_size(current_database()) as database_size
    `);

    const poolStats = {
      totalClients: this.pool.totalCount,
      idleClients: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };

    return {
      ...stats.rows[0],
      pool: poolStats,
      queryStats: Array.from(this.queryStats.entries()).map(([query, stats]) => ({
        query: query.substring(0, 50) + '...',
        ...stats
      }))
    };
  }

  /**
   * Log query statistics
   */
  logQueryStats(query, duration, rowCount) {
    const key = query.substring(0, 100);
    const stats = this.queryStats.get(key) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      maxDuration: 0,
      totalRows: 0
    };

    stats.count++;
    stats.totalDuration += duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.totalRows += rowCount || 0;

    this.queryStats.set(key, stats);

    // Log slow queries
    if (duration > 1000) {
      logger.warn(`Slow query detected (${duration}ms):`, query.substring(0, 100));
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1', [], { retries: 0 });
      return {
        status: 'healthy',
        responseTime: result.duration || 0,
        poolStats: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection pool closed');
    }
  }

  /**
   * Helper: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instance
const db = new DatabaseManager();

export { db, DatabaseManager };

export default db;