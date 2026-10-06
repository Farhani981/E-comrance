import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validateBanner } from '../utils/bannerValidation.js';

const router = express.Router();
const format = banner => ({ ...banner, isActive: Boolean(banner.isActive) });
router.get('/', async (_req, res) => {
  try {
    const [banners] = await pool.query('SELECT * FROM banners WHERE isActive = TRUE ORDER BY position, id');
    res.json({ success: true, banners: banners.map(format) });
  } catch { res.status(503).json({ success: false, message: 'Banners are temporarily unavailable.' }); }
});
router.get('/admin', protect, adminOnly, async (_req, res) => {
  try {
    const [banners] = await pool.query('SELECT * FROM banners ORDER BY position, id');
    res.json({ success: true, banners: banners.map(format) });
  } catch { res.status(503).json({ success: false, message: 'Could not load banners. Check backend initialization.' }); }
});
router.put('/reorder', protect, adminOnly, async (req, res) => {
  let connection;
  try {
    const { ids, kind } = req.body;
    if (!['hero', 'promo'].includes(kind) || !Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some(id => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) return res.status(400).json({ success: false, message: 'Invalid banner order.' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT id FROM banners WHERE kind = ? FOR UPDATE', [kind]);
    if (rows.length !== ids.length || rows.some(row => !ids.includes(row.id))) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Banner list changed. Refresh before reordering.' });
    }
    for (const [position, id] of ids.entries()) await connection.query('UPDATE banners SET position = ? WHERE id = ?', [position, id]);
    await connection.commit();
    res.json({ success: true });
  } catch {
    if (connection) await connection.rollback();
    res.status(500).json({ success: false, message: 'Banner order could not be saved.' });
  } finally { connection?.release(); }
});
router.post('/', protect, adminOnly, async (req, res) => {
  let fields;
  try { fields = validateBanner(req.body); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const keys = Object.keys(fields);
    const [result] = await pool.query(`INSERT INTO banners (${keys.map(key => `\`${key}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(fields));
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, banner: format(rows[0]) });
  } catch { res.status(500).json({ success: false, message: 'Banner could not be saved.' }); }
});
router.put('/:id', protect, adminOnly, async (req, res) => {
  let fields;
  try { fields = validateBanner(req.body, true); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const [result] = await pool.query(`UPDATE banners SET ${Object.keys(fields).map(key => `\`${key}\` = ?`).join(',')} WHERE id = ?`, [...Object.values(fields), req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Banner not found.' });
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    res.json({ success: true, banner: format(rows[0]) });
  } catch { res.status(500).json({ success: false, message: 'Banner could not be updated.' }); }
});
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Banner not found.' });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, message: 'Banner could not be deleted.' }); }
});
export default router;
