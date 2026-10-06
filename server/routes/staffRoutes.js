import express from 'express';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

export const ROLES_LIST = [
  {
    role: 'super_admin',
    name: 'Super Administrator',
    description: 'Full access to financial records, settings, database, staff, orders, and products.',
    permissions: ['all']
  },
  {
    role: 'store_manager',
    name: 'Store Manager',
    description: 'Manage products, inventory, orders, customer interactions, reviews, and marketing.',
    permissions: ['products', 'categories', 'orders', 'inventory', 'customers', 'reviews', 'marketing']
  },
  {
    role: 'order_fulfillment',
    name: 'Order & Shipping Staff',
    description: 'Process orders, print invoices, update tracking and handle returns.',
    permissions: ['orders', 'shipping', 'returns']
  },
  {
    role: 'inventory_specialist',
    name: 'Inventory Specialist',
    description: 'Adjust stock, manage warehouses, suppliers, purchase invoices, and view stock ledger.',
    permissions: ['inventory', 'suppliers', 'purchases']
  }
];

export async function ensureStaffSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      admin_name VARCHAR(150) NOT NULL,
      action VARCHAR(100) NOT NULL,
      module VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(50) DEFAULT '127.0.0.1',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed sample recent activity logs if empty
  const [logs] = await pool.query('SELECT COUNT(*) AS count FROM admin_activity_logs');
  if (logs[0].count === 0) {
    await pool.query(`
      INSERT INTO admin_activity_logs (admin_name, action, module, details) VALUES
      ('Administrator', 'LOGIN', 'Authentication', 'Admin signed in successfully from local dashboard session'),
      ('Administrator', 'UPDATE_STATUS', 'Orders', 'Order status updated to Shipped with tracking code'),
      ('Administrator', 'STOCK_ADJUST', 'Inventory', 'Stock verified and adjusted for summer collection catalog'),
      ('Administrator', 'SYSTEM_AUDIT', 'Settings', 'Store operational rules and free-shipping threshold checked')
    `);
  }
}

// 1. Get Staff members, roles, and activity logs
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    await ensureStaffSchema();

    // Fetch users with role admin or staff
    const [staffUsers] = await pool.query(`
      SELECT id, name, email, role, created_at
      FROM users
      WHERE role IN ('admin', 'staff')
      ORDER BY id ASC
    `);

    // Fetch activity logs
    const [logs] = await pool.query(`
      SELECT * FROM admin_activity_logs
      ORDER BY created_at DESC
      LIMIT 30
    `);

    res.json({
      success: true,
      staff: staffUsers.map(u => ({
        ...u,
        assignedRole: u.role === 'admin' ? 'Super Administrator' : 'Store Manager',
        status: 'Active'
      })),
      roles: ROLES_LIST,
      logs
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Add new staff user
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const [[existing]] = await pool.query('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashedPassword, role === 'super_admin' ? 'admin' : 'staff']
    );

    // Record activity log
    await pool.query(
      'INSERT INTO admin_activity_logs (admin_id, admin_name, action, module, details) VALUES (?, ?, ?, ?, ?)',
      [req.user?.id || null, req.user?.name || 'Administrator', 'CREATE_STAFF', 'Staff Management', `Created staff account: ${email.trim().toLowerCase()}`]
    );

    res.status(201).json({ success: true, message: 'New staff member added successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
