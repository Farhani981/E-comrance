import { getJwtSecret } from '../config/jwt.js';
// Opt-in local database test; fixture changes are rolled back.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/adminRoutes.js';
import productRouter from '../routes/productRoutes.js';
import { inventoryReport } from '../utils/inventoryReport.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';

test('purchase variants: receive, edit, reject over-reversal, delete', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  await ensureVariantSchema();
  const db = await pool.getConnection();
  const query = pool.query, getConnection = pool.getConnection;
  let server;
  try {
    await db.beginTransaction();
    const stamp = Date.now();
    const [admin] = await db.query("INSERT INTO users(name,email,password,role) VALUES('Purchase test',?,'test','admin')", [`purchase-${stamp}@example.invalid`]);
    const [product] = await db.query("INSERT INTO products(name,sku,price,stock,stock_quantity,has_variants) VALUES('Purchase test',?,100,10,10,TRUE)", [`P-${stamp}`]);
    const ids = [];
    for (const suffix of ['A','B']) {
      const [v] = await db.query("INSERT INTO product_variants(product_id,combination_hash,options,sku,image_url,price,stock_quantity,is_active) VALUES(?,?,?,?,'/test.jpg',100,5,TRUE)", [product.insertId, suffix, '[]', `${stamp}-${suffix}`]);
      ids.push(v.insertId);
    }
    pool.query = db.query.bind(db);
    pool.getConnection = async () => ({ query: db.query.bind(db), beginTransaction: () => db.query('SAVEPOINT purchase_test'), commit: () => db.query('RELEASE SAVEPOINT purchase_test'), rollback: () => db.query('ROLLBACK TO SAVEPOINT purchase_test'), release() {} });
    const app = express(); app.use(express.json()); app.use(router); app.use('/products', productRouter);
    server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
    const token = jwt.sign({ id: admin.insertId }, getJwtSecret());
    const api = async (path, method, body) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }, ...(body ? {body:JSON.stringify(body)} : {}) });
      return { status:r.status, ...await r.json() };
    };
    const item = (index, quantity) => ({ product_id:product.insertId, product_variant_id:ids[index], quantity, cost_price:50 });
    const body = { invoice_no:`TEST-${stamp}`, purchase_date:'2026-09-11', paid_amount:0, items:[item(0,3),item(1,2)] };
    const stock = async () => { const [rows] = await db.query('SELECT stock_quantity FROM product_variants WHERE product_id=? ORDER BY id',[product.insertId]);return rows.map(r=>r.stock_quantity); };
    const created = await api('/purchases','POST',body);
    assert.equal(created.status,201,JSON.stringify(created));
    assert.deepEqual(await stock(),[8,7]);
    const repeat = await api('/purchases','POST',{...body,invoice_no:body.invoice_no+'-REPEAT',items:[item(0,2)]});
    assert.equal(repeat.status,201,JSON.stringify(repeat));
    assert.deepEqual(await stock(),[10,7]);
    const report = (await inventoryReport(db)).filter(p=>p.id===product.insertId);
    assert.equal(report.length,1,'Repeat supplier purchases stay in the same inventory row');
    assert.equal(Number(report[0].stock),17);
    assert.equal(Number(report[0].purchased_units),7);
    const storefront = await api('/products/'+product.insertId,'GET');
    assert.equal(Number(storefront.product.stock),17,'Products and inventory expose the same stock');
    assert.equal(Number(storefront.product.variants.find(v=>v.id===ids[0]).stockQuantity),10);
    assert.equal((await api('/purchases/'+repeat.purchaseId,'DELETE')).status,200);
    assert.deepEqual(await stock(),[8,7]);
    const path = `/purchases/${created.purchaseId}`;
    const listing = await api('/purchases','GET');
    assert.deepEqual(listing.purchases.find(p=>p.id===created.purchaseId).items.map(i=>i.product_variant_id),ids);
    const edited = await api(path,'PUT',{...body,items:[item(0,4)]});
    assert.equal(edited.status,200,JSON.stringify(edited));
    assert.deepEqual(await stock(),[9,5]);
    await db.query('UPDATE product_variants SET stock_quantity=1 WHERE id=?',[ids[0]]);
    assert.notEqual((await api(path,'DELETE')).status,200);
    assert.deepEqual(await stock(),[1,5]);
    await db.query('UPDATE product_variants SET stock_quantity=9 WHERE id=?',[ids[0]]);
    assert.equal((await api(path,'DELETE')).status,200);
    assert.deepEqual(await stock(),[5,5]);
    assert.notEqual((await api('/purchases','POST',{...body,items:[{product_id:product.insertId,quantity:1,cost_price:50}]})).status,201);
    await db.query('UPDATE products SET deleted_at=NOW() WHERE id=?',[product.insertId]);
    assert.equal((await inventoryReport(db)).some(p=>p.id===product.insertId),false,'Deleted products do not inflate inventory');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    pool.query=query;pool.getConnection=getConnection;
    await db.rollback();db.release();await pool.end();
  }
});
