import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY id ASC');
    res.json({ success: true, count: categories.length, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Category (Admin Only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, count, img, link, isVisible } = req.body;
    if (!name || !img) {
      return res.status(400).json({ success: false, message: 'Name and Image are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, count, img, link, isVisible) VALUES (?, ?, ?, ?, ?)',
      [name, count || '0 Products', img, link || '/shop', isVisible !== undefined ? isVisible : true]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: { id: result.insertId, name, count, img, link, isVisible },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Category (Admin Only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['name', 'count', 'img', 'link', 'isVisible'];
    const fields = allowedFields.filter(field => req.body[field] !== undefined);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No category fields provided' });
    }

    if (req.body.name !== undefined && !req.body.name) {
      return res.status(400).json({ success: false, message: 'Category name cannot be empty' });
    }

    if (req.body.img !== undefined && !req.body.img) {
      return res.status(400).json({ success: false, message: 'Category image cannot be empty' });
    }

    const values = fields.map(field => req.body[field]);
    const assignments = fields.map(field => `${field} = ?`).join(', ');

    const [result] = await pool.query(
      `UPDATE categories SET ${assignments} WHERE id = ?`,
      [...values, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Category (Admin Only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
