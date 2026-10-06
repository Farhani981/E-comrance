import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import { createContactRouter, contactBody } from '../routes/contactRoutes.js';
import { ensureContactSchema, createContactLimiter } from '../utils/contactMessages.js';

test('contact submission stores real messages and only admins can manage them', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const db = await pool.getConnection();
  t.after(async () => { db.destroy(); await pool.end(); });
  await db.query('CREATE TEMPORARY TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(255), role VARCHAR(20))');
  await db.query("INSERT INTO users VALUES (1,'Admin','admin@example.invalid','admin'),(2,'Customer','customer@example.invalid','user')");
  await db.query("CREATE TEMPORARY TABLE contact_messages (id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100),email VARCHAR(255),subject VARCHAR(200),message TEXT,status VARCHAR(10) DEFAULT 'Unread',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)");
  await ensureContactSchema(db);
  let failInsert = false;
  t.mock.method(pool, 'query', async (sql, values) => {
    if (failInsert && sql.startsWith('INSERT INTO contact_messages')) throw new Error('Private database credentials');
    return db.query(sql, values);
  });
  const app = express(); app.use(contactBody);
  app.use('/contact', createContactRouter(createContactLimiter({ limit: 100 })));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ success: false }));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const admin = jwt.sign({ id: 1 }, process.env.JWT_SECRET), customer = jwt.sign({ id: 2, role: 'admin' }, process.env.JWT_SECRET);
  const request = async (method, path = '', body, token) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/contact${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  };
  const fields = { name: 'Customer', email: 'CUSTOMER@example.invalid', subject: 'Product question', message: 'Can you help?\nMy size is M.' };
  let messageId;
  await t.test('valid public submission persists as unread without a fake email claim', async () => {
    assert.equal((await request('POST', '', fields)).status, 201);
    const [[stored]] = await db.query('SELECT * FROM contact_messages');
    messageId = stored.id;
    assert.equal(stored.message, fields.message); assert.equal(stored.email, fields.email.toLowerCase()); assert.equal(stored.status, 'Unread');
    assert.ok(stored.created_at); assert.ok(stored.updated_at);
    await ensureContactSchema(db);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM contact_messages'))[0][0].count, 1);
  });
  await t.test('invalid email, empty and oversized messages do not insert rows', async () => {
    for (const patch of [{ email: 'bad' }, { message: '' }, { message: 'x'.repeat(5001) }, { status: 'Read' }]) assert.equal((await request('POST', '', { ...fields, ...patch })).status, 400);
    assert.equal((await request('POST', '', { ...fields, message: 'x'.repeat(50000) })).status, 413);
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM contact_messages'))[0][0].count, 1);
  });
  await t.test('database failure returns failure without storing or leaking details', async () => {
    failInsert = true;
    const result = await request('POST', '', fields);
    assert.equal(result.status, 500); assert.equal(result.data.success, false);
    assert.doesNotMatch(JSON.stringify(result.data), /credentials|Private/);
    failInsert = false;
  });
  await t.test('customers and unauthenticated visitors cannot read or mutate admin messages', async () => {
    for (const token of [customer, undefined]) for (const [method, path, body] of [['GET', '', undefined], ['GET', `/${messageId}`, undefined], ['PATCH', `/${messageId}`, { status: 'Read' }], ['DELETE', `/${messageId}`, undefined]]) {
      assert.equal((await request(method, path, body, token)).status, token ? 403 : 401);
    }
  });
  await t.test('admin lists, views, marks read/unread, and deletes stored messages', async () => {
    const list = await request('GET', '', undefined, admin);
    assert.equal(list.status, 200); assert.equal(list.data.total, 1);
    assert.equal((await request('GET', `/${messageId}`, undefined, admin)).data.message.message, fields.message);
    for (const status of ['Read', 'Unread']) {
      assert.equal((await request('PATCH', `/${messageId}`, { status }, admin)).status, 200);
      assert.equal((await request('GET', `/${messageId}`, undefined, admin)).data.message.status, status);
    }
    assert.equal((await request('PATCH', `/${messageId}`, { status: 'Deleted' }, admin)).status, 400);
    assert.equal((await request('DELETE', `/${messageId}`, undefined, admin)).status, 200);
    assert.equal((await request('GET', `/${messageId}`, undefined, admin)).status, 404);
  });
});
