import pool from '../config/db.js';
import { getIO } from './socketService.js';
import { sendOrderStatusEmail } from '../utils/sendEmail.js';

/**
 * Reusable notification service.
 * Handles MySQL persistence, Socket.io broadcasting, and optional email alerts.
 * Protected by try/catch so business transactions are NEVER interrupted by notification failures.
 */
export async function createNotification({
  type,
  title,
  message,
  priority = 'MEDIUM',
  metadata = {},
  sendEmail = false,
}) {
  try {
    const metaJson = JSON.stringify(metadata || {});
    const now = new Date();

    const [result] = await pool.query(
      `INSERT INTO notifications (type, title, message, priority, is_read, created_at, metadata)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [type, title, message, priority, now, metaJson]
    );

    const notificationPayload = {
      id: result.insertId,
      type,
      title,
      message,
      priority,
      is_read: 0,
      created_at: now.toISOString(),
      metadata,
    };

    // 1. Emit via Socket.io to admin_room
    const io = getIO();
    if (io) {
      io.to('admin_room').emit('new_notification', notificationPayload);
    }

    // 2. Optional email alert for high priority or explicit sendEmail
    if (sendEmail || priority === 'HIGH') {
      try {
        const adminEmail = process.env.EMAIL_USER;
        if (adminEmail) {
          // Send notification email asynchronously
          sendOrderStatusEmail(
            adminEmail,
            'Admin',
            metadata.orderId || notificationPayload.id.toString(),
            title,
            [{ title: message, quantity: 1, price: metadata.totalAmount || 0 }],
            metadata.totalAmount || 0,
            metadata.transactionId || '',
            `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/orders`,
            { name: metadata.customerName || 'Customer', email: adminEmail }
          ).catch((e) => console.error('⚠️ Admin notification email dispatch error:', e.message));
        }
      } catch (emailErr) {
        console.error('⚠️ Admin notification email preparation error:', emailErr.message);
      }
    }

    return notificationPayload;
  } catch (error) {
    console.error('❌ Failed to create notification (non-blocking):', error);
    return null;
  }
}
