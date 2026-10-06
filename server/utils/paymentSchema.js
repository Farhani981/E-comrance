export async function ensurePaymentSchema(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS payment_checkouts (
    id CHAR(36) PRIMARY KEY, recovery_hash CHAR(64) NOT NULL, user_id INT NULL,
    snapshot LONGTEXT NOT NULL, payment_intent_id VARCHAR(255) NULL UNIQUE,
    order_id VARCHAR(50) NULL UNIQUE, state VARCHAR(30) NOT NULL DEFAULT 'created',
    last_error_code VARCHAR(50) NULL, attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX payment_recovery_queue (state,next_attempt_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT)`);
}
