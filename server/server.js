import http from 'http';
import { initSocketServer } from './services/socketService.js';
import adminNotificationRoutes from './routes/adminNotificationRoutes.js';
import { stripeWebhook } from './routes/paymentRoutes.js';
import { startPaymentRecovery } from './utils/paymentRecovery.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import shoppingRoutes from './routes/shoppingRoutes.js';
import contactRoutes, { contactBody } from './routes/contactRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import { getJwtSecret } from './config/jwt.js';
import attributeRoutes from './routes/attributeRoutes.js';
import { ensureVariantSchema } from './utils/variantSchema.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { testDBConnection } from './config/db.js';
import { verifyEmailTransport } from './utils/sendEmail.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import collectionRoutes from './routes/collectionRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import operationsRoutes from './routes/operationsRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import discountRoutes from './routes/discountRoutes.js';
import shippingRoutes from './routes/shippingRoutes.js';
import marketingRoutes from './routes/marketingRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import codRoutes from './routes/codRoutes.js';

dotenv.config();

// Fail before listening or initializing the database when auth is unconfigured.
getJwtSecret();

const app = express();
const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.post('/api/orders/stripe-webhook', express.raw({ type: 'application/json', limit: '1mb' }), stripeWebhook);
app.use('/api/contact', contactBody);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Test Base Route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🚀 E-Commerce MySQL API is running smoothly on Port ' + PORT,
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      categories: '/api/categories',
      banners: '/api/banners',
      collections: '/api/collections',
      orders: '/api/orders',
      admin: '/api/admin',
      notifications: '/api/admin/notifications',
    },
  });
});

// API Routes Mounting
app.use('/api', async (req, res, next) => {
  try { await ensureVariantSchema(); next(); } catch (error) { next(error); }
});
app.use('/api/contact', contactRoutes);
app.use('/api/shopping', shoppingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/attributes', attributeRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin/analytics', analyticsRoutes);
app.use('/api/admin/notifications', adminNotificationRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/admin/coupons', couponRoutes);
app.use('/api/admin/discounts', discountRoutes);
app.use('/api/admin/shipping', shippingRoutes);
app.use('/api/admin/marketing', marketingRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/cod', codRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/operations', operationsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found. Check the URL and restart the backend if it was recently updated.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

// Start Server & Test Database Connection
const startServer = async () => {
  try {
    await testDBConnection();
    await ensureVariantSchema();
    startPaymentRecovery();
    await verifyEmailTransport();

    const server = httpServer.listen(PORT, () => {
      console.log(`\n==============================================`);
      console.log(`🚀 Server is running live on: http://localhost:${PORT}`);
      console.log(`==============================================`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other backend process or use a different PORT.`);
        return;
      }
      console.error('❌ Server startup error:', error.message);
    });
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    process.exit(1);
  }
};

startServer();
