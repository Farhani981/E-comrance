import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/analyticsRoutes.js';
import { analyticsRange, growth } from '../utils/analyticsDates.js';
import { exportReport } from '../utils/analyticsExport.js';
import { reportTable } from '../utils/analytics.js';

test('analytics date presets, leap dates, previous periods and zero baselines', () => {
  const range = analyticsRange({ range:'last7' }, '2024-03-01');
  assert.equal(range.start,'2024-02-24'); assert.equal(range.until,'2024-03-02');
  assert.equal(range.previousStart,'2024-02-17'); assert.equal(range.previousEnd,'2024-02-23');
  assert.equal(analyticsRange({ range:'lastMonth' },'2024-03-01').end,'2024-02-29');
  assert.equal(analyticsRange({ compare:'year' },'2024-03-01').previousStart,'2023-01-01');
  for (const preset of ['today','yesterday','last7','last30','month','lastMonth','year']) {
    const p=analyticsRange({ range:preset },'2024-03-01'); assert.ok(p.start<=p.end); assert.ok(p.previousEnd<p.start);
  }
  for (const query of [{ range:'custom',start:'2024-02-30',end:'2024-03-01' },{ range:'custom',start:'2024-03-02',end:'2024-03-01' },{ bucket:'unsafe' }]) assert.throws(() => analyticsRange(query,'2024-03-01'));
  assert.equal(growth(0,0),0); assert.equal(growth(10,0),null); assert.equal(growth(150,100),50);
});
test('large exports fail explicitly instead of silently truncating',async () => {
  const db={ query:async () => [[{ total:10001 }]] };
  await assert.rejects(reportTable(db,'orders',analyticsRange({},'2024-03-01'),{},true),/10,000/);
});
test('exports escape CSV formulas and HTML/XML content without losing numbers', () => {
  const report = { columns:['name','revenue'],rows:[{ name:'=HYPERLINK("unsafe")<script>',revenue:12.5 }] };
  const period = { start:'2024-01-01',end:'2024-01-31' };
  assert.match(exportReport('csv',report,'Test',period).body, /'=HYPERLINK/);
  assert.doesNotMatch(exportReport('print',report,'Test',period).body, /<script>/);
  assert.match(exportReport('excel',report,'Test',period).body, /ss:Type="Number">12.5/);
});

test('real SQL analytics reconcile known records and protect reports/exports', { skip:process.env.RUN_DB_TESTS !== '1' }, async t => {
  assert.match(process.env.DB_NAME,/^shophub_test_[a-f0-9]{24}$/);
  const suffix = randomUUID();
  const [admin] = await pool.query("INSERT INTO users(name,email,password,role,created_at) VALUES ('Analytics admin',?,'unused','admin','2019-01-01')", [`a-${suffix}@example.invalid`]);
  const [customer] = await pool.query("INSERT INTO users(name,email,password,role,created_at) VALUES ('Analytics buyer',?,'unused','user','2020-01-05')", [`u-${suffix}@example.invalid`]);
  const [category] = await pool.query("INSERT INTO catalog_nodes(name,slug) VALUES ('Analytics Category',?)",[suffix]);
  const [product] = await pool.query("INSERT INTO products(name,price,stock,catalog_category_id) VALUES ('Analytics Product',100,4,?)",[category.insertId]);
  const [zero] = await pool.query("INSERT INTO products(name,price,stock,catalog_category_id) VALUES ('Analytics Zero',50,0,?)",[category.insertId]);
  const [variantProduct] = await pool.query("INSERT INTO products(name,price,stock,has_variants,catalog_category_id) VALUES ('Analytics Variant',150,3,1,?)",[category.insertId]);
  const [variant] = await pool.query("INSERT INTO product_variants(product_id,combination_hash,options,sku,image_url,price,stock_quantity) VALUES (?,'analytics','[]',?,'/variant.jpg',150,3)",[variantProduct.insertId,suffix]);
  const [purchase] = await pool.query("INSERT INTO purchases(invoice_no,purchase_date) VALUES (?,'2019-12-01')",[suffix]);
  await pool.query('INSERT INTO purchase_items(purchase_id,product_id,quantity,cost_price) VALUES (?,?,10,40)',[purchase.insertId,product.insertId]);
  await pool.query('INSERT INTO purchase_items(purchase_id,product_id,product_variant_id,quantity,cost_price) VALUES (?,?,?,3,30),(?,?,?,1,50)',[purchase.insertId,variantProduct.insertId,variant.insertId,purchase.insertId,variantProduct.insertId,variant.insertId]);
  const ids = {};
  t.after(async () => {
    try {
      await pool.query('DELETE FROM orders WHERE user_id=?',[customer.insertId]);
      await pool.query('DELETE FROM purchases WHERE id=?',[purchase.insertId]);
      await pool.query('DELETE FROM product_variants WHERE id=?',[variant.insertId]);
      await pool.query('DELETE FROM products WHERE id IN (?,?,?)',[product.insertId,zero.insertId,variantProduct.insertId]);
      await pool.query('DELETE FROM catalog_nodes WHERE id=?',[category.insertId]);
      await pool.query('DELETE FROM users WHERE id IN (?,?)',[customer.insertId,admin.insertId]);
    } finally { await pool.end(); }
  });
  async function order(name,date,status,total,quantity,{ currency='PKR',refund=0,restocked=false,coupon=null,discount=0,subtotal=total,shipping=0 }={}) {
    const id = `AN-${randomUUID()}`; ids[name]=id;
    await pool.query(`INSERT INTO orders(id,user_id,customer_name,email,address,total_amount,subtotal,discount_amount,shipping_amount,tax_amount,currency,coupon_code,order_status,payment_status,created_at)
      VALUES (?,?,'Analytics buyer',?,'',?,?,?,?,0,?,?,?,?,?)`,[id,customer.insertId,`u-${suffix}@example.invalid`,total,subtotal,discount,shipping,currency,coupon,status,refund?'Partially Refunded':'Paid',date]);
    await pool.query('INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES (?,?,?,100,?)',[id,product.insertId,'Analytics Product',quantity]);
    if (refund) await pool.query("INSERT INTO return_requests(order_id,reason,status,refund_amount,restocked) VALUES (?,'Test','Refunded',?,?)",[id,refund,restocked]);
  }
  await order('prior','2019-12-15','Delivered',100,1);
  await order('delivered','2020-01-10','Delivered',200,2);
  // Two lines prove SUM(total_amount) does not multiply with item joins.
  await pool.query('INSERT INTO order_items(order_id,product_id,product_name,price,quantity) VALUES (?,?,?,0,1)',[ids.delivered,zero.insertId,'Analytics Zero']);
  await order('pending','2020-01-11','Pending',110,1,{ subtotal:100,discount:10,shipping:20,coupon:'ANALYTICS10' });
  await order('cancelled','2020-01-12','Cancelled',400,4);
  await order('refund','2020-01-13','Delivered',300,3,{ refund:50,restocked:true });
  await order('legacy','2020-01-14','Processing',999,1,{ currency:null,subtotal:null });
  await order('outside','2020-02-01','Delivered',800,8);
  const app=express(); app.use('/analytics',router);
  const server=await new Promise(resolve => { const instance=app.listen(0,'127.0.0.1',() => resolve(instance)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base={ range:'custom',start:'2020-01-01',end:'2020-01-31' };
  const request=async (type,patch={},user=admin.insertId) => {
    const token=user ? jwt.sign({ id:user,role:'admin' },process.env.JWT_SECRET) : null;
    const response=await fetch(`http://127.0.0.1:${server.address().port}/analytics/${type}?${new URLSearchParams({...base,...patch})}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
    const text=await response.text();
    return { status:response.status, data:response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
  };
  await t.test('overview revenue, counts, refunds, units and comparison are exact',async () => {
    const result=await request('overview'); assert.equal(result.status,200,JSON.stringify(result.data));
    const {current,previous,growth}=result.data.summary;
    assert.equal(current.orders,5); assert.equal(current.revenue,560); assert.equal(current.booked_value,610);
    assert.equal(current.products_sold,3); assert.equal(current.refunded_amount,50); assert.equal(current.cancelled_orders,1); assert.equal(current.completed_orders,2);
    assert.equal(current.gross_sales,600); assert.equal(current.discounts,10); assert.equal(current.shipping,20);
    assert.equal(current.unknown_currency_orders,1); assert.equal(current.missing_breakdown_orders,1);
    assert.equal(previous.revenue,100); assert.equal(growth.revenue,460);
    assert.equal(current.new_customers,1); assert.equal(current.active_customers,1); assert.equal(current.returning_customers,1); assert.equal(current.coupons_used,1);
    assert.equal(result.data.summary.inventory.inventory_value,265);
    assert.deepEqual(Object.fromEntries(result.data.statuses.map(row => [row.status, Number(row.orders)])), {
      Delivered: 1, Pending: 1, Cancelled: 1, Refunded: 1, Processing: 1,
    }, 'Order statuses must not collapse into the joined return status column');
  });
  await t.test('product/category sales and zero-sale filters agree with delivered items',async () => {
    const result=await request('products'); assert.equal(result.status,200,JSON.stringify(result.data));
    const row=result.data.table.rows.find(row=>row.id===product.insertId); assert.equal(row.units,2); assert.equal(row.revenue,200);
    const categories=await request('categories'); assert.equal(categories.status,200,JSON.stringify(categories.data));
    const category=categories.data.table.rows.find(row=>row.category==='Analytics Category');
    assert.equal(category.units,3); assert.equal(category.orders,1); assert.equal(category.revenue,200); assert.equal(category.sales_percentage,100); assert.equal(category.products,3);
    const zeros=await request('products',{performance:'zero'}); assert.equal(zeros.status,200); assert.ok(zeros.data.table.rows.every(row=>row.units===0));
  });
  await t.test('all report endpoints, status filters and deterministic pagination work',async () => {
    for(const type of ['sales','orders','customers','inventory','payments','discounts']) { const r=await request(type); assert.equal(r.status,200,`${type}: ${JSON.stringify(r.data)}`); assert.ok(r.data.table); }
    const first=await request('orders',{limit:2,sort:'date',direction:'ASC'}),second=await request('orders',{limit:2,page:2,sort:'date',direction:'ASC'});
    assert.equal(first.data.table.pagination.total,5); assert.equal(first.data.table.rows.length,2); assert.notEqual(first.data.table.rows[0].id,second.data.table.rows[0].id);
    const refunds=await request('orders',{status:'Refunded'}); assert.equal(refunds.data.table.pagination.total,1);
    const customer=await request('customers'); assert.equal(customer.data.table.rows[0].spent,560); assert.ok(!Object.hasOwn(customer.data.table.rows[0],'email'));
    for(const patch of [{sort:'DROP TABLE orders'},{limit:1000},{start:'2020-02-30'}]) assert.equal((await request('orders',patch)).status,400);
  });
  await t.test('empty ranges have zero totals and empty sales without NaN',async () => {
    const result=await request('sales',{start:'2018-01-01',end:'2018-01-02'});
    assert.equal(result.status,200); assert.equal(result.data.summary.current.revenue,0); assert.equal(result.data.summary.current.average_order_value,0); assert.deepEqual(result.data.table.rows,[]);
  });
  await t.test('inventory uses variant weighted purchase cost and current stock regardless of date range',async () => {
    const result=await request('inventory',{start:'2018-01-01',end:'2018-01-02'});
    const row=result.data.table.rows.find(row=>row.id===`v-${variant.insertId}`);
    assert.equal(row.cost,35); assert.equal(row.inventory_value,105); assert.equal(row.stock,3);
    assert.equal(result.data.summary.inventory.stock_units,7);
  });
  await t.test('exports include every matching row across pages and exclude other dates',async () => {
    for(const format of ['csv','excel','print']) {
      const result=await request('orders',{format,limit:1,status:'Pending'}); assert.equal(result.status,200);
      assert.match(result.data,new RegExp(ids.pending)); assert.doesNotMatch(result.data,new RegExp(ids.outside)); assert.doesNotMatch(result.data,new RegExp(ids.delivered));
    }
  });
  await t.test('customer forged role claims and guests cannot read or export analytics',async () => {
    for(const type of ['overview','sales','orders','products','categories','customers','inventory','payments','discounts']) {
      assert.equal((await request(type,{},customer.insertId)).status,403);
      assert.equal((await request(type,{},null)).status,401);
      assert.equal((await request(type,{format:'csv'},customer.insertId)).status,403);
    }
  });
  await t.test('database errors produce retryable errors without private details or fake data',async () => {
    const original=pool.getConnection;
    pool.getConnection=async () => { throw new Error('Private database connection credentials'); };
    try { const result=await request('overview'); assert.equal(result.status,500); assert.equal(result.data.success,false); assert.doesNotMatch(JSON.stringify(result.data),/Private|credentials/); }
    finally { pool.getConnection=original; }
  });
  await t.test('archived products retain traceable historical sales without pretending stock is current',async () => {
    await pool.query('UPDATE products SET deleted_at=CURRENT_TIMESTAMP WHERE id=?',[product.insertId]);
    const result=await request('products');
    const row=result.data.table.rows.find(row=>row.id===product.insertId);
    assert.equal(row.revenue,200); assert.equal(row.catalog_status,'Archived'); assert.equal(row.stock,null);
    const sales=await request('sales');
    assert.equal(sales.data.table.rows.reduce((n,row)=>n+row.unknown_currency_orders,0),1);
  });
});
