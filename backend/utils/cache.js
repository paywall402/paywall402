import { createClient } from 'redis';
import { logger } from './errorHandler.js';

/**
 * Advanced Caching System with Redis
 */

class CacheManager {
  constructor(options = {}) {
    this.ttl = options.ttl || 3600; // Default 1 hour
    this.prefix = options.prefix || 'paywall402:';
    this.client = null;
    this.inMemoryCache = new Map();
    this.useRedis = process.env.REDIS_URL && process.env.USE_REDIS === 'true';
  }

  async connect() {
    if (this.useRedis) {
      try {
        this.client = createClient({
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                logger.error('Redis connection failed after 10 retries');
                return new Error('Redis connection failed');
              }
              return Math.min(retries * 100, 3000);
            }
          }
        });

        this.client.on('error', (err) => {
          logger.error('Redis Client Error:', err);
          this.fallbackToMemory();
        });

        this.client.on('connect', () => {
          logger.info('Redis connected successfully');
        });

        await this.client.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        this.fallbackToMemory();
      }
    } else {
      logger.info('Using in-memory cache');
    }
  }

  fallbackToMemory() {
    this.useRedis = false;
    this.client = null;
    logger.warn('Falling back to in-memory cache');
  }

  /**
   * Get value from cache
   */
  async get(key) {
    const fullKey = this.prefix + key;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        const value = await this.client.get(fullKey);
        if (value) {
          return JSON.parse(value);
        }
      } else {
        // Use in-memory cache
        const cached = this.inMemoryCache.get(fullKey);
        if (cached && cached.expires > Date.now()) {
          return cached.value;
        } else if (cached) {
          this.inMemoryCache.delete(fullKey);
        }
      }
    } catch (error) {
      logger.error('Cache get error:', error);
    }

    return null;
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = null) {
    const fullKey = this.prefix + key;
    const finalTTL = ttl || this.ttl;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        await this.client.setEx(
          fullKey,
          finalTTL,
          JSON.stringify(value)
        );
      } else {
        // Use in-memory cache
        this.inMemoryCache.set(fullKey, {
          value,
          expires: Date.now() + (finalTTL * 1000)
        });

        // Clean up expired entries periodically
        if (Math.random() < 0.01) {
          this.cleanupMemoryCache();
        }
      }

      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key) {
    const fullKey = this.prefix + key;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        await this.client.del(fullKey);
      } else {
        this.inMemoryCache.delete(fullKey);
      }
      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries with prefix
   */
  async clear(pattern = '*') {
    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        const keys = await this.client.keys(this.prefix + pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      } else {
        // Clear in-memory cache
        const fullPattern = this.prefix + pattern.replace('*', '');
        for (const key of this.inMemoryCache.keys()) {
          if (key.startsWith(fullPattern)) {
            this.inMemoryCache.delete(key);
          }
        }
      }
      return true;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    const fullKey = this.prefix + key;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        return await this.client.exists(fullKey) === 1;
      } else {
        const cached = this.inMemoryCache.get(fullKey);
        return cached && cached.expires > Date.now();
      }
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key) {
    const fullKey = this.prefix + key;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        return await this.client.ttl(fullKey);
      } else {
        const cached = this.inMemoryCache.get(fullKey);
        if (cached && cached.expires > Date.now()) {
          return Math.floor((cached.expires - Date.now()) / 1000);
        }
      }
    } catch (error) {
      logger.error('Cache TTL error:', error);
    }

    return -1;
  }

  /**
   * Increment a counter
   */
  async incr(key, amount = 1) {
    const fullKey = this.prefix + key;

    try {
      if (this.useRedis && this.client && this.client.isOpen) {
        return await this.client.incrBy(fullKey, amount);
      } else {
        const current = await this.get(key) || 0;
        const newValue = current + amount;
        await this.set(key, newValue);
        return newValue;
      }
    } catch (error) {
      logger.error('Cache increment error:', error);
      return null;
    }
  }

  /**
   * Cache with automatic refresh
   */
  async getOrSet(key, fetchFunction, ttl = null) {
    // Try to get from cache
    let value = await this.get(key);

    if (value === null) {
      // Fetch fresh data
      try {
        value = await fetchFunction();
        if (value !== null && value !== undefined) {
          await this.set(key, value, ttl);
        }
      } catch (error) {
        logger.error('Error fetching data for cache:', error);
        throw error;
      }
    }

    return value;
  }

  /**
   * Batch get multiple keys
   */
  async mget(keys) {
    const results = {};

    if (this.useRedis && this.client && this.client.isOpen) {
      const fullKeys = keys.map(k => this.prefix + k);
      const values = await this.client.mGet(fullKeys);

      keys.forEach((key, index) => {
        results[key] = values[index] ? JSON.parse(values[index]) : null;
      });
    } else {
      for (const key of keys) {
        results[key] = await this.get(key);
      }
    }

    return results;
  }

  /**
   * Batch set multiple keys
   */
  async mset(keyValuePairs, ttl = null) {
    const promises = [];

    for (const [key, value] of Object.entries(keyValuePairs)) {
      promises.push(this.set(key, value, ttl));
    }

    return Promise.all(promises);
  }

  /**
   * Clean up expired entries from memory cache
   */
  cleanupMemoryCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.inMemoryCache.entries()) {
      if (value.expires <= now) {
        this.inMemoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const stats = {
      type: this.useRedis ? 'redis' : 'memory',
      connected: false,
      size: 0,
      memoryUsage: null
    };

    if (this.useRedis && this.client && this.client.isOpen) {
      try {
        stats.connected = true;
        const info = await this.client.info('memory');
        const memMatch = info.match(/used_memory_human:(\S+)/);
        if (memMatch) {
          stats.memoryUsage = memMatch[1];
        }
      } catch (error) {
        logger.error('Error getting Redis stats:', error);
      }
    } else {
      stats.connected = true;
      stats.size = this.inMemoryCache.size;
      stats.memoryUsage = process.memoryUsage().heapUsed;
    }

    return stats;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      logger.info('Redis disconnected');
    }
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  content: (id) => `content:${id}`,
  contentInfo: (id) => `content:info:${id}`,
  contentStats: (id) => `content:stats:${id}`,
  paymentToken: (token) => `payment:token:${token}`,
  paymentHistory: (contentId) => `payment:history:${contentId}`,
  creatorContent: (wallet) => `creator:${wallet}:content`,
  rateLimit: (ip) => `ratelimit:${ip}`,
  session: (sessionId) => `session:${sessionId}`,
  verifiedTx: (signature) => `tx:verified:${signature}`,
};

/**
 * Cache decorators
 */
export function cacheable(keyGenerator, ttl = 3600) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const cacheKey = keyGenerator(...args);

      // Try to get from cache
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return cached;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      if (result !== null && result !== undefined) {
        await cache.set(cacheKey, result, ttl);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Invalidate cache decorator
 */
export function invalidateCache(keyGenerator) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args) {
      const result = await originalMethod.apply(this, args);

      // Invalidate cache
      const cacheKey = keyGenerator(...args);
      await cache.del(cacheKey);
      logger.debug(`Cache invalidated for ${cacheKey}`);

      return result;
    };

    return descriptor;
  };
}

// Create singleton instance
const cache = new CacheManager({
  ttl: parseInt(process.env.CACHE_TTL) || 3600,
  prefix: process.env.CACHE_PREFIX || 'paywall402:'
});

export { cache, CacheManager };

export default cache;