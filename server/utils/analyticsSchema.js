export async function ensureAnalyticsSchema(db) {
  // Range filtering is on raw created_at; existing FK indexes cover item joins.
  for (const [table, name, columns] of [['orders','analytics_order_date','created_at'],['users','analytics_customer_date','role,created_at']]) {
    const [indexes] = await db.query(`SHOW INDEX FROM ${table} WHERE Key_name=?`, [name]);
    if (!indexes.length) await db.query(`CREATE INDEX ${name} ON ${table} (${columns})`);
  }
}
