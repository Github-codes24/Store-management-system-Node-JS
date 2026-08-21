import { Router } from 'express';
import customerRoutes from './customer.routes.js';

const router = Router();

router.use('/customers', customerRoutes);

export default router;
