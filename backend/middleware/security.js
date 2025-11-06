import helmet from 'helmet';
import crypto from 'crypto';

/**
 * Enhanced Security Middleware
 * Provides additional security layers for the application
 */

/**
 * Generate a secure nonce for CSP
 */
export const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Content Security Policy middleware with dynamic nonce
 */
export const cspMiddleware = (req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;

  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' https://trusted-cdn.com;
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self' https://api.payai.network https://mainnet.helius-rpc.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  `.replace(/\n/g, ' ').trim());

  next();
};

/**
 * CSRF Token generation and validation
 */
class CSRFProtection {
  constructor(secret) {
    this.secret = secret || crypto.randomBytes(32).toString('hex');
    this.tokens = new Map();
  }

  generateToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(token)
      .digest('hex');

    // Store with expiration (1 hour)
    this.tokens.set(sessionId, {
      token: hash,
      expires: Date.now() + 3600000
    });

    // Clean up expired tokens
    this.cleanupExpired();

    return token;
  }

  validateToken(sessionId, token) {
    const stored = this.tokens.get(sessionId);

    if (!stored || stored.expires < Date.now()) {
      return false;
    }

    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(token)
      .digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(stored.token),
      Buffer.from(hash)
    );
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [key, value] of this.tokens.entries()) {
      if (value.expires < now) {
        this.tokens.delete(key);
      }
    }
  }
}

/**
 * Initialize CSRF protection
 */
const csrfProtection = new CSRFProtection(process.env.CSRF_SECRET);

export const csrfMiddleware = (req, res, next) => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') {
    return next();
  }

  const sessionId = req.session?.id || req.ip;
  const token = req.headers['x-csrf-token'] || req.body?.csrfToken;

  if (!token || !csrfProtection.validateToken(sessionId, token)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Security validation failed'
    });
  }

  next();
};

/**
 * Generate CSRF token endpoint
 */
export const generateCSRFToken = (req, res) => {
  const sessionId = req.session?.id || req.ip;
  const token = csrfProtection.generateToken(sessionId);

  res.json({ csrfToken: token });
};

/**
 * SQL Injection prevention helper
 */
export const escapeSQLIdentifier = (identifier) => {
  // Validate identifier contains only safe characters
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return identifier;
};

/**
 * Path traversal prevention
 */
export const sanitizePath = (filepath) => {
  // Remove any path traversal attempts
  const sanitized = filepath
    .replace(/\.\./g, '')
    .replace(/[\/\\]+/g, '/')
    .replace(/^[\/\\]/, '');

  // Validate file extension
  const allowedExtensions = [
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.zip',
    '.txt', '.doc', '.docx', '.mp4', '.mp3'
  ];

  const ext = sanitized.substring(sanitized.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error('File type not allowed');
  }

  return sanitized;
};

/**
 * Rate limiting with IP-based tracking
 */
export class EnhancedRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.requests = new Map();
  }

  isAllowed(identifier) {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}

/**
 * API Key validation middleware
 */
export const validateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide a valid API key'
    });
  }

  // In production, validate against database or cache
  const validKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!validKeys.includes(apiKey)) {
    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }

  next();
};

/**
 * Session security middleware
 */
export const sessionSecurity = (req, res, next) => {
  // Set secure session headers
  if (req.session) {
    req.session.cookie.secure = process.env.NODE_ENV === 'production';
    req.session.cookie.httpOnly = true;
    req.session.cookie.sameSite = 'strict';
  }

  next();
};

/**
 * Prevent timing attacks on string comparison
 */
export const secureCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

/**
 * Input sanitization for MongoDB queries (if using MongoDB)
 */
export const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }

  const sanitized = {};
  for (const key in query) {
    if (key.startsWith('$')) {
      continue; // Skip MongoDB operators
    }

    const value = query[key];
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMongoQuery(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * XSS prevention for HTML output
 */
export const escapeHTML = (str) => {
  if (typeof str !== 'string') return str;

  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return str.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
};

/**
 * Validate file upload security
 */
export const validateFileUpload = (file) => {
  // Check file size
  const maxSize = parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760; // 10MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds maximum allowed size');
  }

  // Validate MIME type
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'audio/mpeg'
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed');
  }

  // Check for double extensions
  const filename = file.originalname.toLowerCase();
  const doubleExtensions = ['.php.', '.exe.', '.js.', '.asp.'];
  for (const ext of doubleExtensions) {
    if (filename.includes(ext)) {
      throw new Error('Suspicious filename detected');
    }
  }

  // Validate magic bytes (file signatures)
  const buffer = file.buffer;
  if (buffer && buffer.length > 4) {
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
      'application/zip': [0x50, 0x4B]
    };

    const sig = signatures[file.mimetype];
    if (sig) {
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) {
          throw new Error('File content does not match declared type');
        }
      }
    }
  }

  return true;
};

export default {
  cspMiddleware,
  csrfMiddleware,
  generateCSRFToken,
  escapeSQLIdentifier,
  sanitizePath,
  EnhancedRateLimiter,
  validateAPIKey,
  sessionSecurity,
  secureCompare,
  sanitizeMongoQuery,
  escapeHTML,
  validateFileUpload
};