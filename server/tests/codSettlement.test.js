import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'supersecretjwtkey_farhan_ecommerce_2026';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import pool from '../config/db.js';
import { ensureCodSchema } from '../utils/codSchema.js';
import codRoutes from '../routes/codRoutes.js';
import orderRoutes from '../routes/orderRoutes.js';

test('COD Transaction & Courier Settlement End-to-End Workflow', async () => {
  // 1. Ensure Schema is applied
  await ensureCodSchema(pool);

  const [tables] = await pool.query(`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN ('courier_settlements', 'cod_transactions', 'settlement_items', 'cod_adjustments', 'cod_audit_logs')
  `);
  const tableNames = tables.map(r => r.TABLE_NAME || r.table_name);
  assert.ok(tableNames.includes('courier_settlements'), 'courier_settlements exists');
  assert.ok(tableNames.includes('cod_transactions'), 'cod_transactions exists');
  assert.ok(tableNames.includes('settlement_items'), 'settlement_items exists');
  assert.ok(tableNames.includes('cod_adjustments'), 'cod_adjustments exists');
  assert.ok(tableNames.includes('cod_audit_logs'), 'cod_audit_logs exists');

  // Set up express test app
  const app = express();
  app.use(express.json());
  app.use('/api/admin/cod', codRoutes);
  app.use('/api/orders', orderRoutes);

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const testSuffix = randomUUID().slice(0, 8);
  let adminId, customerId, productId;
  const orderId1 = `ORD-TEST-${testSuffix}-1`;
  const orderId2 = `ORD-TEST-${testSuffix}-2`;
  const orderId3 = `ORD-TEST-${testSuffix}-3`;
  let txId1, txId2, txId3;
  let settlementId;

  const adminToken = () => jwt.sign(
    { id: adminId, role: 'admin', email: `admin-${testSuffix}@example.com` },
    getJwtSecret()
  );

  const api = async (method, path, body = null) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken()}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  try {
    // Setup test users & products
    const [adminRes] = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('COD Admin', ?, 'hash', 'admin')",
      [`admin-${testSuffix}@example.com`]
    );
    adminId = adminRes.insertId;

    const [custRes] = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('COD Customer', ?, 'hash', 'customer')",
      [`cust-${testSuffix}@example.com`]
    );
    customerId = custRes.insertId;

    const [prodRes] = await pool.query(
      "INSERT INTO products (name, price, stock, stock_quantity) VALUES ('COD Test Shirt', 1500, 50, 50)"
    );
    productId = prodRes.insertId;

    // STEP 1: Order Creation with COD sets payment_status to 'COD Pending'
    await pool.query(`
      INSERT INTO orders (
        id, user_id, customer_name, email, phone, address, city,
        total_amount, subtotal, shipping_amount, payment_method, payment_status,
        order_status, courier_name, tracking_number, created_at
      ) VALUES (
        ?, ?, 'Test Customer', ?, '03001234567', 'Test Address, Lahore', 'Lahore',
        1700, 1500, 200, 'Cash on Delivery (COD)', 'COD Pending',
        'Pending', 'TCS Express', 'TRK-COD-1', NOW()
      )
    `, [orderId1, customerId, `cust-${testSuffix}@example.com`]);

    const [txRes] = await pool.query(`
      INSERT INTO cod_transactions (
        transaction_id, order_id, customer_name, customer_email, customer_phone,
        courier_name, tracking_number, order_total, cod_amount,
        courier_charges, other_deductions, expected_settlement,
        payment_status, settlement_status
      ) VALUES (
        ?, ?, 'Test Customer', ?, '03001234567',
        'TCS Express', 'TRK-COD-1', 1700, 1700,
        200, 0, 1500,
        'COD Pending', 'Unsettled'
      )
    `, [`COD-TXN-${testSuffix}-1`, orderId1, `cust-${testSuffix}@example.com`]);
    txId1 = txRes.insertId;

    const [txRows] = await pool.query('SELECT * FROM cod_transactions WHERE id = ?', [txId1]);
    assert.equal(txRows.length, 1);
    assert.equal(Number(txRows[0].cod_amount), 1700);
    assert.equal(Number(txRows[0].expected_settlement), 1500);
    assert.equal(txRows[0].payment_status, 'COD Pending');
    assert.equal(txRows[0].settlement_status, 'Unsettled');

    // STEP 2: Decouple Delivered from Paid: Transitioning to Delivered marks 'Collected by Courier' / 'Settlement Pending'
    const confRes = await api('PUT', `/api/orders/${orderId1}/status`, { order_status: 'Confirmed' });
    assert.equal(confRes.status, 200, JSON.stringify(confRes.data));
    const shipRes = await api('PUT', `/api/orders/${orderId1}/status`, { order_status: 'Shipped', courier_name: 'TCS Express', tracking_number: 'TRK-COD-1' });
    assert.equal(shipRes.status, 200, JSON.stringify(shipRes.data));

    const updateRes = await api('PUT', `/api/orders/${orderId1}/status`, {
      order_status: 'Delivered',
      courier_name: 'TCS Express',
      tracking_number: 'TRK-COD-1'
    });
    assert.equal(updateRes.status, 200, JSON.stringify(updateRes.data));

    const [orderRows] = await pool.query('SELECT order_status, payment_status FROM orders WHERE id = ?', [orderId1]);
    assert.equal(orderRows[0].order_status, 'Delivered');
    assert.notEqual(orderRows[0].payment_status, 'Paid', 'Delivered COD order MUST NOT be marked Paid');
    assert.equal(orderRows[0].payment_status, 'Collected by Courier');

    const [delivTxRows] = await pool.query('SELECT * FROM cod_transactions WHERE id = ?', [txId1]);
    assert.equal(delivTxRows[0].settlement_status, 'Settlement Pending');
    assert.equal(delivTxRows[0].payment_status, 'Collected by Courier');
    assert.ok(delivTxRows[0].delivery_date, 'delivery_date is recorded');

    // STEP 3: Create Courier Settlement Batch with exact remittance (Expected = 1500, Actual = 1500 => Diff = 0 => Settled)
    const batchPayload = {
      courier_name: 'TCS Express',
      settlement_date: '2026-09-22',
      bank_reference: `REF-${testSuffix}-001`,
      transaction_ids: [txId1],
      actual_settlement: 1500,
      notes: 'Test batch settlement'
    };

    const settleBatchRes = await api('POST', '/api/admin/cod/settlements', batchPayload);
    assert.equal(settleBatchRes.status, 201, JSON.stringify(settleBatchRes.data));
    assert.ok(settleBatchRes.data.success);
    settlementId = settleBatchRes.data.settlement_id;

    // Verify settlement record calculations
    const [settleRows] = await pool.query('SELECT * FROM courier_settlements WHERE id = ?', [settlementId]);
    assert.equal(Number(settleRows[0].total_orders), 1);
    assert.equal(Number(settleRows[0].total_cod_collected), 1700);
    assert.equal(Number(settleRows[0].total_courier_charges), 200);
    assert.equal(Number(settleRows[0].expected_settlement), 1500);
    assert.equal(Number(settleRows[0].actual_settlement), 1500);
    assert.equal(Number(settleRows[0].difference), 0);
    assert.equal(settleRows[0].settlement_status, 'Settled');

    // Verify transaction updated to Settled
    const [updatedTx] = await pool.query('SELECT * FROM cod_transactions WHERE id = ?', [txId1]);
    assert.equal(updatedTx[0].settlement_status, 'Settled');
    assert.equal(updatedTx[0].payment_status, 'Settled');
    assert.equal(Number(updatedTx[0].actual_settlement), 1500);
    assert.equal(Number(updatedTx[0].difference), 0);

    // Verify corresponding order is now Settled
    const [updatedOrder] = await pool.query('SELECT payment_status FROM orders WHERE id = ?', [orderId1]);
    assert.equal(updatedOrder[0].payment_status, 'Settled');

    // Verify audit log exists
    const [audit] = await pool.query('SELECT * FROM cod_audit_logs WHERE cod_transaction_id = ?', [txId1]);
    assert.ok(audit.length >= 1, 'Audit log written for settlement');

    // STEP 4: Rule 11 - Cannot settle an already settled transaction
    const duplicateBatch = {
      courier_name: 'TCS Express',
      settlement_date: '2026-09-22',
      bank_reference: `REF-${testSuffix}-DUP`,
      transaction_ids: [txId1],
      actual_settlement: 1500
    };

    const dupRes = await api('POST', '/api/admin/cod/settlements', duplicateBatch);
    assert.equal(dupRes.status, 409, 'Duplicate settlement rejected with 409 Conflict');
    assert.match(dupRes.data.message, /already settled/i);

    // STEP 5: Discrepancy Handling & Adjustments (Expected = 2300, Actual = 2000, Diff = -300)
    await pool.query(`
      INSERT INTO orders (
        id, user_id, customer_name, email, phone, address, city,
        total_amount, subtotal, shipping_amount, payment_method, payment_status,
        order_status, courier_name, tracking_number, created_at
      ) VALUES (
        ?, ?, 'Test Customer 2', ?, '03007654321', 'Lahore', 'Lahore',
        2500, 2300, 200, 'Cash on Delivery (COD)', 'Collected by Courier',
        'Delivered', 'Trax Logistics', 'TRK-COD-2', NOW()
      )
    `, [orderId2, customerId, `cust-${testSuffix}@example.com`]);

    const [tx2Res] = await pool.query(`
      INSERT INTO cod_transactions (
        transaction_id, order_id, customer_name, customer_email, customer_phone,
        courier_name, tracking_number, order_total, cod_amount,
        courier_charges, other_deductions, expected_settlement,
        payment_status, settlement_status
      ) VALUES (
        ?, ?, 'Test Customer 2', ?, '03007654321',
        'Trax Logistics', 'TRK-COD-2', 2500, 2500,
        200, 0, 2300,
        'Collected by Courier', 'Settlement Pending'
      )
    `, [`COD-TXN-${testSuffix}-2`, orderId2, `cust-${testSuffix}@example.com`]);
    txId2 = tx2Res.insertId;

    const discrepancyBatch = {
      courier_name: 'Trax Logistics',
      settlement_date: '2026-09-22',
      bank_reference: `REF-${testSuffix}-DISCREP`,
      transaction_ids: [txId2],
      actual_settlement: 2000,
      notes: 'Underpaid by Rs 300 due to weight dispute'
    };

    const discrepRes = await api('POST', '/api/admin/cod/settlements', discrepancyBatch);
    assert.equal(discrepRes.status, 201, 'Settlement batch with discrepancy created');

    const [updatedTx2] = await pool.query('SELECT * FROM cod_transactions WHERE id = ?', [txId2]);
    assert.equal(updatedTx2[0].settlement_status, 'Discrepancy');
    assert.equal(Number(updatedTx2[0].difference), -300);

    // Apply adjustment to resolve discrepancy
    const adjRes = await api('POST', `/api/admin/cod/transactions/${txId2}/adjustments`, {
      amount: 300,
      adjustment_type: 'Courier Fee Correction',
      reason: 'Courier agreed to waive weight dispute fee ticket #9901'
    });
    assert.equal(adjRes.status, 200, JSON.stringify(adjRes.data));
    assert.ok(adjRes.data.success);

    const [adjRows] = await pool.query('SELECT * FROM cod_adjustments WHERE cod_transaction_id = ?', [txId2]);
    assert.equal(adjRows.length, 1);
    assert.equal(Number(adjRows[0].amount), 300);
    assert.equal(adjRows[0].adjustment_type, 'Courier Fee Correction');

    // STEP 6: Formal Reconciliation sets batch and transactions to Reconciled
    const reconRes = await api('POST', '/api/admin/cod/reconciliation/reconcile', {
      settlement_id: settlementId,
      reconciliation_reference: `BANK-REC-${testSuffix}-SUCCESS`,
      notes: 'Verified against Meezan Bank statement #871'
    });
    assert.equal(reconRes.status, 200, JSON.stringify(reconRes.data));
    assert.ok(reconRes.data.success);

    const [batch] = await pool.query('SELECT settlement_status, reconciliation_reference FROM courier_settlements WHERE id = ?', [settlementId]);
    assert.equal(batch[0].settlement_status, 'Reconciled');
    assert.equal(batch[0].reconciliation_reference, `BANK-REC-${testSuffix}-SUCCESS`);

    const [reconciledTx] = await pool.query('SELECT settlement_status FROM cod_transactions WHERE id = ?', [txId1]);
    assert.equal(reconciledTx[0].settlement_status, 'Reconciled');

    // STEP 7: Rule 12 - Settle rejected for cancelled/uncollectable orders
    await pool.query(`
      INSERT INTO orders (
        id, user_id, customer_name, email, phone, address, city,
        total_amount, subtotal, shipping_amount, payment_method, payment_status,
        order_status, courier_name, tracking_number, created_at
      ) VALUES (
        ?, ?, 'Cancelled Customer', ?, '03009999999', 'Lahore', 'Lahore',
        1000, 800, 200, 'Cash on Delivery (COD)', 'Failed / Uncollectable',
        'Cancelled', 'TCS Express', 'TRK-COD-CANCEL', NOW()
      )
    `, [orderId3, customerId, `cust-${testSuffix}@example.com`]);

    const [tx3Res] = await pool.query(`
      INSERT INTO cod_transactions (
        transaction_id, order_id, customer_name, customer_email, customer_phone,
        courier_name, tracking_number, order_total, cod_amount,
        courier_charges, other_deductions, expected_settlement,
        payment_status, settlement_status
      ) VALUES (
        ?, ?, 'Cancelled Customer', ?, '03009999999',
        'TCS Express', 'TRK-COD-CANCEL', 1000, 0,
        200, 0, 0,
        'Failed / Uncollectable', 'Unsettled'
      )
    `, [`COD-TXN-${testSuffix}-3`, orderId3, `cust-${testSuffix}@example.com`]);
    txId3 = tx3Res.insertId;

    const cancelBatch = {
      courier_name: 'TCS Express',
      settlement_date: '2026-09-22',
      bank_reference: `REF-${testSuffix}-CANCEL`,
      transaction_ids: [txId3],
      actual_settlement: 0
    };

    const cancelRes = await api('POST', '/api/admin/cod/settlements', cancelBatch);
    assert.equal(cancelRes.status, 400, 'Settling cancelled order must return 400');
    assert.match(cancelRes.data.message, /cannot be settled/i);

    // STEP 8: GET /api/orders/:id/cod-details
    const detailsRes = await api('GET', `/api/orders/${orderId1}/cod-details`);
    assert.equal(detailsRes.status, 200, 'cod-details returns 200');
    assert.ok(detailsRes.data.success);
    assert.ok(detailsRes.data.isCOD);
    assert.ok(detailsRes.data.cod);
    assert.equal(detailsRes.data.cod.order_id, orderId1);

    // STEP 9: Report endpoint supports JSON and CSV download
    const jsonRes = await api('GET', '/api/admin/cod/reports');
    assert.equal(jsonRes.status, 200, JSON.stringify(jsonRes.data));
    assert.ok(jsonRes.data.success);
    assert.ok(Array.isArray(jsonRes.data.rows));
    assert.equal(typeof jsonRes.data.count, 'number');

    const csvRes = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/cod/reports?format=csv`, {
      headers: { Authorization: `Bearer ${adminToken()}` }
    });
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-type') || '', /text\/csv/);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Order ID,Transaction ID,Customer,Courier'));
  } finally {
    try {
      const orderIds = [orderId1, orderId2, orderId3];
      const [trans] = await pool.query('SELECT id FROM cod_transactions WHERE order_id IN (?)', [orderIds]);
      const transIds = trans.map(tr => tr.id);
      if (transIds.length > 0) {
        await pool.query('DELETE FROM cod_adjustments WHERE cod_transaction_id IN (?)', [transIds]);
        await pool.query('DELETE FROM cod_audit_logs WHERE cod_transaction_id IN (?)', [transIds]);
        await pool.query('DELETE FROM settlement_items WHERE cod_transaction_id IN (?)', [transIds]);
        await pool.query('DELETE FROM cod_transactions WHERE id IN (?)', [transIds]);
      }
      await pool.query('DELETE FROM courier_settlements WHERE bank_reference LIKE ?', [`REF-${testSuffix}%`]);
      await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      await pool.query('DELETE FROM orders WHERE id IN (?)', [orderIds]);
      if (productId) await pool.query('DELETE FROM products WHERE id = ?', [productId]);
      if (adminId || customerId) {
        await pool.query('DELETE FROM users WHERE id IN (?)', [[adminId, customerId].filter(Boolean)]);
      }
    } catch (e) {
      console.error('Cleanup notice:', e.message);
    }
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
