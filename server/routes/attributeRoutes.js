import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { validateAttribute } from '../utils/attributeValidation.js';

const router = express.Router();
let schemaReady;
router.use(protect, adminOnly, async (req, res, next) => {
  try {
    schemaReady ||= pool.query(`CREATE TABLE IF NOT EXISTS product_attributes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      type VARCHAR(10) NOT NULL,
      attribute_values JSON NOT NULL
    )`).catch(error => { schemaReady = undefined; throw error; });
    await schemaReady;
    next();
  } catch (error) { next(error); }
});

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM product_attributes ORDER BY id');
    res.json({ success: true, attributes: rows.map(row => ({ id: row.id, name: row.name, type: row.type, values: typeof row.attribute_values === 'string' ? JSON.parse(row.attribute_values) : row.attribute_values })) });
  } catch (error) { next(error); }
});

async function save(req, res, next) {
  let attribute;
  try { attribute = validateAttribute(req.body); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const values = [attribute.name, attribute.type, JSON.stringify(attribute.values)];
    const [result] = req.params.id
      ? await pool.query('UPDATE product_attributes SET name=?, type=?, attribute_values=? WHERE id=?', [...values, req.params.id])
      : await pool.query('INSERT INTO product_attributes (name,type,attribute_values) VALUES (?,?,?)', values);
    if (req.params.id && !result.affectedRows) return res.status(404).json({ success: false, message: 'Attribute not found.' });
    res.status(req.params.id ? 200 : 201).json({ success: true, attribute: { ...attribute, id: req.params.id ? Number(req.params.id) : result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'An attribute with this name already exists.' });
    next(error);
  }
}
router.post('/', save);
router.put('/:id', save);
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM product_attributes WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Attribute not found.' });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ success: false, message: 'This attribute is used by product variants and cannot be deleted.' });
    next(error);
  }
});
export default router;
