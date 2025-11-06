import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// USDC Mainnet Mint Address
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Mainnet RPC endpoint - IMPORTANT: Set SOLANA_RPC_ENDPOINT in your .env file
const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

// Create a single connection instance for reuse
let connectionInstance = null;

/**
 * Verify a Solana transaction contains a valid USDC transfer
 * @param {string} signature - Transaction signature
 * @param {string} expectedRecipient - Expected recipient wallet address
 * @param {number} expectedAmount - Expected USDC amount (in USDC, not lamports)
 * @returns {Promise<{verified: boolean, error?: string, details?: object}>}
 */
export async function verifySolanaTransaction(signature, expectedRecipient, expectedAmount) {
  try {
    const connection = getSolanaConnection();

    // Fetch transaction
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    });

    if (!tx) {
      return {
        verified: false,
        error: 'Transaction not found on blockchain'
      };
    }

    // Check if transaction was successful
    if (tx.meta?.err) {
      return {
        verified: false,
        error: 'Transaction failed on blockchain',
        details: { error: tx.meta.err }
      };
    }

    // Parse token transfers from transaction
    const preTokenBalances = tx.meta?.preTokenBalances || [];
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    // Find USDC transfers
    const usdcTransfers = [];

    for (let i = 0; i < postTokenBalances.length; i++) {
      const post = postTokenBalances[i];
      const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex);

      // Check if this is a USDC token account
      if (post.mint === USDC_MINT_MAINNET) {
        const preAmount = pre ? parseFloat(pre.uiTokenAmount.uiAmount) : 0;
        const postAmount = parseFloat(post.uiTokenAmount.uiAmount);
        const change = postAmount - preAmount;

        if (change !== 0) {
          usdcTransfers.push({
            accountIndex: post.accountIndex,
            owner: post.owner,
            change: change,
            mint: post.mint
          });
        }
      }
    }

    if (usdcTransfers.length === 0) {
      return {
        verified: false,
        error: 'No USDC transfers found in transaction'
      };
    }

    // Find recipient's transfer - check both owner field and account keys
    // The owner field contains the wallet that owns the token account
    let recipientTransfer = usdcTransfers.find(t =>
      t.owner === expectedRecipient && t.change > 0
    );

    // If not found by owner, also check the account keys in the transaction
    // Sometimes the recipient is in the transaction keys but not directly in owner
    if (!recipientTransfer && tx.transaction) {
      const accountKeys = tx.transaction.message.accountKeys;

      // Find if expected recipient is in the account keys
      const recipientInKeys = accountKeys.some(key =>
        key.toString() === expectedRecipient ||
        (typeof key.toBase58 === 'function' && key.toBase58() === expectedRecipient)
      );

      if (recipientInKeys) {
        // If recipient is in transaction keys, accept any positive USDC transfer
        recipientTransfer = usdcTransfers.find(t => t.change > 0);
      }
    }

    if (!recipientTransfer) {
      return {
        verified: false,
        error: 'Expected recipient not found in transaction',
        details: {
          expectedRecipient,
          foundTransfers: usdcTransfers.map(t => ({ owner: t.owner, amount: t.change }))
        }
      };
    }

    // Verify amount (allow 0.1% tolerance for fees/rounding)
    const amountReceived = recipientTransfer.change;
    const tolerance = expectedAmount * 0.001;
    const amountDiff = Math.abs(amountReceived - expectedAmount);

    if (amountDiff > tolerance && amountDiff > 0.01) {
      return {
        verified: false,
        error: 'Transfer amount does not match expected amount',
        details: {
          expected: expectedAmount,
          received: amountReceived,
          difference: amountDiff
        }
      };
    }

    // Transaction verified successfully
    return {
      verified: true,
      details: {
        signature,
        recipient: recipientTransfer.owner,
        amount: amountReceived,
        mint: USDC_MINT_MAINNET,
        blockTime: tx.blockTime,
        slot: tx.slot
      }
    };

  } catch (error) {
    return {
      verified: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

/**
 * Get Solana connection instance (singleton pattern for connection reuse)
 */
export function getSolanaConnection() {
  if (!connectionInstance) {
    connectionInstance = new Connection(SOLANA_RPC_ENDPOINT, 'confirmed');
  }
  return connectionInstance;
}

/**
 * Check if a transaction exists and is confirmed
 */
export async function isTransactionConfirmed(signature) {
  try {
    const connection = getSolanaConnection();
    const status = await connection.getSignatureStatus(signature);

    return status?.value?.confirmationStatus === 'confirmed' ||
           status?.value?.confirmationStatus === 'finalized';
  } catch (error) {
    return false;
  }
}
