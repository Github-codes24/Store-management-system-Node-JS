import { Router } from 'express';
import adminAuthRoutes from './admin.auth.routes.js';
import productManagementRoutes from './product-management/index.js';
import distributorRouter from './distributor.route.js';
import storeRouter from './store.route.js';
import storeEmployeeRouter from './storeEmployee.route.js';
import userManagementRoutes from './user-management/index.js';
import adminProductRoutes from './adminProduct.routes.js';
import productPurchaseRoutes from './productPurchase.routes.js';
import productStockRoutes from './productStock.routes.js';
import sellProductRoutes from './sellProduct.routes.js';
import retailerRouter from './retailer.route.js';
import settingsRouter from './settings.routes.js';
import uploadRoutes from './upload.routes.js';
import offersAndTaxManagementRoutes from './offers-and-tax-management/index.js';
import adminStoreProductRoutes from './adminStoreProduct.routes.js';
import adminOrderRoutes from './adminOrder.routes.js';

import adminReportRoutes from './adminReport.routes.js';

const router = Router();

// Admin Auth Routes
router.use('/auth', adminAuthRoutes);

// Admin Reports Module Routes
router.use('/reports', adminReportRoutes);


// Order Management Admin Routes (Offline Sales & Online Orders)
router.use('/orders', adminOrderRoutes);
router.use('/offline-sales', (req, res, next) => {
  req.url = '/offline' + (req.url === '/' ? '' : req.url);
  return adminOrderRoutes(req, res, next);
});
router.use('/online-orders', (req, res, next) => {
  req.url = '/online' + (req.url === '/' ? '' : req.url);
  return adminOrderRoutes(req, res, next);
});

// Image & File Upload / Delete Routes
router.use('/upload', uploadRoutes);
router.use('/media', uploadRoutes);

// Product Management Master Routes
router.use('/product-management', productManagementRoutes);

// Offers & Tax Management Routes
router.use('/offers-and-tax-management', offersAndTaxManagementRoutes);

// Admin Product Master Catalog Routes
router.use('/products', adminProductRoutes);

// Store Products Admin Routes (both endpoints supported)
router.use('/store-products', adminStoreProductRoutes);
router.use('/stores/products', adminStoreProductRoutes);

// Product Stock Warehouse Management Routes
router.use('/product-stocks', productStockRoutes);

// Product Purchase Invoice & Payment Routes
router.use('/product-purchases', productPurchaseRoutes);

// Sell Product Invoice & Payment Routes
router.use('/sell-products', sellProductRoutes);

// User Management Routes
router.use('/user-management', userManagementRoutes);

// Distributor Routes
router.use('/distributors', distributorRouter);

// Retailer Routes
router.use('/retailers', retailerRouter);

// Store Routes
router.use('/stores', storeRouter);

// Store Employee Routes
router.use('/store-employees', storeEmployeeRouter);

// System Settings Routes
router.use('/settings', settingsRouter);

export default router;






