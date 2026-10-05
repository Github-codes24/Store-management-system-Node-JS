import { Router } from 'express';
import adminRouter from './admin/index.js';
import storeEmployeeRouter from './store-employee/index.js';
import customerRouter from './customer/index.js';
import razorpayPaymentRoutes from './customer/razorpayPayment.routes.js';

const router = Router();

// Base welcome endpoint
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Store Management Backend API',
    version: '1.0.0',
  });
});

// Admin routes
router.use('/admin', adminRouter);

// Store Employee routes
router.use('/store-employee', storeEmployeeRouter);

// Customer routes
router.use('/customer', customerRouter);

// Direct Payment Aliases (/api/create-order and /api/verify-payment)
router.use('/', razorpayPaymentRoutes);

export default router;

