import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';
import { cartReference, shoppingKey, parseList, shoppingProducts, hydrateCart } from '../utils/shopping.js';
const router = express.Router(); router.use(protect);
const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
for (const kind of ['cart', 'wishlist']) {
  const handler = async (req, res) => {
    let db;
    try {
      const action = req.method === 'GET' ? 'load' : req.body?.action;
      if (!['load', 'merge', 'add', 'set', 'remove', 'clear'].includes(action) || (kind === 'wishlist' && action === 'set')) invalid('Invalid shopping action.');
      if (action === 'merge' && (!Array.isArray(req.body.items) || req.body.items.length > 200 || !/^[a-f0-9-]{36}$/i.test(req.body.mergeId || ''))) invalid('Invalid guest merge.');
      db = await pool.getConnection(); await db.beginTransaction();
      await db.query('SELECT id FROM users WHERE id=? FOR UPDATE', [req.user.id]);
      await db.query("INSERT IGNORE INTO customer_shopping (user_id,cart,wishlist) VALUES (?,'[]','[]')", [req.user.id]);
      const [[state]] = await db.query(`SELECT ${kind} AS items FROM customer_shopping WHERE user_id=?`, [req.user.id]);
      let refs = parseList(state.items), merge = false;
      if (action === 'merge') {
        const [[receipt]] = await db.query('SELECT merge_id FROM shopping_merge_receipts WHERE user_id=? AND kind=? AND merge_id=?', [req.user.id, kind, req.body.mergeId]);
        merge = !receipt;
        if (merge) refs = [...refs, ...req.body.items];
      }
      if (action === 'clear') refs = [];
      let changed;
      if (['add', 'set', 'remove'].includes(action)) {
        if (kind === 'cart') {
          changed = cartReference({ ...req.body.item, quantity: action === 'remove' ? 1 : req.body.item?.quantity });
          const existing = refs.find(item => shoppingKey(item) === shoppingKey(changed));
          refs = refs.filter(item => shoppingKey(item) !== shoppingKey(changed));
          if (action !== 'remove') refs.push({ ...changed, quantity: changed.quantity + (action === 'add' ? existing?.quantity || 0 : 0) });
        } else {
          const id = req.body.item?.id;
          if (!Number.isSafeInteger(id) || id < 1) invalid('Invalid product ID.');
          refs = refs.filter(value => value !== id);
          if (action !== 'remove') refs.push(id);
          changed = { id };
        }
      }
      const ids = kind === 'cart' ? refs.map(item => item?.id).filter(Number.isSafeInteger) : refs.filter(Number.isSafeInteger);
      if (new Set(kind === 'cart' ? refs.map(shoppingKey) : ids).size > 200) invalid('Save at most 200 items.');
      const products = await shoppingProducts(db, ids);
      let items, notices = [];
      if (kind === 'cart') {
        const normalized = hydrateCart(refs, products);
        if (changed && action !== 'remove') {
          const requested = refs.find(item => shoppingKey(item) === shoppingKey(changed));
          const actual = normalized.refs.find(item => shoppingKey(item) === shoppingKey(changed));
          if (!actual || actual.quantity !== requested.quantity) invalid('This item is unavailable or the requested quantity exceeds stock.');
        }
        refs = normalized.refs; items = normalized.items; notices = normalized.notices;
      } else {
        if (changed && action === 'add' && !products.some(p => p.id === changed.id)) invalid('Product is unavailable.');
        refs = [...new Set(ids)].filter(id => products.some(p => p.id === id));
        items = refs.map(id => { const p = products.find(p => p.id === id); return { ...p, title: p.name, price: Number(p.price), originalPrice: Number(p.original_price || 0) }; });
      }
      await db.query(`UPDATE customer_shopping SET ${kind}=? WHERE user_id=?`, [JSON.stringify(refs), req.user.id]);
      if (merge) await db.query('INSERT INTO shopping_merge_receipts (user_id,kind,merge_id) VALUES (?,?,?)', [req.user.id, kind, req.body.mergeId]);
      await db.commit(); res.set('Cache-Control', 'no-store').json({ success: true, items, notices });
    } catch (error) {
      if (db) await db.rollback();
      res.status(error.status || 500).json({ success: false, message: error.status === 400 ? error.message : 'Unable to synchronize shopping items. Please try again.' });
    } finally { db?.release(); }
  };
  router.get(`/${kind}`, handler); router.post(`/${kind}`, handler);
}
export default router;
