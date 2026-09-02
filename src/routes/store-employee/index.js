import { Router } from 'express';
import storeEmployeeAuthRoutes from './storeEmployee.auth.route.js';
import storeEmployeeProfileRoutes from './storeEmployee.profile.route.js';
import storeProductRoutes from './storeProduct.routes.js';
import storeBillingRoutes from './storeBilling.routes.js';
import storeCustomerRoutes from './storeCustomer.route.js';
import storeEmployeeOfferRouter from './storeEmployee.offer.route.js';
import storeReportRoutes from './storeReport.routes.js';
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

// Store Employee Billing & Returns Routes (/api/store-employee/billing)
router.use('/billing', storeBillingRoutes);

// Store Customer Routes (/api/store-employee/customers)
router.use('/customers', storeCustomerRoutes);

// Store Employee Offers Routes (/api/store-employee/offers)
router.use('/offers', storeEmployeeOfferRouter);

// Store Employee Reports Routes (/api/store-employee/reports)
router.use('/reports', storeReportRoutes);

export default router;
