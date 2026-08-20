import { Router } from 'express';
import adminAuthRoutes from './admin.auth.routes.js';
import productManagementRoutes from './product-management/index.js';

const router = Router();

// Admin Auth Routes
router.use('/auth', adminAuthRoutes);

// Product Management Master Routes
router.use('/product-management', productManagementRoutes);

export default router;


