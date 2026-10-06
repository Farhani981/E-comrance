CREATE TABLE IF NOT EXISTS warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  address VARCHAR(500) NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS inventory_settings (
  product_id INT PRIMARY KEY,
  warehouse_id INT NULL,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  delta INT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  actor_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS product_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT NOT NULL,
  comment TEXT NOT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY review_per_customer (product_id, user_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS return_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  reason VARCHAR(1000) NOT NULL,
  status ENUM('Requested','Approved','Rejected','Received','Refunded') NOT NULL DEFAULT 'Requested',
  refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  refund_reference VARCHAR(255) NOT NULL DEFAULT '',
  admin_notes VARCHAR(1000) NOT NULL DEFAULT '',
  restocked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(50) NULL UNIQUE,
  discount_type ENUM('Percentage','Fixed') NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  product_id INT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS order_payment_receipts (
  transaction_id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
