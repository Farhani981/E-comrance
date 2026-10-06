import { getJwtSecret } from '../config/jwt.js';
// Uses real SQL with fixture writes rolled back. Schema migration is additive and persists.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import router from '../routes/bannerRoutes.js';
import { ensureBannerSchema } from '../utils/bannerSchema.js';
test('banner API persistence, access control, visibility, ordering and deletion', {skip: process.env.RUN_DB_TESTS !== '1'}, async () => {
  const connection = await pool.getConnection();
  const originalQuery=pool.query, originalGetConnection=pool.getConnection;
  let server;
  try {
    await ensureBannerSchema(connection);
    await connection.beginTransaction();
    const [admin] = await connection.query("INSERT INTO users (name,email,password,role) VALUES ('Banner test',?,'fixture','admin')",[`banner-${Date.now()}@example.invalid`]);
    pool.query=connection.query.bind(connection);
    pool.getConnection=async()=>({query:connection.query.bind(connection),beginTransaction:()=>connection.query('SAVEPOINT banner_order'),commit:()=>connection.query('RELEASE SAVEPOINT banner_order'),rollback:()=>connection.query('ROLLBACK TO SAVEPOINT banner_order'),release:()=>{}});
    const app=express();app.use(express.json());app.use('/api/banners',router);
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const token=jwt.sign({id:admin.insertId},getJwtSecret());
    const api=async(path='',method='GET',body,auth=true)=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api/banners${path}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,...await res.json()};};
    assert.equal((await api('/admin','GET',undefined,false)).status,401);
    assert.equal((await api('','POST',{},false)).status,401);
    const fields={title:'A considered wardrobe',description:'Made for the everyday.',image:'https://example.com/banner.webp',imageAlt:'Linen shirt',badge:'20% off',buttonText:'Shop the edit',link:'/shop',secondaryButtonText:'Categories',secondaryLink:'/#categories',imagePosition:'right',kind:'hero',isActive:false};
    const created=await api('','POST',fields);assert.equal(created.status,201);
    const id=created.banner.id;
    let saved=(await api('/admin')).banners.find(b=>b.id===id);
    for(const [key,value] of Object.entries(fields)) assert.equal(saved[key],value);
    assert.ok(!(await api('','GET',undefined,false)).banners.some(b=>b.id===id));
    assert.equal((await api('/'+id,'PUT',{isActive:true})).status,200);
    saved=(await api('','GET',undefined,false)).banners.find(b=>b.id===id);
    assert.equal(saved.title,fields.title);assert.equal(saved.badge,fields.badge);
    const ids=(await api('/admin')).banners.filter(b=>b.kind==='hero').map(b=>b.id).reverse();
    assert.equal((await api('/reorder','PUT',{kind:'hero',ids})).status,200);
    assert.deepEqual((await api('/admin')).banners.filter(b=>b.kind==='hero').map(b=>b.id),ids);
    assert.equal((await api('/reorder','PUT',{kind:'hero',ids:[id,id]})).status,400);
    assert.equal((await api('/'+id,'PUT',{link:'//evil.example'})).status,400);
    assert.equal((await api('/'+id,'DELETE')).status,200);
    assert.ok(!(await api('/admin')).banners.some(b=>b.id===id));
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    pool.query=originalQuery;pool.getConnection=originalGetConnection;
    await connection.rollback();connection.release();await pool.end();
  }
});
