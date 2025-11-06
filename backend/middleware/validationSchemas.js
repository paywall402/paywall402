import Joi from 'joi';
import { PublicKey } from '@solana/web3.js';

/**
 * Joi Validation Schemas for robust input validation
 */

// Custom Joi validators
const solanaAddress = Joi.string().custom((value, helpers) => {
  try {
    new PublicKey(value);
    return value;
  } catch (error) {
    return helpers.error('any.invalid');
  }
}, 'Solana address validation');

const base58Signature = Joi.string()
  .pattern(/^[1-9A-HJ-NP-Za-km-z]{87,88}$|^sim_/)
  .messages({
    'string.pattern.base': 'Transaction signature must be a valid Solana signature'
  });

const uuid = Joi.string()
  .guid({ version: ['uuidv4'] })
  .messages({
    'string.guid': 'Must be a valid UUID v4'
  });

const price = Joi.number()
  .min(0.01)
  .max(100)
  .precision(2)
  .messages({
    'number.min': 'Price must be at least $0.01',
    'number.max': 'Price cannot exceed $100',
    'number.precision': 'Price can have maximum 2 decimal places'
  });

const contentType = Joi.string()
  .valid('file', 'text', 'link')
  .messages({
    'any.only': 'Content type must be file, text, or link'
  });

const expiration = Joi.string()
  .valid('never', '1h', '1d', '7d')
  .default('never')
  .messages({
    'any.only': 'Expiration must be never, 1h, 1d, or 7d'
  });

const safeText = Joi.string()
  .max(10000)
  .custom((value, helpers) => {
    // Check for XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(value)) {
        return helpers.error('string.dangerous');
      }
    }

    return value;
  }, 'XSS validation')
  .messages({
    'string.dangerous': 'Text contains potentially dangerous content',
    'string.max': 'Text cannot exceed 10000 characters'
  });

const safeUrl = Joi.string()
  .uri({
    scheme: ['http', 'https'],
    allowRelative: false
  })
  .max(2000)
  .messages({
    'string.uri': 'Must be a valid HTTP or HTTPS URL',
    'string.max': 'URL cannot exceed 2000 characters'
  });

const fileUpload = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().max(255).required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string()
    .valid(
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
    )
    .required()
    .messages({
      'any.only': 'File type not allowed'
    }),
  size: Joi.number()
    .max(10485760) // 10MB
    .required()
    .messages({
      'number.max': 'File size cannot exceed 10MB'
    }),
  buffer: Joi.binary()
});

/**
 * Validation schemas for different endpoints
 */
export const schemas = {
  // Upload endpoint schemas
  uploadFile: Joi.object({
    body: Joi.object({
      price: price.required(),
      creatorWallet: solanaAddress.required(),
      expiresIn: expiration,
      description: safeText.max(500).optional(),
      title: safeText.max(100).optional()
    }),
    file: fileUpload.optional()
  }),

  uploadText: Joi.object({
    body: Joi.object({
      price: price.required(),
      creatorWallet: solanaAddress.required(),
      contentType: Joi.string().valid('text').required(),
      textContent: safeText.required(),
      expiresIn: expiration,
      description: safeText.max(500).optional(),
      title: safeText.max(100).optional()
    })
  }),

  uploadLink: Joi.object({
    body: Joi.object({
      price: price.required(),
      creatorWallet: solanaAddress.required(),
      contentType: Joi.string().valid('link').required(),
      linkUrl: safeUrl.required(),
      expiresIn: expiration,
      description: safeText.max(500).optional(),
      title: safeText.max(100).optional()
    })
  }),

  // Payment endpoint schemas
  initiatePayment: Joi.object({
    body: Joi.object({
      contentId: uuid.required(),
      payerWallet: solanaAddress.optional()
    })
  }),

  verifyPayment: Joi.object({
    body: Joi.object({
      contentId: uuid.required(),
      transactionSignature: base58Signature.required(),
      payerWallet: solanaAddress.optional(),
      amount: price.optional()
    })
  }),

  // Content endpoint schemas
  getContent: Joi.object({
    params: Joi.object({
      id: uuid.required()
    }),
    query: Joi.object({
      payment: Joi.string().optional(),
      preview: Joi.boolean().optional()
    })
  }),

  deleteContent: Joi.object({
    params: Joi.object({
      id: uuid.required()
    }),
    body: Joi.object({
      creatorWallet: solanaAddress.required(),
      signature: Joi.string().optional() // For authenticated deletion
    })
  }),

  // Statistics endpoint schemas
  getStats: Joi.object({
    params: Joi.object({
      creatorWallet: solanaAddress.required()
    }),
    query: Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
      limit: Joi.number().integer().min(1).max(100).default(10),
      offset: Joi.number().integer().min(0).default(0),
      sortBy: Joi.string().valid('created_at', 'views', 'payments', 'revenue').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  }),

  // Search endpoint schemas
  searchContent: Joi.object({
    query: Joi.object({
      q: safeText.max(100).optional(),
      type: contentType.optional(),
      minPrice: price.optional(),
      maxPrice: price.optional(),
      creator: solanaAddress.optional(),
      sort: Joi.string().valid('price', 'created_at', 'views', 'payments').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc'),
      limit: Joi.number().integer().min(1).max(50).default(20),
      offset: Joi.number().integer().min(0).default(0)
    })
  }),

  // Batch operations
  batchUpload: Joi.object({
    body: Joi.object({
      items: Joi.array()
        .items(
          Joi.object({
            type: contentType.required(),
            price: price.required(),
            creatorWallet: solanaAddress.required(),
            content: Joi.alternatives()
              .try(safeText, safeUrl)
              .required(),
            expiresIn: expiration,
            metadata: Joi.object().optional()
          })
        )
        .min(1)
        .max(10)
        .required()
    })
  }),

  // Webhook registration
  registerWebhook: Joi.object({
    body: Joi.object({
      url: safeUrl.required(),
      events: Joi.array()
        .items(
          Joi.string().valid(
            'payment.completed',
            'payment.failed',
            'content.expired',
            'content.deleted'
          )
        )
        .min(1)
        .required(),
      secret: Joi.string().min(32).max(64).optional(),
      creatorWallet: solanaAddress.required()
    })
  })
};

/**
 * Validation middleware factory
 */
export const validate = (schema) => {
  return (req, res, next) => {
    // Build validation object
    const validationObject = {};

    if (schema.body) validationObject.body = req.body;
    if (schema.params) validationObject.params = req.params;
    if (schema.query) validationObject.query = req.query;
    if (schema.file && req.file) validationObject.file = req.file;
    if (schema.files && req.files) validationObject.files = req.files;

    // Perform validation
    const { error, value } = Joi.object(schema).validate(validationObject, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type
      }));

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace request values with validated and sanitized values
    if (value.body) req.body = value.body;
    if (value.params) req.params = value.params;
    if (value.query) req.query = value.query;

    next();
  };
};

/**
 * Custom error messages
 */
export const errorMessages = {
  'string.empty': 'Field cannot be empty',
  'any.required': 'Field is required',
  'string.email': 'Must be a valid email address',
  'number.base': 'Must be a number',
  'string.pattern.base': 'Invalid format',
  'any.invalid': 'Invalid value provided'
};

/**
 * Sanitization helpers
 */
export const sanitizers = {
  /**
   * Sanitize filename
   */
  filename: (filename) => {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/\.{2,}/g, '.')
      .substring(0, 255);
  },

  /**
   * Sanitize HTML content
   */
  html: (html) => {
    // Use a whitelist approach for HTML tags
    const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a'];
    const allowedAttributes = {
      'a': ['href', 'target']
    };

    // This would typically use a library like DOMPurify
    // For now, we'll strip all tags
    return html.replace(/<[^>]*>/g, '');
  },

  /**
   * Sanitize SQL identifiers
   */
  sqlIdentifier: (identifier) => {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error('Invalid SQL identifier');
    }
    return identifier;
  },

  /**
   * Sanitize JSON
   */
  json: (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      // Remove any potentially dangerous keys
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      const clean = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;

        for (const key of dangerousKeys) {
          delete obj[key];
        }

        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            obj[key] = clean(obj[key]);
          }
        }

        return obj;
      };

      return JSON.stringify(clean(parsed));
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }
};

/**
 * Rate limit validation
 */
export const rateLimitValidator = (maxAttempts = 5, windowMs = 60000) => {
  const attempts = new Map();

  return (identifier) => {
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || [];
    const recentAttempts = userAttempts.filter(t => now - t < windowMs);

    if (recentAttempts.length >= maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    attempts.set(identifier, recentAttempts);

    // Cleanup old entries
    if (Math.random() < 0.01) {
      for (const [key, value] of attempts.entries()) {
        const valid = value.filter(t => now - t < windowMs);
        if (valid.length === 0) {
          attempts.delete(key);
        } else {
          attempts.set(key, valid);
        }
      }
    }

    return true;
  };
};

export default {
  schemas,
  validate,
  errorMessages,
  sanitizers,
  rateLimitValidator
};