import { ensureStoreSettingsSchema } from '../utils/storeSettings.js';
// Real SQL + Express checkout. All writes/DDL use connection-local TEMPORARY
// tables shadowing the application tables; persistent products/orders stay intact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { ensureOrderPricingSchema } from '../utils/orderPricingSchema.js';
import { ensureImageSchema } from '../utils/imageSchema.js';
import { MAX_IMAGE_BYTES } from '../../shared/images.js';
import { pngImage } from './imageFixtures.js';

const digest = value => createHash('sha256').update(value).digest('hex');
test('SQL image widening preserves history and permits large-image checkout', { skip: process.env.RUN_DB_TESTS !== '1' }, async t => {
  const previous = { EMAIL_USER: process.env.EMAIL_USER, EMAIL_PASS: process.env.EMAIL_PASS, JWT_SECRET: process.env.JWT_SECRET, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY };
  process.env.EMAIL_USER = ''; process.env.EMAIL_PASS = '';
  process.env.STRIPE_SECRET_KEY = 'sk_test_isolated_no_network';
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  const { default: orderRoutes, stripe } = await import('../routes/orderRoutes.js');
  const db = await pool.getConnection();
  t.after(async () => { db.destroy(); await pool.end(); });
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  for (const statement of [
    "CREATE TEMPORARY TABLE payment_checkouts (id CHAR(36) PRIMARY KEY,recovery_hash CHAR(64),user_id INT,snapshot LONGTEXT,payment_intent_id VARCHAR(255) UNIQUE,order_id VARCHAR(50) UNIQUE,state VARCHAR(30) DEFAULT 'created',last_error_code VARCHAR(50),attempts INT DEFAULT 0,next_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    'CREATE TEMPORARY TABLE customer_shopping (user_id INT PRIMARY KEY, cart JSON, wishlist JSON)',
    'CREATE TEMPORARY TABLE store_settings (id TINYINT PRIMARY KEY, settings LONGTEXT)',
    'CREATE TEMPORARY TABLE users (id INT PRIMARY KEY, name VARCHAR(100), email VARCHAR(200), role VARCHAR(20))',
    `CREATE TEMPORARY TABLE products (id INT PRIMARY KEY, name VARCHAR(100), price DECIMAL(10,2), original_price DECIMAL(10,2), stock INT, stock_quantity INT, image LONGTEXT, has_variants BOOLEAN DEFAULT FALSE, status VARCHAR(30), deleted_at DATETIME NULL)`,
    `CREATE TEMPORARY TABLE product_variants (id INT PRIMARY KEY, product_id INT, sku VARCHAR(100), options JSON, image_url LONGTEXT NOT NULL, price DECIMAL(10,2), sale_price DECIMAL(10,2) NULL, stock_quantity INT, is_active BOOLEAN)`,
    `CREATE TEMPORARY TABLE orders (id VARCHAR(50) PRIMARY KEY, user_id INT NULL, customer_name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50), address TEXT, city VARCHAR(100), total_amount DECIMAL(10,2), payment_method VARCHAR(50), payment_status VARCHAR(50), transaction_id VARCHAR(255), order_status VARCHAR(30), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TEMPORARY TABLE order_items (id INT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(50), product_id INT, product_name VARCHAR(255), price DECIMAL(10,2), quantity INT, image TEXT, product_variant_id INT NULL, variant_sku VARCHAR(100), variant_options JSON)`,
    'CREATE TEMPORARY TABLE promotions (id INT PRIMARY KEY, active BOOLEAN, code VARCHAR(100), name VARCHAR(100), discount_type VARCHAR(20), value DECIMAL(10,2), min_subtotal DECIMAL(10,2), product_id INT NULL, starts_at DATETIME NULL, ends_at DATETIME NULL)',
    'CREATE TEMPORARY TABLE order_payment_receipts (transaction_id VARCHAR(255) PRIMARY KEY, order_id VARCHAR(50))',
    'CREATE TEMPORARY TABLE stock_adjustments (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT, product_name VARCHAR(255), delta INT, reason VARCHAR(500), actor_id INT NULL)',
  ]) await db.query(statement);
  await ensureStoreSettingsSchema(db);
  await ensureOrderPricingSchema(db);
  const oldImage = pngImage();
  const largeImage = pngImage(MAX_IMAGE_BYTES);
  await db.query("INSERT INTO users VALUES (77, 'Image customer', 'images@example.invalid', 'user')");
  await db.query("INSERT INTO orders (id,user_id,order_status) VALUES ('old-image-order',77,'Delivered')");
  await db.query('INSERT INTO order_items (order_id,image) VALUES (?,?),(?,?)', ['old-image-order', oldImage, 'old-image-order', '/images/legacy.jpg']);
  await t.test('old TEXT capacity reproduces the checkout-image failure', async () => {
    await assert.rejects(db.query('INSERT INTO order_items (order_id,image) VALUES (?,?)', ['too-large', largeImage]), error => error.code === 'ER_DATA_TOO_LONG');
  });
  await t.test('migration widens existing schema idempotently and preserves all old image bytes', async () => {
    await ensureImageSchema(db, true);
    await ensureImageSchema(db, true);
    const [[column]] = await db.query("SHOW COLUMNS FROM order_items LIKE 'image'");
    assert.equal(column.Type.toLowerCase(), 'longtext');
    const [rows] = await db.query("SELECT image FROM order_items WHERE order_id='old-image-order' ORDER BY id");
    assert.equal(digest(rows[0].image), digest(oldImage));
    assert.equal(rows[1].image, '/images/legacy.jpg');
  });
  await db.query("INSERT INTO products (id,name,price,stock,stock_quantity,image,has_variants,status) VALUES (1,'Large image product',3000,10,10,?,FALSE,'Active'),(2,'Variant product',3000,10,10,?,TRUE,'Active')", [largeImage, '/cover.jpg']);
  await db.query("INSERT INTO product_variants VALUES (22,2,'IMAGE-VARIANT','[]',?,3000,NULL,10,TRUE)", [largeImage]);
  t.mock.method(pool, 'query', db.query.bind(db));
  t.mock.method(pool, 'getConnection', async () => ({ query: db.query.bind(db), beginTransaction: db.beginTransaction.bind(db), commit: db.commit.bind(db), rollback: db.rollback.bind(db), release() {} }));
  const { default: operationsRoutes } = await import('../routes/operationsRoutes.js');
  const app = express(); app.use(express.json()); app.use('/api/orders/operations', operationsRoutes); app.use('/api/orders', orderRoutes);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = jwt.sign({ id: 77 }, process.env.JWT_SECRET);
  const request = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/orders${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  for (const [label, item] of [['product', { id: 1, quantity: 1 }], ['variant', { id: 2, productVariantId: 22, quantity: 1 }]]) {
    await t.test(`order creation and retrieval with a maximum-size ${label} image`, async () => {
      await db.query("REPLACE INTO customer_shopping (user_id,cart,wishlist) VALUES (77,?,'[]')", [JSON.stringify([{ ...item, quantity: 2 }])]);
      const result = await request('', { customer: { name: 'Image customer', email: 'images@example.invalid', address: 'Test address' }, items: [{ ...item, image: 'untrusted-client-image' }], totalAmount: 3000, paymentMethod: 'Cash on Delivery' });
      assert.equal(result.status, 201, result.data.message);
      const [[savedCart]] = await db.query('SELECT cart FROM customer_shopping WHERE user_id=77');
      assert.equal(JSON.parse(savedCart.cart)[0].quantity, 1, 'order transaction removes only purchased quantity');
      const history = await request('/my-orders');
      assert.equal(history.status, 200);
      const order = history.data.orders.find(order => order.id === result.data.orderId);
      assert.equal(digest(order.items[0].image), digest(largeImage));
      assert.equal(order.items[0].product_variant_id, item.productVariantId || null);
      const [[product]] = await db.query('SELECT stock FROM products WHERE id=?', [item.id]);
      assert.equal(product.stock, 9, 'order commits with stock deduction');
    });
  }
  await t.test('existing URL and base64 order images still return through order history', async () => {
    const result = await request('/my-orders');
    const order = result.data.orders.find(order => order.id === 'old-image-order');
    assert.equal(digest(order.items[0].image), digest(oldImage));
    assert.equal(order.items[1].image, '/images/legacy.jpg');
  });
  await t.test('Cart quote -> Checkout quote -> Stripe amount -> stored order use the same PKR breakdown', async () => {
    await db.query('UPDATE products SET price=1250.25 WHERE id=1');
    await db.query("INSERT INTO promotions (id,active,code,name,discount_type,value,min_subtotal) VALUES (1,1,'SAVE','Ten percent','Percentage',10,0)");
    const payload = { items: [{ id: 1, quantity: 1, price: 0 }], couponCode: 'SAVE', subtotal: 0, shipping: 0, discount: 99999, currency: 'USD' };
    const cart = await request('/operations/quote', payload);
    const checkout = await request('/operations/quote', payload);
    assert.equal(cart.status, 200);
    assert.deepEqual(checkout.data.quote, cart.data.quote);
    const quote = cart.data.quote;
    assert.equal(quote.grandTotal, 1325.22);
    assert.equal(quote.shipping, 200);
    let created;
    t.mock.method(stripe.paymentIntents, 'create', async args => {
      created = args;
      return { id: 'pi_isolated', client_secret: 'isolated-client-reference' };
    });
    const invalid = await request('/create-payment-intent', { ...payload, amount: 1 });
    assert.equal(invalid.status, 400);
    assert.equal(created, undefined);
    const reference = { checkoutId: randomUUID(), recoveryKey: randomBytes(32).toString('hex') };
    const customer = { name: 'Pricing customer', email: 'images@example.invalid', phone: '03001234567', address: 'Test address', city: 'Lahore' };
    const payment = await request('/create-payment-intent', { ...payload, ...reference, amount: quote.grandTotal, customer });
    assert.equal(payment.status, 200);
    assert.equal(created.amount, quote.totalMinor);
    assert.equal(created.currency, quote.currency.toLowerCase());
    let intent = { id: 'pi_isolated', status: 'succeeded', currency: created.currency, amount_received: created.amount, metadata: created.metadata };
    t.mock.method(stripe.paymentIntents, 'retrieve', async () => intent);
    const orderPayload = { ...payload, ...reference, totalAmount: quote.grandTotal, paymentMethod: 'Credit/Debit Card', transactionId: 'pi_isolated', customer };
    // After payment, recovery uses the saved quote, never a new client total.
    intent = { ...intent, currency: 'usd' };
    assert.equal((await request('', orderPayload)).status, 409);
    intent = { ...intent, currency: 'pkr', amount_received: created.amount - 1 };
    assert.equal((await request('', orderPayload)).status, 409);
    const [[pending]] = await db.query('SELECT state,order_id FROM payment_checkouts WHERE id=?',[reference.checkoutId]);
    assert.equal(pending.state,'needs_review'); assert.equal(pending.order_id,null);
    intent = { ...intent, amount_received: created.amount };
    const result = await request('', { ...orderPayload, totalAmount: 1 });
    assert.equal(result.status, 201, result.data.message);
    assert.equal(result.data.quote.grandTotal, quote.grandTotal);
    const [[stored]] = await db.query('SELECT * FROM orders WHERE id=?', [result.data.orderId]);
    for (const [column, key] of [['total_amount','grandTotal'], ['subtotal','subtotal'], ['discount_amount','discountAmount'], ['shipping_amount','shipping'], ['tax_amount','tax']]) assert.equal(Number(stored[column]), quote[key]);
    assert.equal(stored.currency, 'PKR');
    assert.equal(stored.coupon_code, 'SAVE');
    assert.equal(stored.payment_status, 'Paid');
  });

});
