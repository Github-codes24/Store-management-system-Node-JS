import { Router } from 'express';
import {
  getDashboardOverview,
  getSeeAllRecentOrders,
  getSeeAllRecentCustomers,
  getSeeAllLowStockProducts,
  getSeeAllExpiringProducts,
  getSeeAllMostDemandingProducts,
} from '../../controllers/store-employee/storeEmployee.dashboard.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';

const router = Router();

router.use(storeEmployeeAuth);

router.get('/', getDashboardOverview);
router.get('/recent-orders', getSeeAllRecentOrders);
router.get('/recent-customers', getSeeAllRecentCustomers);
router.get('/low-stock-products', getSeeAllLowStockProducts);
router.get('/expiring-products', getSeeAllExpiringProducts);
router.get('/most-demanding-products', getSeeAllMostDemandingProducts);

export default router;
