import express from 'express';
import axios from 'axios';
import { query } from '../db/index.js';
import { verifySolanaTransaction } from '../utils/solana.js';
import { validatePaymentRequest, validateContentId, validateWalletAddress } from '../middleware/validation.js';
import { generateAccessToken } from '../utils/jwt.js';

const router = express.Router();

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://api.payai.network/x402';

/**
 * POST /api/payment/initiate
 * Initiate x402 payment for content
 */
router.post('/initiate', validateContentId, async (req, res) => {
  try {
    const contentId = req.body.contentId || req.params.id;
    const { payerWallet } = req.body;

    // Get content details
    const result = await query(
      `SELECT id, price_usdc, creator_wallet, expires_at
       FROM content
       WHERE id = $1`,
      [contentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Check expiration
    if (content.expires_at && new Date(content.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Content has expired' });
    }

    // Create payment request with facilitator
    const paymentRequest = {
      amount: parseFloat(content.price_usdc),
      currency: 'USDC',
      network: 'solana',
      recipient: content.creator_wallet,
      contentId: contentId,
      payerWallet: payerWallet,
      metadata: {
        contentId: contentId,
        timestamp: new Date().toISOString()
      }
    };

    try {
      // Call x402 facilitator to create payment session
      const facilitatorResponse = await axios.post(
        `${FACILITATOR_URL}/create-payment`,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      res.json({
        success: true,
        payment: {
          sessionId: facilitatorResponse.data.sessionId,
          paymentUrl: facilitatorResponse.data.paymentUrl,
          amount: parseFloat(content.price_usdc),
          currency: 'USDC',
          recipient: content.creator_wallet,
          expiresIn: 900 // 15 minutes
        }
      });

    } catch (facilitatorError) {
      console.error('❌ Facilitator error:', facilitatorError.message);

      // Fallback: return manual payment instructions
      res.json({
        success: true,
        payment: {
          method: 'manual',
          amount: parseFloat(content.price_usdc),
          currency: 'USDC',
          network: 'solana',
          recipient: content.creator_wallet,
          contentId: contentId,
          instructions: 'Send USDC on Solana to the recipient address',
          facilitatorUrl: FACILITATOR_URL
        }
      });
    }

  } catch (error) {
    console.error('❌ Payment initiation error:', error);
    res.status(500).json({
      error: 'Failed to initiate payment',
      message: error.message
    });
  }
});

/**
 * POST /api/payment/verify
 * Verify payment completion
 */
router.post('/verify', validatePaymentRequest, async (req, res) => {
  try {
    const { contentId, transactionSignature, payerWallet } = req.body;

    if (!contentId || !transactionSignature) {
      return res.status(400).json({
        error: 'Content ID and transaction signature are required'
      });
    }

    // Get content details including creator wallet
    const contentResult = await query(
      'SELECT price_usdc, creator_wallet FROM content WHERE id = $1',
      [contentId]
    );

    if (contentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const expectedAmount = parseFloat(contentResult.rows[0].price_usdc);
    const creatorWallet = contentResult.rows[0].creator_wallet;

    // Check if this is a development/simulated transaction
    const isSimulatedTx = transactionSignature.startsWith('sim_');

    if (isSimulatedTx) {
      // Development mode: accept simulated transactions
      console.log('⚠️  Development mode: Accepting simulated transaction');

      // Log successful payment
      await query(
        `INSERT INTO payment_logs (content_id, payer_wallet, amount_usdc, transaction_signature, payment_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [contentId, payerWallet || 'unknown', expectedAmount, transactionSignature, 'completed']
      );

      // Update payment counter
      await query(
        'UPDATE content SET payments = payments + 1 WHERE id = $1',
        [contentId]
      );

      // Generate secure access token (JWT-like)
      const accessToken = generateAccessToken({
        contentId,
        signature: transactionSignature,
        payerWallet: payerWallet || 'unknown',
        type: 'payment'
      }, 7 * 24 * 60 * 60); // 7 days expiration

      res.json({
        verified: true,
        message: 'Payment verified successfully (development mode)',
        accessToken: accessToken,
        downloadUrl: `${process.env.FRONTEND_URL}/${contentId}?payment=${accessToken}`
      });

      console.log('✅ Payment verified (simulated):', {
        contentId,
        signature: transactionSignature,
        amount: expectedAmount
      });

    } else {
      // Production mode: verify real Solana transaction on mainnet
      console.log('🔍 Verifying real Solana transaction:', {
        signature: transactionSignature,
        expectedRecipient: creatorWallet,
        expectedAmount
      });

      const verificationResult = await verifySolanaTransaction(
        transactionSignature,
        creatorWallet,
        expectedAmount
      );

      if (!verificationResult.verified) {
        console.error('❌ Blockchain verification failed:', verificationResult.error);
        return res.status(402).json({
          verified: false,
          error: verificationResult.error,
          details: verificationResult.details
        });
      }

      // Transaction verified on blockchain
      // Log successful payment
      await query(
        `INSERT INTO payment_logs (content_id, payer_wallet, amount_usdc, transaction_signature, payment_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [contentId, payerWallet || 'unknown', expectedAmount, transactionSignature, 'completed']
      );

      // Update payment counter
      await query(
        'UPDATE content SET payments = payments + 1 WHERE id = $1',
        [contentId]
      );

      // Generate secure access token (JWT-like)
      const accessToken = generateAccessToken({
        contentId,
        signature: transactionSignature,
        payerWallet: payerWallet || 'unknown',
        type: 'payment'
      }, 7 * 24 * 60 * 60); // 7 days expiration

      res.json({
        verified: true,
        message: 'Payment verified successfully on Solana mainnet',
        accessToken: accessToken,
        downloadUrl: `${process.env.FRONTEND_URL}/${contentId}?payment=${accessToken}`,
        blockchain: verificationResult.details
      });

      console.log('✅ Payment verified on blockchain:', {
        contentId,
        signature: transactionSignature,
        amount: verificationResult.details.amount,
        blockTime: verificationResult.details.blockTime
      });
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

/**
 * GET /api/payment/status/:contentId
 * Check payment status for content
 */
router.get('/status/:contentId', validateContentId, async (req, res) => {
  try {
    const contentId = req.params.contentId || req.params.id;
    const { signature } = req.query;

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Transaction signature required' });
    }

    // Check if payment exists in logs
    const result = await query(
      `SELECT id, amount_usdc, payment_status, paid_at
       FROM payment_logs
       WHERE content_id = $1 AND transaction_signature = $2
       ORDER BY paid_at DESC
       LIMIT 1`,
      [contentId, signature]
    );

    if (result.rows.length === 0) {
      return res.json({
        paid: false,
        message: 'No payment found'
      });
    }

    const payment = result.rows[0];

    res.json({
      paid: payment.payment_status === 'completed',
      status: payment.payment_status,
      amount: parseFloat(payment.amount_usdc),
      paidAt: payment.paid_at
    });

  } catch (error) {
    console.error('❌ Payment status error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * GET /api/payment/history/:creatorWallet
 * Get payment history for creator (basic implementation)
 */
router.get('/history/:creatorWallet', validateWalletAddress, async (req, res) => {
  try {
    const { creatorWallet } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // Get payments for creator's content
    const result = await query(
      `SELECT p.id, p.content_id, p.amount_usdc, p.transaction_signature,
              p.payment_status, p.paid_at, c.content_type, c.original_filename
       FROM payment_logs p
       JOIN content c ON c.id = p.content_id
       WHERE c.creator_wallet = $1
       ORDER BY p.paid_at DESC
       LIMIT $2 OFFSET $3`,
      [creatorWallet, limit, offset]
    );

    // Get total earnings
    const totalResult = await query(
      `SELECT COUNT(*) as total_payments, SUM(p.amount_usdc) as total_earned
       FROM payment_logs p
       JOIN content c ON c.id = p.content_id
       WHERE c.creator_wallet = $1 AND p.payment_status = 'completed'`,
      [creatorWallet]
    );

    const stats = totalResult.rows[0];

    res.json({
      payments: result.rows,
      stats: {
        totalPayments: parseInt(stats.total_payments),
        totalEarned: parseFloat(stats.total_earned || 0)
      },
      pagination: {
        limit,
        offset,
        hasMore: result.rows.length === limit
      }
    });

  } catch (error) {
    console.error('❌ Payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

export default router;
