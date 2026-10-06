// Widen only: existing URL/base64 snapshots are never deleted or rewritten.
export async function ensureImageSchema(db, includeVariants = false) {
  const columns = [['products', 'image'], ['order_items', 'image']];
  if (includeVariants) columns.push(['product_variants', 'image_url']);
  for (const [table, column] of columns) {
    const [rows] = await db.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (!rows.length) throw new Error(`Missing image column: ${table}.${column}`);
    if (rows[0].Type.toLowerCase() !== 'longtext') {
      await db.query(`ALTER TABLE ${table} MODIFY COLUMN ${column} LONGTEXT ${rows[0].Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    }
  }
}
