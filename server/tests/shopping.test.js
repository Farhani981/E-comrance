import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/shoppingRoutes.js';
import { hydrateCart, cartReference, consumePurchasedCart } from '../utils/shopping.js';
import { readGuest, guestBatch } from '../../my-app/src/utils/shopping.js';

test('guest storage survives reload and merge retries preserve the same receipt', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  storage.setItem('cart', JSON.stringify([{ id: 1, quantity: 2, price: 0, stock: 999 }]));
  assert.equal(readGuest(storage, 'cart')[0].quantity, 2);
  const first = guestBatch(storage, 'cart', 'cart');
  assert.deepEqual(guestBatch(storage, 'cart', 'cart'), first);
  assert.deepEqual(first.items, [{ id: 1, quantity: 2, productVariantId: null }]);
  storage.setItem('cart', 'invalid'); assert.deepEqual(readGuest(storage, 'cart'), []);
});
test('merge validates quantities, deduplicates, clamps stock and removes unavailable variants', () => {
  const p = { id: 1, name: 'Shirt', price: 100, stock: 3, status: 'Active', attributes: [], variants: [] };
  const result = hydrateCart([{ id: 1, quantity: 2 }, { id: 1, quantity: 2, price: 0 }, null, { id: 1, quantity: 1, productVariantId: 44 }], [p]);
  assert.equal(result.items.length, 1); assert.equal(result.items[0].quantity, 3); assert.equal(result.items[0].price, 100);
  assert.equal(hydrateCart([{ id: 1, quantity: 1 }], [{ ...p, stock: 0 }]).items.length, 0);
  for (const quantity of [0, -1, 1.5, '2']) assert.throws(() => cartReference({ id: 1, quantity }));
});
test('variant merge uses current SKU, sale price and variant stock', () => {
  const p = { id: 2, name: 'Variant shirt', price: 999, stock: 10, hasVariants: true, attributes: [], variants: [{ id: 7, isActive: true, stockQuantity: 2, price: 150, salePrice: 125, sku: 'REAL-SKU', options: [] }] };
  const result = hydrateCart([{ id: 2, productVariantId: 7, quantity: 5, price: 1, sku: 'FAKE' }], [p]);
  assert.equal(result.items[0].quantity, 2); assert.equal(result.items[0].price, 125); assert.equal(result.items[0].sku, 'REAL-SKU');
  assert.equal(hydrateCart(result.refs, [{ ...p, variants: [{ ...p.variants[0], isActive: false }] }]).items.length, 0);
});
test('authenticated shopping persists and remains isolated by verified user', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  assert.match(process.env.DB_NAME, /^shophub_test_[a-f0-9]{24}$/);
  t.after(() => pool.end());
  const [u] = await pool.query("INSERT INTO users (name,email,password) VALUES ('Shopping',?,'unused')", [`${randomUUID()}@example.invalid`]);
  const [other] = await pool.query("INSERT INTO users (name,email,password) VALUES ('Other',?,'unused')", [`${randomUUID()}@example.invalid`]);
  const [p] = await pool.query("INSERT INTO products (name,price,stock,status) VALUES ('Shopping shirt',100,3,'Active')");
  const app = express(); app.use(express.json()); app.use('/shopping', router);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = id => jwt.sign({ id }, process.env.JWT_SECRET);
  const request = async (kind, body, user = u.insertId) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/shopping/${kind}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, ...(await res.json()) };
  };
  await t.test('authenticated add uses current price and duplicate merge is retry safe', async () => {
    assert.equal((await request('cart', { action: 'add', item: { id: p.insertId, quantity: 1, price: 0 } })).items[0].price, 100);
    const body = { action: 'merge', mergeId: randomUUID(), items: [{ id: p.insertId, quantity: 9 }, null] };
    assert.equal((await request('cart', body)).items[0].quantity, 3);
    await request('cart', { action: 'set', item: { id: p.insertId, quantity: 2 } });
    assert.equal((await request('cart', body)).items[0].quantity, 2);
  });
  await t.test('overstock, invalid quantity and unavailable variant are rejected', async () => {
    for (const patch of [{ quantity: 4 }, { quantity: 0 }, { quantity: 1.2 }, { quantity: 1, productVariantId: 999999 }]) assert.equal((await request('cart', { action: 'set', item: { id: p.insertId, ...patch } })).status, 400);
    assert.equal((await request('cart')).items[0].quantity, 2);
  });
  await t.test('logout/new login retains cart and cannot access another account', async () => {
    assert.equal((await request('cart', undefined, null)).status, 401);
    assert.equal((await request('cart')).items.length, 1);
    assert.equal((await request('cart', { action: 'load', userId: u.insertId }, other.insertId)).items.length, 0);
  });
  await t.test('wishlist persists, deduplicates and is private', async () => {
    const body = { action: 'merge', mergeId: randomUUID(), items: [p.insertId, p.insertId] };
    assert.equal((await request('wishlist', body)).items.length, 1);
    assert.equal((await request('wishlist')).items.length, 1);
    assert.equal((await request('wishlist', undefined, other.insertId)).items.length, 0);
  });
  await t.test('checkout consumes only purchased quantity and unavailable stock is removed on load', async () => {
    await consumePurchasedCart(pool, u.insertId, [{ id: p.insertId, quantity: 1 }]);
    assert.equal((await request('cart')).items[0].quantity, 1);
    await pool.query('UPDATE products SET stock=0 WHERE id=?', [p.insertId]);
    assert.equal((await request('cart')).items.length, 0);
    assert.equal((await request('cart', { action: 'add', item: { id: p.insertId, quantity: 1 } })).status, 400);
  });
});
