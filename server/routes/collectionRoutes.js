import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all collections (Public)
router.get('/', async (req, res) => {
  try {
    const [collections] = await pool.query('SELECT * FROM collections ORDER BY id DESC');
    res.json({ success: true, count: collections.length, collections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Collection (Admin Only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, badge, image, productCount, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Collection name is required' });
    }

    const [result] = await pool.query(
      'INSERT INTO collections (name, description, badge, image, productCount, isActive) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', badge || 'SALE', image || '', productCount || 0, isActive !== undefined ? isActive : true]
    );

    res.status(201).json({
      success: true,
      message: 'Collection created successfully',
      collection: { id: result.insertId, name, description, badge, image, productCount, isActive },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Collection (Admin Only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, description, badge, image, productCount, isActive } = req.body;
    const { id } = req.params;

    const [result] = await pool.query(
      'UPDATE collections SET name = ?, description = ?, badge = ?, image = ?, productCount = ?, isActive = ? WHERE id = ?',
      [name, description, badge, image, productCount, isActive, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.json({ success: true, message: 'Collection updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Collection (Admin Only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM collections WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }

    res.json({ success: true, message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
