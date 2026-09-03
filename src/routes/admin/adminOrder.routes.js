import { Router } from 'express';
import {
  getAdminOfflineSales,
  getAdminOfflineSaleById,
  getAdminOnlineOrders,
  getAdminOnlineOrderById,
  updateAdminOrderStatus,
} from '../../controllers/admin/adminOrder.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

// Apply admin auth
router.use(adminAuth);

// Offline Sales Routes
router.get('/offline', getAdminOfflineSales);
router.get('/offline/:id', getAdminOfflineSaleById);

// Online Orders Routes
router.get('/online', getAdminOnlineOrders);
router.get('/online/:id', getAdminOnlineOrderById);
router.patch('/online/:id/status', updateAdminOrderStatus);
router.put('/online/:id/status', updateAdminOrderStatus);

export default router;
