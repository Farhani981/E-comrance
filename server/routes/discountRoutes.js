import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { parseJsonList, calculateProductDiscount } from '../services/pricingEngine.js';

const router = express.Router();

function getEffectiveDiscountStatus(discount, now = new Date()) {
  if (discount.deleted_at) return 'Deleted';
  if (discount.is_paused) return 'Paused';
  const start = new Date(discount.starts_at);
  const end = new Date(discount.ends_at);
  if (now < start) return 'Scheduled';
  if (now > end) return 'Expired';
  return 'Active';
}

// 1. Get all discounts with filters and stats
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { status, discountType, applyTo, search, startDate, endDate } = req.query;
    const now = new Date();

    let query = 'SELECT * FROM discounts WHERE deleted_at IS NULL';
    const params = [];

    if (discountType && discountType !== 'All') {
      query += ' AND discount_type = ?';
      params.push(discountType);
    }

    if (applyTo && applyTo !== 'All') {
      query += ' AND apply_to = ?';
      params.push(applyTo);
    }

    if (search && search.trim()) {
      query += ' AND name LIKE ?';
      params.push(`%${search.trim()}%`);
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

    let discounts = rows.map(d => ({
      ...d,
      product_ids: parseJsonList(d.product_ids).map(Number),
      category_ids: parseJsonList(d.category_ids).map(String),
      collection_ids: parseJsonList(d.collection_ids).map(Number),
      effective_status: getEffectiveDiscountStatus(d, now),
    }));

    if (status && status !== 'All') {
      discounts = discounts.filter(d => d.effective_status === status);
    }

    const [allRows] = await pool.query('SELECT * FROM discounts WHERE deleted_at IS NULL');
    const stats = {
      total: allRows.length,
      active: allRows.filter(d => getEffectiveDiscountStatus(d, now) === 'Active').length,
      scheduled: allRows.filter(d => getEffectiveDiscountStatus(d, now) === 'Scheduled').length,
      expired: allRows.filter(d => getEffectiveDiscountStatus(d, now) === 'Expired').length,
      paused: allRows.filter(d => d.is_paused).length,
    };

    res.json({ success: true, count: discounts.length, discounts, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Create discount
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      name,
      discount_type,
      discount_value,
      apply_to = 'All',
      product_ids = [],
      category_ids = [],
      collection_ids = [],
      starts_at,
      ends_at,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Discount name is required.' });
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

    const [result] = await pool.query(`
      INSERT INTO discounts 
      (name, discount_type, discount_value, apply_to, product_ids, category_ids, collection_ids, starts_at, ends_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      type,
      val,
      ['All', 'Products', 'Categories', 'Collections'].includes(apply_to) ? apply_to : 'All',
      Array.isArray(product_ids) ? JSON.stringify(product_ids) : null,
      Array.isArray(category_ids) ? JSON.stringify(category_ids) : null,
      Array.isArray(collection_ids) ? JSON.stringify(collection_ids) : null,
      startDate,
      endDate,
    ]);

    res.status(201).json({
      success: true,
      message: `Discount "${name.trim()}" created successfully.`,
      discountId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get single discount with affected products preview
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM discounts WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    const discount = rows[0];
    discount.product_ids = parseJsonList(discount.product_ids).map(Number);
    discount.category_ids = parseJsonList(discount.category_ids).map(String);
    discount.collection_ids = parseJsonList(discount.collection_ids).map(Number);
    discount.effective_status = getEffectiveDiscountStatus(discount, new Date());

    // Find affected products
    let affectedQuery = 'SELECT id, name, sku, price, original_price, category_id, category_name, image FROM products WHERE deleted_at IS NULL';
    const params = [];

    if (discount.apply_to === 'Products' && discount.product_ids.length > 0) {
      affectedQuery += ' AND id IN (?)';
      params.push(discount.product_ids);
    } else if (discount.apply_to === 'Categories' && discount.category_ids.length > 0) {
      affectedQuery += ' AND (category_id IN (?) OR category_name IN (?))';
      params.push(discount.category_ids, discount.category_ids);
    }
    affectedQuery += ' ORDER BY id DESC LIMIT 50';

    let affectedProducts = [];
    if (discount.apply_to === 'All' || params.length > 0) {
      const [products] = await pool.query(affectedQuery, params);
      affectedProducts = products.map(p => {
        const pricing = calculateProductDiscount(p, [discount]);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          image: p.image,
          originalPrice: pricing.originalPrice,
          discountAmount: pricing.discountAmount,
          finalPrice: pricing.finalPrice,
          discountPercent: pricing.discountPercent,
        };
      });
    }

    res.json({ success: true, discount, affectedProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update discount
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const {
      name,
      discount_type,
      discount_value,
      apply_to = 'All',
      product_ids = [],
      category_ids = [],
      collection_ids = [],
      starts_at,
      ends_at,
    } = req.body;

    const [existing] = await pool.query('SELECT id FROM discounts WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Discount name is required.' });
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
      UPDATE discounts SET
        name = ?,
        discount_type = ?,
        discount_value = ?,
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
      ['All', 'Products', 'Categories', 'Collections'].includes(apply_to) ? apply_to : 'All',
      Array.isArray(product_ids) ? JSON.stringify(product_ids) : null,
      Array.isArray(category_ids) ? JSON.stringify(category_ids) : null,
      Array.isArray(collection_ids) ? JSON.stringify(collection_ids) : null,
      startDate,
      endDate,
      req.params.id,
    ]);

    res.json({ success: true, message: 'Discount updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Toggle pause status
router.patch('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const [existing] = await pool.query('SELECT id, is_paused FROM discounts WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Discount not found.' });
    }

    const newPaused = !existing[0].is_paused;
    await pool.query('UPDATE discounts SET is_paused = ? WHERE id = ?', [newPaused, req.params.id]);

    res.json({
      success: true,
      is_paused: newPaused,
      message: newPaused ? 'Discount has been paused.' : 'Discount has been activated.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Soft delete discount
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE discounts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Discount not found or already deleted.' });
    }

    res.json({ success: true, message: 'Discount deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
