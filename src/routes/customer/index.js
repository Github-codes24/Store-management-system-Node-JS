import { Router } from 'express';
import customerAuthRoutes from './customer.auth.routes.js';
import customerProductRoutes from './customer.product.routes.js';
import customerCartRoutes from './customer.cart.routes.js';
import customerOrderRoutes from './customer.order.routes.js';

const router = Router();

import customerCmsRoutes from './customerCms.routes.js';

// Customer Auth routes (/api/customer/auth)
router.use('/auth', customerAuthRoutes);

// Customer Product & Browsing routes (/api/customer/products)
router.use('/products', customerProductRoutes);

// Customer Cart routes (/api/customer/cart)
router.use('/cart', customerCartRoutes);

// Customer Order Checkout & Tracking routes (/api/customer/orders)
router.use('/orders', customerOrderRoutes);

// Customer CMS & Help/Support routes (/api/customer/cms)
router.use('/cms', customerCmsRoutes);

export default router;
