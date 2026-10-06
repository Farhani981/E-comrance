import pool from '../config/db.js';
import { createHash } from 'node:crypto';

export async function ensureIdempotencySchema(db = pool) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_idempotency (
        idempotency_key VARCHAR(128) PRIMARY KEY,
        user_id INT NULL,
        request_hash VARCHAR(64) NOT NULL,
        order_id VARCHAR(50) NULL,
        response_body LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      )
    `);
  } catch (err) {
    console.error('Error ensuring order_idempotency schema:', err.message);
  }
}

export function computeRequestHash({ userId, customerEmail, items, totalAmount, couponCode }) {
  const normalizedItems = (items || []).map(i => ({
    id: i.id,
    variantId: i.productVariantId || null,
    quantity: Number(i.quantity) || 1,
  })).sort((a, b) => (a.id || 0) - (b.id || 0) || (a.variantId || 0) - (b.variantId || 0));

  const payload = {
    userId: userId || null,
    customerEmail: String(customerEmail || '').trim().toLowerCase(),
    items: normalizedItems,
    totalAmount: Number(totalAmount) || 0,
    couponCode: String(couponCode || '').trim().toUpperCase(),
  };

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
