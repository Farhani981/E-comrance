import { ensurePaymentSchema } from '../utils/paymentSchema.js';
import { ensureShoppingSchema } from '../utils/shopping.js';
import { ensureContactSchema } from '../utils/contactMessages.js';
import { ensureStoreSettingsSchema } from '../utils/storeSettings.js';
import { ensureProfileSchema } from '../utils/profile.js';
import { ensureOrderPricingSchema } from '../utils/orderPricingSchema.js';
import { ensureNotificationSchema } from '../utils/notificationSchema.js';
import { ensureCatalogSchema } from '../utils/catalogSchema.js';
import { ensureBannerSchema } from '../utils/bannerSchema.js';
import { ensureImageSchema } from '../utils/imageSchema.js';
import { ensureCodSchema } from '../utils/codSchema.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initial pool without database specified to create database if not exists
export const initDatabase = async () => {
  try {
    const rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'ecommerce_db'}\`;`);
    await rootConnection.end();

    // Read and run schema.sql
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      const dbConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ecommerce_db',
        multipleStatements: true,
      });
      await dbConnection.query(schemaSql);
      await ensureBannerSchema(dbConnection);
      await ensureContactSchema(dbConnection);
  await ensureShoppingSchema(dbConnection);
  await ensurePaymentSchema(dbConnection);
  await ensureStoreSettingsSchema(dbConnection);
  await ensureProfileSchema(dbConnection);
      await ensureOrderPricingSchema(dbConnection);
      await ensureNotificationSchema(dbConnection);
      await ensureImageSchema(dbConnection);
      await ensureCodSchema(dbConnection);
      // Recover images truncated by the former TEXT column from an intact variant.
      await dbConnection.query(`UPDATE products p JOIN product_variants v ON v.product_id=p.id
        SET p.image=v.image_url
        WHERE OCTET_LENGTH(p.image)=65535 AND p.image LIKE 'data:image/%'
        AND OCTET_LENGTH(v.image_url)>65535
        AND LEFT(v.image_url,65535)=p.image`).catch(error => {
          if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
        });
      const [subcategoryColumns] = await dbConnection.query("SHOW COLUMNS FROM products LIKE 'subcategory'");
      if (!subcategoryColumns.length) await dbConnection.query("ALTER TABLE products ADD COLUMN subcategory VARCHAR(255) DEFAULT ''");
      await ensureCatalogSchema(dbConnection);
      await dbConnection.query(fs.readFileSync(path.join(__dirname, '..', 'operations-schema.sql'), 'utf-8'));
      await dbConnection.query(
        "ALTER TABLE orders MODIFY COLUMN order_status VARCHAR(50) DEFAULT 'Pending'"
      );
      await dbConnection.query(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Unpaid', ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255)"
      );
      await dbConnection.query(
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0"
      );
      await dbConnection.query(
        "UPDATE products SET stock_quantity = stock WHERE (stock_quantity IS NULL OR stock_quantity = 0) AND stock > 0"
      );
      await dbConnection.end();
      console.log('✅ Database & Tables initialized successfully!');
    }
  } catch (err) {
    console.error('⚠️ Database Auto-Initialization notice:', err.message);
  }
};

// Create main connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup
export const testDBConnection = async () => {
  await initDatabase();
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL Connection Pool Active & Ready');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL Connection Failed:', error.message);
    console.log('💡 Tip: Make sure your MySQL Server (XAMPP / MySQL service) is running in the background.');
  }
};

export default pool;
