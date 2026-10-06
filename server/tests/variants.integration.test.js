import { getJwtSecret } from '../config/jwt.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/productRoutes.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';
import { quoteCart, changeStock } from '../utils/operations.js';

test('variant product API, rollback, stock, checkout and restoration', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  await ensureVariantSchema();
  const db = await pool.getConnection();
  const originalQuery = pool.query, originalGet = pool.getConnection;
  let server;
  try {
    await db.beginTransaction();
    pool.query = db.query.bind(db);
    pool.getConnection = async () => ({ query: db.query.bind(db), beginTransaction: () => db.query('SAVEPOINT variant_save'), commit: () => db.query('RELEASE SAVEPOINT variant_save'), rollback: () => db.query('ROLLBACK TO SAVEPOINT variant_save'), release() {} });
    const stamp = Date.now();
    const [admin] = await db.query("INSERT INTO users(name,email,password,role) VALUES('Variant fixture',?,'test','admin')", [`variant-${stamp}@example.invalid`]);
    const [attribute] = await db.query("INSERT INTO product_attributes(name,type,attribute_values) VALUES(?,'color',?)", [`Color ${stamp}`, JSON.stringify([{ label: 'Red', color: '#FF0000' }, { label: 'Blue', color: '#0000FF' }])]);
    const [categories] = await db.query('SELECT s.name AS subcategory,c.name AS category_name FROM catalog_nodes s JOIN catalog_nodes c ON s.parent_id=c.id WHERE c.parent_id IS NULL LIMIT 1');
    const fields = { ...categories[0], name: 'Variant fixture', sku: `BASE-${stamp}`, price: 100, stock: 999,
      attributes: [{ id: attribute.insertId, values: [{ label: 'Red' }, { label: 'Blue' }] }],
      variants: ['Red', 'Blue'].map((label, i) => ({ options: [{ attributeId: attribute.insertId, label }], sku: `V-${stamp}-${i}`, imageUrl: `/test-${label}.jpg`, price: '100.00', salePrice: i ? null : '80.00', stockQuantity: i ? 0 : 5, isActive: true })) };
    const app = express(); app.use(express.json()); app.use('/products', router);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const api = async (path = '', method = 'GET', body, authorized = true) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/products${path}`, { method, headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: `Bearer ${jwt.sign({ id: admin.insertId }, getJwtSecret())}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, ...await response.json() };
    };
    assert.equal((await api('', 'POST', fields, false)).status, 401);
    const created = await api('', 'POST', fields);
    assert.equal(created.status, 201, JSON.stringify(created));
    const id = created.productId, path = '/'+id;
    let product = (await api(path)).product;
    assert.equal(product.stock, 5, 'Stock is sum of variants, never base stock multiplied');
    assert.equal(Number(product.price), 80);
    assert.equal(product.variants.length, 2);
    const red = product.variants[0], blue = product.variants[1];
    const quote = await quoteCart(db, [{ id, productVariantId: red.id, quantity: 2, price: 1 }]);
    assert.equal(Number(quote.lines[0].price), 80);
    assert.equal(quote.lines[0].productVariantId, red.id);
    await assert.rejects(() => quoteCart(db, [{ id, quantity: 1 }]));
    await assert.rejects(() => quoteCart(db, [{ id, productVariantId: blue.id, quantity: 1 }]));
    await assert.rejects(() => quoteCart(db, [{ id, productVariantId: red.id, quantity: 3 }, { id, productVariantId: red.id, quantity: 3 }]));
    await changeStock(db, id, -2, 'Test order', admin.insertId, red.id);
    assert.equal((await api(path)).product.stock, 3);
    assert.equal((await api(path, 'PUT', { ...fields, variants: product.variants })).status, 409, 'Reject stale admin stock');
    await changeStock(db, id, 2, 'Test cancellation', admin.insertId, red.id);
    assert.equal((await api(path)).product.stock, 5);
    await assert.rejects(() => changeStock(db, id, -6, 'Oversell', admin.insertId, red.id));
    const invalid = await api(path, 'PUT', { ...fields, variants: [fields.variants[0], { ...fields.variants[1], sku: fields.variants[0].sku }] });
    assert.equal(invalid.status, 400);
    assert.equal((await api(path)).product.stock, 5);
    const duplicate = await api('', 'POST', { ...fields, sku: `OTHER-${stamp}` });
    assert.equal(duplicate.status, 409);
    const [[count]] = await db.query('SELECT COUNT(*) AS n FROM products WHERE sku=?', [`OTHER-${stamp}`]);
    assert.equal(count.n, 0, 'Duplicate SKU rolls back entire product');
    assert.equal((await api(path, 'PUT', { ...fields, variants: product.variants.map(v => ({ ...v, salePrice: '70.00' })) })).status, 200);
    product = (await api(path)).product;
    assert.equal(product.variants[0].id, red.id);
    assert.equal(Number(product.variants[0].salePrice), 70);
    assert.equal((await api(path, 'PUT', { ...fields, attributes: [{ id: attribute.insertId, values: [{ label: 'Red' }] }], variants: [product.variants[0]] })).status, 200);
    assert.equal((await api(path)).product.variants.find(v => v.id === blue.id).isActive, false);
    // A still-open editor may reuse a historical SKU for a changed color.
    await db.query('UPDATE product_attributes SET attribute_values=? WHERE id=?', [JSON.stringify([{ label: 'Red', color: '#FF0000' }, { label: 'Blue', color: '#0000FF' }, { label: 'Green', color: '#00FF00' }]), attribute.insertId]);
    const replacement = await api(path, 'PUT', { ...fields,
      attributes: [{ id: attribute.insertId, values: [{ label: 'Green' }] }],
      variants: [{ ...fields.variants[0], options: [{ attributeId: attribute.insertId, label: 'Green' }], imageUrl: '/new-green.jpg', stockQuantity: 2 }],
    });
    assert.equal(replacement.status, 200, JSON.stringify(replacement));
    const edited = (await api(path)).product;
    const green = edited.variants.find(v => v.options[0].label === 'Green');
    assert.ok(green);
    assert.equal(green.id, red.id, "Editing options keeps the original inventory ID");
    assert.equal(green.sku, red.sku, "Editing options keeps the original SKU");
    assert.equal(green.imageUrl, '/new-green.jpg');
    assert.equal(edited.stock, 2);
    assert.equal(edited.variants.length, 2, 'Editing does not insert a new inventory record');
    const imageEdit = await api(path, 'PUT', { ...fields,
      attributes: [{ id: attribute.insertId, values: [{ label: 'Green' }] }],
      variants: [{ ...green, imageUrl: '/edited-again.jpg' }],
    });
    assert.equal(imageEdit.status, 200, JSON.stringify(imageEdit));
    const reloaded = (await api(path)).product.variants.find(v => v.id === red.id);
    assert.equal(reloaded.sku, red.sku);
    assert.equal(reloaded.imageUrl, '/edited-again.jpg');
    assert.equal(reloaded.stockQuantity, 2);
    assert.equal((await api(path, 'DELETE', undefined, false)).status, 401);
    assert.equal((await api(path, 'DELETE')).status, 200, 'Products with variants can be removed');
    assert.equal((await api(path)).status, 404);
    assert.equal((await api()).products.some(p => p.id === id), false);
    const [[retained]] = await db.query('SELECT COUNT(*) AS n FROM product_variants WHERE product_id=?', [id]);
    assert.equal(retained.n, 2, 'Variant records remain available for historical invoices and orders');
    await changeStock(db, id, 1, 'Historical reversal after deletion', admin.insertId, red.id);
    await assert.rejects(() => quoteCart(db, [{ id, productVariantId: red.id, quantity: 1 }]), /out of stock/);
    assert.equal((await api(path, 'DELETE')).status, 404);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery; pool.getConnection = originalGet;
    await db.rollback(); db.release(); await pool.end();
  }
});
