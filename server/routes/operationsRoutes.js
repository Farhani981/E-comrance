import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { fail, textValue, numberValue, changeStock, quoteCart } from '../utils/operations.js';
import { inventoryReport } from '../utils/inventoryReport.js';
import { createNotification } from '../services/notificationService.js';
import { stripe } from '../utils/paymentRecovery.js';

const router = express.Router();
const run = handler => async (req, res) => {
  try { await handler(req, res); } catch (error) {
    const status = error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
    res.status(status).json({ success: false, message: error.code === 'ER_DUP_ENTRY' ? 'This record already exists.' : status === 500 ? 'Could not complete the request. Check the server and database.' : error.message });
    if (status === 500) console.error('Operations API:', error);
  }
};
const transaction = async action => {
  const connection = await pool.getConnection();
  try { await connection.beginTransaction(); const result = await action(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
};
const refreshRating = async (connection, id) => {
  await connection.query("UPDATE products SET rating = (SELECT COALESCE(AVG(rating), 0) FROM product_reviews WHERE product_id = ? AND status = 'Approved'), reviews_count = (SELECT COUNT(*) FROM product_reviews WHERE product_id = ? AND status = 'Approved') WHERE id = ?", [id, id, id]);
};

router.post('/quote', run(async (req, res) => res.json({ success: true, quote: await quoteCart(pool, req.body.items, req.body.couponCode) })));
router.get('/reviews/approved', run(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT r.id, u.name, r.rating, r.comment, r.created_at, p.name AS product_name,
      COUNT(*) OVER () AS total_reviews, AVG(r.rating) OVER () AS average_rating
    FROM product_reviews r
    JOIN users u ON u.id = r.user_id
    JOIN products p ON p.id = r.product_id
    WHERE r.status = 'Approved' AND p.deleted_at IS NULL
    ORDER BY r.id DESC LIMIT 24`);
  res.set('Cache-Control', 'no-store');
  res.json({ success: true,
    reviews: rows.map(({ total_reviews, average_rating, ...review }) => review),
    total: Number(rows[0]?.total_reviews || 0),
    averageRating: Number(rows[0]?.average_rating || 0),
  });
}));
router.get('/reviews/product/:id', run(async (req, res) => {
  const [reviews] = await pool.query("SELECT r.id, u.name, r.rating, r.comment, r.created_at FROM product_reviews r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? AND r.status = 'Approved' ORDER BY r.id DESC", [req.params.id]);
  res.json({ success: true, reviews });
}));
router.post('/reviews/product/:id', protect, run(async (req, res) => {
  const rating = numberValue(req.body.rating, 'Rating', 1, true);
  if (rating > 5) fail('Rating must be between 1 and 5.');
  const comment = textValue(req.body.comment, 'Review', 3000);
  const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!product) fail('Product not found.', 404);
  await pool.query("INSERT INTO product_reviews (product_id, user_id, rating, comment, status) VALUES (?, ?, ?, ?, 'Pending')", [product.id, req.user.id, rating, comment]);
  res.status(201).json({ success: true, message: 'Your review was submitted for approval.' });
}));

router.get('/my-returns', protect, run(async (req, res) => {
  const [returns] = await pool.query('SELECT r.* FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE o.user_id = ? ORDER BY r.id DESC', [req.user.id]);
  res.json({ success: true, returns });
}));

const createReturn = async (req, res) => {
  const reason = textValue(req.body.reason, 'Reason', 1000);
  let orderInfo = null;
  await transaction(async connection => {
    const [[order]] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.body.order_id]);
    if (!order || (req.user.role !== 'admin' && order.user_id !== req.user.id)) fail('Order not found.', 404);
    if (!['Delivered', 'Completed', 'Cancelled'].includes(order.order_status)) fail('Returns are available for delivered orders. Cancel an unshipped order instead.');
    if (order.order_status === 'Cancelled' && order.payment_status !== 'Paid') fail('This cancelled order has no paid balance to refund.');
    await connection.query('INSERT INTO return_requests (order_id, reason, status, restocked) VALUES (?, ?, ?, ?)', [order.id, reason, order.order_status === 'Cancelled' ? 'Received' : 'Requested', order.order_status === 'Cancelled']);
    orderInfo = order;
  });

  if (orderInfo) {
    createNotification({
      type: 'RETURN_REQUEST',
      title: 'Return Request Received',
      message: `${orderInfo.customer_name || 'Customer'} requested a return for Order #${orderInfo.id}.`,
      priority: 'MEDIUM',
      metadata: {
        orderId: orderInfo.id,
        customerName: orderInfo.customer_name || 'Customer',
        reason,
        createdAt: new Date().toISOString(),
      },
    });
  }

  res.status(201).json({ success: true });
};
router.post('/my-returns', protect, run(createReturn));
export const cancelOrder = run(async (req, res) => {
  await transaction(async connection => {
    const [[order]] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!order || (req.user.role !== 'admin' && order.user_id !== req.user.id)) fail('Order not found.', 404);
    if (!['Pending', 'Processing'].includes(order.order_status)) fail('Only pending or processing orders can be cancelled.');
    const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY product_id', [order.id]);
    for (const item of items) if (item.product_id) await changeStock(connection, item.product_id, Number(item.quantity), `Cancellation ${order.id}`, req.user.id, item.product_variant_id);
    await connection.query("UPDATE orders SET order_status = 'Cancelled' WHERE id = ?", [order.id]);
    if (order.payment_status === 'Paid') await connection.query("INSERT INTO return_requests (order_id, reason, status, restocked) VALUES (?, 'Paid order cancelled; refund required.', 'Received', TRUE)", [order.id]);
  });
  res.json({ success: true });
});
router.post('/orders/:id/cancel', protect, cancelOrder);

router.use(protect, adminOnly);
router.get('/inventory', run(async (req, res) => {
  const products = await inventoryReport(pool);
  const [warehouses] = await pool.query('SELECT w.*, COUNT(s.product_id) AS product_count FROM warehouses w LEFT JOIN inventory_settings s ON s.warehouse_id = w.id GROUP BY w.id ORDER BY w.name');
  const [adjustments] = await pool.query('SELECT a.*, u.name AS actor_name FROM stock_adjustments a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 100');
  res.json({ success: true, products, warehouses, adjustments });
}));
router.get('/inventory/:id/history', run(async (req, res) => {
  const id = numberValue(req.params.id, 'Product ID', 1, true);
  const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
  if (!product) fail('Product not found.', 404);
  const [purchases] = await pool.query(`SELECT pi.id, pu.id AS purchase_id, pu.invoice_no, pu.purchase_date,
    su.name AS supplier_name, pi.quantity, pi.cost_price, pi.quantity * pi.cost_price AS total_cost
    FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
    LEFT JOIN suppliers su ON su.id = pu.supplier_id WHERE pi.product_id = ?
    ORDER BY pu.purchase_date DESC, pi.id DESC`, [id]);
  const [orders] = await pool.query(`SELECT oi.id, o.id AS order_id, o.created_at, o.order_status,
    oi.quantity, oi.price, COALESCE(r.restocked, 0) AS restocked
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    LEFT JOIN return_requests r ON r.order_id = o.id WHERE oi.product_id = ?
    ORDER BY o.created_at DESC, oi.id DESC`, [id]);
  const [adjustments] = await pool.query(`SELECT a.*, u.name AS actor_name FROM stock_adjustments a
    LEFT JOIN users u ON u.id = a.actor_id WHERE a.product_id = ? ORDER BY a.id DESC`, [id]);
  res.json({ success: true, purchases, orders, adjustments });
}));
router.put('/inventory/:id', run(async (req, res) => {
  const sku = textValue(req.body.sku, 'SKU', 100);
  const threshold = numberValue(req.body.low_stock_threshold, 'Low stock threshold', 0, true);
  const warehouse = req.body.warehouse_id ? numberValue(req.body.warehouse_id, 'Warehouse', 1, true) : null;
  await transaction(async connection => {
    const [[product]] = await connection.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!product) fail('Product not found.', 404);
    if (warehouse) {
      const [[found]] = await connection.query('SELECT id FROM warehouses WHERE id = ?', [warehouse]);
      if (!found) fail('Warehouse not found.');
    }
    await connection.query('UPDATE products SET sku = ? WHERE id = ?', [sku, product.id]);
    await connection.query('INSERT INTO inventory_settings (product_id, warehouse_id, low_stock_threshold) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE warehouse_id = VALUES(warehouse_id), low_stock_threshold = VALUES(low_stock_threshold)', [product.id, warehouse, threshold]);
  });
  res.json({ success: true });
}));
router.post('/inventory/:id/adjust', run(async (req, res) => {
  const delta = numberValue(req.body.delta, 'Adjustment', -100000000, true);
  if (!delta) fail('Adjustment cannot be zero.');
  const reason = textValue(req.body.reason, 'Reason');
  await transaction(connection => changeStock(connection, req.params.id, delta, reason, req.user.id));
  res.json({ success: true });
}));
router.post('/warehouses', run(async (req, res) => {
  await pool.query('INSERT INTO warehouses (name, address) VALUES (?, ?)', [textValue(req.body.name, 'Warehouse name', 120), String(req.body.address || '').trim().slice(0, 500)]);
  res.status(201).json({ success: true });
}));
router.put('/warehouses/:id', run(async (req, res) => {
  const [result] = await pool.query('UPDATE warehouses SET name = ?, address = ? WHERE id = ?', [textValue(req.body.name, 'Warehouse name', 120), String(req.body.address || '').trim().slice(0, 500), req.params.id]);
  if (!result.affectedRows) fail('Warehouse not found.', 404);
  res.json({ success: true });
}));
router.delete('/warehouses/:id', run(async (req, res) => {
  await transaction(async connection => {
    const [[warehouse]] = await connection.query('SELECT id FROM warehouses WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!warehouse) fail('Warehouse not found.', 404);
    const [[assigned]] = await connection.query('SELECT product_id FROM inventory_settings WHERE warehouse_id = ? LIMIT 1', [req.params.id]);
    if (assigned) fail('Reassign the products before deleting this warehouse.');
    await connection.query('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
  });
  res.json({ success: true });
}));
router.get('/reviews', run(async (req, res) => {
  const [reviews] = await pool.query('SELECT r.*, p.name AS product_name, u.name AS customer_name FROM product_reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id ORDER BY r.id DESC');
  res.json({ success: true, reviews });
}));
router.put('/reviews/:id', run(async (req, res) => {
  const rating = numberValue(req.body.rating, 'Rating', 1, true);
  if (rating > 5 || !['Pending', 'Approved', 'Rejected'].includes(req.body.status)) fail('Invalid rating or moderation status.');
  const comment = textValue(req.body.comment, 'Review', 3000);
  await transaction(async connection => {
    const [[review]] = await connection.query('SELECT product_id FROM product_reviews WHERE id = ?', [req.params.id]);
    if (!review) fail('Review not found.', 404);
    await connection.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [review.product_id]);
    await connection.query('UPDATE product_reviews SET rating = ?, comment = ?, status = ? WHERE id = ?', [rating, comment, req.body.status, req.params.id]);
    await refreshRating(connection, review.product_id);
  });
  res.json({ success: true });
}));
router.delete('/reviews/:id', run(async (req, res) => {
  await transaction(async connection => {
    const [[review]] = await connection.query('SELECT product_id FROM product_reviews WHERE id = ?', [req.params.id]);
    if (!review) fail('Review not found.', 404);
    await connection.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [review.product_id]);
    await connection.query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);
    await refreshRating(connection, review.product_id);
  });
  res.json({ success: true });
}));
router.get('/returns', run(async (req, res) => {
  const [returns] = await pool.query('SELECT r.*, o.customer_name, o.total_amount, o.payment_status, o.order_status FROM return_requests r JOIN orders o ON o.id = r.order_id ORDER BY r.id DESC');
  const [orders] = await pool.query('SELECT id, customer_name, total_amount, order_status, payment_status FROM orders ORDER BY created_at DESC');
  res.json({ success: true, returns, orders });
}));
router.post('/returns', run(createReturn));
router.put('/returns/:id', run(async (req, res) => {
  await transaction(async connection => {
    const [[record]] = await connection.query('SELECT r.*, o.total_amount, o.payment_status, o.order_status FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ? FOR UPDATE', [req.params.id]);
    if (!record) fail('Return not found.', 404);
    const transitions = { Requested: ['Approved', 'Rejected'], Approved: ['Received', 'Rejected'], Received: ['Refunded'], Rejected: [], Refunded: [] };
    const status = req.body.status;
    if (record.status !== status && !transitions[record.status].includes(status)) fail('This return status transition is not allowed.');
    if (record.status === 'Refunded') fail('Completed refunds cannot be edited.');
    let amount = Number(record.refund_amount), reference = record.refund_reference, restocked = record.restocked;
    if (status === 'Received' && !restocked) {
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY product_id', [record.order_id]);
      for (const item of items) if (item.product_id) await changeStock(connection, item.product_id, Number(item.quantity), `Return ${record.order_id}`, req.user.id, item.product_variant_id);
      restocked = true;
    }
    if (status === 'Refunded') {
      if (record.payment_status !== 'Paid') fail('Only paid orders can be refunded.');
      amount = numberValue(req.body.refund_amount, 'Refund amount', 0.01);
      if (amount > Number(record.total_amount)) fail('Refund exceeds the order total.');
      reference = textValue(req.body.refund_reference, 'Completed payment refund reference', 255);

      // Verify or execute provider refund for Stripe card transactions
      if (stripe && record.transaction_id && typeof record.transaction_id === 'string' && record.transaction_id.startsWith('pi_')) {
        if (reference.startsWith('re_')) {
          try {
            const providerRefund = await stripe.refunds.retrieve(reference);
            if (providerRefund.payment_intent !== record.transaction_id) {
              fail('Provider refund does not match this order transaction.', 400);
            }
            if (providerRefund.status !== 'succeeded' && providerRefund.status !== 'pending') {
              fail(`Provider refund has not succeeded (status: ${providerRefund.status}).`, 400);
            }
          } catch (err) {
            fail(`Stripe refund verification failed: ${err.message}`, 400);
          }
        } else if (req.body.process_stripe_refund) {
          try {
            const executedRefund = await stripe.refunds.create({
              payment_intent: record.transaction_id,
              amount: Math.round(amount * 100),
              reason: 'requested_by_customer',
            }, {
              idempotencyKey: `shophub-refund-${record.id}-${Math.round(amount * 100)}`,
            });
            reference = executedRefund.id;
          } catch (err) {
            fail(`Failed to execute Stripe refund: ${err.message}`, 502);
          }
        } else if (!req.body.is_manual_settlement) {
          fail('For card payments, provide a valid Stripe refund reference (re_...) or mark as manual settlement.', 400);
        }
      }

      await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [amount === Number(record.total_amount) ? 'Refunded' : 'Partially Refunded', record.order_id]);
    }
    await connection.query('UPDATE return_requests SET status = ?, admin_notes = ?, refund_amount = ?, refund_reference = ?, restocked = ? WHERE id = ?', [status, String(req.body.admin_notes || '').slice(0, 1000), amount, reference, restocked, record.id]);
  });
  res.json({ success: true });
}));
router.get('/promotions', run(async (req, res) => {
  const [promotions] = await pool.query("SELECT *, DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i') AS starts_at, DATE_FORMAT(ends_at, '%Y-%m-%dT%H:%i') AS ends_at FROM promotions ORDER BY id DESC");
  const [products] = await pool.query('SELECT id, name FROM products ORDER BY name');
  res.json({ success: true, promotions, products });
}));
const savePromotion = async (req, res) => {
  const body = req.body;
  const name = textValue(body.name, 'Promotion name', 120);
  const code = String(body.code || '').trim().toUpperCase() || null;
  if (code && !/^[A-Z0-9_-]{1,50}$/.test(code)) fail('Use letters, numbers, underscores or hyphens for coupon codes.');
  const value = numberValue(body.value, 'Discount value', 0.01);
  if (!['Percentage', 'Fixed'].includes(body.discount_type) || (body.discount_type === 'Percentage' && value > 100)) fail('Invalid discount type or percentage.');
  const minimum = numberValue(body.min_subtotal, 'Minimum subtotal');
  const dates = [body.starts_at, body.ends_at].map(date => {
    if (!date) return null;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime())) fail('Invalid promotion date.');
    return date.replace('T', ' ') + ':00';
  });
  if (dates[0] && dates[1] && dates[0] >= dates[1]) fail('End date must be after start date.');
  const productId = body.product_id ? numberValue(body.product_id, 'Product', 1, true) : null;
  if (productId) {
    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
    if (!product) fail('Product not found.');
  }
  const values = [name, code, body.discount_type, value, minimum, productId, ...dates, body.active ? 1 : 0];
  if (req.params.id) {
    const [result] = await pool.query('UPDATE promotions SET name = ?, code = ?, discount_type = ?, value = ?, min_subtotal = ?, product_id = ?, starts_at = ?, ends_at = ?, active = ? WHERE id = ?', [...values, req.params.id]);
    if (!result.affectedRows) fail('Promotion not found.', 404);
  } else await pool.query('INSERT INTO promotions (name, code, discount_type, value, min_subtotal, product_id, starts_at, ends_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', values);
  res.json({ success: true });
};
router.post('/promotions', run(savePromotion));
router.put('/promotions/:id', run(savePromotion));
router.delete('/promotions/:id', run(async (req, res) => {
  const [result] = await pool.query('DELETE FROM promotions WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) fail('Promotion not found.', 404);
  res.json({ success: true });
}));
export default router;
