import { Router } from 'express';
import adminAuthRoutes from './admin.auth.routes.js';
import productManagementRoutes from './product-management/index.js';
import distributorRouter from './distributor.route.js';
import storeRouter from './store.route.js';
import storeEmployeeRouter from './storeEmployee.route.js';
import userManagementRoutes from './user-management/index.js';
import adminProductRoutes from './adminProduct.routes.js';
import productPurchaseRoutes from './productPurchase.routes.js';

const router = Router();

// Admin Auth Routes
router.use('/auth', adminAuthRoutes);

// Product Management Master Routes
router.use('/product-management', productManagementRoutes);

// Admin Product Master Catalog Routes
router.use('/products', adminProductRoutes);

// Product Purchase Invoice & Payment Routes
router.use('/product-purchases', productPurchaseRoutes);

// User Management Routes
router.use('/user-management', userManagementRoutes);

// Distributor Routes
router.use('/distributors', distributorRouter);

// Store Routes
router.use('/stores', storeRouter);

// Store Employee Routes
router.use('/store-employees', storeEmployeeRouter);

export default router;




