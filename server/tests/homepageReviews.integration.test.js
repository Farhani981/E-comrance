import { getJwtSecret } from '../config/jwt.js';
// Opt-in: uses the configured local database, with all fixture writes rolled back.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/operationsRoutes.js';

test('homepage reviews require admin approval and use real totals', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  const connection = await pool.getConnection();
  const originalQuery = pool.query, originalGetConnection = pool.getConnection;
  let server;
  await connection.beginTransaction();
  try {
    const suffix = `${Date.now()}-${Math.random()}`;
    const [admin] = await connection.query("INSERT INTO users (name, email, password, role) VALUES ('Operations test admin', ?, 'fixture-only', 'admin')", [`admin-${suffix}@example.invalid`]);
    const [customer] = await connection.query("INSERT INTO users (name, email, password, role) VALUES ('Operations test customer', ?, 'fixture-only', 'user')", [`customer-${suffix}@example.invalid`]);
    const [product] = await connection.query("INSERT INTO products (name, sku, price, stock, stock_quantity) VALUES ('Operations test product', ?, 1000, 10, 10)", [`TEST-${suffix}`]);
    pool.query = connection.query.bind(connection);
    pool.getConnection = async () => ({
      query: connection.query.bind(connection),
      beginTransaction: () => connection.query('SAVEPOINT operations_route'),
      commit: () => connection.query('RELEASE SAVEPOINT operations_route'),
      rollback: () => connection.query('ROLLBACK TO SAVEPOINT operations_route'),
      release: () => {},
    });
    const app = express(); app.use(express.json()); app.use('/api/operations', router);
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api/operations`;
    const token = id => jwt.sign({ id }, getJwtSecret());
    const api = async (path, method = 'GET', body, user = admin.insertId) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, ...await response.json() };
    };
    const homepageBefore = await api('/reviews/approved', 'GET', undefined, null);
    assert.equal(homepageBefore.success, true);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'POST', { rating: 5, comment: 'A review awaiting moderation', status: 'Approved' }, customer.insertId)).status, 201);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'GET', undefined, null)).reviews.length, 0);
    const review = (await api('/reviews')).reviews.find(r => r.product_id === product.insertId);
    assert.equal(review.status, 'Pending', 'Customers cannot approve their own submissions');
    assert.equal((await api('/reviews/approved', 'GET', undefined, null)).total, homepageBefore.total);
    assert.equal((await api(`/reviews/${review.id}`, 'PUT', { rating: 5, comment: 'Bypass', status: 'Approved' }, customer.insertId)).status, 403);
    assert.equal((await api(`/reviews/${review.id}`, 'PUT', { rating: 4, comment: 'Approved review', status: 'Approved' })).success, true);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'GET', undefined, null)).reviews[0].rating, 4);
    const published = await api('/reviews/approved', 'GET', undefined, null);
    assert.equal(published.total, homepageBefore.total + 1);
    assert.equal(published.reviews[0].id, review.id);
    assert.equal(published.reviews[0].comment, 'Approved review');
    assert.equal(published.reviews[0].product_name, 'Operations test product');
    assert.ok(Math.abs(published.averageRating - (homepageBefore.averageRating * homepageBefore.total + 4) / published.total) < 0.001);
    assert.equal(published.reviews[0].email, undefined, 'Public reviews do not expose email');
    await api(`/reviews/${review.id}`, 'PUT', { rating: 4, comment: 'Approved review', status: 'Rejected' });
    const rejected = await api('/reviews/approved', 'GET', undefined, null);
    assert.equal(rejected.total, homepageBefore.total);
    assert.ok(!rejected.reviews.some(r => r.id === review.id));
    await api(`/reviews/${review.id}`, 'PUT', { rating: 4, comment: 'Approved review', status: 'Approved' });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery; pool.getConnection = originalGetConnection;
    await connection.rollback(); connection.release(); await pool.end();
  }
});
