// Uses only the disposable database created by runIsolatedDbTests.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import settingsRoutes from '../routes/settingsRoutes.js';
import operationsRoutes from '../routes/operationsRoutes.js';
import orderRoutes from '../routes/orderRoutes.js';
import { ensureStoreSettingsSchema, readStoreSettings } from '../utils/storeSettings.js';
import { getJwtSecret } from '../config/jwt.js';

test('admin settings persist across processes and feed actual quotes, orders and inventory', { skip: process.env.RUN_DB_TESTS !== '1' || !/^shophub_test_[a-f0-9]{24}$/.test(process.env.DB_NAME || '') }, async t => {
  const original = await readStoreSettings(pool);
  t.after(async () => { await pool.query('UPDATE store_settings SET settings=? WHERE id=1', [JSON.stringify(original)]); await pool.end(); });
  const [admin] = await pool.query("INSERT INTO users (name,email,password,role) VALUES ('Settings admin','settings-admin@example.invalid','fixture','admin')");
  const [customer] = await pool.query("INSERT INTO users (name,email,password,role) VALUES ('Settings customer','settings-customer@example.invalid','fixture','user')");
  const [product] = await pool.query("INSERT INTO products (name,sku,price,stock,stock_quantity,image) VALUES ('Settings product','SETTINGS-TEST',1000,10,10,'/shirt.jpg')");
  const app = express(); app.use(express.json()); app.use('/settings', settingsRoutes); app.use('/operations', operationsRoutes); app.use('/orders', orderRoutes);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const adminToken = jwt.sign({ id: admin.insertId }, getJwtSecret());
  const customerToken = jwt.sign({ id: customer.insertId, role: 'admin' }, getJwtSecret());
  const request = async (path, method = 'GET', body, token = adminToken) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  };
  await t.test('admin reads settings; customer and unauthenticated requests cannot administer them', async () => {
    assert.equal((await request('/settings')).status, 200);
    for (const method of ['GET', 'PATCH']) {
      assert.equal((await request('/settings', method, method === 'PATCH' ? { storeName: 'Hijacked' } : undefined, customerToken)).status, 403);
      assert.equal((await request('/settings', method, method === 'PATCH' ? { storeName: 'Hijacked' } : undefined, null)).status, 401);
    }
    const publicInfo = await request('/settings/public', 'GET', undefined, null);
    assert.equal(publicInfo.status, 200); assert.equal(publicInfo.data.settings.lowStockThreshold, undefined);
  });
  await t.test('invalid updates are rejected atomically', async () => {
    assert.equal((await request('/settings', 'PATCH', { storeName: 'Not saved', currency: 'USD' })).status, 400);
    assert.equal((await request('/settings')).data.settings.storeName, original.storeName);
  });
  await t.test('valid update survives schema readiness and a new Node process', async () => {
    const result = await request('/settings', 'PATCH', { storeName: 'Updated store', logo: '/updated-logo.png', contactEmail: 'contact@example.invalid', shippingFee: 350, freeShippingAbove: 1500, lowStockThreshold: 12 });
    assert.equal(result.status, 200);
    await ensureStoreSettingsSchema(pool);
    const restarted = spawnSync(process.execPath, ['--input-type=module', '-e', "import pool from './config/db.js'; import { readStoreSettings } from './utils/storeSettings.js'; console.log(JSON.stringify(await readStoreSettings(pool))); await pool.end();"], { cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 10000 });
    assert.ifError(restarted.error); assert.equal(restarted.status, 0, restarted.stderr);
    assert.deepEqual(JSON.parse(restarted.stdout.trim()), result.data.settings);
  });
  await t.test('saved rules reach quote, stored order, and inventory with product overrides', async () => {
    const items = [{ id: product.insertId, quantity: 1, price: 1 }];
    const quote = (await request('/operations/quote', 'POST', { items }, customerToken)).data.quote;
    assert.equal(quote.shipping, 350); assert.equal(quote.grandTotal, 1350); assert.equal(quote.currency, 'PKR');
    const placed = await request('/orders', 'POST', { items, totalAmount: quote.grandTotal, paymentMethod: 'Cash on Delivery', customer: { name: 'Customer', email: 'settings-customer@example.invalid', address: 'Test address' } }, customerToken);
    assert.equal(placed.status, 201, placed.data.message);
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id=?', [placed.data.orderId]);
    assert.equal(Number(order.shipping_amount), 350); assert.equal(Number(order.total_amount), quote.grandTotal);
    const inventory = (await request('/operations/inventory')).data.products.find(p => p.id === product.insertId);
    assert.equal(Number(inventory.low_stock_threshold), 12);
    await pool.query('INSERT INTO inventory_settings (product_id,low_stock_threshold) VALUES (?,3)', [product.insertId]);
    const override = (await request('/operations/inventory')).data.products.find(p => p.id === product.insertId);
    assert.equal(Number(override.low_stock_threshold), 3);
  });
  await t.test('social and SEO changes persist and reach the public storefront', async () => {
    const update = { facebook: 'https://facebook.com/test-shop', instagram: '', tiktok: 'https://tiktok.com/@test-shop', metaTitle: 'Test shop', metaDescription: 'A saved description', metaKeywords: 'clothing' };
    assert.equal((await request('/settings', 'PATCH', update)).status, 200);
    const saved = (await request('/settings/public', 'GET', undefined, null)).data.settings;
    for (const [key, value] of Object.entries(update)) assert.equal(saved[key], value);
    assert.equal((await request('/settings', 'PATCH', { facebook: 'javascript:alert(1)' })).status, 400);
    assert.equal((await request('/settings')).data.settings.facebook, update.facebook);
  });
});
