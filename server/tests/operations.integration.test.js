import { getJwtSecret } from '../config/jwt.js';
// Opt-in: uses the configured local database, with all fixture writes rolled back.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/operationsRoutes.js';
import adminRouter from '../routes/adminRoutes.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';

test('operations API authorization, moderation, inventory and returns', { skip: process.env.RUN_DB_TESTS !== '1' }, async () => {
  await ensureVariantSchema();
  const connection = await pool.getConnection();
  const originalQuery = pool.query, originalGetConnection = pool.getConnection;
  let server;
  await connection.beginTransaction();
  try {
    const suffix = `${Date.now()}-${Math.random()}`;
    const [admin] = await connection.query("INSERT INTO users (name, email, password, role) VALUES ('Operations test admin', ?, 'fixture-only', 'admin')", [`admin-${suffix}@example.invalid`]);
    const [customer] = await connection.query("INSERT INTO users (name, email, password, role) VALUES ('Operations test customer', ?, 'fixture-only', 'user')", [`customer-${suffix}@example.invalid`]);
    const [product] = await connection.query("INSERT INTO products (name, sku, price, stock, stock_quantity) VALUES ('Operations test product', ?, 1000, 10, 10)", [`TEST-${suffix}`]);
    const orderId = `TEST-${Date.now()}`;
    await connection.query("INSERT INTO orders (id, user_id, customer_name, email, address, total_amount, payment_status, order_status) VALUES (?, ?, 'Test customer', 'test@example.invalid', 'Test address', 2000, 'Paid', 'Delivered')", [orderId, customer.insertId]);
    await connection.query('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, 1000, 2)', [orderId, product.insertId, 'Operations test product']);
    pool.query = connection.query.bind(connection);
    pool.getConnection = async () => ({
      query: connection.query.bind(connection),
      beginTransaction: () => connection.query('SAVEPOINT operations_route'),
      commit: () => connection.query('RELEASE SAVEPOINT operations_route'),
      rollback: () => connection.query('ROLLBACK TO SAVEPOINT operations_route'),
      release: () => {},
    });
    const app = express(); app.use(express.json()); app.use('/api/operations', router); app.use('/api/admin', adminRouter);
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = `http://127.0.0.1:${server.address().port}/api/operations`;
    const token = id => jwt.sign({ id }, getJwtSecret());
    const api = async (path, method = 'GET', body, user = admin.insertId) => {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, ...await response.json() };
    };
    assert.equal((await api('/inventory', 'GET', undefined, null)).status, 401);
    assert.equal((await api('/inventory', 'GET', undefined, customer.insertId)).status, 403);
    assert.equal((await api(`/inventory/${product.insertId}/history`, 'GET', undefined, null)).status, 401);
    assert.equal((await api(`/inventory/${product.insertId}/history`, 'GET', undefined, customer.insertId)).status, 403);
    const [supplier] = await connection.query("INSERT INTO suppliers (name) VALUES ('Inventory source fixture')");
    for (const [index, quantity, cost] of [[1, 4, 100], [2, 6, 200]]) {
      const [purchase] = await connection.query('INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount) VALUES (?, ?, CURRENT_DATE, ?)', [supplier.insertId, `INV-${suffix}-${index}`, quantity * cost]);
      await connection.query('INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES (?, ?, ?, ?)', [purchase.insertId, product.insertId, quantity, cost]);
    }
    const initialReport = (await api('/inventory')).products.find(p => p.id === product.insertId);
    assert.equal(Number(initialReport.purchased_units), 10);
    assert.equal(Number(initialReport.purchase_cost), 1600);
    assert.equal(Number(initialReport.average_cost), 160);
    assert.equal(Number(initialReport.sold_units), 2, 'Multiple purchases do not multiply delivered sales');
    assert.equal(Number(initialReport.sales_value), 2000);
    assert.equal(initialReport.supplier_names, 'Inventory source fixture');
    const history = await api(`/inventory/${product.insertId}/history`);
    assert.equal(history.purchases.length, 2);
    assert.equal(history.orders.length, 1);
    assert.equal((await api('/inventory/invalid/history')).status, 400);
    assert.equal((await api(`/inventory/${product.insertId}/adjust`, 'POST', { delta: -11, reason: 'Invalid removal' })).status, 400);
    assert.equal((await api(`/inventory/${product.insertId}/adjust`, 'POST', { delta: 3, reason: 'Count correction' })).success, true);
    const stock = async () => Number((await connection.query('SELECT stock FROM products WHERE id = ?', [product.insertId]))[0][0].stock);
    assert.equal(await stock(), 13);
    const warehouseName = `Test warehouse ${suffix}`;
    assert.equal((await api('/warehouses', 'POST', { name: warehouseName, address: 'Fixture address' })).status, 201);
    const warehouse = (await api('/inventory')).warehouses.find(w => w.name === warehouseName);
    assert.equal((await api(`/inventory/${product.insertId}`, 'PUT', { sku: `UPDATED-${suffix}`, low_stock_threshold: 15, warehouse_id: warehouse.id })).success, true);
    assert.equal((await api(`/warehouses/${warehouse.id}`, 'DELETE')).status, 400, 'Assigned warehouses cannot be deleted');
    const inventory = (await api('/inventory')).products.find(p => p.id === product.insertId);
    assert.equal(inventory.low_stock_threshold, 15);
    assert.equal(inventory.warehouse_id, warehouse.id);
    const promo = { name: `Test promo ${suffix}`, code: `TEST${Date.now()}`, discount_type: 'Percentage', value: 20, min_subtotal: 0, product_id: product.insertId, active: true };
    assert.equal((await api('/promotions', 'POST', promo)).success, true);
    const savedPromo = (await api('/promotions')).promotions.find(p => p.name === promo.name);
    const quote = await api('/quote', 'POST', { items: [{ id: product.insertId, quantity: 2, price: 1 }], couponCode: promo.code }, null);
    assert.equal(quote.quote.subtotal, 2000, 'Quote ignores client supplied prices');
    assert.ok(quote.quote.discountAmount >= 400);
    assert.equal((await api(`/promotions/${savedPromo.id}`, 'PUT', { ...promo, active: false })).success, true);
    assert.equal((await api('/quote', 'POST', { items: [{ id: product.insertId, quantity: 2 }], couponCode: promo.code }, null)).status, 400);
    assert.equal((await api(`/promotions/${savedPromo.id}`, 'DELETE')).success, true);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'POST', { rating: 5, comment: 'A review awaiting moderation' }, customer.insertId)).status, 201);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'GET', undefined, null)).reviews.length, 0);
    const review = (await api('/reviews')).reviews.find(r => r.product_id === product.insertId);
    assert.equal((await api(`/reviews/${review.id}`, 'PUT', { rating: 4, comment: 'Approved review', status: 'Approved' })).success, true);
    assert.equal((await api(`/reviews/product/${product.insertId}`, 'GET', undefined, null)).reviews[0].rating, 4);
    assert.equal((await api('/my-returns', 'POST', { order_id: orderId, reason: 'Wrong fit' }, customer.insertId)).status, 201);
    const returned = (await api('/returns')).returns.find(r => r.order_id === orderId);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Refunded', refund_amount: 2000, refund_reference: 'test' })).status, 400);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Approved' })).success, true);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Received' })).success, true);
    assert.equal(await stock(), 15);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Received' })).success, true);
    assert.equal(await stock(), 15, 'Repeated receipt must not restock twice');
    const returnedReport = (await api('/inventory')).products.find(p => p.id === product.insertId);
    assert.equal(Number(returnedReport.sold_units), 0);
    assert.equal(Number(returnedReport.returned_units), 2);
    assert.equal(Number(returnedReport.sales_value), 0);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Refunded', refund_amount: 2001, refund_reference: 'test' })).status, 400);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Refunded', refund_amount: 2000, refund_reference: 'TEST-REFUND' })).success, true);
    assert.equal((await api(`/returns/${returned.id}`, 'PUT', { status: 'Refunded', refund_amount: 2000, refund_reference: 'TEST-REFUND' })).status, 400);
    const cancelId = `${orderId}-C`;
    await connection.query("INSERT INTO orders (id, user_id, customer_name, email, address, total_amount, payment_status, order_status) VALUES (?, ?, 'Test', 'test@example.invalid', 'Test', 1000, 'Paid', 'Pending')", [cancelId, customer.insertId]);
    await connection.query('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, 1000, 1)', [cancelId, product.insertId, 'Test']);
    assert.equal(Number((await api('/inventory')).products.find(p => p.id === product.insertId).committed_units), 1);
    assert.equal((await api(`/orders/${cancelId}/cancel`, 'POST', {}, customer.insertId)).success, true);
    assert.equal(await stock(), 16);
    assert.equal((await api(`/orders/${cancelId}/cancel`, 'POST', {}, customer.insertId)).status, 400);
    assert.equal(await stock(), 16, 'Repeated cancellation must not restore twice');
    const cancelledReport = (await api('/inventory')).products.find(p => p.id === product.insertId);
    assert.equal(Number(cancelledReport.committed_units), 0);
    assert.equal(Number(cancelledReport.sold_units), 0);
    assert.equal(Number(cancelledReport.returned_units), 2, 'Cancelled orders are not counted as customer returns');
    const cancelReturn = (await api('/returns')).returns.find(r => r.order_id === cancelId);
    assert.equal(cancelReturn.status, 'Received');
    assert.equal((await api(`/returns/${cancelReturn.id}`, 'PUT', { status: 'Received' })).success, true);
    assert.equal(await stock(), 16);
    const purchaseApi = async (path, method, body) => {
      const response = await fetch(base.replace('/operations', '/admin') + '/purchases' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(admin.insertId)}` }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
    };
    const purchaseInput = { supplier_id: supplier.insertId, invoice_no: `MOVEMENT-${suffix}`, purchase_date: '2026-09-10', payment_method: 'Cash', paid_amount: 0, items: [{ product_id: product.insertId, quantity: 3, cost_price: 100 }] };
    await purchaseApi('', 'POST', purchaseInput);
    const [[loggedPurchase]] = await connection.query('SELECT id FROM purchases WHERE invoice_no = ?', [purchaseInput.invoice_no]);
    assert.equal(await stock(), 19);
    await purchaseApi(`/${loggedPurchase.id}`, 'PUT', { ...purchaseInput, items: [{ product_id: product.insertId, quantity: 5, cost_price: 100 }] });
    assert.equal(await stock(), 21);
    await purchaseApi(`/${loggedPurchase.id}`, 'DELETE');
    assert.equal(await stock(), 16);
    const recorded = (await api(`/inventory/${product.insertId}/history`)).adjustments.filter(a => a.reason.startsWith('Purchase '));
    assert.deepEqual(recorded.map(a => Number(a.delta)), [-5, 2, 3]);
    assert.ok(recorded.every(a => a.actor_name === 'Operations test admin'));
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery; pool.getConnection = originalGetConnection;
    await connection.rollback(); connection.release(); await pool.end();
  }
});
