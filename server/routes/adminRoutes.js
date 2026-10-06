import { changeStock } from '../utils/operations.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';
import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use('/purchases', protect, adminOnly, async (req, res, next) => {
  try { await ensureVariantSchema(); next(); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [[{ totalRevenue }]] = await pool.query(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN 
            o.total_amount - COALESCE(r.refund_amount, 0)
          ELSE 0 
        END
      ), 0) AS totalRevenue 
      FROM orders o 
      LEFT JOIN return_requests r ON r.order_id = o.id AND r.status = 'Refunded'
    `);
    const [[{ totalOrders }]] = await pool.query('SELECT COUNT(*) AS totalOrders FROM orders WHERE order_status != "Cancelled"');
    const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) AS totalProducts FROM products');
    const [[{ totalCustomers }]] = await pool.query('SELECT COUNT(*) AS totalCustomers FROM users WHERE role = "user"');

    const [recentOrders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
    const [orderStatus] = await pool.query('SELECT order_status, COUNT(*) as count FROM orders GROUP BY order_status');

    res.json({
      success: true,
      stats: {
        totalRevenue: Number(totalRevenue),
        totalOrders: Number(totalOrders),
        totalProducts: Number(totalProducts),
        totalCustomers: Number(totalCustomers),
        recentOrders,
        orderStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/customers', protect, adminOnly, async (req, res) => {
  try {
    const [customers] = await pool.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at AS joined,
        COUNT(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.id END) AS orders,
        COALESCE(SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END), 0) AS spent,
        COALESCE(SUBSTRING_INDEX(GROUP_CONCAT(o.phone ORDER BY o.created_at DESC), ',', 1), '') AS phone,
        COALESCE(SUBSTRING_INDEX(GROUP_CONCAT(o.city ORDER BY o.created_at DESC), ',', 1), '') AS city
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY u.id, u.name, u.email, u.created_at
      ORDER BY u.created_at DESC
    `);

    res.json({ success: true, customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/customers/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    const [result] = await pool.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ? AND role = "user"',
      [name.trim(), email.trim(), req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email is already in use' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/customers/:id', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ? AND role = "user"',
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/customers/:id/details', protect, adminOnly, async (req, res) => {
  try {
    const customerId = req.params.id;
    const [[customer]] = await pool.query(
      `SELECT id, name, email, created_at AS joined
       FROM users WHERE id = ? AND role = 'user'`,
      [customerId]
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const [orders] = await pool.query(
      `SELECT o.id, o.created_at, o.order_status, o.payment_status, o.payment_method,
              o.total_amount,
              COALESCE(GROUP_CONCAT(CONCAT(oi.product_name, ' x', oi.quantity) SEPARATOR ', '), '') AS items_summary
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [customerId]
    );
    const [ledger] = await pool.query(
      `SELECT id, entry_type, amount, description, order_id, payment_method, created_at
       FROM (
          SELECT CONVERT(CONCAT('order-', o.id) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS id,
            CONVERT('debit' USING utf8mb4) COLLATE utf8mb4_unicode_ci AS entry_type,
            o.total_amount AS amount,
            CONVERT(CONCAT('Order ', o.id) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS description,
            o.id AS order_id,
            CONVERT(o.payment_method USING utf8mb4) COLLATE utf8mb4_unicode_ci AS payment_method,
            o.created_at
         FROM orders o
         WHERE o.user_id = ? AND o.order_status <> 'Cancelled'
         UNION ALL
          SELECT CONVERT(CAST(id AS CHAR) USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            CONVERT(entry_type USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            amount,
            CONVERT(description USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            order_id,
            CONVERT(payment_method USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            created_at
         FROM customer_ledger WHERE customer_id = ?
       ) AS entries
       ORDER BY created_at DESC, id DESC`,
      [customerId, customerId]
    );
    const [[summary]] = await pool.query(
      `SELECT
         COUNT(*) AS totalOrders,
         COALESCE(SUM(CASE WHEN order_status <> 'Cancelled' THEN total_amount ELSE 0 END), 0) AS lifetimeSpend,
         COALESCE(SUM(CASE WHEN order_status <> 'Cancelled' AND payment_status IN ('Paid', 'Completed') THEN total_amount ELSE 0 END), 0) AS orderPaid
       FROM orders WHERE user_id = ?`,
      [customerId]
    );
    const totalPaid = ledger
      .filter((entry) => entry.entry_type === 'credit')
      .reduce((sum, entry) => sum + Number(entry.amount), Number(summary.orderPaid));
    const lifetimeSpend = Number(summary.lifetimeSpend);

    res.json({
      success: true,
      customer,
      orders,
      ledger,
      summary: {
        totalOrders: Number(summary.totalOrders),
        lifetimeSpend,
        totalPaid,
        balanceDue: Math.max(0, lifetimeSpend - totalPaid),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/customers/:id/payments', protect, adminOnly, async (req, res) => {
  try {
    const customerId = req.params.id;
    const { amount, description, payment_method } = req.body;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'A valid payment amount is required' });
    }
    const [[customer]] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND role = 'user'",
      [customerId]
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    await pool.query(
      `INSERT INTO customer_ledger
       (customer_id, entry_type, amount, description, payment_method)
       VALUES (?, 'credit', ?, ?, ?)`,
      [customerId, numericAmount, description?.trim() || 'Manual payment received', payment_method?.trim() || 'Cash']
    );
    res.status(201).json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const purchasePaymentStatus = (total, paid) => {
  if (paid >= total) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
};

const normalizePurchaseInput = (body) => {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw new Error('At least one product item is required.');

  const seenProducts = new Set();
  const items = rawItems.map((item) => {
    const productId = Number(item.product_id);
    const variantId = item.product_variant_id == null ? null : Number(item.product_variant_id);
    if (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0)) throw new Error('Invalid product variant.');
    const itemKey = productId + ':' + (variantId || '');
    const quantity = Number(item.quantity);
    const costPrice = Number(item.cost_price);
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
      throw new Error('Each item requires a valid product, a whole-number quantity above zero, and a non-negative cost price.');
    }
    if (seenProducts.has(itemKey)) throw new Error('A product or variant can only appear once on an invoice. Increase its quantity instead.');
    seenProducts.add(itemKey);
    return { product_id: productId, product_variant_id: variantId, quantity, cost_price: Math.round(costPrice * 100) / 100 };
  });

  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.quantity * item.cost_price, 0) * 100) / 100;
  const paidAmount = Number(body.paid_amount ?? 0);
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
    throw new Error('Paid amount must be between zero and the invoice total.');
  }

  const purchaseDate = String(body.purchase_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) throw new Error('A valid purchase date is required.');

  const invoiceNo = String(body.invoice_no || '').trim() || `PUR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    supplier_id: body.supplier_id ? Number(body.supplier_id) : null,
    invoice_no: invoiceNo,
    purchase_date: purchaseDate,
    payment_method: body.payment_method === 'Bank Transfer' ? 'Bank Transfer' : 'Cash',
    paid_amount: Math.round(paidAmount * 100) / 100,
    total_amount: totalAmount,
    due_amount: Math.round((totalAmount - paidAmount) * 100) / 100,
    payment_status: purchasePaymentStatus(totalAmount, paidAmount),
    items,
  };
};

const updateProductStock = async (connection, productId, delta, reason, actorId, variantId = null) => {
  const [[product]] = await connection.query('SELECT id, name, stock, has_variants FROM products WHERE id = ? FOR UPDATE', [productId]);
  if (!product) throw new Error(`Product ${productId} does not exist.`);
  if (product.has_variants) {
    if (!variantId) throw new Error('Select the specific variant for this purchase item.');
    return changeStock(connection, productId, delta, reason, actorId, variantId);
  }
  if (variantId) throw new Error('This product does not use variants.');
  const nextStock = Number(product.stock) + delta;
  if (nextStock < 0) {
    const error = new Error(`Cannot reverse this invoice because product ${productId} stock has already been consumed.`);
    error.statusCode = 409;
    throw error;
  }
  await connection.query(
    `UPDATE products
     SET stock = ?, stock_quantity = ?,
         status = CASE WHEN ? <= 0 THEN 'Out of Stock' WHEN ? < 10 THEN 'Low Stock' ELSE 'Active' END
     WHERE id = ?`,
    [nextStock, nextStock, nextStock, nextStock, productId]
  );
  if (delta) await connection.query('INSERT INTO stock_adjustments (product_id, product_name, delta, reason, actor_id) VALUES (?, ?, ?, ?, ?)', [productId, product.name, delta, reason, actorId]);
};

const verifySupplier = async (connection, supplierId) => {
  if (!supplierId) return;
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw new Error('Invalid supplier selected.');
  const [[supplier]] = await connection.query('SELECT id FROM suppliers WHERE id = ?', [supplierId]);
  if (!supplier) throw new Error('Selected supplier does not exist.');
};

router.get('/suppliers', protect, adminOnly, async (req, res) => {
  try {
    const [suppliers] = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.company_name,
        s.phone,
        s.email,
        s.address,
        s.created_at,
        COUNT(p.id) AS purchase_count,
        COALESCE(SUM(p.total_amount), 0) AS total_purchases,
        COALESCE(SUM(p.paid_amount), 0) AS total_paid,
        COALESCE(SUM(p.due_amount), 0) AS total_due,
        COALESCE(SUM(p.due_amount), 0) AS total_unpaid,
        MAX(p.purchase_date) AS last_purchase_date
      FROM suppliers s
      LEFT JOIN purchases p ON p.supplier_id = s.id
      GROUP BY s.id, s.name, s.company_name, s.phone, s.email, s.address, s.created_at
      ORDER BY s.created_at DESC, s.id DESC
    `);

    res.json({ success: true, suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/suppliers', protect, adminOnly, async (req, res) => {
  try {
    const { name, company_name, phone, email, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const [result] = await pool.query(
      `INSERT INTO suppliers (name, company_name, phone, email, address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name.trim(),
        company_name?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, supplier: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/suppliers/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, company_name, phone, email, address } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    const [result] = await pool.query(
      `UPDATE suppliers
       SET name = ?, company_name = ?, phone = ?, email = ?, address = ?
       WHERE id = ?`,
      [
        name.trim(),
        company_name?.trim() || null,
        phone?.trim() || null,
        email?.trim() || null,
        address?.trim() || null,
        req.params.id,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    const [rows] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ success: true, supplier: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/suppliers/:id', protect, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Purchases & Inventory Stock-In Endpoints
// ==========================================

// 1. GET /api/admin/purchases — Fetch purchase invoices list with supplier and items
router.get('/purchases', protect, adminOnly, async (req, res) => {
  try {
    const supplierFilter = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const statusFilter = ['Paid', 'Unpaid', 'Partial'].includes(req.query.status) ? req.query.status : null;
    const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : null;
    const toDate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : null;
    const [purchases] = await pool.query(`
      SELECT 
        p.id,
        p.supplier_id,
        s.name AS supplier_name,
        s.company_name AS supplier_company,
        p.invoice_no,
        p.total_amount,
        p.paid_amount,
        p.due_amount,
        p.payment_status,
        p.payment_method,
        DATE_FORMAT(p.purchase_date, '%Y-%m-%d') AS purchase_date,
        p.created_at,
        COUNT(pi.id) AS items_count
      FROM purchases p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      WHERE (? IS NULL OR p.supplier_id = ?)
        AND (? IS NULL OR p.payment_status = ?)
        AND (? IS NULL OR p.purchase_date >= ?)
        AND (? IS NULL OR p.purchase_date <= ?)
      GROUP BY p.id, p.supplier_id, s.name, s.company_name, p.invoice_no, p.total_amount, p.paid_amount, p.due_amount, p.payment_status, p.payment_method, p.purchase_date, p.created_at
      ORDER BY p.purchase_date DESC, p.id DESC
    `, [supplierFilter, supplierFilter, statusFilter, statusFilter, fromDate, fromDate, toDate, toDate]);

    const [items] = await pool.query(`
      SELECT 
        pi.id,
        pi.purchase_id,
        pi.product_id,
        pi.product_variant_id,
        pr.name AS product_name,
        COALESCE(pv.sku, pr.sku) AS product_sku,
        pi.quantity,
        pi.cost_price,
        (pi.quantity * pi.cost_price) AS subtotal
      FROM purchase_items pi
      LEFT JOIN products pr ON pr.id = pi.product_id
      LEFT JOIN product_variants pv ON pv.id = pi.product_variant_id
      ORDER BY pi.id ASC
    `);

    const itemsByPurchase = {};
    for (const item of items) {
      if (!itemsByPurchase[item.purchase_id]) {
        itemsByPurchase[item.purchase_id] = [];
      }
      itemsByPurchase[item.purchase_id].push(item);
    }

    const formattedPurchases = purchases.map((p) => ({
      ...p,
      items: itemsByPurchase[p.id] || [],
    }));

    res.json({ success: true, purchases: formattedPurchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. POST /api/admin/purchases — Create purchase invoice with items and automatically increment stock in a DB transaction
router.post('/purchases', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    let input;
    try {
      input = normalizePurchaseInput(req.body);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // START DB TRANSACTION
    await connection.beginTransaction();
    await verifySupplier(connection, input.supplier_id);

    // 1. Insert into purchases table
    const [purchaseResult] = await connection.query(
      `INSERT INTO purchases (
        supplier_id, invoice_no, total_amount, paid_amount, due_amount, payment_status, payment_method, purchase_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.supplier_id,
        input.invoice_no,
        input.total_amount,
        input.paid_amount,
        input.due_amount,
        input.payment_status,
        input.payment_method,
        input.purchase_date
      ]
    );

    const purchaseId = purchaseResult.insertId;

    // 2. Insert purchase items and increment product stock
    for (const item of input.items) {
      await connection.query(
        `INSERT INTO purchase_items (purchase_id, product_id, product_variant_id, quantity, cost_price)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.product_id, item.product_variant_id, item.quantity, item.cost_price]
      );
      await updateProductStock(connection, item.product_id, item.quantity, `Purchase received #${purchaseId}`, req.user.id, item.product_variant_id);
    }

    // COMMIT DB TRANSACTION
    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Purchase created and inventory updated successfully.',
      purchaseId,
      invoice_no: input.invoice_no,
      total_amount: input.total_amount,
      paid_amount: input.paid_amount,
      due_amount: input.due_amount,
      payment_status: input.payment_status
    });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Invoice number already exists. Please use a unique invoice number.' });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

router.put('/purchases/:id', protect, adminOnly, async (req, res) => {
  let input;
  try {
    input = normalizePurchaseInput(req.body);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[purchase]] = await connection.query('SELECT id FROM purchases WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!purchase) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });
    }

    await verifySupplier(connection, input.supplier_id);
    const [oldItems] = await connection.query(
      'SELECT product_id, product_variant_id, quantity FROM purchase_items WHERE purchase_id = ? FOR UPDATE',
      [req.params.id]
    );
    const quantityChanges = new Map();
    for (const [items, sign] of [[oldItems, -1], [input.items, 1]]) {
      for (const item of items) {
        if (!item.product_id) continue;
        const key = item.product_id + ':' + (item.product_variant_id || '');
        const previous = quantityChanges.get(key);
        quantityChanges.set(key, { ...item, delta: (previous?.delta || 0) + sign * Number(item.quantity) });
      }
    }
    for (const item of [...quantityChanges.values()].sort((a,b) => a.product_id-b.product_id || (a.product_variant_id || 0)-(b.product_variant_id || 0))) {
      if (item.delta) await updateProductStock(connection, item.product_id, item.delta, `Purchase edited #${req.params.id}`, req.user.id, item.product_variant_id);
    }

    await connection.query(
      `UPDATE purchases SET supplier_id = ?, invoice_no = ?, total_amount = ?, paid_amount = ?,
       due_amount = ?, payment_status = ?, payment_method = ?, purchase_date = ? WHERE id = ?`,
      [input.supplier_id, input.invoice_no, input.total_amount, input.paid_amount, input.due_amount,
        input.payment_status, input.payment_method, input.purchase_date, req.params.id]
    );
    await connection.query('DELETE FROM purchase_items WHERE purchase_id = ?', [req.params.id]);
    for (const item of input.items) {
      await connection.query(
        'INSERT INTO purchase_items (purchase_id, product_id, product_variant_id, quantity, cost_price) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, item.product_id, item.product_variant_id, item.quantity, item.cost_price]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Purchase invoice and inventory were updated successfully.' });
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Invoice number already exists. Please use a unique invoice number.' });
    }
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

router.patch('/purchases/:id/payment', protect, adminOnly, async (req, res) => {
  try {
    const [[purchase]] = await pool.query('SELECT total_amount FROM purchases WHERE id = ?', [req.params.id]);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });

    const paidAmount = Number(req.body.paid_amount);
    const totalAmount = Number(purchase.total_amount);
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > totalAmount) {
      return res.status(400).json({ success: false, message: 'Paid amount must be between zero and the invoice total.' });
    }
    const paymentMethod = req.body.payment_method === 'Bank Transfer' ? 'Bank Transfer' : 'Cash';
    const dueAmount = Math.round((totalAmount - paidAmount) * 100) / 100;
    const paymentStatus = purchasePaymentStatus(totalAmount, paidAmount);
    await pool.query(
      'UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ?, payment_method = ? WHERE id = ?',
      [paidAmount, dueAmount, paymentStatus, paymentMethod, req.params.id]
    );
    res.json({ success: true, message: 'Supplier payment was updated.', paid_amount: paidAmount, due_amount: dueAmount, payment_status: paymentStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/purchases/:id', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[purchase]] = await connection.query('SELECT id, invoice_no FROM purchases WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!purchase) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Purchase invoice not found.' });
    }
    const [items] = await connection.query(
      'SELECT product_id, product_variant_id, quantity FROM purchase_items WHERE purchase_id = ? FOR UPDATE',
      [req.params.id]
    );
    for (const item of items) {
      if (item.product_id) await updateProductStock(connection, Number(item.product_id), -Number(item.quantity), `Purchase deleted #${req.params.id}`, req.user.id, item.product_variant_id);
    }
    await connection.query('DELETE FROM purchases WHERE id = ?', [req.params.id]);
    await connection.commit();
    res.json({ success: true, message: `Invoice ${purchase.invoice_no} was deleted and its stock was reversed.` });
  } catch (error) {
    await connection.rollback();
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// TRANSACTIONS & PAYMENTS MANAGEMENT
// ==========================================

router.get('/transactions', protect, adminOnly, async (req, res) => {
  try {
    const [transactions] = await pool.query(`
      SELECT 
        o.id AS order_id,
        COALESCE(o.transaction_id, CONCAT('TXN-', YEAR(COALESCE(o.created_at, NOW())), '-', LPAD(o.id, 5, '0'))) AS transaction_id,
        o.customer_name,
        o.email,
        o.phone,
        o.total_amount,
        o.payment_method,
        o.payment_status,
        o.order_status,
        o.created_at,
        CASE 
          WHEN o.payment_status = 'Refunded' OR r.status = 'Refunded' THEN 'Refund'
          ELSE 'Payment'
        END AS transaction_type,
        r.status AS return_status,
        r.refund_amount
      FROM orders o
      LEFT JOIN return_requests r ON r.order_id = o.id
      ORDER BY o.created_at DESC
    `);

    const [[stats]] = await pool.query(`
      SELECT 
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END), 0) AS successfulAmount,
        COALESCE(SUM(CASE WHEN payment_status IN ('Unpaid', 'Pending') THEN total_amount ELSE 0 END), 0) AS pendingAmount,
        COALESCE(SUM(CASE WHEN payment_status IN ('Failed', 'Refunded') THEN total_amount ELSE 0 END), 0) AS failedAmount
      FROM orders
    `);

    res.json({
      success: true,
      transactions,
      stats: {
        totalTransactions: Number(stats?.totalTransactions || 0),
        successfulAmount: Number(stats?.successfulAmount || 0),
        pendingAmount: Number(stats?.pendingAmount || 0),
        failedAmount: Number(stats?.failedAmount || 0),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/transactions/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { payment_status } = req.body;
    const allowed = ['Paid', 'Unpaid', 'Pending', 'Failed', 'Refunded'];
    if (!allowed.includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status.' });
    }

    const orderId = String(req.params.id).replace(/^ORD-/i, '').trim();
    const [[order]] = await pool.query('SELECT id, transaction_id, payment_status, total_amount, customer_name FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    let txnId = order.transaction_id;
    if (payment_status === 'Paid' && !txnId) {
      txnId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    await pool.query(
      'UPDATE orders SET payment_status = ?, transaction_id = ? WHERE id = ?',
      [payment_status, txnId, orderId]
    );

    res.json({
      success: true,
      message: `Payment status updated to ${payment_status}`,
      transaction_id: txnId,
      payment_status
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/transactions/refunds', protect, adminOnly, async (req, res) => {
  try {
    const [refunds] = await pool.query(`
      SELECT 
        r.id,
        r.order_id,
        r.reason,
        r.status,
        r.refund_amount,
        r.refund_reference,
        r.admin_notes,
        r.created_at,
        o.customer_name,
        o.email,
        o.total_amount,
        o.payment_method,
        o.payment_status
      FROM return_requests r
      JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, refunds });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/transactions/refunds/:id/action', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { action, admin_notes } = req.body;
    const [[record]] = await connection.query(
      'SELECT r.*, o.total_amount FROM return_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!record) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Refund request not found.' });
    }

    if (action === 'approve') {
      const refundAmount = req.body.refund_amount !== undefined ? Number(req.body.refund_amount) : Number(record.total_amount);
      const refundRef = req.body.refund_reference || `REF-${Date.now().toString(36).toUpperCase()}`;
      await connection.query(
        'UPDATE return_requests SET status = "Refunded", refund_amount = ?, refund_reference = ?, admin_notes = ? WHERE id = ?',
        [refundAmount, refundRef, admin_notes || 'Approved via Transactions management', record.id]
      );
      await connection.query(
        'UPDATE orders SET payment_status = "Refunded" WHERE id = ?',
        [record.order_id]
      );
    } else if (action === 'reject') {
      await connection.query(
        'UPDATE return_requests SET status = "Rejected", admin_notes = ? WHERE id = ?',
        [admin_notes || 'Rejected via Transactions management', record.id]
      );
    } else {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Invalid action. Must be approve or reject.' });
    }

    await connection.commit();
    res.json({ success: true, message: `Refund request ${action === 'approve' ? 'approved' : 'rejected'} successfully.` });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

export default router;
