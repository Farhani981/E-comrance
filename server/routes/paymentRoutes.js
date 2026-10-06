import express from 'express';
import pool from '../config/db.js';
import { protect,adminOnly } from '../middleware/authMiddleware.js';
import { stripe,prepareCheckout,checkoutRow,authorizeCheckout,reconcileCheckout,ensureIntent,parseSnapshot } from '../utils/paymentRecovery.js';
import { ensureVariantSchema } from '../utils/variantSchema.js';
const router=express.Router();
const optionalAuth=(req,res,next)=>req.headers.authorization?protect(req,res,next):next();
const errorResponse=(res,error)=>res.status(error.status || 503).json({ success:false,message:error.status ? error.message : 'Payment service is temporarily unavailable. Keep your checkout reference and retry; do not start another payment.' });
export async function createPaymentIntent(req,res) {
  try { res.set('Cache-Control','no-store').json({success:true,...await prepareCheckout(req.body,req.user?.id)}); }
  catch(error) { errorResponse(res,error); }
}
export async function completePaymentRequest(req,res) {
  try {
    const id=req.params.id || req.body.checkoutId;
    const row=await checkoutRow(id || '');
    authorizeCheckout(row,req.body.recoveryKey,req.user?.id);
    const result=await reconcileCheckout(id);
    res.status(result.success?201:202).json(result);
  } catch(error) { errorResponse(res,error); }
}
router.get('/admin/pending', protect, adminOnly, async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    // 1. Get checkouts from payment_checkouts
    let checkoutRows = [];
    try {
      const [pc] = await pool.query(
        "SELECT id, payment_intent_id, state, last_error_code, attempts, created_at, updated_at, snapshot FROM payment_checkouts WHERE order_id IS NULL AND state <> 'canceled' ORDER BY created_at DESC"
      );
      checkoutRows = (pc || []).map((row) => {
        const snap = parseSnapshot(row.snapshot);
        return {
          id: row.id,
          type: 'checkout',
          payment_intent_id: row.payment_intent_id,
          customer_name: snap?.customer?.name || 'Incomplete Checkout',
          email: snap?.customer?.email || '',
          phone: snap?.customer?.phone || '',
          amount: Number(snap?.quote?.grandTotal || 0),
          payment_method: 'Stripe Card Checkout',
          state: row.state,
          order_status: 'Awaiting Payment',
          last_error_code: row.last_error_code || 'Checkout abandoned before confirmation',
          attempts: row.attempts,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
    } catch (e) {
      console.error('Error fetching payment_checkouts:', e);
    }

    // 2. Get unpaid/pending orders needing payment recovery
    const [orderRows] = await pool.query(
      `SELECT 
        o.id,
        'order' AS type,
        o.transaction_id AS payment_intent_id,
        o.customer_name,
        o.email,
        o.phone,
        o.total_amount AS amount,
        o.payment_method,
        COALESCE(NULLIF(o.payment_status, ''), 'Unpaid') AS state,
        o.order_status,
        CASE 
          WHEN o.payment_status = 'Failed' THEN 'Payment Failed'
          WHEN o.payment_status = 'Pending' THEN 'Payment Verification Pending'
          ELSE 'Awaiting Payment Collection'
        END AS last_error_code,
        1 AS attempts,
        o.created_at,
        o.created_at AS updated_at
      FROM orders o
      WHERE (o.payment_status IN ('Unpaid', 'Pending', 'Failed', '') OR o.payment_status IS NULL)
        AND (o.order_status <> 'Cancelled' OR o.order_status IS NULL)
      ORDER BY o.created_at DESC`
    );

    const allRows = [...checkoutRows, ...(orderRows || [])];
    const total = allRows.length;

    // Calculate aggregated stats
    const totalRecoverableAmount = allRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const unpaidOrdersCount = (orderRows || []).length;
    const abandonedCheckoutsCount = checkoutRows.length;
    const failedPaymentsCount = allRows.filter((r) => r.state === 'Failed' || r.state === 'needs_review').length;

    // Paginate
    const paginatedRows = allRows.slice(offset, offset + limit);

    res.set('Cache-Control', 'no-store').json({
      success: true,
      rows: paginatedRows,
      total,
      page,
      stats: {
        totalRecoverableAmount,
        unpaidOrdersCount,
        abandonedCheckoutsCount,
        failedPaymentsCount,
        totalItems: total,
      },
    });
  } catch (error) {
    errorResponse(res, error);
  }
});

router.post('/admin/order/:id/recover', protect, adminOnly, async (req, res) => {
  try {
    const orderId = req.params.id;
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const year = new Date().getFullYear();
    const cleanNum = String(orderId).replace(/[^0-9]/g, '').slice(-5) || '10001';
    const txnId = order.transaction_id || `TXN-${year}-${cleanNum}`;

    await pool.query(
      "UPDATE orders SET payment_status = 'Paid', transaction_id = ? WHERE id = ?",
      [txnId, orderId]
    );

    try {
      createNotification({
        type: 'PAYMENT_RECOVERED',
        title: 'Payment Recovered',
        message: `Order #${orderId} for ${order.customer_name} marked as Paid. (Rs. ${order.total_amount})`,
        priority: 'MEDIUM',
        metadata: { orderId, amount: order.total_amount, transactionId: txnId }
      });
    } catch {}

    res.json({
      success: true,
      message: `Order #${orderId} ka payment successfully Recover (Paid) ho gaya.`,
      transaction_id: txnId,
      orderId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/order/:id/cancel', protect, adminOnly, async (req, res) => {
  try {
    const orderId = req.params.id;
    await pool.query("UPDATE orders SET order_status = 'Cancelled' WHERE id = ?", [orderId]);
    res.json({ success: true, message: `Order #${orderId} cancel kar diya gaya.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/:id/reconcile', protect, adminOnly, async (req, res) => {
  try {
    // Check if it's an order
    const [[order]] = await pool.query('SELECT id FROM orders WHERE id = ?', [req.params.id]);
    if (order) {
      const year = new Date().getFullYear();
      const cleanNum = String(req.params.id).replace(/[^0-9]/g, '').slice(-5) || '10001';
      const txnId = `TXN-${year}-${cleanNum}`;
      await pool.query("UPDATE orders SET payment_status = 'Paid', transaction_id = ? WHERE id = ?", [txnId, req.params.id]);
      return res.json({ success: true, orderId: req.params.id, message: 'Order recovered and marked as Paid' });
    }
    const result = await reconcileCheckout(req.params.id);
    res.status(result.success ? 200 : 202).json(result);
  } catch (error) {
    errorResponse(res, error);
  }
});

router.get('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const id = req.params.id;
    // Check if order exists
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (order) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      return res.set('Cache-Control', 'no-store').json({
        success: true,
        type: 'order',
        state: order.payment_status || 'Unpaid',
        paymentReference: order.transaction_id || 'COD / Pending Confirmation',
        customer: {
          name: order.customer_name,
          email: order.email,
          phone: order.phone,
          address: order.shipping_address || order.address || '-',
          city: order.city || '-'
        },
        quote: {
          currency: 'PKR',
          grandTotal: order.total_amount,
          lines: (items || []).map(it => ({
            name: it.product_name || it.title || 'Product',
            sku: it.sku || `SKU-${it.product_id || ''}`,
            quantity: it.quantity,
            price: it.price
          }))
        },
        order
      });
    }

    // Otherwise check payment_checkouts
    const row = await checkoutRow(id);
    res.set('Cache-Control', 'no-store').json({
      success: true,
      type: 'checkout',
      state: row.state,
      paymentReference: row.payment_intent_id,
      ...parseSnapshot(row.snapshot)
    });
  } catch (error) {
    errorResponse(res, error);
  }
});
router.post('/:id/reconcile',optionalAuth,completePaymentRequest);
router.post('/:id/cancel',optionalAuth,async(req,res)=>{
  try {
    const row=await checkoutRow(req.params.id); authorizeCheckout(row,req.body.recoveryKey,req.user?.id);
    const intent=await ensureIntent(row);
    if (intent.status==='succeeded') return res.json(await reconcileCheckout(row.id));
    const canceled=intent.status==='canceled'?intent:await stripe.paymentIntents.cancel(intent.id);
    if(canceled.status!=='canceled') throw new Error('Cancellation not confirmed.');
    await pool.query("UPDATE payment_checkouts SET state='canceled' WHERE id=? AND order_id IS NULL",[row.id]);
    res.json({success:true,canceled:true});
  } catch(error) { if(error.status===404) return res.json({success:true,canceled:true}); errorResponse(res,error); }
});
router.post('/:id/resume',optionalAuth,async(req,res)=>{
  try {
    const row=await checkoutRow(req.params.id); authorizeCheckout(row,req.body.recoveryKey,req.user?.id);
    const intent=await ensureIntent(row);
    res.set('Cache-Control','no-store').json({success:true,clientSecret:intent.client_secret,paymentStatus:intent.status});
  } catch(error) { errorResponse(res,error); }
});
import { createNotification } from '../services/notificationService.js';

export async function stripeWebhook(req,res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({success:false,message:'Stripe webhook is not configured.'});
  let event;
  try { event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).json({success:false,message:'Invalid Stripe webhook signature.'}); }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    const checkoutId = intent.metadata?.checkout_id;
    createNotification({
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      message: `Payment for ${checkoutId ? `Checkout #${checkoutId}` : 'order'} has failed.`,
      priority: 'HIGH',
      metadata: {
        checkoutId,
        transactionId: intent.id,
        paymentStatus: 'failed',
        createdAt: new Date().toISOString(),
      },
    });
    return res.json({ received: true });
  }

  if (event.type!=='payment_intent.succeeded') return res.json({received:true});
  const intent=event.data.object, id=intent.metadata?.checkout_id;
  if (!id) return res.json({received:true,ignored:true}); // Not a checkout created by this workflow.
  try {
    await ensureVariantSchema();
    // Recover the Stripe-create / DB-save gap using signed metadata.
    await pool.query('UPDATE payment_checkouts SET payment_intent_id=? WHERE id=? AND payment_intent_id IS NULL',[intent.id,id]);
    const row=await checkoutRow(id);
    if(row.payment_intent_id!==intent.id) return res.status(409).json({success:false,message:'Payment reference mismatch.'});
    await reconcileCheckout(id); // Re-read Stripe; never trust unsigned client success flags.
    res.json({received:true});
  } catch(error) { errorResponse(res,error); } // Non-2xx requests Stripe redelivery.
}
export default router;
