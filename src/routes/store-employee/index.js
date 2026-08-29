import { Router } from 'express';
import storeEmployeeAuthRoutes from './storeEmployee.auth.route.js';
import storeEmployeeProfileRoutes from './storeEmployee.profile.route.js';
import storeCustomerRoutes from './storeCustomer.route.js';

const router = Router();

// Store Employee Auth Routes (/api/store-employee/auth)
router.use('/auth', storeEmployeeAuthRoutes);

// Store Employee Profile Routes (/api/store-employee/profile)
router.use('/profile', storeEmployeeProfileRoutes);

// Store Customer Routes (/api/store-employee/customers)
router.use('/customers', storeCustomerRoutes);

export default router;
