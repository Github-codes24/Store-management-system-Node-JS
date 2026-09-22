import { Router } from 'express';
import {
  getCustomerNotifications,
  clearAllCustomerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../controllers/customer/customerNotification.controller.js';
import customerAuthMiddleware from '../../middlewares/customer.auth.middleware.js';

const router = Router();

router.use(customerAuthMiddleware);

router.get('/', getCustomerNotifications);
router.delete('/clear-all', clearAllCustomerNotifications);
router.delete('/', clearAllCustomerNotifications);
router.patch('/read-all', markAllNotificationsAsRead);
router.patch('/:id/read', markNotificationAsRead);

export default router;
