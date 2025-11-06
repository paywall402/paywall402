import express from 'express';
import path from 'path';
import { query } from '../db/index.js';
import { x402PaymentGate } from '../middleware/x402.js';
import { validateContentId } from '../middleware/validation.js';

const router = express.Router();

/**
 * GET /api/content/:id/info
 * Get content metadata (without paywall)
 */
router.get('/:id/info', validateContentId, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, content_type, original_filename, file_mimetype, price_usdc,
              views, payments, expires_at, created_at, creator_wallet
       FROM content
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Increment view counter
    await query('UPDATE content SET views = views + 1 WHERE id = $1', [id]);

    // Check if expired
    const isExpired = content.expires_at && new Date(content.expires_at) < new Date();

    res.json({
      id: content.id,
      type: content.content_type,
      filename: content.original_filename,
      mimetype: content.file_mimetype,
      price: parseFloat(content.price_usdc),
      views: content.views + 1,
      payments: content.payments,
      expiresAt: content.expires_at,
      isExpired: isExpired,
      createdAt: content.created_at,
      creatorWallet: content.creator_wallet
    });

  } catch (error) {
    console.error('❌ Content info error:', error);
    res.status(500).json({ error: 'Failed to fetch content info' });
  }
});

/**
 * GET /api/content/:id/download
 * Download content (requires payment via x402)
 */
router.get('/:id/download', validateContentId, x402PaymentGate, async (req, res) => {
  try {
    const { id } = req.params;
    const content = req.content; // Set by x402PaymentGate middleware

    // Get full content details
    const result = await query(
      `SELECT content_type, content_path, original_filename, file_mimetype
       FROM content
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const contentData = result.rows[0];

    // Handle different content types
    switch (contentData.content_type) {
      case 'file':
        // Send file for download
        const filePath = path.join(process.cwd(), 'uploads', contentData.content_path);
        res.download(filePath, contentData.original_filename || 'download');
        break;

      case 'text':
        // Send text content
        const fs = await import('fs/promises');
        const textPath = path.join(process.cwd(), 'uploads', contentData.content_path);
        const textContent = await fs.readFile(textPath, 'utf8');
        res.json({
          type: 'text',
          content: textContent
        });
        break;

      case 'link':
        // Return the link
        res.json({
          type: 'link',
          url: contentData.content_path
        });
        break;

      default:
        res.status(400).json({ error: 'Unknown content type' });
    }

    console.log('✅ Content delivered:', { id, type: contentData.content_type });

  } catch (error) {
    console.error('❌ Content download error:', error);
    res.status(500).json({ error: 'Failed to deliver content' });
  }
});

/**
 * GET /api/content/:id/preview
 * Get content preview (limited info, no paywall)
 */
router.get('/:id/preview', validateContentId, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, content_type, original_filename, file_mimetype, price_usdc
       FROM content
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Return limited preview info
    res.json({
      id: content.id,
      type: content.content_type,
      filename: content.original_filename,
      mimetype: content.file_mimetype,
      price: parseFloat(content.price_usdc),
      previewAvailable: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(content.file_mimetype)
    });

  } catch (error) {
    console.error('❌ Preview error:', error);
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
});

/**
 * DELETE /api/content/:id
 * Delete content (creator only - basic implementation)
 */
router.delete('/:id', validateContentId, async (req, res) => {
  try {
    const { id } = req.params;
    const { creatorWallet } = req.body;

    if (!creatorWallet) {
      return res.status(400).json({ error: 'Creator wallet required' });
    }

    // Get content
    const result = await query(
      'SELECT content_type, content_path, creator_wallet FROM content WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Verify creator
    if (content.creator_wallet !== creatorWallet) {
      return res.status(403).json({ error: 'Not authorized to delete this content' });
    }

    // Delete file if it exists
    if (content.content_type === 'file' || content.content_type === 'text') {
      const fs = await import('fs/promises');
      const filePath = path.join(process.cwd(), 'uploads', content.content_path);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }

    // Delete from database (cascade will delete payment logs)
    await query('DELETE FROM content WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });

    console.log('✅ Content deleted:', { id, creator: creatorWallet });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

export default router;
