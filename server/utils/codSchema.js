export async function ensureCodSchema(db) {
  db = db || (await import('../config/db.js')).default;
  // 1. Ensure courier table exists for foreign key references if not already created
  await db.query(`
    CREATE TABLE IF NOT EXISTS shipping_couriers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) NOT NULL UNIQUE,
      tracking_url_template VARCHAR(255) NOT NULL,
      account_number VARCHAR(100) DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure orders.payment_status is VARCHAR(50) so it can store COD statuses
  try {
    await db.query(`ALTER TABLE orders MODIFY COLUMN payment_status VARCHAR(50) DEFAULT 'Unpaid'`);
  } catch (err) {
    // ignore if table doesn't exist yet
  }

  // 2. Courier Settlements Table (Master Batch)
  await db.query(`
    CREATE TABLE IF NOT EXISTS courier_settlements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      settlement_number VARCHAR(100) NOT NULL UNIQUE,
      courier_id INT NULL,
      courier_name VARCHAR(100) NOT NULL,
      settlement_date DATE NOT NULL,
      bank_reference VARCHAR(255) NOT NULL DEFAULT '',
      total_orders INT NOT NULL DEFAULT 0,
      total_cod_collected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      total_courier_charges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      total_other_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      expected_settlement DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      actual_settlement DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      difference DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      settlement_status VARCHAR(50) NOT NULL DEFAULT 'Settlement Pending',
      notes TEXT NULL,
      attachment_url TEXT NULL,
      created_by INT NULL,
      reconciled_by INT NULL,
      reconciled_at DATETIME NULL,
      reconciliation_reference VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_settlement_date (settlement_date),
      INDEX idx_settlement_courier (courier_name),
      INDEX idx_settlement_status (settlement_status),
      FOREIGN KEY (courier_id) REFERENCES shipping_couriers(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 3. COD Transactions Table (Per Order COD Lifecycle)
  await db.query(`
    CREATE TABLE IF NOT EXISTS cod_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id VARCHAR(100) NOT NULL UNIQUE,
      order_id VARCHAR(50) NOT NULL UNIQUE,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(50) NULL DEFAULT '',
      courier_id INT NULL,
      courier_name VARCHAR(100) NULL,
      tracking_number VARCHAR(255) NULL,
      order_total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      cod_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      courier_charges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      other_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      expected_settlement DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      actual_settlement DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      difference DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      payment_status VARCHAR(50) NOT NULL DEFAULT 'COD Pending',
      settlement_status VARCHAR(50) NOT NULL DEFAULT 'Unsettled',
      settlement_id INT NULL,
      delivery_date DATETIME NULL,
      settlement_date DATETIME NULL,
      reconciled_at DATETIME NULL,
      reconciled_by INT NULL,
      reconciliation_reference VARCHAR(255) NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cod_order (order_id),
      INDEX idx_cod_tracking (tracking_number),
      INDEX idx_cod_courier (courier_name),
      INDEX idx_cod_pay_status (payment_status),
      INDEX idx_cod_settle_status (settlement_status),
      INDEX idx_cod_settlement_id (settlement_id),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (courier_id) REFERENCES shipping_couriers(id) ON DELETE SET NULL,
      FOREIGN KEY (settlement_id) REFERENCES courier_settlements(id) ON DELETE SET NULL,
      FOREIGN KEY (reconciled_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 4. Settlement Items Table (Links COD transactions to settlement batches)
  await db.query(`
    CREATE TABLE IF NOT EXISTS settlement_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      settlement_id INT NOT NULL,
      cod_transaction_id INT NOT NULL,
      order_id VARCHAR(50) NOT NULL,
      cod_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      courier_charges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      other_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      expected_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      actual_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      difference DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      status VARCHAR(50) NOT NULL DEFAULT 'Settled',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_item_settlement (settlement_id),
      INDEX idx_item_cod_txn (cod_transaction_id),
      INDEX idx_item_order (order_id),
      UNIQUE KEY uq_settlement_cod_txn (settlement_id, cod_transaction_id),
      FOREIGN KEY (settlement_id) REFERENCES courier_settlements(id) ON DELETE CASCADE,
      FOREIGN KEY (cod_transaction_id) REFERENCES cod_transactions(id) ON DELETE CASCADE
    )
  `);

  // 5. COD Financial Adjustments
  await db.query(`
    CREATE TABLE IF NOT EXISTS cod_adjustments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cod_transaction_id INT NULL,
      settlement_id INT NULL,
      adjustment_type VARCHAR(100) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
      reason TEXT NOT NULL,
      document_url TEXT NULL,
      actor_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_adj_cod_txn (cod_transaction_id),
      INDEX idx_adj_settlement (settlement_id),
      FOREIGN KEY (cod_transaction_id) REFERENCES cod_transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (settlement_id) REFERENCES courier_settlements(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 6. COD Audit Logs
  await db.query(`
    CREATE TABLE IF NOT EXISTS cod_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cod_transaction_id INT NULL,
      settlement_id INT NULL,
      order_id VARCHAR(50) NULL,
      actor_id INT NULL,
      actor_name VARCHAR(255) NULL,
      action VARCHAR(100) NOT NULL,
      previous_status VARCHAR(50) NULL,
      new_status VARCHAR(50) NULL,
      previous_amount DECIMAL(12, 2) NULL,
      new_amount DECIMAL(12, 2) NULL,
      details TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_cod_txn (cod_transaction_id),
      INDEX idx_audit_settlement (settlement_id),
      INDEX idx_audit_order (order_id),
      FOREIGN KEY (cod_transaction_id) REFERENCES cod_transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (settlement_id) REFERENCES courier_settlements(id) ON DELETE SET NULL,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 7. Auto-backfill existing COD orders into cod_transactions if missing
  try {
    const [existingOrders] = await db.query(`
      SELECT o.id, o.customer_name, o.email, o.phone, o.total_amount, o.shipping_amount,
             o.payment_method, o.payment_status, o.order_status, o.courier_name, o.tracking_number,
             o.created_at
      FROM orders o
      LEFT JOIN cod_transactions ct ON ct.order_id = o.id
      WHERE (LOWER(o.payment_method) LIKE '%cash%' OR LOWER(o.payment_method) LIKE '%cod%')
        AND ct.id IS NULL
    `);

    for (const ord of existingOrders) {
      const orderTotal = Number(ord.total_amount) || 0;
      const courierCharges = Number(ord.shipping_amount) > 0 ? Number(ord.shipping_amount) : 200.00;
      const otherDeductions = 0.00;
      const expectedSettlement = Math.max(0, orderTotal - courierCharges - otherDeductions);
      const txnNumber = `COD-TXN-${String(ord.id).replace(/\D/g, '').padEnd(6, '0').slice(-6) || Math.floor(100000 + Math.random() * 900000)}`;

      let payStatus = 'COD Pending';
      let settleStatus = 'Unsettled';
      let delivDate = null;
      let actualSettlement = 0.00;
      let diff = -expectedSettlement;

      if (ord.order_status === 'Delivered') {
        delivDate = ord.created_at;
        if (ord.payment_status === 'Paid') {
          payStatus = 'Settled';
          settleStatus = 'Settled';
          actualSettlement = expectedSettlement;
          diff = 0.00;
        } else {
          payStatus = 'Collected by Courier';
          settleStatus = 'Settlement Pending';
        }
      } else if (ord.order_status === 'Shipped' || ord.order_status === 'Out for Delivery') {
        payStatus = 'COD Pending';
        settleStatus = 'Unsettled';
      } else if (ord.order_status === 'Cancelled') {
        payStatus = 'Failed / Uncollectable';
        settleStatus = 'Unsettled';
      } else if (ord.order_status === 'Returned') {
        payStatus = 'Refunded';
        settleStatus = 'Unsettled';
      }

      await db.query(`
        INSERT IGNORE INTO cod_transactions (
          transaction_id, order_id, customer_name, customer_email, customer_phone,
          courier_name, tracking_number, order_total, cod_amount, courier_charges,
          other_deductions, expected_settlement, actual_settlement, difference,
          payment_status, settlement_status, delivery_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        txnNumber,
        ord.id,
        ord.customer_name || 'Customer',
        ord.email || 'customer@example.com',
        ord.phone || '',
        ord.courier_name || 'Trax Logistics',
        ord.tracking_number || null,
        orderTotal,
        orderTotal,
        courierCharges,
        otherDeductions,
        expectedSettlement,
        actualSettlement,
        diff,
        payStatus,
        settleStatus,
        delivDate,
        ord.created_at
      ]);
    }
  } catch (err) {
    console.error('Notice: COD backfill check skipped or completed with message:', err.message);
  }
}
