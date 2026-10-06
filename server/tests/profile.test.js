import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile } from '../utils/profile.js';
import { requestProfile } from '../../my-app/src/utils/profile.js';

test('profile validation permits only existing profile fields and supports clearing contact details', () => {
  assert.deepEqual(validateProfile({ name: ' Customer ', city: '', address: '', phone: '' }), { name: 'Customer', city: '', address: '', phone: '' });
  for (const body of [null, [], {}, { role: 'admin' }, { name: ' ' }, { phone: 123 }, { city: 'Bad\nCity' }]) assert.throws(() => validateProfile(body), { status: 400 });
});

test('frontend saves through protected API and refresh reads the server profile', async t => {
  const calls = [];
  const profile = { id: 1, name: 'Server name', city: 'Lahore', role: 'user' };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, ...options });
    return new Response(JSON.stringify({ success: true, user: profile }), { status: 200 });
  });
  assert.deepEqual(await requestProfile('session-token', { fields: { name: 'Server name' } }), profile);
  assert.equal(calls[0].url, '/api/auth/me'); assert.equal(calls[0].method, 'PATCH');
  assert.equal(calls[0].headers.Authorization, 'Bearer session-token');
  assert.deepEqual(JSON.parse(calls[0].body), { name: 'Server name' });
  assert.deepEqual(await requestProfile('session-token'), profile);
  assert.equal(calls[1].method, 'GET'); assert.equal(calls[1].body, undefined);
});

test('frontend rejects validation, unauthorized and server failures instead of reporting a saved profile', async t => {
  for (const status of [400, 401, 409, 500]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, message: 'Save failed' }), { status }));
    await assert.rejects(requestProfile('session-token', { fields: { name: 'Changed' } }), { status, message: 'Save failed' });
    mock.mock.restore();
  }
  await assert.rejects(requestProfile(null), { status: 401 });
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable'); });
  await assert.rejects(requestProfile('session-token'));
});
