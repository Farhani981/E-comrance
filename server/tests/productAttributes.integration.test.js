import { getJwtSecret } from '../config/jwt.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import productRouter from '../routes/productRoutes.js';

test('product attributes persist on create/edit, reject invalid values, and clear', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const db = await pool.getConnection();
  const originalQuery = pool.query;
  const originalGetConnection = pool.getConnection;
  let server;
  try {
    const app = express();
    app.use(express.json());
    app.use('/products', productRouter);
    server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}/products`;
    // Initialize the additive schema before opening the rollback-only fixture transaction.
    assert.equal((await fetch(base)).status, 200);
    await db.beginTransaction();
    pool.query = db.query.bind(db);
    pool.getConnection = async () => ({ query: db.query.bind(db), beginTransaction: () => db.query('SAVEPOINT product_save'), commit: () => db.query('RELEASE SAVEPOINT product_save'), rollback: () => db.query('ROLLBACK TO SAVEPOINT product_save'), release() {} });
    const stamp = Date.now();
    const [admin] = await db.query("INSERT INTO users(name,email,password,role) VALUES('Attribute test',?,'test','admin')", [`attributes-${stamp}@example.invalid`]);
    const [attribute] = await db.query("INSERT INTO product_attributes(name,type,attribute_values) VALUES(?,'text',?)", [`Test size ${stamp}`, JSON.stringify([{ label: 'M' }, { label: 'L' }])]);
    const [categories] = await db.query('SELECT s.name AS subcategory,c.name AS category_name FROM catalog_nodes s JOIN catalog_nodes c ON s.parent_id=c.id WHERE c.parent_id IS NULL LIMIT 1');
    const fields = { ...categories[0], name: 'Attribute fixture', sku: `ATTR-${stamp}`, price: 100, stock: 1, attributes: [{ id: attribute.insertId, values: [{ label: 'M' }] }] };
    const api = async (path = '', method = 'GET', body) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt.sign({ id: admin.insertId }, getJwtSecret())}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, ...await response.json() };
    };
    const created = await api('', 'POST', fields);
    assert.equal(created.status, 201, JSON.stringify(created));
    const path = '/' + created.productId;
    assert.equal((await api(path)).product.attributes[0].values[0].label, 'M');
    assert.equal((await api(path, 'PUT', { ...fields, attributes: [{ id: attribute.insertId, values: [{ label: 'L' }] }] })).status, 200);
    assert.equal((await api(path)).product.attributes[0].values[0].label, 'L');
    assert.equal((await api(path, 'PUT', { ...fields, attributes: [{ id: attribute.insertId, values: [{ label: 'Invalid' }] }] })).status, 400);
    assert.equal((await api(path)).product.attributes[0].values[0].label, 'L');
    const { attributes, ...withoutAttributes } = fields;
    assert.equal((await api(path, 'PUT', withoutAttributes)).status, 200);
    assert.equal((await api(path)).product.attributes[0].values[0].label, 'L');
    assert.equal((await api(path, 'PUT', { ...fields, attributes: [] })).status, 200);
    assert.deepEqual((await api(path)).product.attributes, []);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
    await db.rollback();
    db.release();
    await pool.end();
  }
});
