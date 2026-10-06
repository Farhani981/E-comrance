import { analyticsError, growth } from './analyticsDates.js';
import { readStoreSettings } from './storeSettings.js';

// Scope orders before joining separately aggregated items. Never multiply money
// by item count. Current refund state is attributed to the original order cohort.
const facts = `WITH scoped AS (
 SELECT o.*, CASE WHEN o.order_status <> 'Cancelled' THEN 1 ELSE 0 END AS booked,
 CASE WHEN o.order_status IN ('Delivered','Completed') AND COALESCE(r.restocked,0)=0 THEN 1 ELSE 0 END AS sold,
 CASE WHEN r.status='Refunded' THEN r.refund_amount ELSE 0 END AS refund,
 CASE WHEN r.status='Refunded' THEN 'Refunded' WHEN r.status='Received' AND o.order_status<>'Cancelled' THEN 'Returned'
 WHEN o.order_status='Completed' THEN 'Delivered' ELSE o.order_status END AS report_status,
 CASE WHEN o.user_id IS NOT NULL THEN CONCAT('user:',o.user_id) ELSE CONCAT('guest:',LOWER(TRIM(o.email))) END AS customer_key
 FROM orders o LEFT JOIN return_requests r ON r.order_id=o.id
 WHERE o.created_at>=? AND o.created_at<?
), quantities AS (
 SELECT oi.order_id,SUM(oi.quantity) AS units FROM order_items oi JOIN scoped s ON s.id=oi.order_id GROUP BY oi.order_id
), f AS (SELECT s.*,COALESCE(q.units,0) AS units FROM scoped s LEFT JOIN quantities q ON q.order_id=s.id)`;
const money = expression => `COALESCE(SUM(CASE WHEN currency='PKR' THEN ${expression} ELSE 0 END),0)`;
const net = `CASE WHEN booked=1 THEN total_amount-refund ELSE 0 END`;
const customerKey = `CASE WHEN user_id IS NOT NULL THEN CONCAT('user:',user_id) ELSE CONCAT('guest:',LOWER(TRIM(email))) END`;
const periodArgs = period => [period.start, period.until];
const numberRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) && !['id','sku','period','coupon','name','customer','category','warehouse','payment_method','status'].includes(key) ? Number(value) : value])));
const category = `COALESCE(c.name,NULLIF(p.category_name,''),'Uncategorized')`;
const productSales = `, ps AS (SELECT oi.product_id, SUM(oi.quantity*f.sold) AS units,
 SUM(CASE WHEN f.currency='PKR' THEN oi.quantity*oi.price*f.sold ELSE 0 END) AS revenue,
 COUNT(DISTINCT CASE WHEN f.sold=1 THEN f.id END) AS orders
 FROM order_items oi JOIN f ON f.id=oi.order_id GROUP BY oi.product_id)`;
const inventoryCTE = `WITH costs AS (
 SELECT product_id,COALESCE(product_variant_id,0) AS variant_id,SUM(quantity*cost_price)/NULLIF(SUM(quantity),0) AS cost
 FROM purchase_items GROUP BY product_id,COALESCE(product_variant_id,0)
), stock AS (
 SELECT p.id AS product_id,CONCAT('p-',p.id) AS id,p.name,p.sku,${category} AS category,p.stock,p.price,
 COALESCE(s.low_stock_threshold,?) AS minimum_stock,w.name AS warehouse,b.cost,p.stock*b.cost AS inventory_value
 FROM products p LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id
 LEFT JOIN inventory_settings s ON s.product_id=p.id LEFT JOIN warehouses w ON w.id=s.warehouse_id
 LEFT JOIN costs b ON b.product_id=p.id AND b.variant_id=0 WHERE p.deleted_at IS NULL AND p.has_variants=0
 UNION ALL
 SELECT p.id,CONCAT('v-',v.id),p.name,v.sku,${category},v.stock_quantity,COALESCE(v.sale_price,v.price),
 COALESCE(s.low_stock_threshold,?),w.name,b.cost,v.stock_quantity*b.cost
 FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id
 LEFT JOIN inventory_settings s ON s.product_id=p.id LEFT JOIN warehouses w ON w.id=s.warehouse_id
 LEFT JOIN costs b ON b.product_id=p.id AND b.variant_id=v.id WHERE p.deleted_at IS NULL AND p.has_variants=1 AND v.is_active=1
)`;

export async function inventorySummary(db) {
  const settings = await readStoreSettings(db);
  const [[row]] = await db.query(`${inventoryCTE} SELECT COUNT(DISTINCT product_id) AS products,COALESCE(SUM(stock),0) AS stock_units,
 COUNT(DISTINCT CASE WHEN stock>0 AND stock<=minimum_stock THEN product_id END) AS low_stock_products,
 COALESCE(SUM(stock=0),0) AS out_of_stock_skus,COALESCE(SUM(inventory_value),0) AS inventory_value,
 COALESCE(SUM(cost IS NULL AND stock>0),0) AS uncosted_skus FROM stock`, [settings.lowStockThreshold, settings.lowStockThreshold]);
  const [[catalog]] = await db.query(`SELECT COUNT(*) AS products,COALESCE(SUM(p.stock>0 AND p.stock<=COALESCE(s.low_stock_threshold,?)),0) AS low_stock_products,COALESCE(SUM(p.stock=0),0) AS out_of_stock_products FROM products p LEFT JOIN inventory_settings s ON s.product_id=p.id WHERE p.deleted_at IS NULL`, [settings.lowStockThreshold]);
  Object.assign(row, catalog);
  return numberRows([row])[0];
}
async function totals(db, start, until) {
  const [[row]] = await db.query(`${facts} SELECT COUNT(*) AS orders,${money(net)} AS revenue,
 COALESCE(SUM(units*sold),0) AS products_sold,COALESCE(SUM(order_status='Pending'),0) AS pending_orders,
 COALESCE(SUM(order_status IN ('Delivered','Completed')),0) AS completed_orders,COALESCE(SUM(order_status='Cancelled'),0) AS cancelled_orders,
 ${money('refund')} AS refunded_amount,${money('booked*refund')} AS sales_refunds,
 ${money('booked*total_amount')} AS booked_value,${money('booked*subtotal')} AS gross_sales,
 ${money('booked*discount_amount')} AS discounts,${money('booked*shipping_amount')} AS shipping,${money('booked*tax_amount')} AS tax,
 COALESCE(SUM(booked=1 AND currency='PKR'),0) AS valued_orders,
 COALESCE(SUM(currency IS NULL OR currency<>'PKR'),0) AS unknown_currency_orders,
 COALESCE(SUM(booked=1 AND (subtotal IS NULL OR discount_amount IS NULL OR shipping_amount IS NULL OR tax_amount IS NULL)),0) AS missing_breakdown_orders,
 COUNT(DISTINCT CASE WHEN booked=1 THEN customer_key END) AS active_customers,
 COUNT(DISTINCT CASE WHEN booked=1 AND currency='PKR' THEN customer_key END) AS valued_customers,
 COALESCE(SUM(booked=1 AND NULLIF(coupon_code,'') IS NOT NULL),0) AS coupons_used,
 COALESCE(SUM(booked),0) AS customer_orders FROM f`, [start, until]);
  const [[customers]] = await db.query(`SELECT COUNT(*) AS total_customers,COALESCE(SUM(created_at>=?),0) AS new_customers FROM users WHERE role='user' AND created_at<?`, [start, until]);
  const [[returning]] = await db.query(`${facts}, prior AS (SELECT DISTINCT ${customerKey} AS customer_key FROM orders WHERE created_at<? AND order_status<>'Cancelled') SELECT COUNT(DISTINCT f.customer_key) AS returning_customers FROM f JOIN prior p ON p.customer_key=f.customer_key WHERE f.booked=1`, [start, until, start]);
  const value = numberRows([{ ...row, ...customers, ...returning }])[0];
  value.average_order_value = value.valued_orders ? Math.round(value.booked_value / value.valued_orders * 100) / 100 : 0;
  value.average_customer_spending = value.valued_customers ? Math.round(value.revenue / value.valued_customers * 100) / 100 : 0;
  value.average_orders_per_customer = value.active_customers ? Math.round(value.customer_orders / value.active_customers * 100) / 100 : 0;
  return value;
}
export async function overview(db, period) {
  const current = await totals(db, period.start, period.until);
  const previous = await totals(db, period.previousStart, period.previousUntil);
  const inventory = await inventorySummary(db);
  const [[coupon]] = await db.query(`${facts} SELECT coupon_code AS code,COUNT(*) AS uses FROM f WHERE booked=1 AND NULLIF(coupon_code,'') IS NOT NULL GROUP BY coupon_code ORDER BY uses DESC,coupon_code LIMIT 1`, periodArgs(period));
  return { current, previous, growth: Object.fromEntries(Object.keys(current).map(key => [key, growth(current[key], previous[key])])), inventory, mostUsedCoupon: coupon || null };
}

export async function reportDefinition(db, type, period) {
  const args = periodArgs(period);
  const bucket = { daily: `DATE_FORMAT(created_at,'%Y-%m-%d')`, weekly: `DATE_FORMAT(DATE_SUB(created_at,INTERVAL WEEKDAY(created_at) DAY),'%Y-%m-%d')`, monthly: `DATE_FORMAT(created_at,'%Y-%m')`, yearly: `DATE_FORMAT(created_at,'%Y')` }[period.bucket];
  const common = { cte: facts, args, search: [], filters: {}, defaultSort: 'revenue', direction: 'DESC' };
  const definitions = {
    sales: { ...common, sql: `SELECT ${bucket} AS period,COUNT(*) AS orders,COALESCE(SUM(units*sold),0) AS units_sold,${money('booked*subtotal')} AS gross_sales,${money('booked*discount_amount')} AS discounts,${money('booked*shipping_amount')} AS shipping,${money('booked*tax_amount')} AS tax,${money('booked*refund')} AS refunds,${money(net)} AS revenue,COALESCE(SUM(currency IS NULL OR currency<>'PKR'),0) AS unknown_currency_orders,COALESCE(SUM(booked=1 AND (subtotal IS NULL OR discount_amount IS NULL OR shipping_amount IS NULL OR tax_amount IS NULL)),0) AS missing_breakdown_orders FROM f GROUP BY period`, columns: ['period','orders','units_sold','gross_sales','discounts','shipping','tax','refunds','revenue','unknown_currency_orders','missing_breakdown_orders'], defaultSort: 'period', direction: 'ASC' },
    orders: { ...common, sql: `SELECT id,customer_name AS customer,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s') AS date,total_amount AS total,currency,payment_method,payment_status,report_status AS status FROM f`, columns: ['id','customer','date','total','currency','payment_method','payment_status','status'], search: ['id','customer'], filters: { status: ['Pending','Processing','Shipped','Delivered','Cancelled','Returned','Refunded'], payment_status: ['Paid','Unpaid','Refunded','Partially Refunded'] }, defaultSort: 'date' },
    products: { ...common, cte: facts + productSales, sql: `SELECT p.id,p.name,${category} AS category,CASE WHEN p.deleted_at IS NULL THEN p.stock ELSE NULL END AS stock,CASE WHEN p.deleted_at IS NULL THEN 'Current' ELSE 'Archived' END AS catalog_status,COALESCE(ps.units,0) AS units,COALESCE(ps.revenue,0) AS revenue,COALESCE(ps.orders,0) AS orders FROM products p LEFT JOIN ps ON ps.product_id=p.id LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id WHERE p.deleted_at IS NULL OR ps.orders>0`, columns: ['id','name','category','stock','catalog_status','units','revenue','orders'], search: ['name','category'], defaultSort: 'units' },
    categories: { ...common, cte: facts + `, cs AS (
 SELECT COALESCE(c.name,NULLIF(p.category_name,''),'Uncategorized / deleted') AS category,
 SUM(oi.quantity*f.sold) AS units,COUNT(DISTINCT CASE WHEN f.sold=1 THEN f.id END) AS orders,
 SUM(CASE WHEN f.currency='PKR' THEN oi.price*oi.quantity*f.sold ELSE 0 END) AS revenue
 FROM order_items oi JOIN f ON f.id=oi.order_id LEFT JOIN products p ON p.id=oi.product_id
 LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id GROUP BY category
 ), cp AS (SELECT COALESCE(c.name,NULLIF(p.category_name,''),'Uncategorized / deleted') AS category,COUNT(*) AS products
 FROM products p LEFT JOIN catalog_nodes c ON c.id=p.catalog_category_id WHERE p.deleted_at IS NULL GROUP BY category),
 ck AS (SELECT category FROM cs UNION SELECT category FROM cp)`, sql: `SELECT ck.category,COALESCE(cp.products,0) AS products,COALESCE(cs.units,0) AS units,COALESCE(cs.orders,0) AS orders,COALESCE(cs.revenue,0) AS revenue,COALESCE(ROUND(100*cs.revenue/NULLIF(SUM(cs.revenue) OVER(),0),2),0) AS sales_percentage FROM ck LEFT JOIN cp ON cp.category=ck.category LEFT JOIN cs ON cs.category=ck.category`, columns: ['category','products','units','orders','revenue','sales_percentage'], search: ['category'] },
    customers: { ...common, sql: `SELECT SHA2(customer_key,256) AS id,MAX(customer_name) AS customer,COUNT(*) AS orders,${money('total_amount-refund')} AS spent,${money('total_amount')}/NULLIF(SUM(currency='PKR'),0) AS average_order_value,MAX(DATE_FORMAT(created_at,'%Y-%m-%d %H:%i:%s')) AS last_order FROM f WHERE booked=1 GROUP BY customer_key`, columns: ['id','customer','orders','spent','average_order_value','last_order'], search: ['customer'], defaultSort: 'spent' },
    payments: { ...common, sql: `SELECT COALESCE(payment_method,'Unspecified') AS payment_method,COUNT(*) AS order_count,COUNT(DISTINCT transaction_id) AS recorded_transactions,${money('total_amount')} AS order_amount,COALESCE(SUM(payment_status='Paid'),0) AS paid,COALESCE(SUM(payment_status='Unpaid'),0) AS unpaid,COALESCE(SUM(payment_status IN ('Refunded','Partially Refunded')),0) AS refunded,${money('refund')} AS refund_amount FROM f GROUP BY payment_method`, columns: ['payment_method','order_count','recorded_transactions','order_amount','paid','unpaid','refunded','refund_amount'], defaultSort: 'order_amount' },
    discounts: { ...common, sql: `SELECT COALESCE(NULLIF(coupon_code,''),'Automatic / unattributed') AS coupon,COUNT(*) AS orders,${money('discount_amount')} AS discount_amount,${money(net)} AS revenue FROM f WHERE booked=1 AND discount_amount>0 GROUP BY coupon`, columns: ['coupon','orders','discount_amount','revenue'], search: ['coupon'], defaultSort: 'orders' },
  };
  if (type === 'inventory') {
    const settings = await readStoreSettings(db);
    return { ...common, cte: inventoryCTE, args: [settings.lowStockThreshold,settings.lowStockThreshold], sql: `SELECT id,name,sku,category,stock,minimum_stock,price,cost,inventory_value,warehouse,CASE WHEN stock=0 THEN 'Out of Stock' WHEN stock<=minimum_stock THEN 'Low Stock' ELSE 'In Stock' END AS status FROM stock`, columns: ['id','name','sku','category','stock','minimum_stock','price','cost','inventory_value','warehouse','status'], search: ['name','sku','category'], filters: { status: ['Out of Stock','Low Stock','In Stock'] }, defaultSort: 'stock', direction: 'ASC' };
  }
  if (!definitions[type]) analyticsError('Unknown report.');
  return definitions[type];
}

export async function reportTable(db, type, period, query, exportAll = false) {
  const definition = await reportDefinition(db, type, period);
  const { cte, sql, columns } = definition;
  const clauses = [], args = [...definition.args];
  if (query.search) {
    if (typeof query.search !== 'string' || query.search.length>100) analyticsError('Search is limited to 100 characters.');
    if (definition.search.length) { clauses.push(`(${definition.search.map(c => `\`${c}\` LIKE ?`).join(' OR ')})`); args.push(...definition.search.map(() => `%${query.search.replace(/[\\%_]/g, '\\$&')}%`)); }
  }
  for (const [key, values] of Object.entries(definition.filters)) if (query[key]) { if (!values.includes(query[key])) analyticsError('Invalid report filter.'); clauses.push(`\`${key}\`=?`); args.push(query[key]); }
  if (query.performance) {
    if (type !== 'products' || !['zero','sold'].includes(query.performance)) analyticsError('Invalid product performance filter.');
    clauses.push(query.performance === 'zero' ? 'units=0' : 'units>0');
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const sort = query.sort || definition.defaultSort, direction = query.direction || definition.direction;
  if (!columns.includes(sort) || !['ASC','DESC'].includes(direction)) analyticsError('Invalid report sorting.');
  const page = Number(query.page || 1), limit = Number(query.limit || 25);
  if (!Number.isSafeInteger(page) || page<1 || page>100000 || !Number.isSafeInteger(limit) || limit<1 || limit>100) analyticsError('Invalid pagination.');
  const [[count]] = await db.query(`${cte} SELECT COUNT(*) AS total FROM (${sql}) report${where}`, args);
  if (exportAll && count.total>10000) analyticsError('Export is limited to 10,000 rows. Narrow the filters or date range.');
  const [rows] = await db.query(`${cte} SELECT * FROM (${sql}) report${where} ORDER BY \`${sort}\` ${direction}${sort!==columns[0] ? `,\`${columns[0]}\` ASC` : ''} LIMIT ? OFFSET ?`, [...args, exportAll ? 10000 : limit, exportAll ? 0 : (page-1)*limit]);
  return { columns, rows: numberRows(rows), pagination: { page: exportAll ? 1 : page, limit: exportAll ? 10000 : limit, total: Number(count.total), pages: Math.ceil(count.total/limit) } };
}

export async function reportChart(db, type, period) {
  const d = await reportDefinition(db, type, period);
  const [rows] = await db.query(`${d.cte} ${d.sql} ORDER BY \`${d.defaultSort}\` ${d.direction} LIMIT ${type === 'sales' ? 3662 : 20}`, d.args);
  return numberRows(rows);
}
