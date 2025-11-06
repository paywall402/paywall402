import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Enhanced Error Handling System
 */

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'paywall402-backend' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Custom error classes
 */
export class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export class PaymentError extends AppError {
  constructor(message = 'Payment processing failed', details = null) {
    super(message, 402);
    this.name = 'PaymentError';
    this.details = details;
  }
}

export class BlockchainError extends AppError {
  constructor(message = 'Blockchain operation failed', details = null) {
    super(message, 503);
    this.name = 'BlockchainError';
    this.details = details;
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', query = null) {
    super(message, 500);
    this.name = 'DatabaseError';
    this.query = query;
    this.isOperational = false;
  }
}

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      name: err.name,
      isOperational: err.isOperational,
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    },
    timestamp: new Date().toISOString(),
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Invalid ID format';
    error = new ValidationError(message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `Duplicate value for field: ${field}`;
    error = new ConflictError(message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = errors.join(', ');
    error = new ValidationError(message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AuthenticationError('Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    error = new AuthenticationError('Token expired');
  }

  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new ValidationError('File size too large');
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error = new ValidationError('Unexpected file upload');
    } else {
      error = new ValidationError('File upload error');
    }
  }

  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    error = new ConflictError('Duplicate entry');
  }

  if (err.code === '23503') { // Foreign key violation
    error = new ValidationError('Referenced resource does not exist');
  }

  if (err.code === '22P02') { // Invalid text representation
    error = new ValidationError('Invalid input format');
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: error.details,
      }),
    },
    timestamp: new Date().toISOString(),
    requestId: req.id || 'unknown',
  });

  // For non-operational errors, consider shutting down
  if (!error.isOperational) {
    logger.error('Non-operational error occurred. Consider restarting application.');
    // In production, you might want to gracefully shut down
    // process.exit(1);
  }
};

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejections = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', {
      reason,
      promise,
      timestamp: new Date().toISOString(),
    });

    // In production, gracefully shut down
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtExceptions = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', {
      error: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
    });

    // Always exit on uncaught exception
    process.exit(1);
  });
};

/**
 * Request logger middleware
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Generate request ID
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log request
  logger.info({
    type: 'request',
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info({
      type: 'response',
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });

  next();
};

/**
 * Sanitize error messages for production
 */
export const sanitizeErrorMessage = (error) => {
  if (process.env.NODE_ENV === 'production') {
    // Generic messages for production
    const productionMessages = {
      ValidationError: 'Invalid input provided',
      AuthenticationError: 'Authentication required',
      AuthorizationError: 'Insufficient permissions',
      NotFoundError: 'Resource not found',
      PaymentError: 'Payment processing failed',
      DatabaseError: 'Service temporarily unavailable',
      BlockchainError: 'Blockchain service unavailable',
    };

    return productionMessages[error.name] || 'An error occurred';
  }

  return error.message;
};

/**
 * Error response formatter
 */
export const formatErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      message: sanitizeErrorMessage(error),
      code: error.code || error.name,
      statusCode: error.statusCode || 500,
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    requestId: req.id,
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.details = error.details;
    response.error.originalMessage = error.message;
  }

  return response;
};

/**
 * Circuit breaker for external services
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.successCount = 0;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null,
    };
  }
}

export { logger };

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  PaymentError,
  BlockchainError,
  DatabaseError,
  asyncHandler,
  errorHandler,
  handleUnhandledRejections,
  handleUncaughtExceptions,
  requestLogger,
  sanitizeErrorMessage,
  formatErrorResponse,
  CircuitBreaker,
  logger,
};