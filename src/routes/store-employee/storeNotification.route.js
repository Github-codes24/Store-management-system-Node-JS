import { Router } from 'express';
import {
  getStoreNotifications,
  markStoreNotificationAsRead,
  markAllStoreNotificationsAsRead,
  deleteStoreNotification,
  clearAllStoreNotifications,
} from '../../controllers/store-employee/storeNotification.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';

const router = Router();

router.use(storeEmployeeAuth);

router.get('/', getStoreNotifications);
router.patch('/mark-all-read', markAllStoreNotificationsAsRead);
router.patch('/:id/read', markStoreNotificationAsRead);
router.delete('/clear-all', clearAllStoreNotifications);
router.delete('/:id', deleteStoreNotification);

export default router;
