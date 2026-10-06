import { ensureVariantSchema } from '../utils/variantSchema.js';
import { getJwtSecret } from '../config/jwt.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import catalogRouter from '../routes/catalogRoutes.js';
import productRouter from '../routes/productRoutes.js';
import { ensureCatalogSchema } from '../utils/catalogSchema.js';
test('men’s catalog: database tree, protected management, dependent product assignments and filtering', {skip:process.env.RUN_DB_TESTS!=='1'},async()=>{
 const db=await pool.getConnection();let server;const originalQuery=pool.query,originalGet=pool.getConnection;
 try{
  await ensureCatalogSchema(db);await ensureCatalogSchema(db);
  // Schema DDL must finish before the rollback-only fixture transaction.
  await ensureVariantSchema();
  await db.beginTransaction();
  const [admin]=await db.query("INSERT INTO users(name,email,password,role) VALUES('Catalog admin',?,'test','admin')",[`catalog-${Date.now()}@example.invalid`]);
  const [customer]=await db.query("INSERT INTO users(name,email,password,role) VALUES('Catalog customer',?,'test','user')",[`customer-${Date.now()}@example.invalid`]);
  pool.query=db.query.bind(db);pool.getConnection=async()=>({query:db.query.bind(db),beginTransaction:()=>db.query('SAVEPOINT catalog_test'),commit:()=>db.query('RELEASE SAVEPOINT catalog_test'),rollback:()=>db.query('ROLLBACK TO SAVEPOINT catalog_test'),release:()=>{}});
  const app=express();app.use(express.json());app.use('/api/catalog',catalogRouter);app.use('/api/products',productRouter);
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const api=async(path,method='GET',body,user=admin.insertId)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+jwt.sign({id:user},getJwtSecret())}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,...await response.json()};};
  const data=await api('/catalog','GET',undefined,null);
  assert.deepEqual(data.tree.map(p=>p.name),['Top Wear','Bottom Wear','Eastern Wear','Accessories']);
  assert.equal(data.tree[3].children.find(c=>c.name==='Footwear').children.length,5);
  assert.equal((await api('/catalog','POST',{},null)).status,401);assert.equal((await api('/catalog','POST',{},customer.insertId)).status,403);
  const parent=data.tree[0], name='Studio Shirts '+Date.now();
  const sub=await api('/catalog','POST',{name,parent_id:parent.id});assert.equal(sub.status,201);
  const type=await api('/catalog','POST',{name:'Cotton Test',parent_id:sub.id});assert.equal(type.status,201);
  assert.equal((await api('/catalog','POST',{name:'Fourth level',parent_id:type.id})).status,400);
  const fields={name:'Catalog fixture shirt',sku:'CAT-'+Date.now(),category_name:parent.name,subcategory:name,product_type:'Cotton Test',fit:'Slim Fit',occasion:'Formal',price:3999,stock:0,status:'Out of Stock'};
  assert.equal((await api('/products','POST',{...fields,category_name:'Bottom Wear'})).status,400);
  assert.equal((await api('/products','POST',{...fields,fit:'Wrong fit'})).status,400);
  const created=await api('/products','POST',fields);assert.equal(created.status,201,JSON.stringify(created));
  const id=created.productId;const loaded=(await api('/products/'+id)).product;
  assert.equal(loaded.catalog_subcategory_id,sub.id);assert.equal(loaded.catalog_type_id,type.id);assert.equal(loaded.fit,'Slim Fit');assert.equal(loaded.occasion,'Formal');assert.equal(loaded.stock,0);
  const query='/products?'+new URLSearchParams({category:'top-wear',subcategory:loaded.subcategory_slug,type:loaded.product_type_slug,fit:'Slim Fit',occasion:'Formal'});
  assert.ok((await api(query)).products.some(p=>p.id===id));assert.ok(!(await api(query.replace('Slim+Fit','Regular+Fit'))).products.some(p=>p.id===id));
  assert.equal((await api('/catalog/'+sub.id,'DELETE')).status,409);
  assert.equal((await api('/catalog/'+parent.id,'DELETE')).status,400);
  assert.equal((await api('/catalog/'+sub.id,'PUT',{name:'Renamed '+name})).status,200);
  const renamed=(await api('/products/'+id)).product;assert.equal(renamed.subcategory,'Renamed '+name);assert.equal(renamed.subcategory_slug,loaded.subcategory_slug);
  assert.equal((await api('/products/'+id,'PUT',{...fields,subcategory:'Renamed '+name,fit:'Relaxed Fit'})).status,200);
  assert.equal((await api('/products/'+id)).product.fit,'Relaxed Fit');
  assert.equal((await api('/products/'+id,'DELETE')).status,200);
  assert.equal((await api('/catalog/'+sub.id,'DELETE')).status,409,'Children prevent deletion');
  // Products are soft-deleted: their category references remain for history.
  const [[archived]] = await db.query('SELECT deleted_at,catalog_subcategory_id,catalog_type_id FROM products WHERE id=?',[id]);
  assert.ok(archived.deleted_at);
  assert.equal(archived.catalog_subcategory_id,sub.id);
  assert.equal(archived.catalog_type_id,type.id);
  assert.equal((await api('/catalog/'+type.id,'DELETE')).status,409,'Archived products retain their category references');
  assert.equal((await api('/catalog/'+sub.id,'DELETE')).status,409);
  const unused=await api('/catalog','POST',{name:'Unused '+Date.now(),parent_id:parent.id});
  assert.equal(unused.status,201);
  assert.equal((await api('/catalog/'+unused.id,'DELETE')).status,200,'Unassigned categories can still be deleted');
 }finally{if(server)await new Promise(r=>server.close(r));pool.query=originalQuery;pool.getConnection=originalGet;await db.rollback();db.release();await pool.end();}
});
