import { Router } from 'express';
import adminAuthRoutes from './admin.auth.routes.js';
import productManagementRoutes from './product-management/index.js';
import distributorRouter from './distributor.route.js';
import storeRouter from './store.route.js';

const router = Router();

// Admin Auth Routes
router.use('/auth', adminAuthRoutes);

// Product Management Master Routes
router.use('/product-management', productManagementRoutes);

// Distributor Routes
router.use('/distributors', distributorRouter);

// Store Routes
router.use('/stores', storeRouter);

export default router;


