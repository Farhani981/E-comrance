import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect, adminOnly);

/**
 * GET /api/admin/notifications
 * Supports ?page=1&limit=10&filter=all|unread
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const filter = req.query.filter === 'unread' ? 'unread' : 'all';

    let whereClause = '';
    const params = [];

    if (filter === 'unread') {
      whereClause = 'WHERE is_read = 0';
    }

    // Count total matching items
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM notifications ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Count total unread items
    const [unreadRows] = await pool.query(
      `SELECT COUNT(*) AS unreadCount FROM notifications WHERE is_read = 0`
    );
    const unreadCount = unreadRows[0]?.unreadCount || 0;

    // Select paginated items
    const [rows] = await pool.query(
      `SELECT id, type, title, message, priority, is_read, created_at, metadata
       FROM notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const formattedData = rows.map((row) => ({
      ...row,
      is_read: Boolean(row.is_read),
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notificationId]);

    const updated = {
      ...rows[0],
      is_read: 1,
      metadata: typeof rows[0].metadata === 'string' ? JSON.parse(rows[0].metadata) : rows[0].metadata || {},
    };

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/notifications/read-all
 * Mark all unread notifications as read
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
