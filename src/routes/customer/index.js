import { Router } from 'express';
import customerAuthRoutes from './customer.auth.routes.js';
import customerProductRoutes from './customer.product.routes.js';

const router = Router();

// Customer Auth routes (/api/customer/auth)
router.use('/auth', customerAuthRoutes);

// Customer Product & Browsing routes (/api/customer/products)
router.use('/products', customerProductRoutes);

export default router;
