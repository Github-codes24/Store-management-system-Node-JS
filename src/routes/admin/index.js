import { Router } from 'express';

import adminAuthRoutes from './admin.auth.routes.js';
import productManagementRoutes from './product-management/index.js';
import offersTaxManagementRoutes from './offers-tax-management/index.js';
import distributorRouter from './distributor.route.js';
import storeRouter from './store.route.js';
import userManagementRoutes from './user-management/index.js';

const router = Router();

// Admin Auth Routes
router.use('/auth', adminAuthRoutes);

// Product Management Routes
router.use('/product-management', productManagementRoutes);

// Offers & Tax Management Routes
router.use('/offers-tax-management', offersTaxManagementRoutes);

// User Management Routes
router.use('/distributors', distributorRouter);

// Store Routes
router.use('/stores', storeRouter);

// User Management Routes
router.use('/user-management', userManagementRoutes);

export default router;