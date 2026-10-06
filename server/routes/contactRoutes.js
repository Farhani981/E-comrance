import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { createContactLimiter, validateContact } from '../utils/contactMessages.js';
import { createNotification } from '../services/notificationService.js';
import { sendContactReplyEmail } from '../utils/sendEmail.js';

// Mount before the application's larger product-image JSON parser.
export const contactBody = [
  (req, res, next) => {
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ success: false, message: 'Submit contact requests as JSON.' });
    }
    next();
  },
  express.json({ limit: '60kb' }),
  (error, req, res, next) => {
    if (error) {
      return res.status(error.type === 'entity.too.large' ? 413 : 400).json({ success: false, message: 'Invalid or oversized contact request.' });
    }
    next();
  },
];

export function createContactRouter(limiter = createContactLimiter()) {
  const router = express.Router();
  const run = handler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      res.status(error.status || 500).json({
        success: false,
        message: error.status === 400 ? error.message : error.message || 'Unable to process contact message.',
      });
    }
  };
  const id = req => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
      throw Object.assign(new Error('Invalid message ID.'), { status: 400 });
    }
    return Number(req.params.id);
  };

  // Helper to extract related order ID from subject, message, or by email
  const detectRelatedOrder = async (email, text) => {
    // 1. Look for explicit pattern like #ORD-123456 or ORD-123456
    const match = (text || '').match(/#?(ORD-\d+)/i);
    if (match && match[1]) {
      const orderId = match[1].toUpperCase();
      const [[found]] = await pool.query('SELECT id, total_amount, order_status, created_at FROM orders WHERE id = ?', [orderId]);
      if (found) return found;
    }
    // 2. If no explicit ID, look for the most recent order by this customer's email
    if (email) {
      const [[recent]] = await pool.query('SELECT id, total_amount, order_status, created_at FROM orders WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1', [email.toLowerCase()]);
      if (recent) return recent;
    }
    return null;
  };

  // 1. Public contact form submission
  router.post('/', limiter, run(async (req, res) => {
    const fields = validateContact(req.body);
    const [result] = await pool.query(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [fields.name, fields.email, fields.phone || null, fields.subject, fields.message]
    );

    // Detect related order if mentioned
    const fullText = `${fields.subject} ${fields.message}`;
    const relatedOrder = await detectRelatedOrder(fields.email, fullText).catch(() => null);

    // Real-time notification for admin
    createNotification({
      type: 'CONTACT_MESSAGE',
      title: 'New Contact Message',
      message: `${fields.name}: ${fields.subject}`,
      priority: 'MEDIUM',
      metadata: {
        messageId: result.insertId,
        customerName: fields.name,
        email: fields.email,
        phone: fields.phone || '',
        subject: fields.subject,
        relatedOrderId: relatedOrder?.id || null,
        createdAt: new Date().toISOString(),
      },
      sendEmail: true,
    }).catch(err => console.error('Notification dispatch error:', err));

    res.status(201).json({
      success: true,
      message: 'Your message has been received. Our team will contact you shortly.',
    });
  }));

  // Protected Admin Routes
  router.use(protect, adminOnly);

  // 2. Get All Messages with Filters, Search, and KPI Stats
  router.get('/', run(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const statusFilter = req.query.status || 'All';
    const dateRange = req.query.dateRange || 'All';

    // Summary Stats
    const [[statsRow]] = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'Unread' THEN 1 ELSE 0 END), 0) AS unread,
        COALESCE(SUM(CASE WHEN status = 'Read' THEN 1 ELSE 0 END), 0) AS \`read\`,
        COALESCE(SUM(CASE WHEN status = 'Replied' THEN 1 ELSE 0 END), 0) AS replied,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today
      FROM contact_messages
    `);

    // Build dynamic WHERE clause
    const conditions = [];
    const params = [];

    if (statusFilter && statusFilter !== 'All') {
      conditions.push('status = ?');
      params.push(statusFilter);
    }

    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (dateRange === 'Today') {
      conditions.push('DATE(created_at) = CURDATE()');
    } else if (dateRange === 'Last 7 Days') {
      conditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (dateRange === 'Last 30 Days') {
      conditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    } else if (req.query.startDate && req.query.endDate) {
      conditions.push('DATE(created_at) BETWEEN ? AND ?');
      params.push(req.query.startDate, req.query.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count matching
    const [[{ filteredCount }]] = await pool.query(
      `SELECT COUNT(*) AS filteredCount FROM contact_messages ${whereClause}`,
      params
    );

    // Fetch paginated messages
    const [messages] = await pool.query(
      `SELECT id, name, email, phone, subject, message, reply_message, replied_at, status, created_at, updated_at 
       FROM contact_messages 
       ${whereClause} 
       ORDER BY created_at DESC, id DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Enrich messages with detected related order IDs
    for (const msg of messages) {
      const match = (`${msg.subject} ${msg.message}`).match(/#?(ORD-\d+)/i);
      if (match && match[1]) {
        msg.related_order_id = match[1].toUpperCase();
      }
    }

    res.set('Cache-Control', 'no-store').json({
      success: true,
      messages,
      total: Number(filteredCount),
      page,
      limit,
      stats: {
        total: Number(statsRow?.total || 0),
        unread: Number(statsRow?.unread || 0),
        read: Number(statsRow?.read || 0),
        replied: Number(statsRow?.replied || 0),
        today: Number(statsRow?.today || 0),
      },
    });
  }));

  // 3. Get Single Message Details with Related Order Lookups
  router.get('/:id', run(async (req, res) => {
    const msgId = id(req);
    const [[message]] = await pool.query('SELECT * FROM contact_messages WHERE id = ?', [msgId]);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

    // Detect related order
    const fullText = `${message.subject} ${message.message}`;
    const relatedOrder = await detectRelatedOrder(message.email, fullText);
    message.related_order = relatedOrder;

    res.set('Cache-Control', 'no-store').json({ success: true, message });
  }));

  // 4. Update Status (Read, Unread, Replied)
  router.patch('/:id', run(async (req, res) => {
    const msgId = id(req);
    const { status } = req.body || {};
    const validStatuses = ['Read', 'Unread', 'Replied'];
    if (!status || !validStatuses.includes(status)) {
      throw Object.assign(new Error('Status must be Read, Unread, or Replied.'), { status: 400 });
    }

    const [result] = await pool.query(
      'UPDATE contact_messages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, msgId]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Message not found.' });

    res.json({ success: true, status });
  }));

  // 5. Send Support Reply to Customer
  router.post('/:id/reply', run(async (req, res) => {
    const msgId = id(req);
    const { reply_message, subject } = req.body;
    if (!reply_message || !reply_message.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    const [[msg]] = await pool.query('SELECT * FROM contact_messages WHERE id = ?', [msgId]);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });

    // Send email to customer
    const emailResult = await sendContactReplyEmail({
      toEmail: msg.email,
      customerName: msg.name,
      subject: subject || msg.subject,
      replyMessage: reply_message.trim(),
      originalMessage: msg.message,
    });

    // Update database status to Replied
    await pool.query(
      'UPDATE contact_messages SET status = "Replied", reply_message = ?, replied_at = NOW(), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reply_message.trim(), msgId]
    );

    res.json({
      success: true,
      message: emailResult.success
        ? 'Reply sent successfully to customer via email.'
        : 'Reply recorded successfully (email could not be delivered).',
      emailSent: !!emailResult.success,
    });
  }));

  // 6. Delete Message
  router.delete('/:id', run(async (req, res) => {
    const msgId = id(req);
    const [result] = await pool.query('DELETE FROM contact_messages WHERE id = ?', [msgId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Message not found.' });

    res.json({ success: true, message: 'Contact message deleted successfully.' });
  }));

  return router;
}

export default createContactRouter();
