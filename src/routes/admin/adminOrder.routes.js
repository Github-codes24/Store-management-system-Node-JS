import { Router } from 'express';
import {
  getAdminOfflineSales,
  getAdminOfflineSaleById,
  getAdminOnlineOrders,
  getAdminOnlineOrderById,
  updateAdminOrderStatus,
  assignAdminOrderStore,
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
router.patch('/online/:id/assign-store', assignAdminOrderStore);

export default router;
