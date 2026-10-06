import { ensurePaymentSchema } from './paymentSchema.js';
import { ensureAnalyticsSchema } from './analyticsSchema.js';
import { ensureShoppingSchema } from './shopping.js';
import { ensureContactSchema } from './contactMessages.js';
import { ensureStoreSettingsSchema } from './storeSettings.js';
import { ensureProfileSchema } from './profile.js';
import { ensureOrderPricingSchema } from './orderPricingSchema.js';
import pool from '../config/db.js';
import { ensureImageSchema } from './imageSchema.js';
let ready;
export function ensureVariantSchema() {
  ready ||= migrate().catch(error => { ready = undefined; throw error; });
  return ready;
}
async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS product_attributes (
    id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(10) NOT NULL, attribute_values JSON NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS attribute_values (
    id INT AUTO_INCREMENT PRIMARY KEY, attribute_id INT NOT NULL, label VARCHAR(100) NOT NULL,
    color_hex CHAR(7), UNIQUE KEY attribute_label (attribute_id,label),
    UNIQUE KEY attribute_pair (attribute_id,id),
    FOREIGN KEY (attribute_id) REFERENCES product_attributes(id) ON DELETE RESTRICT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL,
    combination_hash CHAR(64) NOT NULL, options JSON NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE, image_url LONGTEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL, sale_price DECIMAL(12,2) NULL,
    stock_quantity INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE KEY product_combination (product_id,combination_hash),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CHECK (price > 0), CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)),
    CHECK (stock_quantity >= 0))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS product_attribute_values (
    product_id INT NOT NULL, attribute_id INT NOT NULL, value_id INT NOT NULL,
    PRIMARY KEY (product_id,attribute_id,value_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (attribute_id,value_id) REFERENCES attribute_values(attribute_id,id) ON DELETE RESTRICT)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS variant_attribute_values (
    variant_id INT NOT NULL, attribute_id INT NOT NULL, value_id INT NOT NULL,
    PRIMARY KEY (variant_id,attribute_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (attribute_id,value_id) REFERENCES attribute_values(attribute_id,id) ON DELETE RESTRICT)`);
  for (const [table, column, definition] of [
    ['purchase_items', 'product_variant_id', 'INT NULL'],
    ['products', 'deleted_at', 'DATETIME NULL'],
    ['products', 'attributes', 'JSON NULL'],
    ['products', 'has_variants', 'BOOLEAN NOT NULL DEFAULT FALSE'],
    ['order_items', 'product_variant_id', 'INT NULL'],
    ['order_items', 'variant_sku', 'VARCHAR(100) NULL'],
    ['order_items', 'variant_options', 'JSON NULL']
  ]) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (!columns.length) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  // Also runs through the existing API schema gate before orders are accepted.
  await ensureAnalyticsSchema(pool);
  await ensureContactSchema(pool);
  await ensureShoppingSchema(pool);
  await ensurePaymentSchema(pool);
  await ensureStoreSettingsSchema(pool);
  await ensureProfileSchema(pool);
  await ensureOrderPricingSchema(pool);
  await ensureImageSchema(pool, true);
}
