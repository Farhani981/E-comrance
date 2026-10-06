// Historical orders retain NULL breakdowns; do not invent old pricing details.
export async function ensureOrderPricingSchema(db) {
  for (const [column, definition] of [
    ['subtotal', 'DECIMAL(14,2) NULL'], ['discount_amount', 'DECIMAL(14,2) NULL'],
    ['shipping_amount', 'DECIMAL(14,2) NULL'], ['tax_amount', 'DECIMAL(14,2) NULL'],
    ['currency', 'CHAR(3) NULL'], ['coupon_code', 'VARCHAR(100) NULL']
  ]) {
    const [rows] = await db.query('SHOW COLUMNS FROM orders LIKE ?', [column]);
    if (!rows.length) await db.query('ALTER TABLE orders ADD COLUMN ' + column + ' ' + definition);
  }
}
