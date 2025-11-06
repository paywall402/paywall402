import crypto from 'crypto';

/**
 * JWT-like token utility for access control
 * Using native crypto module to avoid external dependencies
 */

const SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const ALGORITHM = 'sha256';

/**
 * Generate a secure access token
 * @param {Object} payload - Token payload
 * @param {string} payload.contentId - Content ID
 * @param {string} payload.signature - Transaction signature
 * @param {number} expiresIn - Expiration time in seconds (default: 7 days)
 * @returns {string} - Signed JWT-like token
 */
export function generateAccessToken(payload, expiresIn = 7 * 24 * 60 * 60) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));

  // Create signature
  const signature = createSignature(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an access token
 * @param {string} token - JWT-like token
 * @returns {Object|null} - Decoded payload or null if invalid
 */
export function verifyAccessToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`);
    if (signature !== expectedSignature) {
      console.error('❌ Invalid token signature');
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('❌ Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    return null;
  }
}

/**
 * Create HMAC signature
 * @param {string} data - Data to sign
 * @returns {string} - Base64 URL-encoded signature
 */
function createSignature(data) {
  const hmac = crypto.createHmac(ALGORITHM, SECRET);
  hmac.update(data);
  return base64UrlEncode(hmac.digest('base64'));
}

/**
 * Base64 URL encode
 * @param {string} str - String to encode
 * @returns {string} - Base64 URL-encoded string
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode
 * @param {string} str - Base64 URL-encoded string
 * @returns {string} - Decoded string
 */
function base64UrlDecode(str) {
  // Add padding if needed
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Generate a secure random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
export function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} - Hex-encoded hash
 */
export function hashString(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export default {
  generateAccessToken,
  verifyAccessToken,
  generateRandomString,
  hashString
};
