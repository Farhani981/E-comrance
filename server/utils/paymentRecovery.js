import Stripe from 'stripe';
import { createHash, timingSafeEqual } from 'node:crypto';
import pool from '../config/db.js';
import { quoteCart, fail, toMinorUnits } from './operations.js';
import { persistOrder } from './orderPersistence.js';
import { sendOrderStatusEmail } from './sendEmail.js';
import { createNotification } from '../services/notificationService.js';
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
export const parseSnapshot = value => typeof value === 'string' ? JSON.parse(value) : value;
const digest = value => createHash('sha256').update(String(value || '')).digest('hex');
export function validateRecoveryReference(id, key) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id) || typeof key !== 'string' || !/^[a-f0-9]{64}$/i.test(key)) fail('Invalid checkout recovery reference.');
}
export function authorizeCheckout(row, key, userId) {
  const supplied = Buffer.from(digest(key),'hex'), stored = Buffer.from(row.recovery_hash,'hex');
  if (!timingSafeEqual(supplied, stored) || (row.user_id && row.user_id !== userId)) fail('Checkout not found or access denied.',403);
}
export async function checkoutRow(id) {
  const [[row]] = await pool.query('SELECT *,TIMESTAMPDIFF(SECOND,created_at,NOW()) AS age_seconds FROM payment_checkouts WHERE id=?',[id]);
  if (!row) fail('Checkout not found.',404);
  return row;
}
function customerDetails(input) {
  if (!input || typeof input !== 'object') fail('Customer details are required before payment.');
  const result = {};
  for (const [key,max] of [['name',255],['email',255],['phone',50],['address',1000],['city',100]]) {
    const value = key === 'name' ? input.name || input.fullName || [input.firstName,input.lastName].filter(Boolean).join(' ') : input[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length>max || /[\x00-\x1f\x7f]/.test(value)) fail(`Valid customer ${key} is required before payment.`);
    result[key]=value.trim();
  }
  result.email=result.email.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) fail('Valid email is required.');
  return result;
}
export async function prepareCheckout(body, userId) {
  if (!stripe) fail('Card payments are not configured.',503);
  validateRecoveryReference(body.checkoutId,body.recoveryKey);
  let [[row]] = await pool.query('SELECT *,TIMESTAMPDIFF(SECOND,created_at,NOW()) AS age_seconds FROM payment_checkouts WHERE id=?',[body.checkoutId]);
  if (!row) {
    const customer=customerDetails(body.customer);
    const quote=await quoteCart(pool,body.items,body.couponCode);
    if (toMinorUnits(body.amount)!==quote.totalMinor) fail('Your total has changed. Refresh checkout before paying.');
    // Preserve commercial terms and identities, not large browser image copies.
    quote.lines=quote.lines.map(({ id,name,price,quantity,productVariantId,sku,variantOptions }) => ({ id,name,price,quantity,productVariantId:productVariantId || null,sku:sku || null,variantOptions:variantOptions || [] }));
    await pool.query(`INSERT IGNORE INTO payment_checkouts(id,recovery_hash,user_id,snapshot) VALUES (?,?,?,?)`,[body.checkoutId,digest(body.recoveryKey),userId || null,JSON.stringify({customer,quote})]);
    row=await checkoutRow(body.checkoutId);
  }
  authorizeCheckout(row,body.recoveryKey,userId);
  const intent=await ensureIntent(row);
  return { checkoutId:row.id,clientSecret:intent.client_secret,quote:parseSnapshot(row.snapshot).quote, paymentStatus:intent.status };
}
export async function ensureIntent(row) {
  if (!stripe) fail('Card payments are not configured.',503);
  if (row.payment_intent_id) return stripe.paymentIntents.retrieve(row.payment_intent_id);
  // Do not reuse a possibly expired Stripe idempotency key after an uncertain create.
  if (Number(row.age_seconds)>23*60*60) {
    await pool.query("UPDATE payment_checkouts SET state='needs_review',last_error_code='initialization_uncertain' WHERE id=? AND payment_intent_id IS NULL",[row.id]);
    fail('Checkout initialization needs administrator review.',409);
  }
  const {customer,quote}=parseSnapshot(row.snapshot);
  const intent=await stripe.paymentIntents.create({ amount:quote.totalMinor,currency:quote.currency.toLowerCase(),payment_method_types:['card'],metadata:{ checkout_id:row.id,customer_email:customer.email } },{ idempotencyKey:`shophub-checkout-${row.id}` });
  await pool.query('UPDATE payment_checkouts SET payment_intent_id=?,state=\'awaiting_payment\' WHERE id=? AND payment_intent_id IS NULL',[intent.id,row.id]);
  return intent;
}
async function completedResult(orderId,quote,customer) {
  const [images]=await pool.query('SELECT product_id,product_variant_id,image FROM order_items WHERE order_id=?',[orderId]);
  const lines=quote.lines.map(line=>({...line,image:images.find(image=>image.product_id===line.id && (image.product_variant_id || null)===(line.productVariantId || null))?.image || ''}));
  return {success:true,orderId,quote:{...quote,lines},customer,state:'completed'};
}
export async function reconcileCheckout(id) {
  let row=await checkoutRow(id);
  const {customer,quote}=parseSnapshot(row.snapshot);
  if (row.order_id) return completedResult(row.order_id,quote,customer);
  const intent=await ensureIntent(row);
  if (intent.status!=='succeeded') {
    const state=intent.status==='canceled'?'canceled':'awaiting_payment';
    await pool.query("UPDATE payment_checkouts SET state=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=? AND order_id IS NULL AND state NOT IN ('paid_pending','needs_review')",[state,id]);
    return { success:false,state,paymentStatus:intent.status,checkoutId:id,message:'Payment is not confirmed. No paid order has been created.' };
  }
  if (intent.metadata?.checkout_id!==id || intent.currency!==quote.currency.toLowerCase() || intent.amount_received!==quote.totalMinor) {
    await pool.query("UPDATE payment_checkouts SET state='needs_review',last_error_code='payment_mismatch',next_attempt_at=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE id=? AND order_id IS NULL",[id]);
    fail('Payment requires administrator review. Do not pay again.',409);
  }
  // Commit the verified paid state independently: order rollback cannot erase it.
  await pool.query("UPDATE payment_checkouts SET state='paid_pending',next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=? AND order_id IS NULL",[id]);
  let db;
  try {
    db=await pool.getConnection(); await db.beginTransaction();
    const [[locked]]=await db.query('SELECT * FROM payment_checkouts WHERE id=? FOR UPDATE',[id]);
    if (locked.order_id) { await db.commit(); db.release(); db=null; return completedResult(locked.order_id,quote,customer); }
    if (locked.user_id) await db.query('SELECT id FROM users WHERE id=? FOR UPDATE',[locked.user_id]);
    const [[receipt]]=await db.query('SELECT order_id FROM order_payment_receipts WHERE transaction_id=?',[intent.id]);
    const orderId=receipt?.order_id || await persistOrder(db,{customer,quote,userId:locked.user_id,transactionId:intent.id});
    await db.query("UPDATE payment_checkouts SET order_id=?,state='completed',last_error_code=NULL WHERE id=?",[orderId,id]);
    await db.commit();
    db.release(); db=null;
    let emailSent=false;
    if(!receipt) {
      try { emailSent=await sendOrderStatusEmail(customer.email,customer.name,orderId,'Pending',quote.lines,quote.grandTotal,'',`${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders?order=${encodeURIComponent(orderId)}`,customer); }
      catch { console.error('Order saved; payment confirmation email could not be sent.'); }
      
      createNotification({
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Payment for Order #${orderId} was successfully received.`,
        priority: 'HIGH',
        metadata: { orderId, transactionId: intent.id, paymentStatus: 'success', createdAt: new Date().toISOString() },
      });
      createNotification({
        type: 'NEW_ORDER',
        title: 'New Order Received',
        message: `Order #${orderId} was placed by ${customer.name || customer.firstName || 'Customer'}.`,
        priority: 'HIGH',
        metadata: { orderId, customerName: customer.name || customer.firstName || 'Customer', totalAmount: quote.grandTotal, itemsCount: quote.lines.length, paymentMethod: 'Credit/Debit Card', createdAt: new Date().toISOString() },
        sendEmail: true,
      });
    }
    return {...await completedResult(orderId,quote,customer),emailSent};
  } catch (error) {
    if (db) { await db.rollback(); db.release(); db=null; }
    await pool.query("UPDATE payment_checkouts SET state='paid_pending',last_error_code=?,attempts=attempts+1,next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=? AND order_id IS NULL",[error.status && error.status<500?'fulfillment_blocked':'database_retry',id]);
    throw Object.assign(new Error('Payment is confirmed; your order is pending recovery. Do not pay again. Retry using this checkout reference.'),{status:503});
  } finally { db?.release(); }
}
export async function runPaymentRecoveryBatch() {
      const [rows]=await pool.query("SELECT id FROM payment_checkouts WHERE state IN ('created','awaiting_payment','paid_pending','needs_review') AND next_attempt_at<=NOW() ORDER BY CASE WHEN state='paid_pending' THEN 0 ELSE 1 END,next_attempt_at LIMIT 25");
      for (const row of rows) {
        try { await reconcileCheckout(row.id); }
        catch { await pool.query("UPDATE payment_checkouts SET next_attempt_at=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=?",[row.id]); }
      }
}
export function startPaymentRecovery() {
  if (!stripe) return;
  let running=false;
  const tick=async () => {
    if (running) return; running=true;
    try {
      await runPaymentRecoveryBatch();
    } catch { console.error('Payment reconciliation is unavailable; persisted checkouts will be retried.'); }
    finally { running=false; }
  };
  void tick(); const timer=setInterval(tick,60000); timer.unref(); return timer;
}
