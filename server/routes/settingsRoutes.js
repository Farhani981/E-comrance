import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { readStoreSettings, validateSettings, publicStoreInfo } from '../utils/storeSettings.js';
const router = express.Router();
const failure = (res, error) => res.status(error.status || 500).json({ success: false, message: error.status === 400 ? error.message : 'Store settings are unavailable. Please try again.' });
// Explicit public subset for storefront branding/contact/shipping information.
router.get('/public', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json({ success: true, settings: publicStoreInfo(await readStoreSettings(pool)) }); }
  catch (error) { failure(res, error); }
});
router.use(protect, adminOnly);
router.get('/', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json({ success: true, settings: await readStoreSettings(pool) }); }
  catch (error) { failure(res, error); }
});
router.patch('/', async (req, res) => {
  let connection;
  try {
    const changes = validateSettings(req.body);
    connection = await pool.getConnection(); await connection.beginTransaction();
    const current = await readStoreSettings(connection, true);
    const settings = { ...current, ...changes };
    await connection.query('UPDATE store_settings SET settings=? WHERE id=1', [JSON.stringify(settings)]);
    await connection.commit();
    res.json({ success: true, settings });
  } catch (error) {
    if (connection) await connection.rollback();
    failure(res, error);
  } finally { connection?.release(); }
});
export default router;
