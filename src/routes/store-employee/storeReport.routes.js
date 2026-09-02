import { Router } from 'express';
import {
  getSalesRegisterReport,
  getGSTSummaryReport,
  getSalesSummaryReport,
  saveCompositeGSTReport,
} from '../../controllers/store-employee/storeReport.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';

const router = Router();

// Require store employee authentication
router.use(storeEmployeeAuth);

// 1. Sales Register Report
router.get('/sales-register', getSalesRegisterReport);

// 2. GST Summary Report
router.get('/gst-summary', getGSTSummaryReport);

// 3. Sales Summary Report
router.get('/sales-summary', getSalesSummaryReport);

// 4. Save Composite GST Report
router.post('/composite-gst', saveCompositeGSTReport);

export default router;
