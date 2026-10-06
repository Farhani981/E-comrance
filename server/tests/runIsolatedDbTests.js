// Run opt-in suites against a new disposable database, never the configured app DB.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const testDatabase = `shophub_test_${randomBytes(12).toString('hex')}`;
const admin = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', multipleStatements: true,
});
let created = false;
let pool;
try {
  await admin.query(`CREATE DATABASE \`${testDatabase}\``);
  created = true;
  process.env.DB_NAME = testDatabase;
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.EMAIL_USER = ''; process.env.EMAIL_PASS = '';
  process.env.STRIPE_SECRET_KEY = '';
  const database = await import('../config/db.js');
  pool = database.default;
  await admin.changeUser({ database: testDatabase });
  // The legacy schema names ecommerce_db explicitly. Remove database-selection
  // statements so test setup cannot escape the disposable database.
  const schema = readFileSync('schema.sql', 'utf8').replace(/^\s*(?:CREATE DATABASE[^;]*;|USE[^;]*;)\s*$/gm, '');
  await admin.query(schema);
  await admin.query("ALTER TABLE products ADD COLUMN subcategory VARCHAR(255) DEFAULT '', ADD COLUMN stock_quantity INT DEFAULT 0");
  const { ensureBannerSchema } = await import('../utils/bannerSchema.js');
  const { ensureCatalogSchema } = await import('../utils/catalogSchema.js');
  await ensureBannerSchema(admin);
  await ensureCatalogSchema(admin);
  await admin.query(readFileSync('operations-schema.sql', 'utf8'));
  const { ensureVariantSchema } = await import('../utils/variantSchema.js');
  await ensureVariantSchema();
  const files = readdirSync('tests').filter(name => name.endsWith('.test.js')).map(name => `tests/${name}`);
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=20000', '--test-force-exit', ...files, '../my-app/tests/catalog.test.js'], {
      stdio: 'inherit', env: { ...process.env, RUN_DB_TESTS: '1' },
    });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
} finally {
  if (pool) await pool.end();
  // Only the unpredictable database successfully created by this invocation.
  if (created && /^shophub_test_[a-f0-9]{24}$/.test(testDatabase)) {
    await admin.query(`DROP DATABASE \`${testDatabase}\``);
    console.log('Disposable test database removed.');
  }
  await admin.end();
}
