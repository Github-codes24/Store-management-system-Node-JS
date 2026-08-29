import { Router } from 'express';
import storeEmployeeAuthRoutes from './storeEmployee.auth.route.js';
import storeEmployeeProfileRoutes from './storeEmployee.profile.route.js';
import storeProductRoutes from './storeProduct.routes.js';

const router = Router();

// Store Employee Auth Routes (/api/store-employee/auth)
router.use('/auth', storeEmployeeAuthRoutes);

// Store Employee Profile Routes (/api/store-employee/profile)
router.use('/profile', storeEmployeeProfileRoutes);

// Store Employee Product Inventory Routes (/api/store-employee/products)
router.use('/products', storeProductRoutes);

export default router;
