import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';
import { generatePaymentLink } from '../middleware/x402.js';
import { validateUploadRequest, validateContentId } from '../middleware/validation.js';

const router = express.Router();

// Allowed file types
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed'
];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, images, videos, text, ZIP'));
    }
  }
});

/**
 * POST /api/upload
 * Upload content and create paywall
 */
router.post('/', upload.single('file'), validateUploadRequest, async (req, res) => {
  try {
    const { price, expiresIn, creatorWallet, contentType } = req.body;

    // Validation
    if (!price || parseFloat(price) < 0.01 || parseFloat(price) > 100) {
      return res.status(400).json({
        error: 'Invalid price. Must be between $0.01 and $100'
      });
    }

    if (!creatorWallet) {
      return res.status(400).json({
        error: 'Creator wallet address is required'
      });
    }

    let contentPath;
    let originalFilename = null;
    let fileMimetype = null;
    let type = contentType || 'file';

    if (req.file) {
      // File upload
      contentPath = req.file.filename;
      originalFilename = req.file.originalname;
      fileMimetype = req.file.mimetype;
      type = 'file';
    } else if (req.body.textContent) {
      // Text content
      const textId = uuidv4();
      contentPath = `text_${textId}.txt`;
      type = 'text';

      // Save text content to file
      const fs = await import('fs/promises');
      await fs.writeFile(`uploads/${contentPath}`, req.body.textContent);
    } else if (req.body.linkUrl) {
      // Link content
      contentPath = req.body.linkUrl;
      type = 'link';
    } else {
      return res.status(400).json({
        error: 'No content provided. Upload a file, provide text, or link'
      });
    }

    // Calculate expiration
    let expiresAt = null;
    if (expiresIn && expiresIn !== 'never') {
      const now = new Date();
      switch (expiresIn) {
        case '1h':
          expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
          break;
        case '1d':
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case '7d':
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          expiresAt = null;
      }
    }

    // Insert into database
    const result = await query(
      `INSERT INTO content (content_type, content_path, original_filename, file_mimetype,
                            price_usdc, creator_wallet, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, content_type, price_usdc, creator_wallet, expires_at, created_at`,
      [type, contentPath, originalFilename, fileMimetype, price, creatorWallet, expiresAt]
    );

    const content = result.rows[0];

    // Generate payment link
    const paymentLink = generatePaymentLink(
      content.id,
      parseFloat(price),
      creatorWallet
    );

    // Generate shareable URL
    const shareUrl = `${process.env.FRONTEND_URL}/${content.id}`;

    res.status(201).json({
      success: true,
      message: 'Content uploaded successfully',
      content: {
        id: content.id,
        type: content.content_type,
        price: parseFloat(content.price_usdc),
        expiresAt: content.expires_at,
        createdAt: content.created_at,
        shareUrl: shareUrl,
        paymentLink: paymentLink
      }
    });

    console.log('✅ Content uploaded:', {
      id: content.id,
      type: type,
      price: price,
      creator: creatorWallet
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    // Clean up file if upload failed
    if (req.file) {
      const fs = await import('fs/promises');
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * GET /api/upload/stats/:id
 * Get upload statistics
 */
router.get('/stats/:id', validateContentId, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, content_type, price_usdc, views, payments, created_at, expires_at
       FROM content
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Get payment logs
    const paymentsResult = await query(
      `SELECT COUNT(*) as total_payments, SUM(amount_usdc) as total_earned
       FROM payment_logs
       WHERE content_id = $1 AND payment_status = 'completed'`,
      [id]
    );

    const stats = paymentsResult.rows[0];

    res.json({
      id: content.id,
      type: content.content_type,
      price: parseFloat(content.price_usdc),
      views: content.views,
      payments: content.payments,
      totalEarned: parseFloat(stats.total_earned || 0),
      createdAt: content.created_at,
      expiresAt: content.expires_at,
      isExpired: content.expires_at && new Date(content.expires_at) < new Date()
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
