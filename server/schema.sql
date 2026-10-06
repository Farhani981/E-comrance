-- Database Schema (Database creation is managed by config/db.js with dynamic DB_NAME)


-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  phone VARCHAR(50) NOT NULL DEFAULT '',
  address TEXT NULL,
  city VARCHAR(100) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  count VARCHAR(100) DEFAULT '0 Products',
  img TEXT NOT NULL,
  link VARCHAR(255) DEFAULT '/shop',
  isVisible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Banners Table
CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  buttonText VARCHAR(100) DEFAULT 'Shop Now',
  image TEXT NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  position INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Collections Table
CREATE TABLE IF NOT EXISTS collections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  badge VARCHAR(50) DEFAULT 'SALE',
  image TEXT,
  productCount INT DEFAULT 0,
  isActive BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  category_id INT,
  category_name VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  stock INT DEFAULT 0,
  image LONGTEXT,
  description TEXT,
  status ENUM('Active', 'Low Stock', 'Out of Stock') DEFAULT 'Active',
  rating DECIMAL(2, 1) DEFAULT 4.5,
  reviews_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(50) PRIMARY KEY,
  user_id INT NULL,
  customer_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT NOT NULL,
  city VARCHAR(100),
  subtotal DECIMAL(14,2) NULL,
  discount_amount DECIMAL(14,2) NULL,
  shipping_amount DECIMAL(14,2) NULL,
  tax_amount DECIMAL(14,2) NULL,
  currency CHAR(3) NULL,
  coupon_code VARCHAR(100) NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Cash on Delivery',
  payment_status VARCHAR(50) DEFAULT 'Unpaid',
  transaction_id VARCHAR(255),
  order_status VARCHAR(50) DEFAULT 'Pending',
  tracking_number VARCHAR(255) NULL,
  courier_name VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  image LONGTEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 8. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id INT NULL,
  invoice_no VARCHAR(100) NOT NULL UNIQUE,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('Paid', 'Unpaid', 'Partial') DEFAULT 'Unpaid',
  payment_method ENUM('Cash', 'Bank Transfer') DEFAULT 'Cash',
  purchase_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- 10. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id INT NOT NULL,
  product_id INT NULL,
  quantity INT NOT NULL DEFAULT 1,
  cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 11. Customer Payment Ledger
CREATE TABLE IF NOT EXISTS customer_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  entry_type ENUM('debit', 'credit') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  order_id VARCHAR(50),
  payment_method VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Seed Initial Categories (Optional / Default data)
INSERT IGNORE INTO categories (id, name, count, img, link, isVisible) VALUES
(1, 'Casual Shirts', '140+ Products', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80', '/shop?category=Casual-Shirts', TRUE),
(2, 'Formal Shirts', '95+ Products', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80', '/shop?category=Formal-Shirts', TRUE),
(3, 'T-Shirts & Polos', '210+ Products', 'https://images.unsplash.com/photo-1571945153237-4929e783af4a?q=80&w=387', '/shop?category=T-Shirts', TRUE),
(4, 'Denim Jeans', '180+ Products', 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?q=80&w=435', '/shop?category=Jeans', TRUE),
(5, 'Jackets & Coats', '75+ Products', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80', '/shop?category=Jackets', TRUE);

-- Banners are managed by the dashboard. Never re-seed deleted campaigns on startup.
