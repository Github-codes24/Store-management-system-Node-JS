import { Router } from 'express';

import productTypeRoutes from './productType.routes.js';
import categoryRoutes from './category.routes.js';
import subcategoryRoutes from './subcategory.routes.js';
import brandRoutes from './brand.routes.js';
import unitRoutes from './unit.routes.js';
import attributeRoutes from './attribute.routes.js';
import taxRoutes from './tax.routes.js';

const router = Router();

router.use('/product-types', productTypeRoutes);
router.use('/categories', categoryRoutes);
router.use('/subcategories', subcategoryRoutes);
router.use('/brands', brandRoutes);
router.use('/units', unitRoutes);
router.use('/attributes', attributeRoutes);
router.use('/taxes', taxRoutes);

export default router;