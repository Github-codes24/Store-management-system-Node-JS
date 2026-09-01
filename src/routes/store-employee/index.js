import { Router } from 'express';
import storeEmployeeAuthRoutes from './storeEmployee.auth.route.js';
import storeEmployeeProfileRoutes from './storeEmployee.profile.route.js';
import storeProductRoutes from './storeProduct.routes.js';
import storeBillingRoutes from './storeBilling.routes.js';

const router = Router();

// Store Employee Auth Routes (/api/store-employee/auth)
router.use('/auth', storeEmployeeAuthRoutes);

// Store Employee Profile Routes (/api/store-employee/profile)
router.use('/profile', storeEmployeeProfileRoutes);

// Store Employee Product Inventory Routes (/api/store-employee/products)
router.use('/products', storeProductRoutes);

// Store Employee Billing & Returns Routes (/api/store-employee/billing)
router.use('/billing', storeBillingRoutes);

export default router;
