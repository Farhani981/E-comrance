import express from 'express';
import pool from '../config/db.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import { analyticsRange } from '../utils/analyticsDates.js';
import { overview, reportTable, reportChart } from '../utils/analytics.js';
import { exportReport } from '../utils/analyticsExport.js';
const router = express.Router();
router.use(protect, adminOnly);
router.get('/:report', async (req, res) => {
  let db;
  try {
    db = await pool.getConnection();
    await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
    const [[clock]] = await db.query("SELECT DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') AS today");
    const period = analyticsRange(req.query, clock.today);
    const type = req.params.report;
    res.set('Cache-Control', 'no-store');
    if (req.query.format) {
      const report = await reportTable(db, type, period, req.query, true);
      const output = exportReport(req.query.format, report, `ShopHub ${type} report`, period);
      await db.commit();
      res.set('Content-Type', output.mime);
      res.set('Content-Disposition', `${req.query.format === 'print' ? 'inline' : 'attachment'}; filename="shophub-${type}-${period.start}-${period.end}.${output.extension}"`);
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      return res.send(output.body);
    }
    const summary = await overview(db, period);
    const table = type === 'overview' ? null : await reportTable(db, type, period, req.query);
    let chart = [];
    if (['overview','sales','orders'].includes(type)) chart = await reportChart(db, 'sales', period);
    else if (['categories','payments'].includes(type)) chart = await reportChart(db, type, period);
    let statuses = [];
    if (['overview','orders'].includes(type)) {
      const [rows] = await db.query(`SELECT CASE WHEN r.status='Refunded' THEN 'Refunded' WHEN r.status='Received' AND o.order_status<>'Cancelled' THEN 'Returned' WHEN o.order_status='Completed' THEN 'Delivered' ELSE o.order_status END AS report_status,COUNT(*) AS orders FROM orders o LEFT JOIN return_requests r ON r.order_id=o.id WHERE o.created_at>=? AND o.created_at<? GROUP BY report_status`, [period.start,period.until]);
      statuses = rows.map(({ report_status, orders }) => ({ status: report_status, orders }));
    }
    await db.commit();
    res.json({ success: true, period, currency: 'PKR', summary, table, chart, statuses });
  } catch (error) {
    if (db) await db.rollback();
    res.status(error.status || 500).json({ success: false, message: error.status === 400 ? error.message : 'Unable to load analytics. Please try again.' });
  } finally { db?.release(); }
});
export default router;
