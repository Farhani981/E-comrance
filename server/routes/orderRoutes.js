import { persistOrder } from '../utils/orderPersistence.js';
import paymentRoutes, { createPaymentIntent, completePaymentRequest } from './paymentRoutes.js';
export { createPaymentIntent };
export { stripe } from '../utils/paymentRecovery.js';
import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { sendOrderStatusEmail } from '../utils/sendEmail.js';
import { quoteCart, fail, toMinorUnits, changeStock } from '../utils/operations.js';
import { cancelOrder } from './operationsRoutes.js';
import { createNotification } from '../services/notificationService.js';
import { computeRequestHash, ensureIdempotencySchema } from '../utils/orderIdempotency.js';

const router = express.Router();
const normalizeEmail = email => String(email || '').trim().toLowerCase();
router.use('/payments', paymentRoutes);
router.post('/create-payment-intent', (req,res,next) => req.headers.authorization ? protect(req,res,next) : next(), createPaymentIntent);

// 1. Create new order
router.post('/', (req, res, next) => req.headers.authorization ? protect(req, res, next) : next(), async (req, res) => {
  if (req.body.paymentMethod === 'Credit/Debit Card') return completePaymentRequest(req, res);
  if (req.body.transactionId || req.body.checkoutId) return res.status(400).json({success:false,message:'Payment references must use the protected payment recovery flow.'});
  const connection = await pool.getConnection();
  try {
    const { customer, items: submittedItems } = req.body;

    if (!customer || !Array.isArray(submittedItems) || submittedItems.length === 0) {
      connection.release();
      return res.status(400).json({ success: false, message: 'Order data and items are required' });
    }

    const customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || 'Customer';
    const customerEmail = normalizeEmail(customer.email);
    if (!customerEmail) {
      connection.release();
      return res.status(400).json({ success: false, message: 'A customer email is required' });
    }

    // Guests remain guests; a claimed userId cannot attach an order to another account.
    const safeUserId = req.user?.id || null;

    // COD Idempotency Check
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotencyKey || req.body.clientOrderId || null;
    const requestHash = computeRequestHash({
      userId: safeUserId,
      customerEmail,
      items: submittedItems,
      totalAmount: req.body.totalAmount,
      couponCode: req.body.couponCode,
    });

    if (idempotencyKey) {
      await ensureIdempotencySchema(connection);
      const [[existingRecord]] = await connection.query(
        'SELECT * FROM order_idempotency WHERE idempotency_key = ?',
        [idempotencyKey]
      ).catch(() => [[]]);

      if (existingRecord) {
        if (existingRecord.request_hash !== requestHash) {
          connection.release();
          return res.status(409).json({
            success: false,
            message: 'This idempotency key was previously used with different order details.',
          });
        }
        if (existingRecord.order_id && existingRecord.response_body) {
          connection.release();
          try {
            const cachedResponse = JSON.parse(existingRecord.response_body);
            return res.status(200).json(cachedResponse);
          } catch {
            // Fall through if parsing fails
          }
        }
      }
    }

    await connection.beginTransaction();
    if (safeUserId) await connection.query('SELECT id FROM users WHERE id=? FOR UPDATE', [safeUserId]);

    if (idempotencyKey) {
      const [[lockedRecord]] = await connection.query(
        'SELECT * FROM order_idempotency WHERE idempotency_key = ? FOR UPDATE',
        [idempotencyKey]
      ).catch(() => [[]]);

      if (lockedRecord?.order_id && lockedRecord.response_body) {
        await connection.commit();
        connection.release();
        return res.status(200).json(JSON.parse(lockedRecord.response_body));
      }

      if (!lockedRecord) {
        await connection.query(
          'INSERT INTO order_idempotency (idempotency_key, user_id, request_hash) VALUES (?, ?, ?)',
          [idempotencyKey, safeUserId, requestHash]
        ).catch(() => {});
      }
    }

    const quote = await quoteCart(connection, submittedItems, req.body.couponCode, true);
    const totalAmount = quote.grandTotal;
    const items = quote.lines;
    if (toMinorUnits(req.body.totalAmount) !== quote.totalMinor) fail('Your total has changed. Refresh checkout and try again.');
    const orderId = await persistOrder(connection, { customer, quote, userId: safeUserId });

    const responsePayload = {
      success: true,
      message: 'Order placed successfully',
      orderId,
      quote,
    };

    if (idempotencyKey) {
      await connection.query(
        'UPDATE order_idempotency SET order_id = ?, response_body = ? WHERE idempotency_key = ?',
        [orderId, JSON.stringify(responsePayload), idempotencyKey]
      ).catch(() => {});
    }

    await connection.commit();

    let emailSent = false;
    try {
      emailSent = await sendOrderStatusEmail(
        customerEmail,
        customerName,
        orderId,
        'Pending',
        items,
        totalAmount || 0,
        '',
        `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders?order=${encodeURIComponent(orderId)}`,
        {
          name: customerName,
          address: customer.address || '',
          city: customer.city || '',
          phone: customer.phone || '',
        }
      );
    } catch (error) {
      console.error('Error sending order confirmation email:', error.message);
    }

    // Dispatch real-time Admin notification
    createNotification({
      type: 'NEW_ORDER',
      title: 'New Order Received',
      message: `Order #${orderId} was placed by ${customerName}.`,
      priority: 'HIGH',
      metadata: {
        orderId,
        customerName,
        totalAmount,
        itemsCount: items.length,
        paymentMethod: 'Cash on Delivery',
        createdAt: new Date().toISOString(),
      },
      sendEmail: true,
    });

    res.status(201).json({
      success: true,
      emailSent,
      message: 'Order placed successfully',
      orderId,
      quote,
    });
  } catch (error) {
    await connection.rollback();
    res.status(error.status || 500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// Public Order Tracking by ID (Accessible without login)
router.get('/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const [items] = await pool.query('SELECT product_name, price, quantity, image FROM order_items WHERE order_id = ?', [id]);
    order.items = items;

    // Deterministic tracking number and carrier info
    const numericPart = String(order.id).replace(/\D/g, '') || '302011';
    const trackingNumber = order.tracking_number || order.transaction_id || `4221${numericPart.slice(-6).padStart(6, '7362')}`;
    const carrier = order.courier_name || 'Standard Courier';

    res.json({
      success: true,
      order: {
        ...order,
        tracking_number: trackingNumber,
        courier_name: order.courier_name || carrier,
        carrier,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Get All Orders for Logged In User
router.get('/my-orders', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const [orders] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);

    for (let order of orders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Get All Orders (Admin Only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');

    for (let order of orders) {
      const [items] = await pool.query(
        `SELECT 
          oi.*,
          COALESCE(pv.stock_quantity, p.stock_quantity, p.stock, 0) AS available_stock,
          COALESCE(oi.variant_sku, pv.sku, p.sku, '') AS sku
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
        WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Update Status (Admin Only) - Email Notification Included
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { order_status, payment_status, cancellation_reason, courier_name, tracking_number } = req.body;
    const { id } = req.params;

    const validStatuses = [
      'New',
      'Pending',
      'Confirmed',
      'Processing',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Completed',
      'Cancelled',
      'Returned',
    ];

    if (!validStatuses.includes(order_status)) {
      connection.release();
      return res.status(400).json({ success: false, message: `Invalid order status: ${order_status}` });
    }

    await connection.beginTransaction();

    const [[currentOrder]] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!currentOrder) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (currentOrder.order_status === 'Cancelled' && order_status !== 'Cancelled') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Cancelled orders cannot be reopened.' });
    }

    if (currentOrder.order_status === 'Returned' && order_status !== 'Returned') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Returned orders cannot be reopened.' });
    }

    const ALLOWED_STATUS_TRANSITIONS = {
      '': ['New', 'Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Cancelled'],
      New: ['Pending', 'Confirmed', 'Processing', 'Cancelled'],
      Pending: ['Confirmed', 'Processing', 'Cancelled'],
      Confirmed: ['Processing', 'Packed', 'Shipped', 'Cancelled'],
      Processing: ['Packed', 'Shipped', 'Cancelled'],
      Packed: ['Shipped', 'Out for Delivery', 'Cancelled'],
      Shipped: ['Out for Delivery', 'Delivered'],
      'Out for Delivery': ['Delivered'],
      Delivered: ['Completed', 'Returned'],
      Completed: ['Returned'],
      Cancelled: [],
      Returned: [],
    };

    const currentStatus = (currentOrder.order_status || '').trim();
    if (currentStatus !== order_status) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Cancelled'];
      if (!allowed.includes(order_status)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          message: `Cannot transition order from "${currentStatus || 'Unknown'}" to "${order_status}".`
        });
      }
    }

    // Handle Cancellation
    if (order_status === 'Cancelled' && currentOrder.order_status !== 'Cancelled') {
      const reason = (cancellation_reason || req.body.reason || 'Cancelled by administrator').trim();
      
      // Restore stock safely
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        if (item.product_id) {
          await changeStock(connection, item.product_id, Number(item.quantity), `Cancellation Order #${id}`, req.user.id, item.product_variant_id);
        }
      }

      await connection.query(
        'UPDATE orders SET order_status = "Cancelled", cancellation_reason = ? WHERE id = ?',
        [reason, id]
      );

      // If already paid, request refund
      if (currentOrder.payment_status === 'Paid') {
        await connection.query(
          'INSERT INTO return_requests (order_id, reason, status, restocked) VALUES (?, ?, "Received", TRUE)',
          [id, `Paid order cancelled: ${reason}`]
        );
      }

      // Update cod_transactions for cancelled orders
      await connection.query(
        'UPDATE cod_transactions SET payment_status = "Failed / Uncollectable", settlement_status = "Unsettled" WHERE order_id = ?',
        [id]
      ).catch(() => {});
    } else if (order_status === 'Returned' && currentOrder.order_status !== 'Returned' && currentOrder.order_status !== 'Cancelled') {
      // Handle Return: Customer returned product, restore stock (+quantity) back to inventory
      const reason = (cancellation_reason || req.body.reason || 'Returned by customer').trim();
      
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        if (item.product_id) {
          await changeStock(connection, item.product_id, Number(item.quantity), `Return Order #${id}`, req.user.id, item.product_variant_id);
        }
      }

      let nextPaymentStatus = payment_status || (currentOrder.payment_status === 'Paid' ? 'Refunded' : currentOrder.payment_status);
      let nextTxnId = currentOrder.transaction_id;

      await connection.query(
        'UPDATE orders SET order_status = "Returned", payment_status = ?, transaction_id = ? WHERE id = ?',
        [nextPaymentStatus, nextTxnId, id]
      );

      // Update cod_transactions for returned orders
      await connection.query(
        'UPDATE cod_transactions SET payment_status = "Refunded", settlement_status = "Unsettled" WHERE order_id = ?',
        [id]
      ).catch(() => {});

      // Link with return_requests so return report and restocked flag stay synchronized
      const [[existingReturn]] = await connection.query('SELECT id FROM return_requests WHERE order_id = ?', [id]);
      if (existingReturn) {
        await connection.query('UPDATE return_requests SET status = "Received", restocked = TRUE WHERE id = ?', [existingReturn.id]);
      } else {
        await connection.query(
          'INSERT INTO return_requests (order_id, reason, status, restocked) VALUES (?, ?, "Received", TRUE)',
          [id, `Order marked as returned: ${reason}`]
        );
      }
    } else {
      // Normal Status Transition
      const isCod = currentOrder.payment_method?.toLowerCase().includes('cash') || currentOrder.payment_method?.toLowerCase().includes('cod');
      let nextPaymentStatus = payment_status || currentOrder.payment_status;
      let nextTxnId = currentOrder.transaction_id;

      // For COD orders, when marked as Delivered, customer pays courier: COD Collected by Courier / Settlement Pending
      // Delivered does NOT mean Payment Settled!
      if (order_status === 'Delivered') {
        if (payment_status) {
          nextPaymentStatus = payment_status;
        } else if (isCod) {
          if (!['Settled', 'Reconciled', 'Partially Settled'].includes(currentOrder.payment_status)) {
            nextPaymentStatus = 'Collected by Courier';
          }
        }
      }

      if (nextPaymentStatus === 'Paid' && !nextTxnId) {
        nextTxnId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      }

      const updateFields = ['order_status = ?', 'payment_status = ?', 'transaction_id = ?'];
      const updateValues = [order_status, nextPaymentStatus, nextTxnId];

      if (courier_name !== undefined) {
        updateFields.push('courier_name = ?');
        updateValues.push(courier_name ? String(courier_name).trim() : null);
      }
      if (tracking_number !== undefined) {
        updateFields.push('tracking_number = ?');
        updateValues.push(tracking_number ? String(tracking_number).trim() : null);
      }

      updateValues.push(id);
      await connection.query(
        `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      // Synchronize cod_transactions
      if (isCod) {
        const codUpdates = [];
        const codParams = [];

        if (order_status === 'Delivered') {
          codUpdates.push('delivery_date = COALESCE(delivery_date, NOW())');
          if (!['Settled', 'Reconciled', 'Partially Settled'].includes(nextPaymentStatus)) {
            codUpdates.push('payment_status = ?', 'settlement_status = "Settlement Pending"');
            codParams.push('Collected by Courier');
          }
        } else if (nextPaymentStatus) {
          codUpdates.push('payment_status = ?');
          codParams.push(nextPaymentStatus);
        }

        if (courier_name !== undefined) {
          codUpdates.push('courier_name = ?');
          codParams.push(courier_name ? String(courier_name).trim() : null);
        }
        if (tracking_number !== undefined) {
          codUpdates.push('tracking_number = ?');
          codParams.push(tracking_number ? String(tracking_number).trim() : null);
        }

        if (codUpdates.length > 0) {
          codParams.push(id);
          await connection.query(
            `UPDATE cod_transactions SET ${codUpdates.join(', ')} WHERE order_id = ?`,
            codParams
          ).catch(e => console.error('COD sync error:', e.message));
        }
      }
    }

    await connection.commit();
    connection.release();

    // Fetch updated order for notifications and response
    const [[updatedOrder]] = await pool.query(
      `SELECT o.*, u.email AS account_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`,
      [id]
    );
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);

    // Send customer email
    let emailSent = false;
    const storedEmail = normalizeEmail(updatedOrder?.email);
    const recipientEmail = storedEmail && storedEmail !== 'guest@example.com'
      ? storedEmail
      : normalizeEmail(updatedOrder?.account_email);

    if (recipientEmail) {
      try {
        emailSent = await sendOrderStatusEmail(
          recipientEmail,
          updatedOrder.customer_name,
          updatedOrder.id,
          order_status,
          items,
          updatedOrder.total_amount,
          updatedOrder.tracking_number || '',
          `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders?order=${encodeURIComponent(updatedOrder.id)}`,
          {
            name: updatedOrder.customer_name,
            address: updatedOrder.address,
            city: updatedOrder.city,
            phone: updatedOrder.phone,
          }
        );
      } catch (error) {
        console.error('Error sending order status email:', error.message);
      }
    }

    // Real-time notification for admin
    createNotification({
      type: 'ORDER_STATUS_UPDATE',
      title: `Order #${id} Updated`,
      message: `Order status changed to "${order_status}".`,
      priority: ['Delivered', 'Cancelled'].includes(order_status) ? 'HIGH' : 'MEDIUM',
      metadata: {
        orderId: id,
        orderStatus: order_status,
        paymentStatus: updatedOrder.payment_status,
        customerName: updatedOrder.customer_name,
        totalAmount: updatedOrder.total_amount,
        createdAt: new Date().toISOString(),
      },
    }).catch(e => console.error('Notification error:', e));

    res.json({
      success: true,
      emailSent,
      order: updatedOrder,
      message: emailSent
        ? `Order status updated to "${order_status}" and confirmation email sent.`
        : `Order status updated to "${order_status}".`,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    connection.release();
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Update Payment Status directly (Admin Only)
router.put('/:id/payment-status', protect, adminOnly, async (req, res) => {
  try {
    const { payment_status } = req.body;
    const { id } = req.params;
    const valid = ['Pending', 'Unpaid', 'Paid', 'Failed', 'Refunded'];
    if (!valid.includes(payment_status)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' });
    }

    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    let txnId = order.transaction_id;
    if (payment_status === 'Paid' && !txnId) {
      txnId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    await pool.query('UPDATE orders SET payment_status = ?, transaction_id = ? WHERE id = ?', [payment_status, txnId, id]);

    // Also update cod_transactions if present
    await pool.query(
      'UPDATE cod_transactions SET payment_status = ? WHERE order_id = ?',
      [payment_status, id]
    ).catch(() => {});

    res.json({
      success: true,
      payment_status,
      transaction_id: txnId,
      message: `Payment status updated to "${payment_status}".`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Update Shipping / Courier Details directly (Admin Only)
router.put('/:id/shipping', protect, adminOnly, async (req, res) => {
  try {
    const { courier_name, tracking_number } = req.body;
    const { id } = req.params;

    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const trimmedCourier = courier_name !== undefined ? (courier_name ? String(courier_name).trim() : null) : order.courier_name;
    const trimmedTracking = tracking_number !== undefined ? (tracking_number ? String(tracking_number).trim() : null) : order.tracking_number;

    await pool.query(
      'UPDATE orders SET courier_name = ?, tracking_number = ? WHERE id = ?',
      [trimmedCourier, trimmedTracking, id]
    );

    // Sync cod_transactions
    await pool.query(
      'UPDATE cod_transactions SET courier_name = ?, tracking_number = ? WHERE order_id = ?',
      [trimmedCourier, trimmedTracking, id]
    ).catch(() => {});

    res.json({
      success: true,
      message: 'Shipping and courier details updated successfully.',
      courier_name: trimmedCourier,
      tracking_number: trimmedTracking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 7. Get Linked COD & Settlement Details for Order Details Modal
router.get('/:id/cod-details', protect, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const [[cod]] = await pool.query(`
      SELECT 
        ct.*,
        cs.settlement_number,
        cs.bank_reference,
        cs.settlement_date AS batch_settlement_date,
        cs.settlement_status AS batch_status,
        u.name AS reconciled_by_name
      FROM cod_transactions ct
      LEFT JOIN courier_settlements cs ON cs.id = ct.settlement_id
      LEFT JOIN users u ON u.id = ct.reconciled_by
      WHERE ct.order_id = ?
    `, [id]);

    if (!cod) {
      return res.json({ success: true, isCOD: false, cod: null });
    }

    res.json({ success: true, isCOD: true, cod });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
