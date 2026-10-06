export async function ensureNotificationSchema(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      priority ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata JSON NULL,
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at),
      INDEX idx_type (type)
    );
  `;
  await db.query(sql);
}
