import { randomUUID } from 'node:crypto';
import { changeStock, fail } from './operations.js';
import { consumePurchasedCart } from './shopping.js';
export async function persistOrder(connection, { customer, quote, userId, transactionId = null }) {
 const safeUserId=userId || null, cardPayment=!!transactionId, paymentStatus=cardPayment?'Paid':'Unpaid';
 const paymentMethod=cardPayment?'Credit/Debit Card':'Cash on Delivery';
 const customerName=customer.name || [customer.firstName,customer.lastName].filter(Boolean).join(' ') || 'Customer';
 const customerEmail=String(customer.email || '').trim().toLowerCase();
 // 6-digit random number generate 
const shortCode = Math.floor(100000 + Math.random() * 900000); 
const totalAmount=quote.grandTotal, items=quote.lines, orderId=`ORD-${shortCode}`;
    // MODIFIED: SQL query mein payment_status aur transaction_id add kar diye gaye hain
    await connection.query(
      `INSERT INTO orders 
      (id, user_id, customer_name, email, phone, address, city, total_amount, payment_method, payment_status, transaction_id, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        safeUserId,
        customerName,
        customerEmail,
        customer.phone || '',
        customer.address || '',
        customer.city || '',
        totalAmount || 0,
        paymentMethod || 'Cash on Delivery',
        paymentStatus || 'Unpaid',
        cardPayment ? transactionId : null,
        'Pending',
      ]
    );

    await connection.query('UPDATE orders SET subtotal=?, discount_amount=?, shipping_amount=?, tax_amount=?, currency=?, coupon_code=? WHERE id=?', [quote.subtotal, quote.discountAmount, quote.shipping, quote.tax, quote.currency, quote.couponCode, orderId]);
    if (cardPayment) await connection.query('INSERT INTO order_payment_receipts (transaction_id, order_id) VALUES (?, ?)', [transactionId, orderId]);
    for (const item of items) {
      let productId = null;
      if (item.id) {
        const [existingProduct] = await connection.query('SELECT id FROM products WHERE id = ? FOR UPDATE', [item.id]);
        productId = existingProduct[0]?.id || null;
      }

      if (!productId) fail('A purchased product requires fulfillment review.',409);
      const [inserted] = await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity, image, product_variant_id, variant_sku, variant_options)
        SELECT ?, ?, ?, ?, ?, ${item.productVariantId ? 'image_url' : 'image'}, ?, ?, ?
        FROM ${item.productVariantId ? 'product_variants' : 'products'} WHERE id = ?`,
        [
          orderId,
          productId,
          item.name || item.title || 'Product',
          Number(item.price) || 0,
          Number(item.quantity) || 1,
          item.productVariantId || null, item.sku || null, JSON.stringify(item.variantOptions || []),
          item.productVariantId || productId,
        ]
      );
      if (inserted.affectedRows !== 1) fail('A purchased variant requires fulfillment review.',409);

      if (productId) {
        await changeStock(connection, productId, -Number(item.quantity), `Order ${orderId}`, safeUserId, item.productVariantId);
      }
    }

    if (safeUserId) await consumePurchasedCart(connection, safeUserId, items);

 return orderId;
}
