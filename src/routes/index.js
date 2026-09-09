import { Router } from 'express';
import adminRouter from './admin/index.js';
import storeEmployeeRouter from './store-employee/index.js';
import customerRouter from './customer/index.js';

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

export default router;

