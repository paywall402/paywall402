/**
 * Mock database for development without PostgreSQL
 * WARNING: Data is stored in memory and will be lost on server restart
 */

import { v4 as uuidv4 } from 'uuid';

// In-memory storage
const storage = {
  content: new Map(),
  payments: new Map()
};

/**
 * Mock query function compatible with PostgreSQL client
 */
export const query = async (text, params = []) => {
  console.log('📝 Mock DB Query:', text.substring(0, 100));

  // INSERT content
  if (text.includes('INSERT INTO content')) {
    const id = uuidv4();
    const [type, path, filename, mimetype, price, wallet, expiresAt] = params;

    const content = {
      id,
      content_type: type,
      content_path: path,
      original_filename: filename,
      file_mimetype: mimetype,
      price_usdc: price,
      creator_wallet: wallet,
      expires_at: expiresAt,
      views: 0,
      payments: 0,
      created_at: new Date()
    };

    storage.content.set(id, content);

    return {
      rows: [content],
      rowCount: 1
    };
  }

  // SELECT content by ID
  if (text.includes('SELECT') && text.includes('FROM content') && text.includes('WHERE id =')) {
    const id = params[0];
    const content = storage.content.get(id);

    if (!content) {
      return { rows: [], rowCount: 0 };
    }

    return {
      rows: [content],
      rowCount: 1
    };
  }

  // UPDATE views
  if (text.includes('UPDATE content SET views')) {
    const id = params[0];
    const content = storage.content.get(id);

    if (content) {
      content.views += 1;
      storage.content.set(id, content);
    }

    return { rows: [], rowCount: 1 };
  }

  // UPDATE payments
  if (text.includes('UPDATE content SET payments')) {
    const id = params[0];
    const content = storage.content.get(id);

    if (content) {
      content.payments += 1;
      storage.content.set(id, content);
    }

    return { rows: [], rowCount: 1 };
  }

  // INSERT payment log
  if (text.includes('INSERT INTO payment_logs')) {
    const id = uuidv4();
    const [contentId, payerWallet, amount, signature, status] = params;

    const payment = {
      id,
      content_id: contentId,
      payer_wallet: payerWallet,
      amount_usdc: amount,
      transaction_signature: signature,
      payment_status: status,
      paid_at: new Date()
    };

    storage.payments.set(id, payment);

    return {
      rows: [payment],
      rowCount: 1
    };
  }

  // SELECT payment logs
  if (text.includes('SELECT') && text.includes('FROM payment_logs')) {
    const payments = Array.from(storage.payments.values());

    if (text.includes('WHERE content_id =')) {
      const contentId = params[0];
      const filtered = payments.filter(p => p.content_id === contentId);

      if (text.includes('COUNT')) {
        const total = filtered.filter(p => p.payment_status === 'completed').length;
        const sum = filtered
          .filter(p => p.payment_status === 'completed')
          .reduce((acc, p) => acc + parseFloat(p.amount_usdc), 0);

        return {
          rows: [{
            total_payments: total,
            total_earned: sum
          }],
          rowCount: 1
        };
      }

      return {
        rows: filtered,
        rowCount: filtered.length
      };
    }

    return {
      rows: payments,
      rowCount: payments.length
    };
  }

  // Default fallback
  return {
    rows: [],
    rowCount: 0
  };
};

/**
 * Mock transaction helper
 */
export const transaction = async (callback) => {
  console.log('🔄 Mock transaction started');
  try {
    const result = await callback({ query });
    console.log('✅ Mock transaction committed');
    return result;
  } catch (error) {
    console.error('❌ Mock transaction rolled back:', error.message);
    throw error;
  }
};

/**
 * Health check
 */
export const healthCheck = async () => {
  return true;
};

/**
 * Close (no-op for mock)
 */
export const close = async () => {
  console.log('✅ Mock database closed');
};

export default { query, transaction, healthCheck, close };
