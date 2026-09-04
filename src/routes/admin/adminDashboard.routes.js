import { Router } from 'express';
import {
  getDashboardOverview,
  getDashboardStats,
  getDashboardActivities,
  getDashboardCharts,
} from '../../controllers/admin/adminDashboard.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

// Apply admin authentication to all dashboard routes
router.use(adminAuth);

// Routes
router.get('/overview', getDashboardOverview);
router.get('/stats', getDashboardStats);
router.get('/activities', getDashboardActivities);
router.get('/charts', getDashboardCharts);
router.get('/', getDashboardOverview);

export default router;
