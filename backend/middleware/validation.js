import { PublicKey } from '@solana/web3.js';
import validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Input Validation Middleware
 * Validates and sanitizes user inputs to prevent injection attacks
 */

/**
 * Rate limiting for validation attempts
 */
const validationAttempts = new Map();

const checkValidationRateLimit = (identifier) => {
  const now = Date.now();
  const attempts = validationAttempts.get(identifier) || [];
  const recentAttempts = attempts.filter(t => now - t < 60000); // Last minute

  if (recentAttempts.length > 10) {
    return false;
  }

  recentAttempts.push(now);
  validationAttempts.set(identifier, recentAttempts);
  return true;
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validate Solana wallet address
 */
export const isValidSolanaAddress = (address) => {
  try {
    new PublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validate price range
 */
export const isValidPrice = (price) => {
  const priceNum = parseFloat(price);
  return !isNaN(priceNum) && priceNum >= 0.01 && priceNum <= 100;
};

/**
 * Validate expiration value
 */
export const isValidExpiration = (expiresIn) => {
  const validValues = ['never', '1h', '1d', '7d'];
  return validValues.includes(expiresIn);
};

/**
 * Validate content type
 */
export const isValidContentType = (type) => {
  const validTypes = ['file', 'text', 'link'];
  return validTypes.includes(type);
};

/**
 * Sanitize text input with enhanced XSS protection
 */
export const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';

  // Use DOMPurify for comprehensive XSS protection
  let sanitized = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });

  // Additional sanitization
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 10000); // Limit length

  // Validate against common injection patterns
  const injectionPatterns = [
    /(\b(script|iframe|object|embed|applet)\b)/gi,
    /(javascript:|data:text\/html)/gi,
    /(<\s*\/?\s*(script|iframe|object|embed|applet))/gi
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      return ''; // Return empty string if injection detected
    }
  }

  return sanitized;
};

/**
 * Sanitize URL
 */
export const sanitizeUrl = (url) => {
  if (typeof url !== 'string') return '';
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    return url.trim().substring(0, 2000);
  } catch (error) {
    return '';
  }
};

/**
 * Middleware: Validate content ID parameter
 */
export const validateContentId = (req, res, next) => {
  const { id } = req.params;

  if (!id || !isValidUUID(id)) {
    return res.status(400).json({
      error: 'Invalid content ID',
      message: 'Content ID must be a valid UUID'
    });
  }

  next();
};

/**
 * Middleware: Validate upload request
 */
export const validateUploadRequest = (req, res, next) => {
  const { price, creatorWallet, contentType, expiresIn } = req.body;

  // Validate price
  if (!price || !isValidPrice(price)) {
    return res.status(400).json({
      error: 'Invalid price',
      message: 'Price must be between $0.01 and $100'
    });
  }

  // Validate creator wallet
  if (!creatorWallet || !isValidSolanaAddress(creatorWallet)) {
    return res.status(400).json({
      error: 'Invalid wallet address',
      message: 'Creator wallet must be a valid Solana address'
    });
  }

  // Validate content type
  if (contentType && !isValidContentType(contentType)) {
    return res.status(400).json({
      error: 'Invalid content type',
      message: 'Content type must be file, text, or link'
    });
  }

  // Validate expiration
  if (expiresIn && !isValidExpiration(expiresIn)) {
    return res.status(400).json({
      error: 'Invalid expiration',
      message: 'Expiration must be never, 1h, 1d, or 7d'
    });
  }

  // Sanitize text content if provided
  if (req.body.textContent) {
    req.body.textContent = sanitizeText(req.body.textContent);
    if (!req.body.textContent) {
      return res.status(400).json({
        error: 'Invalid text content',
        message: 'Text content cannot be empty'
      });
    }
  }

  // Sanitize link URL if provided
  if (req.body.linkUrl) {
    req.body.linkUrl = sanitizeUrl(req.body.linkUrl);
    if (!req.body.linkUrl) {
      return res.status(400).json({
        error: 'Invalid link URL',
        message: 'Link URL must be a valid HTTP or HTTPS URL'
      });
    }
  }

  next();
};

/**
 * Middleware: Validate payment request
 */
export const validatePaymentRequest = (req, res, next) => {
  const { contentId, transactionSignature } = req.body;

  // Validate content ID
  if (!contentId || !isValidUUID(contentId)) {
    return res.status(400).json({
      error: 'Invalid content ID',
      message: 'Content ID must be a valid UUID'
    });
  }

  // Validate transaction signature (for production)
  if (!transactionSignature || typeof transactionSignature !== 'string') {
    return res.status(400).json({
      error: 'Invalid transaction signature',
      message: 'Transaction signature is required'
    });
  }

  // Validate signature format (base58 string, 87-88 characters for Solana)
  const signatureRegex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$|^sim_/;
  if (!signatureRegex.test(transactionSignature)) {
    return res.status(400).json({
      error: 'Invalid transaction signature format',
      message: 'Transaction signature must be a valid Solana signature'
    });
  }

  // Validate payer wallet if provided
  if (req.body.payerWallet) {
    if (!isValidSolanaAddress(req.body.payerWallet)) {
      return res.status(400).json({
        error: 'Invalid payer wallet',
        message: 'Payer wallet must be a valid Solana address'
      });
    }
  }

  next();
};

/**
 * Middleware: Validate wallet address parameter
 */
export const validateWalletAddress = (req, res, next) => {
  const { creatorWallet } = req.params;

  if (!creatorWallet || !isValidSolanaAddress(creatorWallet)) {
    return res.status(400).json({
      error: 'Invalid wallet address',
      message: 'Wallet address must be a valid Solana address'
    });
  }

  next();
};

/**
 * General request sanitization middleware
 */
export const sanitizeRequest = (req, res, next) => {
  // Sanitize query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === 'string') {
      req.query[key] = req.query[key].trim();
    }
  }

  // Sanitize body parameters (for non-file fields)
  for (const key in req.body) {
    if (typeof req.body[key] === 'string' && key !== 'textContent') {
      req.body[key] = req.body[key].trim();
    }
  }

  next();
};

export default {
  validateContentId,
  validateUploadRequest,
  validatePaymentRequest,
  validateWalletAddress,
  sanitizeRequest,
  isValidUUID,
  isValidSolanaAddress,
  isValidPrice,
  sanitizeText,
  sanitizeUrl
};
