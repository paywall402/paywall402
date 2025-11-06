import axios from 'axios';
import { query } from '../db/index.js';
import { verifyAccessToken } from '../utils/jwt.js';

/**
 * x402 Payment Middleware
 * Implements HTTP 402 Payment Required standard with x402 protocol
 */

// x402 facilitator configuration
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || 'https://api.payai.network/x402';

/**
 * Verify x402 payment proof
 * @param {string} paymentProof - Payment proof from x402 header
 * @param {string} contentId - Content ID being accessed
 * @param {number} expectedAmount - Expected payment amount in USDC
 * @returns {Promise<boolean>} - True if payment is valid
 */
export const verifyX402Payment = async (paymentProof, contentId, expectedAmount) => {
  try {
    // Call facilitator to verify payment
    const response = await axios.post(`${FACILITATOR_URL}/verify`, {
      proof: paymentProof,
      contentId: contentId,
      expectedAmount: expectedAmount
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data.verified) {
      console.log('✅ Payment verified:', {
        contentId,
        amount: expectedAmount,
        signature: response.data.signature
      });

      // Log payment in database
      await logPayment(contentId, response.data);

      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Payment verification failed:', error.message);
    return false;
  }
};

/**
 * Log payment to database
 */
const logPayment = async (contentId, paymentData) => {
  try {
    await query(
      `INSERT INTO payment_logs (content_id, payer_wallet, amount_usdc, transaction_signature, payment_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        contentId,
        paymentData.payerWallet || 'unknown',
        paymentData.amount,
        paymentData.signature,
        'completed'
      ]
    );

    // Update content payment counter
    await query(
      `UPDATE content SET payments = payments + 1 WHERE id = $1`,
      [contentId]
    );
  } catch (error) {
    console.error('❌ Failed to log payment:', error.message);
  }
};

/**
 * x402 Payment Gate Middleware
 * Returns 402 with payment instructions if no valid payment proof provided
 */
export const x402PaymentGate = async (req, res, next) => {
  const contentId = req.params.id;

  try {
    // Get content details
    const result = await query(
      'SELECT id, price_usdc, creator_wallet, expires_at FROM content WHERE id = $1',
      [contentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const content = result.rows[0];

    // Check if content has expired
    if (content.expires_at && new Date(content.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Content has expired' });
    }

    // Check for x402 payment proof in headers or query
    const paymentProof = req.headers['x-payment-proof'] || req.query.payment;

    if (paymentProof) {
      // First try to verify as JWT token (new method)
      const tokenPayload = verifyAccessToken(paymentProof);

      if (tokenPayload && tokenPayload.contentId === contentId && tokenPayload.type === 'payment') {
        // Valid JWT token, allow access
        console.log('✅ Access granted via JWT token');
        req.content = content;
        req.payment = tokenPayload;
        return next();
      }

      // Fallback: try legacy x402 verification
      const isValid = await verifyX402Payment(
        paymentProof,
        contentId,
        parseFloat(content.price_usdc)
      );

      if (isValid) {
        // Payment verified, allow access
        req.content = content;
        return next();
      }
    }

    // No payment or invalid payment - return 402 Payment Required
    return res.status(402).json({
      error: 'Payment Required',
      message: 'This content requires payment to access',
      payment: {
        amount: parseFloat(content.price_usdc),
        currency: 'USDC',
        network: 'solana',
        recipient: content.creator_wallet,
        facilitator: FACILITATOR_URL,
        contentId: contentId,
        instructions: {
          method: 'x402',
          endpoint: `${FACILITATOR_URL}/pay`,
          headers: {
            'X-Payment-Amount': content.price_usdc,
            'X-Payment-Currency': 'USDC',
            'X-Payment-Network': 'solana',
            'X-Content-Id': contentId
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ x402 middleware error:', error);
    return res.status(500).json({ error: 'Payment processing error' });
  }
};

/**
 * Generate x402 payment link
 */
export const generatePaymentLink = (contentId, amount, creatorWallet) => {
  const paymentData = {
    amount: amount,
    currency: 'USDC',
    network: 'solana',
    recipient: creatorWallet,
    contentId: contentId,
    callbackUrl: `${process.env.FRONTEND_URL}/${contentId}/success`
  };

  const encodedData = Buffer.from(JSON.stringify(paymentData)).toString('base64');
  return `${FACILITATOR_URL}/pay?data=${encodedData}`;
};

export default x402PaymentGate;
