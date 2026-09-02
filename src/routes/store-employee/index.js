import { Router } from 'express';
import storeEmployeeAuthRoutes from './storeEmployee.auth.route.js';
import storeEmployeeProfileRoutes from './storeEmployee.profile.route.js';
import storeProductRoutes from './storeProduct.routes.js';
import storeCustomerRoutes from './storeCustomer.route.js';
import storeEmployeeOfferRouter from './storeEmployee.offer.route.js';
import storeEmployeeDashboardRouter from './storeEmployee.dashboard.route.js';

const router = Router();

// Store Employee Dashboard Routes (/api/store-employee/dashboard)
router.use('/dashboard', storeEmployeeDashboardRouter);

// Store Employee Auth Routes (/api/store-employee/auth)
router.use('/auth', storeEmployeeAuthRoutes);

// Store Employee Profile Routes (/api/store-employee/profile)
router.use('/profile', storeEmployeeProfileRoutes);

// Store Employee Product Inventory Routes (/api/store-employee/products)
router.use('/products', storeProductRoutes);

// Store Customer Routes (/api/store-employee/customers)
router.use('/customers', storeCustomerRoutes);

// Store Employee Offers Routes (/api/store-employee/offers)
router.use('/offers', storeEmployeeOfferRouter);

export default router;
