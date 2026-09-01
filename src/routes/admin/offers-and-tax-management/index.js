import { Router } from 'express';
import taxRoutes from './tax.routes.js';
import offerRoutes from './offer.routes.js';

const router = Router();

router.use('/taxes', taxRoutes);
router.use('/offers', offerRoutes);

export default router;
