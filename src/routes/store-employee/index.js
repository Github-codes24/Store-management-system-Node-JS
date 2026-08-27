import { Router } from 'express';
import storeEmployeeAuthRouter from './storeEmployeeAuthRoutes.route.js';
import adminAuthMiddleware from '../../middlewares/admin.auth.middleware.js';


const router = Router();



// Store Employee routes
router.use('/auth', storeEmployeeAuthRouter);

export default router;

