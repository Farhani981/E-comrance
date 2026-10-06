import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { parseJsonList, validateAndApplyCoupon } from '../services/pricingEngine.js';

const router = express.Router();

/**
 * Calculates effective status based on current server time and pause/delete state.
 */
function getEffectiveCouponStatus(coupon, now = new Date()) {
  if (coupon.deleted_at) return 'Deleted';
  if (coupon.is_paused) return 'Paused';
  const start = new Date(coupon.starts_at);
  const end = new Date(coupon.ends_at);
  if (now < start) return 'Scheduled';
  if (now > end) return 'Expired';
  return 'Active';
}

// ==========================================
// CUSTOMER PUBLIC ENDPOINTS
// ==========================================

// Validate coupon at checkout
router.post('/validate', async (req, res) => {
  try {
    const { code, items = [], customerEmail = '' } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Please enter a coupon code.' });
    }

    const userId = req.user?.id || null;
    const result = await validateAndApplyCoupon(pool, {
      code,
      cartLines: items,
      customerEmail,
      userId,
      now: new Date(),
    });

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      valid: true,
      coupon: result.coupon,
      discountAmount: result.discountAmount,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ADMIN MANAGEMENT ENDPOINTS
// ==========================================

// 1. Get all coupons with filters and KPI stats
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, discountType, search, startDate, endDate } = req.query;
    const now = new Date();

    let query = 'SELECT * FROM coupons WHERE deleted_at IS NULL';
    const params = [];

    if (discountType && discountType !== 'All') {
      query += ' AND discount_type = ?';
      params.push(discountType);
    }

    if (search && search.trim()) {
      query += ' AND (code LIKE ? OR name LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (startDate) {
      query += ' AND starts_at >= ?';
      params.push(new Date(startDate));
    }
    if (endDate) {
      query += ' AND ends_at <= ?';
      params.push(new Date(endDate));
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.query(query, params);

    // Compute effective status for each coupon
    let coupons = rows.map(c => ({
      ...c,
      product_ids: parseJsonList(c.product_ids).map(Number),
      category_ids: parseJsonList(c.category_ids).map(String),
      collection_ids: parseJsonList(c.collection_ids).map(Number),
      effective_status: getEffectiveCouponStatus(c, now),
    }));

    if (status && status !== 'All') {
      coupons = coupons.filter(c => c.effective_status === status);
    }

    // Compute summary KPI stats across all non-deleted coupons
    const [allRows] = await pool.query('SELECT * FROM coupons WHERE deleted_at IS NULL');
    const stats = {
      total: allRows.length,
      active: allRows.filter(c => getEffectiveCouponStatus(c, now) === 'Active').length,
      scheduled: allRows.filter(c => getEffectiveCouponStatus(c, now) === 'Scheduled').length,
      expired: allRows.filter(c => getEffectiveCouponStatus(c, now) === 'Expired').length,
      paused: allRows.filter(c => c.is_paused).length,
      totalUsages: allRows.reduce((sum, c) => sum + (Number(c.usage_count) || 0), 0),
    };

    res.json({ success: true, count: coupons.length, coupons, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Create coupon
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      code,
      name,
      discount_type,
      discount_value,
      min_order_amount = 0,
      max_discount_amount = null,
      usage_limit = null,
      per_customer_limit = 1,
      apply_to = 'All',
      product_ids = [],
      category_ids = [],
      collection_ids = [],
      starts_at,
      ends_at,
    } = req.body;

    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode || !/^[A-Z0-9_-]{2,50}$/.test(normalizedCode)) {
      return res.status(400).json({ success: false, message: 'Coupon code must be 2-50 alphanumeric characters (hyphens and underscores allowed).' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Coupon name is required.' });
    }

    const type = discount_type === 'Fixed' ? 'Fixed' : 'Percentage';
    const val = Number(discount_value);
    if (!Number.isFinite(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than 0.' });
    }
    if (type === 'Percentage' && val > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    }

    if (!starts_at || !ends_at) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }
    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date.' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: 'End date must be after or equal to start date.' });
    }

    // Check code uniqueness
    const [existing] = await pool.query('SELECT id FROM coupons WHERE UPPER(code) = ? AND deleted_at IS NULL', [normalizedCode]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Coupon code "${normalizedCode}" already exists.` });
    }

    const [result] = await pool.query(`
      INSERT INTO coupons 
      (code, name, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, per_customer_limit, apply_to, product_ids, category_ids, collection_ids, starts_at, ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      normalizedCode,
      name.trim(),
      type,
      val,
      Number(min_order_amount) || 0,
      max_discount_amount != null && max_discount_amount !== '' ? Number(max_discount_amount) : null,
      usage_limit != null && usage_limit !== '' ? Number(usage_limit) : null,
      Number(per_customer_limit) || 1,
      ['All', 'Products', 'Categories', 'Collections'].includes(apply_to) ? apply_to : 'All',
      Array.isArray(product_ids) ? JSON.stringify(product_ids) : null,
      Array.isArray(category_ids) ? JSON.stringify(category_ids) : null,
      Array.isArray(collection_ids) ? JSON.stringify(collection_ids) : null,
      startDate,
      endDate,
    ]);

    res.status(201).json({
      success: true,
      message: `Coupon "${normalizedCode}" created successfully.`,
      couponId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get single coupon with usage history
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    const coupon = rows[0];
    coupon.product_ids = parseJsonList(coupon.product_ids).map(Number);
    coupon.category_ids = parseJsonList(coupon.category_ids).map(String);
    coupon.collection_ids = parseJsonList(coupon.collection_ids).map(Number);
    coupon.effective_status = getEffectiveCouponStatus(coupon, new Date());

    // Fetch usages
    const [usages] = await pool.query(`
      SELECT cu.*, o.customer_name, o.total_amount
      FROM coupon_usages cu
      LEFT JOIN orders o ON o.id = cu.order_id
      WHERE cu.coupon_id = ?
      ORDER BY cu.created_at DESC
      LIMIT 50
    `, [coupon.id]);

    res.json({ success: true, coupon, usages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update coupon
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const {
      name,
      discount_type,
      discount_value,
      min_order_amount = 0,
      max_discount_amount = null,
      usage_limit = null,
      per_customer_limit = 1,
      apply_to = 'All',
      product_ids = [],
      category_ids = [],
      collection_ids = [],
      starts_at,
      ends_at,
    } = req.body;

    const [existing] = await pool.query('SELECT id FROM coupons WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Coupon name is required.' });
    }

    const type = discount_type === 'Fixed' ? 'Fixed' : 'Percentage';
    const val = Number(discount_value);
    if (!Number.isFinite(val) || val <= 0) {
      return res.status(400).json({ success: false, message: 'Discount value must be greater than 0.' });
    }
    if (type === 'Percentage' && val > 100) {
      return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%.' });
    }

    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (endDate < startDate) {
      return res.status(400).json({ success: false, message: 'End date must be after or equal to start date.' });
    }

    await pool.query(`
      UPDATE coupons SET
        name = ?,
        discount_type = ?,
        discount_value = ?,
        min_order_amount = ?,
        max_discount_amount = ?,
        usage_limit = ?,
        per_customer_limit = ?,
        apply_to = ?,
        product_ids = ?,
        category_ids = ?,
        collection_ids = ?,
        starts_at = ?,
        ends_at = ?
      WHERE id = ?
    `, [
      name.trim(),
      type,
      val,
      Number(min_order_amount) || 0,
      max_discount_amount != null && max_discount_amount !== '' ? Number(max_discount_amount) : null,
      usage_limit != null && usage_limit !== '' ? Number(usage_limit) : null,
      Number(per_customer_limit) || 1,
      ['All', 'Products', 'Categories', 'Collections'].includes(apply_to) ? apply_to : 'All',
      Array.isArray(product_ids) ? JSON.stringify(product_ids) : null,
      Array.isArray(category_ids) ? JSON.stringify(category_ids) : null,
      Array.isArray(collection_ids) ? JSON.stringify(collection_ids) : null,
      startDate,
      endDate,
      req.params.id,
    ]);

    res.json({ success: true, message: 'Coupon updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Toggle pause status
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id, is_paused FROM coupons WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found.' });
    }

    const newPaused = !existing[0].is_paused;
    await pool.query('UPDATE coupons SET is_paused = ? WHERE id = ?', [newPaused, req.params.id]);

    res.json({
      success: true,
      is_paused: newPaused,
      message: newPaused ? 'Coupon has been paused.' : 'Coupon has been activated.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Soft delete coupon
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE coupons SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found or already deleted.' });
    }

    res.json({ success: true, message: 'Coupon deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
