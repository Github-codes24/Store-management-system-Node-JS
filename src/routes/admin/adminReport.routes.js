import { Router } from 'express';
import {
  getSalesRegisterReport,
  getSalesSummaryReport,
  getStorePnLReport,
  getStorePnLDetailReport,
  exportReport,
} from '../../controllers/admin/adminReport.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

// Require admin authentication for report endpoints
router.use(adminAuth);

// Export endpoint (placed before parametrized routes)
router.get('/export', exportReport);

// Report Tab Endpoints
router.get('/sales-register', getSalesRegisterReport);
router.get('/sales-summary', getSalesSummaryReport);
router.get('/store-pnl', getStorePnLReport);
router.get('/store-pnl/:storeId', getStorePnLDetailReport);

export default router;
