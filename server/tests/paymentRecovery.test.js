import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import {beginPaymentRecovery,readPaymentRecovery,paymentStorageKey} from '../../my-app/src/utils/paymentRecovery.js';

test('browser retains one recovery reference across retry/refresh without storing card credentials',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const first=beginPaymentRecovery(storage);
  assert.deepEqual(beginPaymentRecovery(storage),first);assert.deepEqual(readPaymentRecovery(storage),first);
  assert.equal(first.recoveryKey.length,64);assert.doesNotMatch(values.get(paymentStorageKey),/client_secret|card|password/);
  assert.throws(()=>beginPaymentRecovery({getItem:()=>null,setItem:()=>{throw new Error('Storage blocked');}}),/Storage blocked/);
});

test('Stripe recovery with real SQL is idempotent, durable and stock-atomic', {skip:process.env.RUN_DB_TESTS!=='1'},async t=>{
  assert.match(process.env.DB_NAME,/^shophub_test_[a-f0-9]{24}$/);
  process.env.STRIPE_SECRET_KEY='sk_test_isolated_no_network';
  process.env.STRIPE_WEBHOOK_SECRET=`whsec_${randomBytes(24).toString('hex')}`;
  process.env.EMAIL_USER='';process.env.EMAIL_PASS='';
  const {default:orders}=await import('../routes/orderRoutes.js');
  const {stripe,runPaymentRecoveryBatch}=await import('../utils/paymentRecovery.js');
  const {stripeWebhook}=await import('../routes/paymentRoutes.js');
  const [user]=await pool.query("INSERT INTO users(name,email,password,role) VALUES ('Payment customer',?,'unused','user')",[`${randomUUID()}@example.invalid`]);
  const [admin]=await pool.query("INSERT INTO users(name,email,password,role) VALUES ('Payment admin',?,'unused','admin')",[`${randomUUID()}@example.invalid`]);
  const [p]=await pool.query("INSERT INTO products(name,price,stock,stock_quantity) VALUES ('Payment shirt',100,20,20)");
  const [p2]=await pool.query("INSERT INTO products(name,price,stock,stock_quantity) VALUES ('Payment coat',200,20,20)");
  const references=[];
  t.after(async()=>{
    try {
      for(const id of references) await pool.query('DELETE FROM payment_checkouts WHERE id=?',[id]);
      await pool.query('DELETE FROM orders WHERE user_id=?',[user.insertId]);
      await pool.query('DELETE FROM stock_adjustments WHERE product_id IN (?,?)',[p.insertId,p2.insertId]);
      await pool.query('DELETE FROM products WHERE id IN (?,?)',[p.insertId,p2.insertId]);
      await pool.query('DELETE FROM users WHERE id IN (?,?)',[user.insertId,admin.insertId]);
    }finally{await pool.end();}
  });
  const intents=new Map(),keys=new Map();let creates=0;
  t.mock.method(stripe.paymentIntents,'create',async(args,options)=>{
    assert.ok(options.idempotencyKey); if(keys.has(options.idempotencyKey)) return intents.get(keys.get(options.idempotencyKey));
    creates++; const intent={id:`pi_test_${randomUUID()}`,client_secret:'test-only-client-reference',status:'requires_payment_method',amount:args.amount,amount_received:0,currency:args.currency,metadata:args.metadata};
    intents.set(intent.id,intent);keys.set(options.idempotencyKey,intent.id);return intent;
  });
  t.mock.method(stripe.paymentIntents,'retrieve',async id=>{assert.ok(intents.has(id));return intents.get(id);});
  t.mock.method(stripe.paymentIntents,'cancel',async id=>{const intent=intents.get(id);assert.notEqual(intent.status,'succeeded');intent.status='canceled';return intent;});
  const app=express();app.post('/webhook',express.raw({type:'application/json'}),stripeWebhook);app.use(express.json());app.use('/orders',orders);
  const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const token=id=>jwt.sign({id,role:'admin'},process.env.JWT_SECRET);
  const request=async(path,body,identity=user.insertId)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/orders${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(identity?{Authorization:`Bearer ${token(identity)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return{status:response.status,data:await response.json()};
  };
  const prepare=async(items=[{id:p.insertId,quantity:1}])=>{
    const reference={checkoutId:randomUUID(),recoveryKey:randomBytes(32).toString('hex')};references.push(reference.checkoutId);
    const body={...reference,customer:{name:'Payment customer',email:'payment@example.invalid',phone:'03001234567',address:'Saved address',city:'Lahore'},items,amount:items.reduce((n,i)=>n+(i.id===p.insertId?100:200)*i.quantity,200)};
    const result=await request('/create-payment-intent',body);assert.equal(result.status,200,JSON.stringify(result.data));
    const intent=[...intents.values()].find(i=>i.metadata.checkout_id===reference.checkoutId);
    return{reference,body,intent};
  };
  const pay=attempt=>{attempt.intent.status='succeeded';attempt.intent.amount_received=attempt.intent.amount;};
  const complete=attempt=>request(`/payments/${attempt.reference.checkoutId}/reconcile`,attempt.reference);
  const stock=async()=>Number((await pool.query('SELECT stock FROM products WHERE id=?',[p.insertId]))[0][0].stock);
  await t.test('one persisted checkout creates one PaymentIntent across duplicate initialization requests',async()=>{
    const a=await prepare();const before=creates;
    assert.equal((await request('/create-payment-intent',a.body)).status,200);assert.equal(creates,before);
    const [[row]]=await pool.query('SELECT * FROM payment_checkouts WHERE id=?',[a.reference.checkoutId]);assert.ok(row.payment_intent_id);assert.equal(JSON.parse(row.snapshot).customer.address,'Saved address');
  });
  await t.test('failed/unconfirmed payment never creates a paid order or deducts stock',async()=>{
    const a=await prepare(),before=await stock();const result=await complete(a);
    assert.equal(result.status,202);assert.equal(result.data.success,false);assert.equal(await stock(),before);
    const canceled=await request(`/payments/${a.reference.checkoutId}/cancel`,a.reference);assert.equal(canceled.data.canceled,true);
  });
  let successful;
  await t.test('successful payment and concurrent duplicate requests create one real order and deduct once',async()=>{
    const a=await prepare();pay(a);const before=await stock();
    const results=await Promise.all([complete(a),complete(a),complete(a)]);
    for(const result of results){assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.orderId,results[0].data.orderId);}
    assert.equal(await stock(),before-1);
    assert.equal((await pool.query('SELECT COUNT(*) AS n FROM orders WHERE transaction_id=?',[a.intent.id]))[0][0].n,1);
    await assert.rejects(pool.query('INSERT INTO order_payment_receipts(transaction_id,order_id) VALUES (?,?)',[a.intent.id,results[0].data.orderId]),e=>e.code==='ER_DUP_ENTRY');
    successful=a;
  });
  await t.test('order failure after stock mutation rolls everything back and retry honors saved prices',async()=>{
    const a=await prepare([{id:p.insertId,quantity:1},{id:p2.insertId,quantity:1}]);pay(a);const before=await stock();
    const original=pool.getConnection.bind(pool);let injected=false;
    pool.getConnection=async()=>{const db=await original();const query=db.query.bind(db);db.query=async(sql,args)=>{if(!injected && sql.includes('INSERT INTO order_items') && args[1]===p2.insertId){injected=true;throw new Error('Injected database failure');}return query(sql,args);};return db;};
    try{const result=await complete(a);assert.equal(result.status,503);assert.match(result.data.message,/Do not pay again/);}finally{pool.getConnection=original;}
    assert.equal(await stock(),before);assert.equal((await pool.query('SELECT COUNT(*) AS n FROM orders WHERE transaction_id=?',[a.intent.id]))[0][0].n,0);
    const [[row]]=await pool.query('SELECT * FROM payment_checkouts WHERE id=?',[a.reference.checkoutId]);assert.equal(row.state,'paid_pending');assert.ok(row.snapshot);
    await pool.query('UPDATE products SET price=999 WHERE id=?',[p.insertId]);
    const result=await complete(a);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.quote.grandTotal,500);assert.equal(await stock(),before-1);
    await pool.query('UPDATE products SET price=100 WHERE id=?',[p.insertId]);
  });
  const webhook=async intent=>{
    const payload=JSON.stringify({id:`evt_${randomUUID()}`,type:'payment_intent.succeeded',data:{object:intent}});
    const signature=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
    return fetch(`http://127.0.0.1:${server.address().port}/webhook`,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload});
  };
  await t.test('signed callback without a browser creates an order; duplicate events and requests cannot duplicate it',async()=>{
    const a=await prepare();pay(a);const before=await stock();
    assert.equal((await webhook(a.intent)).status,200);assert.equal((await webhook(a.intent)).status,200);
    assert.equal((await complete(a)).status,201);assert.equal(await stock(),before-1);
    const paidBefore=await stock();assert.equal((await webhook(successful.intent)).status,200);assert.equal(await stock(),paidBefore);
    const bad=await fetch(`http://127.0.0.1:${server.address().port}/webhook`,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':'invalid'},body:'{}'});assert.equal(bad.status,400);
  });
  await t.test('signed webhook repairs a missing DB payment reference and insufficient stock stays recoverable',async()=>{
    const a=await prepare();pay(a);await pool.query('UPDATE payment_checkouts SET payment_intent_id=NULL WHERE id=?',[a.reference.checkoutId]);
    const before=await stock();await pool.query('UPDATE products SET stock=0 WHERE id=?',[p.insertId]);
    assert.equal((await webhook(a.intent)).status,503);
    const [[row]]=await pool.query('SELECT * FROM payment_checkouts WHERE id=?',[a.reference.checkoutId]);assert.equal(row.payment_intent_id,a.intent.id);assert.equal(row.state,'paid_pending');
    await pool.query('UPDATE products SET stock=? WHERE id=?',[before,p.insertId]);assert.equal((await webhook(a.intent)).status,200);assert.equal(await stock(),before-1);
  });
  await t.test('recovery keys and account binding protect customer data; only admins see the queue',async()=>{
    const a=await prepare();
    assert.equal((await request(`/payments/${a.reference.checkoutId}/reconcile`,{recoveryKey:'bad'})).status,403);
    assert.equal((await request(`/payments/${a.reference.checkoutId}/reconcile`,a.reference,null)).status,403);
    assert.equal((await request('/payments/admin/pending')).status,403);
    assert.equal((await request('/payments/admin/pending',undefined,admin.insertId)).status,200);
    assert.equal((await request(`/payments/admin/${a.reference.checkoutId}`,undefined,admin.insertId)).data.customer.address,'Saved address');
  });
  await t.test('background reconciliation recovers persisted successful payment without browser or webhook',async()=>{
    const a=await prepare();pay(a);const before=await stock();
    await runPaymentRecoveryBatch();
    const [[row]]=await pool.query('SELECT state,order_id FROM payment_checkouts WHERE id=?',[a.reference.checkoutId]);
    assert.equal(row.state,'completed');assert.ok(row.order_id);assert.equal(await stock(),before-1);
  });
});
