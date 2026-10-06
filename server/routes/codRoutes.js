import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { ensureCodSchema } from '../utils/codSchema.js';

const router = express.Router();

// Helper to ensure schema is initialized
router.use(async (req, res, next) => {
  try {
    await ensureCodSchema(pool);
    next();
  } catch (error) {
    next(error);
  }
});

// Helper to log audit trail
async function logAudit(connection, {
  cod_transaction_id = null,
  settlement_id = null,
  order_id = null,
  actor_id = null,
  actor_name = 'Admin',
  action,
  previous_status = null,
  new_status = null,
  previous_amount = null,
  new_amount = null,
  details = null,
}) {
  const runner = connection || pool;
  await runner.query(`
    INSERT INTO cod_audit_logs (
      cod_transaction_id, settlement_id, order_id, actor_id, actor_name,
      action, previous_status, new_status, previous_amount, new_amount, details
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    cod_transaction_id, settlement_id, order_id, actor_id, actor_name,
    action, previous_status, new_status, previous_amount, new_amount, details
  ]).catch(e => console.error('Audit log error:', e.message));
}

// ==============================================================================
// 1. DASHBOARD & STATS
// ==============================================================================
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [[metrics]] = await pool.query(`
      SELECT 
        COUNT(*) AS totalCodOrders,
        COALESCE(SUM(cod_amount), 0) AS codAmount,
        COALESCE(SUM(CASE WHEN payment_status IN ('Collected by Courier', 'Settlement Pending') THEN cod_amount ELSE 0 END), 0) AS collectedByCourier,
        COALESCE(SUM(CASE WHEN settlement_status = 'Settlement Pending' THEN expected_settlement ELSE 0 END), 0) AS settlementPending,
        COALESCE(SUM(CASE WHEN settlement_status = 'Partially Settled' THEN actual_settlement ELSE 0 END), 0) AS partiallySettled,
        COALESCE(SUM(CASE WHEN settlement_status IN ('Settled', 'Reconciled') THEN actual_settlement ELSE 0 END), 0) AS settledAmount,
        COALESCE(SUM(CASE WHEN settlement_status = 'Reconciled' THEN actual_settlement ELSE 0 END), 0) AS reconciledAmount,
        COALESCE(SUM(CASE WHEN settlement_status IN ('Unsettled', 'Settlement Pending', 'Partially Settled') 
                          THEN GREATEST(0, expected_settlement - actual_settlement) ELSE 0 END), 0) AS outstandingAmount,
        COALESCE(SUM(courier_charges + other_deductions), 0) AS totalDeductions,
        COALESCE(SUM(CASE WHEN ABS(difference) > 0.001 AND settlement_status != 'Reconciled' THEN ABS(difference) ELSE 0 END), 0) AS totalDiscrepancy,
        COUNT(CASE WHEN ABS(difference) > 0.001 AND settlement_status != 'Reconciled' THEN 1 END) AS discrepancyCount
      FROM cod_transactions
    `);

    res.json({
      success: true,
      stats: {
        totalCodOrders: Number(metrics.totalCodOrders || 0),
        codAmount: Number(metrics.codAmount || 0),
        collectedByCourier: Number(metrics.collectedByCourier || 0),
        settlementPending: Number(metrics.settlementPending || 0),
        partiallySettled: Number(metrics.partiallySettled || 0),
        settledAmount: Number(metrics.settledAmount || 0),
        reconciledAmount: Number(metrics.reconciledAmount || 0),
        outstandingAmount: Number(metrics.outstandingAmount || 0),
        totalDeductions: Number(metrics.totalDeductions || 0),
        totalDiscrepancy: Number(metrics.totalDiscrepancy || 0),
        discrepancyCount: Number(metrics.discrepancyCount || 0),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 2. COURIERS LIST FOR DROPDOWNS
// ==============================================================================
router.get('/couriers', protect, adminOnly, async (req, res) => {
  try {
    const [dbCouriers] = await pool.query('SELECT id, name, code, is_active FROM shipping_couriers ORDER BY name ASC');
    const [distinctCouriers] = await pool.query(`
      SELECT DISTINCT courier_name FROM cod_transactions WHERE courier_name IS NOT NULL AND courier_name != ''
      UNION
      SELECT DISTINCT courier_name FROM orders WHERE courier_name IS NOT NULL AND courier_name != ''
    `);

    const courierNames = new Set([
      ...dbCouriers.map(c => c.name),
      ...distinctCouriers.map(c => c.courier_name),
      'Trax Logistics', 'TCS Express', 'Leopards Courier', 'CallCourier', 'PostEx', 'M&P Logistics'
    ]);

    res.json({
      success: true,
      couriers: Array.from(courierNames).filter(Boolean).sort(),
      registeredCouriers: dbCouriers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 3. UNSETTLED DELIVERED COD ORDERS (FOR BATCHING)
// ==============================================================================
router.get('/unsettled-orders', protect, adminOnly, async (req, res) => {
  try {
    const { courier_name } = req.query;
    let query = `
      SELECT ct.*, o.order_status, o.address, o.city
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      WHERE ct.settlement_id IS NULL
        AND ct.payment_status NOT IN ('Refunded', 'Failed / Uncollectable')
        AND o.order_status NOT IN ('Cancelled')
    `;
    const params = [];

    if (courier_name && courier_name !== 'All') {
      query += ` AND LOWER(ct.courier_name) = LOWER(?)`;
      params.push(courier_name);
    }

    query += ` ORDER BY ct.delivery_date DESC, ct.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json({ success: true, count: rows.length, transactions: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 4. COD TRANSACTIONS LIST (WITH FILTERS & PAGINATION)
// ==============================================================================
router.get('/transactions', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const {
      search,
      courier,
      payment_status,
      settlement_status,
      order_status,
      reconciled,
      discrepancy,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(`(
        ct.transaction_id LIKE ? OR 
        ct.order_id LIKE ? OR 
        ct.tracking_number LIKE ? OR 
        ct.customer_name LIKE ? OR 
        ct.customer_email LIKE ? OR 
        ct.customer_phone LIKE ?
      )`);
      params.push(s, s, s, s, s, s);
    }

    if (courier && courier !== 'All') {
      conditions.push(`LOWER(ct.courier_name) = LOWER(?)`);
      params.push(courier);
    }

    if (payment_status && payment_status !== 'All') {
      conditions.push(`ct.payment_status = ?`);
      params.push(payment_status);
    }

    if (settlement_status && settlement_status !== 'All') {
      conditions.push(`ct.settlement_status = ?`);
      params.push(settlement_status);
    }

    if (order_status && order_status !== 'All') {
      conditions.push(`o.order_status = ?`);
      params.push(order_status);
    }

    if (reconciled === 'reconciled') {
      conditions.push(`ct.settlement_status = 'Reconciled'`);
    } else if (reconciled === 'unreconciled') {
      conditions.push(`ct.settlement_status != 'Reconciled'`);
    }

    if (discrepancy === 'has_discrepancy') {
      conditions.push(`(ABS(ct.difference) > 0.001 OR ct.settlement_status = 'Discrepancy')`);
    } else if (discrepancy === 'no_discrepancy') {
      conditions.push(`(ABS(ct.difference) <= 0.001 AND ct.settlement_status != 'Discrepancy')`);
    }

    if (startDate) {
      conditions.push(`DATE(COALESCE(ct.delivery_date, ct.created_at)) >= DATE(?)`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`DATE(COALESCE(ct.delivery_date, ct.created_at)) <= DATE(?)`);
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Allowed sort columns
    const allowedSortCols = {
      created_at: 'ct.created_at',
      delivery_date: 'ct.delivery_date',
      settlement_date: 'ct.settlement_date',
      cod_amount: 'ct.cod_amount',
      expected_settlement: 'ct.expected_settlement',
      actual_settlement: 'ct.actual_settlement',
      difference: 'ct.difference',
      transaction_id: 'ct.transaction_id',
      order_id: 'ct.order_id',
    };
    const orderCol = allowedSortCols[sortBy] || 'ct.created_at';
    const orderDirection = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query
    const [[countResult]] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      WHERE ${whereClause}
    `, params);

    const total = Number(countResult.total || 0);

    // Filtered list query
    const [transactions] = await pool.query(`
      SELECT 
        ct.*,
        o.order_status,
        o.created_at AS order_created_at,
        o.address,
        o.city,
        cs.settlement_number,
        cs.bank_reference,
        u.name AS reconciled_by_name
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      LEFT JOIN courier_settlements cs ON cs.id = ct.settlement_id
      LEFT JOIN users u ON u.id = ct.reconciled_by
      WHERE ${whereClause}
      ORDER BY ${orderCol} ${orderDirection}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 5. COD TRANSACTION DETAILS (BY ID OR ORDER ID)
// ==============================================================================
router.get('/transactions/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const isOrderLookup = String(id).startsWith('ORD-') || req.query.byOrder === 'true';

    const [[txn]] = await pool.query(`
      SELECT 
        ct.*,
        o.order_status,
        o.customer_name AS order_customer_name,
        o.email AS order_email,
        o.phone AS order_phone,
        o.address,
        o.city,
        o.subtotal,
        o.discount_amount,
        o.shipping_amount,
        o.coupon_code,
        o.created_at AS order_created_at,
        cs.settlement_number,
        cs.bank_reference,
        cs.settlement_status AS batch_status,
        cs.settlement_date AS batch_settlement_date,
        u.name AS reconciled_by_name
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      LEFT JOIN courier_settlements cs ON cs.id = ct.settlement_id
      LEFT JOIN users u ON u.id = ct.reconciled_by
      WHERE ${isOrderLookup ? 'ct.order_id = ?' : 'ct.id = ? OR ct.transaction_id = ?'}
    `, [id, id]);

    if (!txn) {
      return res.status(404).json({ success: false, message: 'COD Transaction not found' });
    }

    // Get order items
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [txn.order_id]);
    txn.items = items;

    // Get adjustments
    const [adjustments] = await pool.query(`
      SELECT ca.*, u.name AS actor_name
      FROM cod_adjustments ca
      LEFT JOIN users u ON u.id = ca.actor_id
      WHERE ca.cod_transaction_id = ?
      ORDER BY ca.created_at DESC
    `, [txn.id]);
    txn.adjustments = adjustments;

    // Get audit logs
    const [auditLogs] = await pool.query(`
      SELECT * FROM cod_audit_logs 
      WHERE cod_transaction_id = ? OR order_id = ?
      ORDER BY created_at DESC
    `, [txn.id, txn.order_id]);
    txn.auditLogs = auditLogs;

    res.json({ success: true, transaction: txn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update COD Transaction status, deductions, charges, notes directly
router.put('/transactions/:id', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      courier_charges,
      other_deductions,
      notes,
      payment_status,
      settlement_status,
      delivery_date,
      courier_name,
      tracking_number
    } = req.body;

    await connection.beginTransaction();

    const [[current]] = await connection.query('SELECT * FROM cod_transactions WHERE id = ? FOR UPDATE', [id]);
    if (!current) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'COD Transaction not found' });
    }

    const newCharges = courier_charges !== undefined ? Number(courier_charges) : Number(current.courier_charges);
    const newDeductions = other_deductions !== undefined ? Number(other_deductions) : Number(current.other_deductions);
    const expectedSettlement = Math.max(0, Number(current.cod_amount) - newCharges - newDeductions);
    const actualSettlement = Number(current.actual_settlement);
    const difference = actualSettlement - expectedSettlement;

    const nextPaymentStatus = payment_status || current.payment_status;
    const nextSettlementStatus = settlement_status || (
      Math.abs(difference) < 0.01 && actualSettlement > 0 ? 'Settled' :
      actualSettlement > 0 ? 'Discrepancy' : current.settlement_status
    );

    await connection.query(`
      UPDATE cod_transactions 
      SET courier_charges = ?,
          other_deductions = ?,
          expected_settlement = ?,
          difference = ?,
          payment_status = ?,
          settlement_status = ?,
          notes = COALESCE(?, notes),
          delivery_date = COALESCE(?, delivery_date),
          courier_name = COALESCE(?, courier_name),
          tracking_number = COALESCE(?, tracking_number)
      WHERE id = ?
    `, [
      newCharges,
      newDeductions,
      expectedSettlement,
      difference,
      nextPaymentStatus,
      nextSettlementStatus,
      notes,
      delivery_date,
      courier_name,
      tracking_number,
      id
    ]);

    // Also update order table payment_status
    await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [nextPaymentStatus, current.order_id]);

    await logAudit(connection, {
      cod_transaction_id: current.id,
      order_id: current.order_id,
      actor_id: req.user?.id,
      actor_name: req.user?.name || 'Administrator',
      action: 'UPDATE_COD_TRANSACTION',
      previous_status: current.payment_status,
      new_status: nextPaymentStatus,
      previous_amount: current.expected_settlement,
      new_amount: expectedSettlement,
      details: notes || 'Updated transaction financial fields and status',
    });

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'COD Transaction updated successfully.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add adjustment to COD transaction
router.post('/transactions/:id/adjustments', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { adjustment_type, amount, reason, document_url } = req.body;

    if (!adjustment_type || amount === undefined || isNaN(Number(amount)) || !reason) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Adjustment type, valid amount, and reason are required.' });
    }

    await connection.beginTransaction();

    const [[txn]] = await connection.query('SELECT * FROM cod_transactions WHERE id = ? FOR UPDATE', [id]);
    if (!txn) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'COD Transaction not found' });
    }

    const adjAmount = Number(amount);
    await connection.query(`
      INSERT INTO cod_adjustments (cod_transaction_id, settlement_id, adjustment_type, amount, reason, document_url, actor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [txn.id, txn.settlement_id, adjustment_type, adjAmount, reason, document_url || null, req.user?.id]);

    // Recompute deductions & difference
    const newOtherDeductions = Number(txn.other_deductions) + adjAmount;
    const expectedSettlement = Math.max(0, Number(txn.cod_amount) - Number(txn.courier_charges) - newOtherDeductions);
    const difference = Number(txn.actual_settlement) - expectedSettlement;

    let newStatus = txn.settlement_status;
    if (txn.actual_settlement > 0) {
      newStatus = Math.abs(difference) < 0.01 ? 'Settled' : 'Discrepancy';
    }

    await connection.query(`
      UPDATE cod_transactions 
      SET other_deductions = ?,
          expected_settlement = ?,
          difference = ?,
          settlement_status = ?
      WHERE id = ?
    `, [newOtherDeductions, expectedSettlement, difference, newStatus, id]);

    await logAudit(connection, {
      cod_transaction_id: txn.id,
      settlement_id: txn.settlement_id,
      order_id: txn.order_id,
      actor_id: req.user?.id,
      actor_name: req.user?.name || 'Administrator',
      action: 'ADD_ADJUSTMENT',
      previous_amount: txn.other_deductions,
      new_amount: newOtherDeductions,
      details: `${adjustment_type}: ${reason} (Amount: Rs. ${adjAmount})`,
    });

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Adjustment added successfully.', expectedSettlement, difference });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 6. COURIER SETTLEMENT BATCHES
// ==============================================================================
router.get('/settlements', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const { search, courier, status, startDate, endDate } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      conditions.push(`(cs.settlement_number LIKE ? OR cs.bank_reference LIKE ? OR cs.courier_name LIKE ?)`);
      params.push(s, s, s);
    }

    if (courier && courier !== 'All') {
      conditions.push(`LOWER(cs.courier_name) = LOWER(?)`);
      params.push(courier);
    }

    if (status && status !== 'All') {
      conditions.push(`cs.settlement_status = ?`);
      params.push(status);
    }

    if (startDate) {
      conditions.push(`cs.settlement_date >= ?`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`cs.settlement_date <= ?`);
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    const [[countResult]] = await pool.query(`
      SELECT COUNT(*) AS total FROM courier_settlements cs WHERE ${whereClause}
    `, params);

    const total = Number(countResult.total || 0);

    const [settlements] = await pool.query(`
      SELECT 
        cs.*,
        u1.name AS created_by_name,
        u2.name AS reconciled_by_name
      FROM courier_settlements cs
      LEFT JOIN users u1 ON u1.id = cs.created_by
      LEFT JOIN users u2 ON u2.id = cs.reconciled_by
      WHERE ${whereClause}
      ORDER BY cs.settlement_date DESC, cs.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      settlements,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Single settlement batch details with items
router.get('/settlements/:id', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [[settlement]] = await pool.query(`
      SELECT 
        cs.*,
        u1.name AS created_by_name,
        u2.name AS reconciled_by_name
      FROM courier_settlements cs
      LEFT JOIN users u1 ON u1.id = cs.created_by
      LEFT JOIN users u2 ON u2.id = cs.reconciled_by
      WHERE cs.id = ? OR cs.settlement_number = ?
    `, [id, id]);

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement batch not found' });
    }

    // Get itemized transactions
    const [items] = await pool.query(`
      SELECT 
        si.*,
        ct.transaction_id,
        ct.tracking_number,
        ct.customer_name,
        ct.customer_phone,
        ct.delivery_date,
        ct.payment_status AS cod_payment_status,
        ct.settlement_status AS cod_settlement_status,
        o.order_status
      FROM settlement_items si
      JOIN cod_transactions ct ON ct.id = si.cod_transaction_id
      JOIN orders o ON o.id = si.order_id
      WHERE si.settlement_id = ?
      ORDER BY si.id ASC
    `, [settlement.id]);

    settlement.items = items;

    // Get adjustments
    const [adjustments] = await pool.query(`
      SELECT ca.*, u.name AS actor_name
      FROM cod_adjustments ca
      LEFT JOIN users u ON u.id = ca.actor_id
      WHERE ca.settlement_id = ?
      ORDER BY ca.created_at DESC
    `, [settlement.id]);
    settlement.adjustments = adjustments;

    // Get audit logs
    const [auditLogs] = await pool.query(`
      SELECT * FROM cod_audit_logs 
      WHERE settlement_id = ?
      ORDER BY created_at DESC
    `, [settlement.id]);
    settlement.auditLogs = auditLogs;

    res.json({ success: true, settlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create Courier Settlement Batch
router.post('/settlements', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      courier_id,
      courier_name,
      settlement_date,
      bank_reference,
      transaction_ids,
      actual_settlement,
      notes,
      attachment_url,
      is_partial = false
    } = req.body;

    if (!courier_name || !settlement_date || !bank_reference || !Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Courier name, settlement date, bank reference, and at least one transaction are required.'
      });
    }

    const actualAmount = Number(actual_settlement);
    if (isNaN(actualAmount) || actualAmount < 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Valid actual settlement amount is required.' });
    }

    await connection.beginTransaction();

    // Lock and validate transactions
    const [txns] = await connection.query(`
      SELECT * FROM cod_transactions 
      WHERE id IN (?) FOR UPDATE
    `, [transaction_ids]);

    if (txns.length !== transaction_ids.length) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'One or more selected transactions were not found.' });
    }

    // Rule 11: Prevent duplicate settlement
    const alreadySettled = txns.filter(t => t.settlement_id !== null && ['Settled', 'Reconciled'].includes(t.settlement_status));
    if (alreadySettled.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        success: false,
        message: `Transaction #${alreadySettled[0].transaction_id} (Order #${alreadySettled[0].order_id}) is already settled in another batch.`
      });
    }

    // Rule 12: Prevent settling cancelled/RTO orders without dedicated override
    const invalidStatuses = txns.filter(t => ['Refunded', 'Failed / Uncollectable'].includes(t.payment_status));
    if (invalidStatuses.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Transaction #${invalidStatuses[0].transaction_id} is marked as ${invalidStatuses[0].payment_status} and cannot be settled.`
      });
    }

    // Calculate totals automatically
    let totalCodCollected = 0;
    let totalCourierCharges = 0;
    let totalOtherDeductions = 0;

    for (const t of txns) {
      totalCodCollected += Number(t.cod_amount) || 0;
      totalCourierCharges += Number(t.courier_charges) || 0;
      totalOtherDeductions += Number(t.other_deductions) || 0;
    }

    const expectedSettlement = Math.max(0, totalCodCollected - totalCourierCharges - totalOtherDeductions);
    const difference = Math.round((actualAmount - expectedSettlement) * 100) / 100;

    // Status logic
    let batchStatus = 'Settlement Pending';
    if (is_partial || (actualAmount < expectedSettlement && is_partial)) {
      batchStatus = 'Partially Settled';
    } else if (Math.abs(difference) < 0.01) {
      batchStatus = 'Settled';
    } else {
      batchStatus = 'Discrepancy';
    }

    // Generate settlement number: SET-YYYYMMDD-XXXX
    const dateStr = settlement_date.replace(/-/g, '');
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const settlementNumber = `SET-${dateStr}-${randCode}`;

    // Insert courier_settlements
    const [settlementResult] = await connection.query(`
      INSERT INTO courier_settlements (
        settlement_number, courier_id, courier_name, settlement_date, bank_reference,
        total_orders, total_cod_collected, total_courier_charges, total_other_deductions,
        expected_settlement, actual_settlement, difference, settlement_status,
        notes, attachment_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      settlementNumber,
      courier_id || null,
      courier_name,
      settlement_date,
      bank_reference,
      txns.length,
      totalCodCollected,
      totalCourierCharges,
      totalOtherDeductions,
      expectedSettlement,
      actualAmount,
      difference,
      batchStatus,
      notes || null,
      attachment_url || null,
      req.user?.id
    ]);

    const settlementId = settlementResult.insertId;

    // Pro-rate actual settlement across transactions based on expected amount share
    for (const t of txns) {
      const itemExpected = Math.max(0, Number(t.cod_amount) - Number(t.courier_charges) - Number(t.other_deductions));
      const shareRatio = expectedSettlement > 0 ? (itemExpected / expectedSettlement) : (1 / txns.length);
      const itemActual = Math.round((actualAmount * shareRatio) * 100) / 100;
      const itemDiff = Math.round((itemActual - itemExpected) * 100) / 100;

      let itemStatus = 'Settled';
      if (batchStatus === 'Partially Settled') {
        itemStatus = 'Partially Settled';
      } else if (Math.abs(itemDiff) >= 0.01) {
        itemStatus = 'Discrepancy';
      }

      // Insert settlement_item
      await connection.query(`
        INSERT INTO settlement_items (
          settlement_id, cod_transaction_id, order_id, cod_amount, courier_charges,
          other_deductions, expected_amount, actual_amount, difference, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        settlementId,
        t.id,
        t.order_id,
        t.cod_amount,
        t.courier_charges,
        t.other_deductions,
        itemExpected,
        itemActual,
        itemDiff,
        itemStatus
      ]);

      // Update cod_transaction
      const newPayStatus = itemStatus === 'Settled' ? 'Settled' : 
                           itemStatus === 'Partially Settled' ? 'Partially Settled' : 'Discrepancy';

      await connection.query(`
        UPDATE cod_transactions 
        SET settlement_id = ?,
            settlement_date = ?,
            actual_settlement = ?,
            difference = ?,
            settlement_status = ?,
            payment_status = ?
        WHERE id = ?
      `, [
        settlementId,
        settlement_date,
        itemActual,
        itemDiff,
        itemStatus,
        newPayStatus,
        t.id
      ]);

      // Update order payment status
      await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [newPayStatus, t.order_id]);

      await logAudit(connection, {
        cod_transaction_id: t.id,
        settlement_id: settlementId,
        order_id: t.order_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'ADDED_TO_SETTLEMENT',
        previous_status: t.payment_status,
        new_status: newPayStatus,
        previous_amount: t.expected_settlement,
        new_amount: itemActual,
        details: `Batched in ${settlementNumber} (${bank_reference})`,
      });
    }

    await logAudit(connection, {
      settlement_id: settlementId,
      actor_id: req.user?.id,
      actor_name: req.user?.name || 'Administrator',
      action: 'CREATE_SETTLEMENT_BATCH',
      new_status: batchStatus,
      new_amount: actualAmount,
      details: `Created batch ${settlementNumber} for ${courier_name} with ${txns.length} orders. Expected: Rs. ${expectedSettlement}, Actual: Rs. ${actualAmount}, Diff: Rs. ${difference}`,
    });

    await connection.commit();
    connection.release();

    res.status(201).json({
      success: true,
      message: `Settlement batch ${settlementNumber} created successfully.`,
      settlement_id: settlementId,
      settlement_number: settlementNumber,
      expected_settlement: expectedSettlement,
      actual_settlement: actualAmount,
      difference,
      settlement_status: batchStatus,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Settlement Batch (Actual received, Bank reference, Notes)
router.put('/settlements/:id', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const { actual_settlement, bank_reference, notes, attachment_url, is_partial } = req.body;

    await connection.beginTransaction();

    const [[settlement]] = await connection.query('SELECT * FROM courier_settlements WHERE id = ? FOR UPDATE', [id]);
    if (!settlement) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Settlement batch not found' });
    }

    const newActual = actual_settlement !== undefined ? Number(actual_settlement) : Number(settlement.actual_settlement);
    const expected = Number(settlement.expected_settlement);
    const diff = Math.round((newActual - expected) * 100) / 100;

    let newStatus = settlement.settlement_status;
    if (settlement.settlement_status !== 'Reconciled') {
      if (is_partial || (newActual < expected && is_partial)) {
        newStatus = 'Partially Settled';
      } else if (Math.abs(diff) < 0.01) {
        newStatus = 'Settled';
      } else {
        newStatus = 'Discrepancy';
      }
    }

    await connection.query(`
      UPDATE courier_settlements 
      SET actual_settlement = ?,
          difference = ?,
          settlement_status = ?,
          bank_reference = COALESCE(?, bank_reference),
          notes = COALESCE(?, notes),
          attachment_url = COALESCE(?, attachment_url)
      WHERE id = ?
    `, [newActual, diff, newStatus, bank_reference, notes, attachment_url, id]);

    // Recalculate child items if actual settlement changed
    if (actual_settlement !== undefined) {
      const [items] = await connection.query('SELECT * FROM settlement_items WHERE settlement_id = ?', [id]);
      for (const item of items) {
        const itemExpected = Number(item.expected_amount);
        const share = expected > 0 ? (itemExpected / expected) : (1 / items.length);
        const itemActual = Math.round((newActual * share) * 100) / 100;
        const itemDiff = Math.round((itemActual - itemExpected) * 100) / 100;
        const itemStatus = newStatus === 'Partially Settled' ? 'Partially Settled' : (Math.abs(itemDiff) < 0.01 ? 'Settled' : 'Discrepancy');

        await connection.query(`
          UPDATE settlement_items 
          SET actual_amount = ?, difference = ?, status = ?
          WHERE id = ?
        `, [itemActual, itemDiff, itemStatus, item.id]);

        await connection.query(`
          UPDATE cod_transactions 
          SET actual_settlement = ?, difference = ?, settlement_status = ?, payment_status = ?
          WHERE id = ?
        `, [itemActual, itemDiff, itemStatus, itemStatus, item.cod_transaction_id]);

        await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [itemStatus, item.order_id]);
      }
    }

    await logAudit(connection, {
      settlement_id: settlement.id,
      actor_id: req.user?.id,
      actor_name: req.user?.name || 'Administrator',
      action: 'UPDATE_SETTLEMENT_BATCH',
      previous_amount: settlement.actual_settlement,
      new_amount: newActual,
      previous_status: settlement.settlement_status,
      new_status: newStatus,
      details: `Updated settlement ${settlement.settlement_number}`,
    });

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Settlement updated successfully.', difference: diff, settlement_status: newStatus });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Remove item from settlement batch
router.delete('/settlements/:id/items/:itemId', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id, itemId } = req.params;

    await connection.beginTransaction();

    const [[item]] = await connection.query('SELECT * FROM settlement_items WHERE id = ? AND settlement_id = ? FOR UPDATE', [itemId, id]);
    if (!item) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Settlement item not found' });
    }

    // Delete item
    await connection.query('DELETE FROM settlement_items WHERE id = ?', [itemId]);

    // Restore cod_transaction
    await connection.query(`
      UPDATE cod_transactions 
      SET settlement_id = NULL,
          settlement_date = NULL,
          actual_settlement = 0.00,
          difference = -expected_settlement,
          settlement_status = 'Settlement Pending',
          payment_status = 'Collected by Courier'
      WHERE id = ?
    `, [item.cod_transaction_id]);

    await connection.query('UPDATE orders SET payment_status = "Collected by Courier" WHERE id = ?', [item.order_id]);

    // Recalculate settlement totals
    const [[newTotals]] = await connection.query(`
      SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(cod_amount), 0) AS total_cod_collected,
        COALESCE(SUM(courier_charges), 0) AS total_courier_charges,
        COALESCE(SUM(other_deductions), 0) AS total_other_deductions,
        COALESCE(SUM(expected_amount), 0) AS expected_settlement
      FROM settlement_items
      WHERE settlement_id = ?
    `, [id]);

    const [[settlement]] = await connection.query('SELECT actual_settlement FROM courier_settlements WHERE id = ?', [id]);
    const actual = Number(settlement.actual_settlement);
    const exp = Number(newTotals.expected_settlement);
    const diff = actual - exp;

    await connection.query(`
      UPDATE courier_settlements 
      SET total_orders = ?,
          total_cod_collected = ?,
          total_courier_charges = ?,
          total_other_deductions = ?,
          expected_settlement = ?,
          difference = ?
      WHERE id = ?
    `, [
      Number(newTotals.total_orders || 0),
      Number(newTotals.total_cod_collected || 0),
      Number(newTotals.total_courier_charges || 0),
      Number(newTotals.total_other_deductions || 0),
      exp,
      diff,
      id
    ]);

    await logAudit(connection, {
      cod_transaction_id: item.cod_transaction_id,
      settlement_id: id,
      order_id: item.order_id,
      actor_id: req.user?.id,
      actor_name: req.user?.name || 'Administrator',
      action: 'REMOVE_FROM_SETTLEMENT',
      details: `Removed order #${item.order_id} from batch #${id}`,
    });

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Item removed from settlement successfully.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 7. RECONCILIATION MODULE
// ==============================================================================
router.get('/reconciliation', protect, adminOnly, async (req, res) => {
  try {
    // 1. Overall Comparison Metrics
    const [[storeExpected]] = await pool.query(`
      SELECT 
        COALESCE(SUM(cod_amount), 0) AS storeCodTotal,
        COALESCE(SUM(courier_charges), 0) AS storeChargesTotal,
        COALESCE(SUM(expected_settlement), 0) AS storeExpectedSettlement
      FROM cod_transactions
      WHERE payment_status NOT IN ('Refunded', 'Failed / Uncollectable')
    `);

    const [[settlementsSummary]] = await pool.query(`
      SELECT 
        COALESCE(SUM(expected_settlement), 0) AS courierExpectedTotal,
        COALESCE(SUM(actual_settlement), 0) AS actualBankReceivedTotal,
        COALESCE(SUM(difference), 0) AS totalDifference,
        COUNT(CASE WHEN settlement_status != 'Reconciled' THEN 1 END) AS pendingReconcileCount,
        COUNT(CASE WHEN settlement_status = 'Discrepancy' OR ABS(difference) > 0.001 THEN 1 END) AS discrepancyCount
      FROM courier_settlements
    `);

    // 2. Settlement Batches Awaiting Reconciliation
    const [batches] = await pool.query(`
      SELECT cs.*, u.name AS created_by_name
      FROM courier_settlements cs
      LEFT JOIN users u ON u.id = cs.created_by
      ORDER BY 
        CASE WHEN cs.settlement_status = 'Discrepancy' THEN 1
             WHEN cs.settlement_status = 'Settled' THEN 2
             WHEN cs.settlement_status = 'Partially Settled' THEN 3
             ELSE 4 END ASC,
        cs.settlement_date DESC
      LIMIT 50
    `);

    // 3. Transactions with Discrepancies
    const [discrepantTransactions] = await pool.query(`
      SELECT ct.*, o.order_status, cs.settlement_number, cs.bank_reference
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      LEFT JOIN courier_settlements cs ON cs.id = ct.settlement_id
      WHERE (ABS(ct.difference) > 0.001 OR ct.settlement_status = 'Discrepancy')
        AND ct.settlement_status != 'Reconciled'
      ORDER BY ct.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      comparison: {
        storeCodTotal: Number(storeExpected.storeCodTotal || 0),
        storeChargesTotal: Number(storeExpected.storeChargesTotal || 0),
        storeExpectedSettlement: Number(storeExpected.storeExpectedSettlement || 0),
        courierExpectedTotal: Number(settlementsSummary.courierExpectedTotal || 0),
        actualBankReceivedTotal: Number(settlementsSummary.actualBankReceivedTotal || 0),
        totalDifference: Number(settlementsSummary.totalDifference || 0),
        pendingReconcileCount: Number(settlementsSummary.pendingReconcileCount || 0),
        discrepancyCount: Number(settlementsSummary.discrepancyCount || 0),
      },
      batches,
      discrepantTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Formally Reconcile a Settlement Batch or Individual Transaction
router.post('/reconciliation/reconcile', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { settlement_id, cod_transaction_id, reconciliation_reference, notes } = req.body;

    if (!reconciliation_reference) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Reconciliation reference or Bank confirmation is required.' });
    }

    await connection.beginTransaction();

    if (settlement_id) {
      const [[batch]] = await connection.query('SELECT * FROM courier_settlements WHERE id = ? FOR UPDATE', [settlement_id]);
      if (!batch) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'Settlement batch not found' });
      }

      // Mark batch reconciled
      await connection.query(`
        UPDATE courier_settlements 
        SET settlement_status = 'Reconciled',
            reconciled_by = ?,
            reconciled_at = NOW(),
            reconciliation_reference = ?,
            notes = CONCAT(COALESCE(notes, ''), '\n[Reconciliation Note]: ', COALESCE(?, ''))
        WHERE id = ?
      `, [req.user?.id, reconciliation_reference, notes, settlement_id]);

      // Mark items reconciled
      await connection.query(`
        UPDATE settlement_items SET status = 'Reconciled' WHERE settlement_id = ?
      `, [settlement_id]);

      // Mark transactions reconciled
      await connection.query(`
        UPDATE cod_transactions 
        SET settlement_status = 'Reconciled',
            payment_status = 'Reconciled',
            reconciled_by = ?,
            reconciled_at = NOW(),
            reconciliation_reference = ?
        WHERE settlement_id = ?
      `, [req.user?.id, reconciliation_reference, settlement_id]);

      // Update order table payment status
      await connection.query(`
        UPDATE orders o
        JOIN cod_transactions ct ON ct.order_id = o.id
        SET o.payment_status = 'Reconciled'
        WHERE ct.settlement_id = ?
      `, [settlement_id]);

      await logAudit(connection, {
        settlement_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'RECONCILE_SETTLEMENT_BATCH',
        previous_status: batch.settlement_status,
        new_status: 'Reconciled',
        details: `Reconciled with ref: ${reconciliation_reference}. ${notes || ''}`,
      });
    } else if (cod_transaction_id) {
      const [[txn]] = await connection.query('SELECT * FROM cod_transactions WHERE id = ? FOR UPDATE', [cod_transaction_id]);
      if (!txn) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'COD Transaction not found' });
      }

      await connection.query(`
        UPDATE cod_transactions 
        SET settlement_status = 'Reconciled',
            payment_status = 'Reconciled',
            reconciled_by = ?,
            reconciled_at = NOW(),
            reconciliation_reference = ?,
            notes = CONCAT(COALESCE(notes, ''), '\n[Reconciled]: ', COALESCE(?, ''))
        WHERE id = ?
      `, [req.user?.id, reconciliation_reference, notes, cod_transaction_id]);

      await connection.query('UPDATE orders SET payment_status = "Reconciled" WHERE id = ?', [txn.order_id]);

      await logAudit(connection, {
        cod_transaction_id,
        order_id: txn.order_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'RECONCILE_TRANSACTION',
        previous_status: txn.settlement_status,
        new_status: 'Reconciled',
        details: `Reconciled with ref: ${reconciliation_reference}. ${notes || ''}`,
      });
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Reconciliation recorded successfully.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Flag Discrepancy
router.post('/reconciliation/discrepancy', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { settlement_id, cod_transaction_id, reason, notes } = req.body;

    if (!reason) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Discrepancy reason is required.' });
    }

    await connection.beginTransaction();

    if (settlement_id) {
      await connection.query(`
        UPDATE courier_settlements 
        SET settlement_status = 'Discrepancy',
            notes = CONCAT(COALESCE(notes, ''), '\n[Discrepancy]: ', ?, ' - ', COALESCE(?, ''))
        WHERE id = ?
      `, [reason, notes, settlement_id]);

      await logAudit(connection, {
        settlement_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'FLAG_DISCREPANCY',
        new_status: 'Discrepancy',
        details: `Reason: ${reason}. Notes: ${notes || ''}`,
      });
    }

    if (cod_transaction_id) {
      const [[txn]] = await connection.query('SELECT * FROM cod_transactions WHERE id = ?', [cod_transaction_id]);
      await connection.query(`
        UPDATE cod_transactions 
        SET settlement_status = 'Discrepancy',
            payment_status = 'Discrepancy',
            notes = CONCAT(COALESCE(notes, ''), '\n[Discrepancy]: ', ?, ' - ', COALESCE(?, ''))
        WHERE id = ?
      `, [reason, notes, cod_transaction_id]);

      if (txn?.order_id) {
        await connection.query('UPDATE orders SET payment_status = "Discrepancy" WHERE id = ?', [txn.order_id]);
      }

      await logAudit(connection, {
        cod_transaction_id,
        order_id: txn?.order_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'FLAG_DISCREPANCY',
        new_status: 'Discrepancy',
        details: `Reason: ${reason}. Notes: ${notes || ''}`,
      });
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Discrepancy flagged successfully.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// Resolve Discrepancy (Adds Adjustment or Waiver without silently modifying historical data)
router.post('/reconciliation/resolve-discrepancy', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      settlement_id,
      cod_transaction_id,
      adjustment_type = 'Charge Correction',
      adjustment_amount = 0,
      reason,
      notes,
      document_url
    } = req.body;

    if (!reason) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Resolution reason is required.' });
    }

    await connection.beginTransaction();

    if (cod_transaction_id) {
      const [[txn]] = await connection.query('SELECT * FROM cod_transactions WHERE id = ? FOR UPDATE', [cod_transaction_id]);
      if (!txn) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: 'COD Transaction not found' });
      }

      const adj = Number(adjustment_amount) || 0;
      if (adj !== 0) {
        await connection.query(`
          INSERT INTO cod_adjustments (cod_transaction_id, settlement_id, adjustment_type, amount, reason, document_url, actor_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [txn.id, txn.settlement_id, adjustment_type, adj, reason, document_url || null, req.user?.id]);
      }

      const newDeductions = Number(txn.other_deductions) + adj;
      const expectedSettlement = Math.max(0, Number(txn.cod_amount) - Number(txn.courier_charges) - newDeductions);
      const diff = Number(txn.actual_settlement) - expectedSettlement;
      const resolvedStatus = Math.abs(diff) < 0.01 ? (txn.actual_settlement > 0 ? 'Settled' : 'Settlement Pending') : 'Discrepancy';

      await connection.query(`
        UPDATE cod_transactions 
        SET other_deductions = ?,
            expected_settlement = ?,
            difference = ?,
            settlement_status = ?,
            payment_status = ?,
            notes = CONCAT(COALESCE(notes, ''), '\n[Discrepancy Resolved]: ', ?, ' - ', COALESCE(?, ''))
        WHERE id = ?
      `, [newDeductions, expectedSettlement, diff, resolvedStatus, resolvedStatus, reason, notes, cod_transaction_id]);

      await connection.query('UPDATE orders SET payment_status = ? WHERE id = ?', [resolvedStatus, txn.order_id]);

      await logAudit(connection, {
        cod_transaction_id,
        order_id: txn.order_id,
        actor_id: req.user?.id,
        actor_name: req.user?.name || 'Administrator',
        action: 'RESOLVE_DISCREPANCY',
        previous_status: txn.settlement_status,
        new_status: resolvedStatus,
        details: `Resolved with ${adjustment_type} (Rs. ${adj}). ${reason}`,
      });
    }

    if (settlement_id) {
      const [[batch]] = await connection.query('SELECT * FROM courier_settlements WHERE id = ? FOR UPDATE', [settlement_id]);
      if (batch) {
        const adj = Number(adjustment_amount) || 0;
        if (adj !== 0) {
          await connection.query(`
            INSERT INTO cod_adjustments (settlement_id, adjustment_type, amount, reason, document_url, actor_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [settlement_id, adjustment_type, adj, reason, document_url || null, req.user?.id]);
        }

        const newExpected = Math.max(0, Number(batch.expected_settlement) - adj);
        const diff = Number(batch.actual_settlement) - newExpected;
        const resolvedStatus = Math.abs(diff) < 0.01 ? 'Settled' : 'Discrepancy';

        await connection.query(`
          UPDATE courier_settlements 
          SET expected_settlement = ?,
              difference = ?,
              settlement_status = ?,
              notes = CONCAT(COALESCE(notes, ''), '\n[Discrepancy Resolved]: ', ?, ' - ', COALESCE(?, ''))
          WHERE id = ?
        `, [newExpected, diff, resolvedStatus, reason, notes, settlement_id]);

        await logAudit(connection, {
          settlement_id,
          actor_id: req.user?.id,
          actor_name: req.user?.name || 'Administrator',
          action: 'RESOLVE_DISCREPANCY',
          previous_status: batch.settlement_status,
          new_status: resolvedStatus,
          details: `Resolved batch discrepancy with ${adjustment_type} (Rs. ${adj}). ${reason}`,
        });
      }
    }

    await connection.commit();
    connection.release();

    res.json({ success: true, message: 'Discrepancy resolved successfully.' });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==============================================================================
// 8. COD SETTLEMENT REPORTS & CSV EXPORT
// ==============================================================================
const handleReports = async (req, res) => {
  try {
    const { startDate, endDate, courier, settlement_status, payment_status, order_status, format } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (courier && courier !== 'All') {
      conditions.push('LOWER(ct.courier_name) = LOWER(?)');
      params.push(courier);
    }
    if (settlement_status && settlement_status !== 'All') {
      conditions.push('ct.settlement_status = ?');
      params.push(settlement_status);
    }
    if (payment_status && payment_status !== 'All') {
      conditions.push('ct.payment_status = ?');
      params.push(payment_status);
    }
    if (order_status && order_status !== 'All') {
      conditions.push('o.order_status = ?');
      params.push(order_status);
    }
    if (startDate) {
      conditions.push('DATE(COALESCE(ct.settlement_date, ct.delivery_date, ct.created_at)) >= DATE(?)');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('DATE(COALESCE(ct.settlement_date, ct.delivery_date, ct.created_at)) <= DATE(?)');
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(`
      SELECT 
        ct.order_id,
        ct.transaction_id,
        ct.customer_name,
        ct.courier_name,
        ct.tracking_number,
        ct.order_total,
        ct.cod_amount,
        ct.courier_charges,
        ct.other_deductions,
        ct.expected_settlement,
        ct.actual_settlement,
        ct.difference,
        ct.settlement_status,
        ct.payment_status,
        o.order_status,
        ct.delivery_date,
        ct.settlement_date,
        ct.reconciliation_reference
      FROM cod_transactions ct
      JOIN orders o ON o.id = ct.order_id
      WHERE ${whereClause}
      ORDER BY ct.settlement_date DESC, ct.created_at DESC
    `, params);

    // If CSV requested
    if (format === 'csv') {
      const headers = [
        'Order ID',
        'Transaction ID',
        'Customer',
        'Courier',
        'Tracking No',
        'Order Amount',
        'COD Collected',
        'Courier Charges',
        'Other Deductions',
        'Expected Settlement',
        'Actual Settlement',
        'Difference',
        'Settlement Status',
        'Payment Status',
        'Order Status',
        'Delivery Date',
        'Settlement Date',
        'Reconciliation Ref'
      ];

      const csvRows = [headers.join(',')];

      for (const r of rows) {
        const line = [
          `"${r.order_id || ''}"`,
          `"${r.transaction_id || ''}"`,
          `"${(r.customer_name || '').replace(/"/g, '""')}"`,
          `"${(r.courier_name || '').replace(/"/g, '""')}"`,
          `"${r.tracking_number || ''}"`,
          Number(r.order_total || 0).toFixed(2),
          Number(r.cod_amount || 0).toFixed(2),
          Number(r.courier_charges || 0).toFixed(2),
          Number(r.other_deductions || 0).toFixed(2),
          Number(r.expected_settlement || 0).toFixed(2),
          Number(r.actual_settlement || 0).toFixed(2),
          Number(r.difference || 0).toFixed(2),
          `"${r.settlement_status || ''}"`,
          `"${r.payment_status || ''}"`,
          `"${r.order_status || ''}"`,
          `"${r.delivery_date ? new Date(r.delivery_date).toISOString().split('T')[0] : ''}"`,
          `"${r.settlement_date ? new Date(r.settlement_date).toISOString().split('T')[0] : ''}"`,
          `"${(r.reconciliation_reference || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(line.join(','));
      }

      const csvString = csvRows.join('\r\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=cod-settlement-report-${Date.now()}.csv`);
      return res.status(200).send(csvString);
    }

    res.json({ success: true, count: rows.length, rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/reports', protect, adminOnly, handleReports);
router.get('/report', protect, adminOnly, handleReports);

// ==============================================================================
// 9. AUDIT LOGS
// ==============================================================================
router.get('/audit-logs', protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [[countResult]] = await pool.query('SELECT COUNT(*) AS total FROM cod_audit_logs');
    const total = Number(countResult.total || 0);

    const [logs] = await pool.query(`
      SELECT al.*, u.email AS actor_email
      FROM cod_audit_logs al
      LEFT JOIN users u ON u.id = al.actor_id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
