// Real Express routes, bcrypt and JWT; isolated SQL boundary, no database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import authRoutes from '../routes/authRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import categoryRoutes from '../routes/categoryRoutes.js';
import collectionRoutes from '../routes/collectionRoutes.js';
import bannerRoutes from '../routes/bannerRoutes.js';
import operationsRoutes from '../routes/operationsRoutes.js';

test('public registration and database-backed administrator authorization', async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const users = new Map();
  const password = 'Registration-test-password-42';
  const admin = { id: 1, name: 'Existing administrator', email: 'admin@example.invalid', role: 'admin', password: await bcrypt.hash(password, 10) };
  users.set(admin.id, admin);
  let nextId = 2;
  let adminReads = 0;
  let loginFailure = false;
  const signing = t.mock.method(jwt, 'sign');
  t.mock.method(pool, 'query', async (sql, values = []) => {
    if (sql === 'SELECT id FROM users WHERE email = ?') {
      return [[...users.values()].filter(user => user.email === values[0]).map(({ id }) => ({ id }))];
    }
    if (sql === 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)') {
      const [name, email, hash, role] = values;
      const id = nextId++;
      users.set(id, { id, name, email, password: hash, role });
      return [{ insertId: id }];
    }
    if (sql === 'SELECT * FROM users WHERE email = ?') {
      if (loginFailure) throw new Error('SQL connection details and credentials must stay private');
      return [[...users.values()].filter(user => user.email === values[0])];
    }
    if (sql.startsWith('SELECT id, name, email, role') && sql.endsWith('FROM users WHERE id = ?')) {
      const user = users.get(values[0]);
      return [user ? [{ id: user.id, name: user.name, email: user.email, role: user.role }] : []];
    }
    if (sql.includes('FROM users u') && sql.includes("WHERE u.role = 'user'")) {
      adminReads++;
      return [[]];
    }
    throw new Error(`Unexpected SQL in auth regression test: ${sql}`);
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/collections', collectionRoutes);
  app.use('/api/banners', bannerRoutes);
  app.use('/api/operations', operationsRoutes);
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = async (path, { method = 'GET', body, token } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };
  const sign = claims => jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '5m' });
  let customerToken, customerId;

  for (const role of [undefined, 'admin', 'administrator', 'superadmin', 'ADMIN', ['admin'], { role: 'admin' }]) {
    await t.test(`registration ignores role ${JSON.stringify(role) ?? '(omitted)'}`, async () => {
      const result = await request('/api/auth/register?role=admin&userId=1', {
        method: 'POST',
        body: { name: 'Registration test', email: `signup-${nextId}@example.invalid`, password, ...(role === undefined ? {} : { role }), isAdmin: true, id: admin.id },
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.user.role, 'user');
      const stored = users.get(result.data.user.id);
      assert.equal(stored.role, 'user', 'SQL insert must persist the safe role');
      assert.notEqual(stored.id, admin.id);
      assert.notEqual(stored.password, password);
      assert.equal(await bcrypt.compare(password, stored.password), true);
      const claims = jwt.verify(result.data.token, process.env.JWT_SECRET);
      assert.equal(claims.id, stored.id);
      assert.equal(claims.role, undefined);
      assert.equal((await request('/api/admin/customers', { token: result.data.token })).status, 403);
      customerToken = result.data.token;
      customerId = stored.id;
    });
  }
  await t.test('existing customer registration validation is preserved', async () => {
    const before = users.size;
    assert.equal((await request('/api/auth/register', { method: 'POST', body: { name: 'Missing fields', role: 'admin' } })).status, 400);
    assert.equal((await request('/api/auth/register', { method: 'POST', body: { name: 'Duplicate', email: admin.email, password, role: 'admin' } })).status, 400);
    assert.equal(users.size, before);
    assert.equal(users.get(admin.id).role, 'admin');
  });
  await t.test('customer login and current-user response remain normal users', async () => {
    const result = await request('/api/auth/login', { method: 'POST', body: { email: users.get(customerId).email, password, role: 'admin' } });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.role, 'user');
    assert.equal(result.data.user.password, undefined);
    assert.equal((await request('/api/admin/customers', { token: result.data.token })).status, 403);
    assert.equal((await request('/api/auth/me', { token: result.data.token })).data.user.role, 'user');
  });
  await t.test('existing admin login and protected admin access still work', async () => {
    const result = await request('/api/auth/login', { method: 'POST', body: { email: admin.email, password } });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.role, 'admin');
    assert.equal(result.data.user.password, undefined);
    assert.equal(jwt.verify(result.data.token, process.env.JWT_SECRET).id, admin.id);
    assert.equal((await request('/api/admin/customers', { token: result.data.token })).status, 200);
    assert.equal(adminReads, 1);
    const signup = await request('/api/auth/register', { method: 'POST', token: result.data.token, body: { name: 'Public signup', email: 'admin-caller@example.invalid', password, role: 'admin' } });
    assert.equal(signup.data.user.role, 'user');
    assert.equal(users.get(signup.data.user.id).role, 'user');
  });
  await t.test('database role overrides signed admin claims and request state', async () => {
    const token = sign({ id: customerId, role: 'admin', isAdmin: true, user: { id: admin.id, role: 'admin' } });
    assert.equal((await request('/api/auth/me?role=admin', { token })).data.user.role, 'user');
    assert.equal((await request('/api/admin/customers?role=admin&id=1', { token })).status, 403);
    assert.equal((await request(`/api/admin/customers/${admin.id}`, { method: 'PUT', token, body: { role: 'admin', user: admin, name: 'Changed', email: 'changed@example.invalid' } })).status, 403);
    assert.equal(adminReads, 1);
  });
  await t.test('unsigned browser/demo state and tampered JWT identity are rejected', async () => {
    const [header, payload, signature] = customerToken.split('.');
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), id: admin.id, role: 'admin' })).toString('base64url');
    for (const token of ['demo-token-admin', JSON.stringify({ id: admin.id, role: 'admin' }), `${header}.${tampered}.${signature}`, jwt.sign({ id: admin.id }, randomBytes(32).toString('hex'))]) {
      assert.equal((await request('/api/admin/customers', { token })).status, 401);
    }
    assert.equal((await request('/api/admin/customers?role=admin')).status, 401);
  });
  await t.test('customer denied across admin management API families', async () => {
    for (const [method, path] of [
      ['GET', '/api/admin/customers'], ['GET', '/api/admin/stats'], ['GET', '/api/admin/suppliers'],
      ['GET', '/api/admin/purchases'], ['POST', '/api/categories'], ['POST', '/api/collections'],
      ['GET', '/api/banners/admin'], ['POST', '/api/banners'], ['GET', '/api/operations/inventory'],
      ['GET', '/api/operations/reviews'], ['GET', '/api/operations/returns'], ['POST', '/api/operations/promotions'],
    ]) {
      const result = await request(path, { method, token: customerToken, ...(method === 'POST' ? { body: { role: 'admin', userId: admin.id } } : {}) });
      assert.equal(result.status, 403, `${method} ${path}`);
    }
    assert.equal(adminReads, 1, 'denied requests must not execute admin handler SQL');
  });
  await t.test('wrong passwords including former shortcuts never sign or return a JWT', async () => {
    const before = signing.mock.callCount();
    for (const attemptedPassword of ['wrong-password', 'admin', 'admin123', 'password123']) {
      const result = await request('/api/auth/login', { method: 'POST', body: { email: admin.email, password: attemptedPassword } });
      assert.equal(result.status, 401);
      assert.deepEqual(result.data, { success: false, message: 'Invalid email or password' });
    }
    assert.equal(signing.mock.callCount(), before);
  });
  await t.test('unknown admin email has the same safe failure response and no JWT', async () => {
    const before = signing.mock.callCount();
    const result = await request('/api/auth/login', { method: 'POST', body: { email: 'unknown-admin@example.invalid', password } });
    assert.equal(result.status, 401);
    assert.deepEqual(result.data, { success: false, message: 'Invalid email or password' });
    assert.equal(signing.mock.callCount(), before);
  });
  await t.test('empty and malformed login credentials fail validation without signing', async () => {
    const before = signing.mock.callCount();
    for (const body of [undefined, {}, { email: admin.email }, { password }, { email: '', password: '' }, { email: ' ', password }, { email: admin.email, password: '' }, { email: [admin.email], password }, { email: admin.email, password: { value: password } }]) {
      const result = await request('/api/auth/login', { method: 'POST', body });
      assert.equal(result.status, 400);
      assert.deepEqual(result.data, { success: false, message: 'Email and password are required' });
    }
    assert.equal(signing.mock.callCount(), before);
  });
  await t.test('internal login errors never expose database details or sign a JWT', async () => {
    const before = signing.mock.callCount();
    loginFailure = true;
    try {
      const result = await request('/api/auth/login', { method: 'POST', body: { email: admin.email, password } });
      assert.equal(result.status, 500);
      assert.deepEqual(result.data, { success: false, message: 'Login is temporarily unavailable. Please try again.' });
      assert.equal(signing.mock.callCount(), before);
    } finally { loginFailure = false; }
  });
  await t.test('expired configured-secret token is rejected', async () => {
    const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await request('/api/admin/customers', { token })).status, 401);
  });
  await t.test('demoted administrator loses access despite a previously issued token', async () => {
    const token = sign({ id: admin.id, role: 'admin' });
    users.set(admin.id, { ...admin, role: 'user' });
    assert.equal((await request('/api/admin/customers', { token })).status, 403);
  });
});
