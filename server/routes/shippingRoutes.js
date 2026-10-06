import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper to ensure shipping tables exist
export async function ensureShippingSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_methods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      description TEXT,
      base_rate DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
      free_above DECIMAL(10, 2) DEFAULT NULL,
      estimated_days VARCHAR(50) DEFAULT '2-4 Days',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_zones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      regions TEXT NOT NULL,
      rate DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
      estimated_days VARCHAR(50) DEFAULT '2-3 Days',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipping_couriers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      tracking_url_template VARCHAR(255) NOT NULL,
      account_number VARCHAR(100) DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default shipping methods if empty
  const [methods] = await pool.query('SELECT COUNT(*) AS count FROM shipping_methods');
  if (methods[0].count === 0) {
    await pool.query(`
      INSERT INTO shipping_methods (name, code, description, base_rate, free_above, estimated_days, is_active) VALUES
      ('Standard Delivery', 'standard', 'Regular courier delivery across Pakistan', 200.00, 2000.00, '2-4 Business Days', TRUE),
      ('Express Delivery', 'express', 'Next-day fast priority courier service', 450.00, NULL, '1-2 Business Days', TRUE),
      ('Cash on Delivery (COD)', 'cod', 'Pay upon receiving your order at your doorstep', 200.00, 2000.00, '2-4 Business Days', TRUE),
      ('Free Shipping Promotion', 'free_shipping', 'Eligible for promotional cart totals over Rs. 2,000', 0.00, 2000.00, '3-5 Business Days', TRUE)
    `);
  }

  // Seed default zones if empty
  const [zones] = await pool.query('SELECT COUNT(*) AS count FROM shipping_zones');
  if (zones[0].count === 0) {
    await pool.query(`
      INSERT INTO shipping_zones (name, regions, rate, estimated_days, is_active) VALUES
      ('Lahore / Local City', 'Lahore, Raiwind, Kasur', 150.00, '1-2 Days', TRUE),
      ('Punjab Major Cities', 'Islamabad, Rawalpindi, Faisalabad, Multan, Gujranwala, Sialkot', 200.00, '2-3 Days', TRUE),
      ('Sindh & South Zone', 'Karachi, Hyderabad, Sukkur, Larkana', 220.00, '2-4 Days', TRUE),
      ('KPK & Northern Zone', 'Peshawar, Abbottabad, Mardan, Swat', 220.00, '3-4 Days', TRUE),
      ('Balochistan & Remote', 'Quetta, Gwadar, Turbat, Khuzdar, Gilgit, AJ&K', 280.00, '4-6 Days', TRUE)
    `);
  }

  // Seed couriers if empty
  const [couriers] = await pool.query('SELECT COUNT(*) AS count FROM shipping_couriers');
  if (couriers[0].count === 0) {
    await pool.query(`
      INSERT INTO shipping_couriers (name, code, tracking_url_template, account_number, is_active) VALUES
      ('TCS Express', 'tcs', 'https://www.tcsexpress.com/tracking?tracking_no={TRACKING_NO}', 'TCS-PK-98231', TRUE),
      ('Leopards Courier', 'leopards', 'https://leopardscourier.com/tracking/?track={TRACKING_NO}', 'LEO-LHR-4412', TRUE),
      ('Trax Logistics', 'trax', 'https://trax.pk/tracking?tracking_number={TRACKING_NO}', 'TRX-77821', TRUE),
      ('CallCourier', 'callcourier', 'https://callcourier.com.pk/tracking/?cn={TRACKING_NO}', 'CC-55219', TRUE),
      ('PostEx', 'postex', 'https://postex.pk/tracking?cn={TRACKING_NO}', 'PSTX-3310', TRUE),
      ('M&P Logistics', 'mnp', 'https://mulphilog.com/tracking?cn={TRACKING_NO}', 'MNP-1120', FALSE)
    `);
  }
}

// 1. Get all shipping configurations
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    await ensureShippingSchema();
    const [methods] = await pool.query('SELECT * FROM shipping_methods ORDER BY id ASC');
    const [zones] = await pool.query('SELECT * FROM shipping_zones ORDER BY id ASC');
    const [couriers] = await pool.query('SELECT * FROM shipping_couriers ORDER BY id ASC');
    
    // Recent dispatched orders with tracking
    const [dispatchedOrders] = await pool.query(`
      SELECT id, customer_name, city, total_amount, order_status, courier_name, tracking_number, created_at
      FROM orders
      WHERE tracking_number IS NOT NULL AND tracking_number != ''
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      methods,
      zones,
      couriers,
      dispatchedOrders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Toggle or update shipping method
router.put('/methods/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, base_rate, free_above, estimated_days, is_active } = req.body;
    await pool.query(
      `UPDATE shipping_methods 
       SET name = COALESCE(?, name),
           base_rate = COALESCE(?, base_rate),
           free_above = ?,
           estimated_days = COALESCE(?, estimated_days),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, base_rate, free_above === undefined ? null : free_above, estimated_days, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Shipping method updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Toggle or update shipping zone
router.put('/zones/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, regions, rate, estimated_days, is_active } = req.body;
    await pool.query(
      `UPDATE shipping_zones 
       SET name = COALESCE(?, name),
           regions = COALESCE(?, regions),
           rate = COALESCE(?, rate),
           estimated_days = COALESCE(?, estimated_days),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, regions, rate, estimated_days, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Shipping zone updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Toggle or update courier partner
router.put('/couriers/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, tracking_url_template, account_number, is_active } = req.body;
    await pool.query(
      `UPDATE shipping_couriers 
       SET name = COALESCE(?, name),
           tracking_url_template = COALESCE(?, tracking_url_template),
           account_number = COALESCE(?, account_number),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, tracking_url_template, account_number, is_active, req.params.id]
    );
    res.json({ success: true, message: 'Courier partner updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
