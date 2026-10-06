import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import authRoutes from '../routes/authRoutes.js';
import { ensureProfileSchema } from '../utils/profile.js';

test('protected customer profile persists in SQL without changing protected fields', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
  const db = await pool.getConnection();
  t.after(async () => { db.destroy(); await pool.end(); });
  await db.query('CREATE TEMPORARY TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const password = 'Profile-regression-password';
  const hash = await bcrypt.hash(password, 10);
  await db.query("INSERT INTO users (id,name,email,password,role) VALUES (1,'First','first@example.invalid',?,'user'),(2,'Other','other@example.invalid',?,'user')", [hash, hash]);
  await ensureProfileSchema(db); await ensureProfileSchema(db);
  const [[existing]] = await db.query('SELECT * FROM users WHERE id=1');
  assert.equal(existing.name, 'First'); assert.equal(existing.password, hash);
  let failSave = false;
  t.mock.method(pool, 'query', async (sql, values) => {
    if (failSave && sql.startsWith('UPDATE users')) throw new Error('Private database diagnostics');
    return db.query(sql, values);
  });
  const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const request = async (method, body, path = '/me', credential = token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json().catch(() => ({})) };
  };
  await t.test('own profile is saved, read back after refresh, and returned on fresh login', async () => {
    const fields = { name: ' Updated Name ', email: 'UPDATED@example.invalid', phone: '+92 300 1234567', address: 'House 10\nMain Road', city: ' Lahore ' };
    const result = await request('PATCH', fields);
    assert.equal(result.status, 200);
    assert.equal(result.data.user.name, 'Updated Name');
    assert.equal(result.data.user.email, 'updated@example.invalid');
    assert.equal(result.data.user.city, 'Lahore');
    assert.equal(result.data.user.password, undefined);
    const [[stored]] = await db.query('SELECT * FROM users WHERE id=1');
    assert.equal(stored.address, fields.address);
    assert.equal(stored.phone, fields.phone);
    assert.equal(stored.role, 'user'); assert.equal(stored.password, hash);
    assert.deepEqual((await request('GET')).data.user, result.data.user);
    const login = await request('POST', { email: 'updated@example.invalid', password }, '/login', null);
    assert.equal(login.status, 200);
    assert.equal(login.data.user.phone, fields.phone);
    assert.equal(login.data.user.address, fields.address);
    assert.equal(login.data.user.city, 'Lahore');
    assert.equal(login.data.user.password, undefined);
  });
  await t.test('body/path/query identities cannot select another customer', async () => {
    assert.equal((await request('PATCH', { id: 2, name: 'Hijacked' })).status, 400);
    assert.equal((await request('PATCH', { name: 'Hijacked' }, '/me/2')).status, 404);
    const result = await request('PATCH', { city: 'Karachi' }, '/me?id=2&userId=2');
    assert.equal(result.data.user.id, 1);
    const [[other]] = await db.query('SELECT * FROM users WHERE id=2');
    assert.equal(other.name, 'Other'); assert.equal(other.city, '');
  });
  await t.test('protected and unknown fields reject the entire update', async () => {
    for (const field of ['role', 'permissions', 'isAdmin', 'password', 'password_hash', 'userId', 'id', 'status', 'created_at', 'unknown']) {
      assert.equal((await request('PATCH', { name: 'Do not save', [field]: 'admin' })).status, 400);
    }
    const [[stored]] = await db.query('SELECT * FROM users WHERE id=1');
    assert.equal(stored.name, 'Updated Name'); assert.equal(stored.role, 'user'); assert.equal(stored.password, hash);
  });
  await t.test('invalid fields and duplicate email reject without partial writes', async () => {
    for (const fields of [{}, [], { name: '' }, { name: 42 }, { name: 'a'.repeat(256) }, { name: 'Bad\x00Name' }, { email: 'invalid' }, { phone: 'abc' }, { phone: '12' }, { city: 'a'.repeat(101) }, { address: 'a'.repeat(1001) }, { address: {} }]) {
      assert.equal((await request('PATCH', fields)).status, 400, JSON.stringify(fields));
    }
    const conflict = await request('PATCH', { name: 'Do not save', email: 'other@example.invalid' });
    assert.equal(conflict.status, 409);
    assert.equal((await request('GET')).data.user.name, 'Updated Name');
  });
  await t.test('missing, invalid and forged JWTs cannot update any profile', async () => {
    for (const credential of [null, 'invalid', jwt.sign({ id: 2 }, randomBytes(32).toString('hex'))]) {
      assert.equal((await request('PATCH', { name: 'Hijacked' }, '/me', credential)).status, 401);
    }
  });
  await t.test('optional fields clear and omitted fields remain unchanged', async () => {
    const result = await request('PATCH', { phone: '', address: '', city: '' });
    assert.equal(result.status, 200);
    assert.equal(result.data.user.name, 'Updated Name');
    assert.equal(result.data.user.phone, ''); assert.equal(result.data.user.address, ''); assert.equal(result.data.user.city, '');
  });
  await t.test('server errors return a safe failure without a success response', async () => {
    failSave = true;
    const result = await request('PATCH', { name: 'Not saved' });
    assert.equal(result.status, 500); assert.equal(result.data.success, false);
    assert.doesNotMatch(JSON.stringify(result.data), /Private database/);
    failSave = false;
    assert.equal((await request('GET')).data.user.name, 'Updated Name');
  });
});
