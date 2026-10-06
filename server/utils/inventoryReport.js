import { readStoreSettings } from './storeSettings.js';
// Aggregate each source separately so multiple invoices/orders cannot multiply totals.
export async function inventoryReport(db) {
  const settings = await readStoreSettings(db);
  const [products] = await db.query(`
    SELECT p.id, p.name, p.image, p.sku, p.stock, p.price,
      COALESCE(s.low_stock_threshold, ?) AS low_stock_threshold,
      s.warehouse_id, w.name AS warehouse_name,
      COALESCE(b.purchased_units, 0) AS purchased_units,
      COALESCE(b.purchase_cost, 0) AS purchase_cost,
      b.average_cost, b.last_purchase_date, b.supplier_names,
      COALESCE(o.sold_units, 0) AS sold_units,
      COALESCE(o.committed_units, 0) AS committed_units,
      COALESCE(o.returned_units, 0) AS returned_units,
      COALESCE(o.sales_value, 0) AS sales_value,
      o.last_sale_date
    FROM products p
    LEFT JOIN inventory_settings s ON s.product_id = p.id
    LEFT JOIN warehouses w ON w.id = s.warehouse_id
    LEFT JOIN (
      SELECT pi.product_id, SUM(pi.quantity) AS purchased_units,
        SUM(pi.quantity * pi.cost_price) AS purchase_cost,
        SUM(pi.quantity * pi.cost_price) / NULLIF(SUM(pi.quantity), 0) AS average_cost,
        MAX(pu.purchase_date) AS last_purchase_date,
        GROUP_CONCAT(DISTINCT COALESCE(su.name, 'Unknown supplier') ORDER BY su.name SEPARATOR ', ') AS supplier_names
      FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
      LEFT JOIN suppliers su ON su.id = pu.supplier_id GROUP BY pi.product_id
    ) b ON b.product_id = p.id
    LEFT JOIN (
      -- Sold counts every delivered/completed unit, returns are reported separately so that
      -- available = opening + purchases - delivered + returned +/- manual adjustments stays traceable.
      SELECT oi.product_id,
        SUM(CASE WHEN o.order_status IN ('Delivered', 'Completed') THEN oi.quantity ELSE 0 END) AS sold_units,
        SUM(CASE WHEN o.order_status IN ('Pending', 'Processing', 'Shipped') THEN oi.quantity ELSE 0 END) AS committed_units,
        SUM(CASE WHEN o.order_status <> 'Cancelled' AND COALESCE(r.restocked, 0) = 1 THEN oi.quantity ELSE 0 END) AS returned_units,
        SUM(CASE WHEN o.order_status IN ('Delivered', 'Completed') AND COALESCE(r.restocked, 0) = 0 THEN oi.quantity * oi.price ELSE 0 END) AS sales_value,
        MAX(CASE WHEN o.order_status IN ('Delivered', 'Completed') THEN o.created_at END) AS last_sale_date
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      LEFT JOIN return_requests r ON r.order_id = o.id GROUP BY oi.product_id
    ) o ON o.product_id = p.id WHERE p.deleted_at IS NULL ORDER BY p.name`, [settings.lowStockThreshold]);
  return products;
}