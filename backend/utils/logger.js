/**
 * Simple logging utility
 * Provides consistent logging across the application
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'
};

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Format log message
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const color = COLORS[level] || '';
  const reset = COLORS.RESET;

  let logMessage = `${color}[${timestamp}] ${level}:${reset} ${message}`;

  if (Object.keys(meta).length > 0) {
    logMessage += `\n${JSON.stringify(meta, null, 2)}`;
  }

  return logMessage;
}

/**
 * Log error
 */
export function error(message, meta = {}) {
  console.error(formatMessage(LOG_LEVELS.ERROR, message, meta));
}

/**
 * Log warning
 */
export function warn(message, meta = {}) {
  console.warn(formatMessage(LOG_LEVELS.WARN, message, meta));
}

/**
 * Log info
 */
export function info(message, meta = {}) {
  console.log(formatMessage(LOG_LEVELS.INFO, message, meta));
}

/**
 * Log debug (only in development)
 */
export function debug(message, meta = {}) {
  if (isDevelopment) {
    console.log(formatMessage(LOG_LEVELS.DEBUG, message, meta));
  }
}

/**
 * Log HTTP request
 */
export function httpRequest(req) {
  const message = `${req.method} ${req.path}`;
  const meta = {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    query: req.query
  };

  if (isDevelopment) {
    info(message, meta);
  } else {
    info(message);
  }
}

/**
 * Log database query
 */
export function dbQuery(query, duration, rows) {
  if (isDevelopment) {
    debug('Database query executed', {
      query: query.substring(0, 100),
      duration: `${duration}ms`,
      rows
    });
  }
}

/**
 * Log error with stack trace
 */
export function errorWithStack(message, err) {
  error(message, {
    error: err.message,
    stack: isDevelopment ? err.stack : undefined
  });
}

export default {
  error,
  warn,
  info,
  debug,
  httpRequest,
  dbQuery,
  errorWithStack
};
