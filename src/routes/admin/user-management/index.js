import { Router } from 'express';
import customerRoutes from './customer.routes.js';
import subAdminRoutes from './subAdmin.routes.js';

const router = Router();

router.use('/customers', customerRoutes);
router.use('/sub-admins', subAdminRoutes);

export default router;

