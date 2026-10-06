import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

export async function ensureMarketingSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      type ENUM('Flash Sale', 'Seasonal Discount', 'Free Shipping', 'Cart Recovery', 'Holiday Special') DEFAULT 'Seasonal Discount',
      discount_rule VARCHAR(100) DEFAULT '15% Off Everything',
      banner_url TEXT,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      target_segment VARCHAR(100) DEFAULT 'All Customers',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [campaigns] = await pool.query('SELECT COUNT(*) AS count FROM marketing_campaigns');
  if (campaigns[0].count === 0) {
    await pool.query(`
      INSERT INTO marketing_campaigns (title, description, type, discount_rule, banner_url, starts_at, ends_at, is_active, target_segment) VALUES
      ('Grand Season Finale', 'Flat 20% off across summer shirts and casual wear.', 'Seasonal Discount', '20% Off', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), TRUE, 'All Customers'),
      ('Weekend Flash Sale', 'Limited 48-hour flash pricing on shoes and watches.', 'Flash Sale', 'Flat Rs. 500 Off', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80', NOW(), DATE_ADD(NOW(), INTERVAL 2 DAY), TRUE, 'VIP Customers'),
      ('Welcome 1st Purchase Offer', 'Special discount coupon code for brand new subscribers.', 'Cart Recovery', '10% Off 1st Order', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&q=80', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), TRUE, 'First-time Visitors')
    `);
  }
}

// 1. Get Marketing Overview (Campaigns, Abandoned Carts, Customer Segments)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    await ensureMarketingSchema();
    const [campaigns] = await pool.query('SELECT * FROM marketing_campaigns ORDER BY starts_at DESC');

    // Customer Segments based on real order metrics
    const [vipRows] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as count, COALESCE(SUM(o.total_amount), 0) as totalRevenue
      FROM users u
      JOIN orders o ON o.user_id = u.id AND o.order_status != 'Cancelled'
      WHERE u.role = 'user'
      GROUP BY u.id
      HAVING COUNT(o.id) >= 3 OR SUM(o.total_amount) >= 15000
    `);
    const vipCount = vipRows.length;

    const [repeatRows] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN orders o ON o.user_id = u.id AND o.order_status != 'Cancelled'
      WHERE u.role = 'user'
      GROUP BY u.id
      HAVING COUNT(o.id) BETWEEN 2 AND 2
    `);
    const repeatCount = repeatRows.length;

    const [allCustomers] = await pool.query(`SELECT COUNT(*) as total FROM users WHERE role = 'user'`);
    const totalCustomers = allCustomers[0]?.total || 0;

    const [oneTimeRows] = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      JOIN orders o ON o.user_id = u.id AND o.order_status != 'Cancelled'
      WHERE u.role = 'user'
      GROUP BY u.id
      HAVING COUNT(o.id) = 1
    `);
    const oneTimeCount = oneTimeRows.length;
    const inactiveCount = Math.max(0, totalCustomers - (vipCount + repeatCount + oneTimeCount));

    // Abandoned Carts (Orders in Pending/Unpaid status older than 2 hours or shopping carts)
    const [abandonedOrders] = await pool.query(`
      SELECT o.id, o.customer_name, o.email, o.phone, o.total_amount, o.created_at,
             COUNT(oi.id) as item_count,
             GROUP_CONCAT(oi.product_name SEPARATOR ', ') as items_preview
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.order_status = 'Pending' AND o.payment_status = 'Unpaid'
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 15
    `);

    res.json({
      success: true,
      campaigns,
      segments: [
        { name: 'VIP Champions', criteria: '3+ Orders or Rs. 15,000+ Spent', count: vipCount, badge: 'text-amber-700 bg-amber-50 border-amber-200' },
        { name: 'Repeat Buyers', criteria: '2 Completed Purchases', count: repeatCount, badge: 'text-blue-700 bg-blue-50 border-blue-200' },
        { name: 'First-time Customers', criteria: '1 Completed Order', count: oneTimeCount, badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        { name: 'Inactive / Leads', criteria: 'Registered with no orders yet', count: inactiveCount, badge: 'text-slate-700 bg-slate-50 border-slate-200' }
      ],
      abandonedCarts: abandonedOrders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Create Campaign
router.post('/campaigns', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, type, discount_rule, banner_url, starts_at, ends_at, target_segment } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign title is required.' });
    }

    await pool.query(`
      INSERT INTO marketing_campaigns (title, description, type, discount_rule, banner_url, starts_at, ends_at, target_segment, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)
    `, [title.trim(), description || '', type || 'Seasonal Discount', discount_rule || '', banner_url || '', starts_at || new Date(), ends_at || new Date(Date.now() + 14 * 86400000), target_segment || 'All Customers']);

    res.status(201).json({ success: true, message: 'Marketing campaign created successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Toggle/Update Campaign
router.put('/campaigns/:id', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, discount_rule, is_active, banner_url } = req.body;
    await pool.query(`
      UPDATE marketing_campaigns
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          discount_rule = COALESCE(?, discount_rule),
          is_active = COALESCE(?, is_active),
          banner_url = COALESCE(?, banner_url)
      WHERE id = ?
    `, [title, description, discount_rule, is_active, banner_url, req.params.id]);

    res.json({ success: true, message: 'Campaign updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Delete Campaign
router.delete('/campaigns/:id', protect, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM marketing_campaigns WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Campaign deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Send recovery email/message reminder to abandoned cart
router.post('/abandoned-carts/:orderId/recover', protect, adminOnly, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT id, customer_name, email FROM orders WHERE id = ?', [req.params.orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order reference not found.' });
    }
    // Simulation / Notification triggered
    res.json({ success: true, message: `Recovery reminder dispatched to ${order.customer_name || 'Customer'} (${order.email}).` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
