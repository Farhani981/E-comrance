import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getJwtSecret } from '../config/jwt.js';

test('JWT configuration requires an explicit secret without changing its value', t => {
  const original = process.env.JWT_SECRET;
  t.after(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });
  const configured = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = configured;
  assert.equal(getJwtSecret(), configured);
  for (const missing of [undefined, '', '   ']) {
    if (missing === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = missing;
    assert.throws(getJwtSecret, /^Error: JWT_SECRET is required\./);
  }
});

test('production server exits before listening when JWT_SECRET is empty', () => {
  // An explicit empty variable prevents dotenv from substituting a local .env key.
  const result = spawnSync(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '', PORT: '0' },
    encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET is required/);
  assert.doesNotMatch(result.stdout, /Server is running live|Database.*initialized|SMTP connection verified/);
});
