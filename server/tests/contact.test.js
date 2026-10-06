import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContact, createContactLimiter } from '../utils/contactMessages.js';
import { submitContact } from '../../my-app/src/utils/contact.js';
const valid = { name: 'Customer', email: 'customer@example.invalid', subject: 'Sizing', message: 'Please help with sizing.' };

test('contact validates required fields, email, types and maximum lengths', () => {
  assert.deepEqual(validateContact({ ...valid, name: ' Customer ' }), valid);
  for (const fields of [{ ...valid, email: 'invalid' }, { ...valid, message: ' ' }, { ...valid, message: 'x'.repeat(5001) }, { ...valid, name: 123 }, { ...valid, status: 'Read' }, {}, null]) assert.throws(() => validateContact(fields), { status: 400 });
});
test('contact limiter blocks repeated attempts, ignores forwarding headers, and expires', () => {
  let time = 0, accepted = 0, status;
  const limiter = createContactLimiter({ limit: 2, windowMs: 1000, now: () => time });
  const res = { set() { return this; }, status(code) { status = code; return this; }, json() { return this; } };
  for (let i = 0; i < 3; i++) limiter({ ip: '127.0.0.1', headers: { 'x-forwarded-for': String(i) } }, res, () => accepted++);
  assert.equal(accepted, 2); assert.equal(status, 429);
  time = 1000; limiter({ ip: '127.0.0.1' }, res, () => accepted++); assert.equal(accepted, 3);
});
test('contact frontend uses the API and rejects failures instead of reporting success', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/contact'); assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), valid);
    return new Response(JSON.stringify({ success: true }), { status: 201 });
  });
  assert.equal((await submitContact(valid)).success, true);
  mock.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, message: 'Storage failed' }), { status: 500 }));
  await assert.rejects(submitContact(valid), /Storage failed/);
});
