import { Router } from 'express';
import {
  getAdminNotifications,
  createAdminNotification,
  markAdminNotificationAsRead,
  markAllAdminNotificationsAsRead,
  deleteAdminNotification,
  clearAllAdminNotifications,
} from '../../controllers/admin/adminNotification.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

// Require admin authentication
router.use(adminAuth);

// Notification endpoints
router.get('/', getAdminNotifications);
router.post('/', createAdminNotification);
router.patch('/mark-all-read', markAllAdminNotificationsAsRead);
router.patch('/:id/read', markAdminNotificationAsRead);
router.delete('/clear-all', clearAllAdminNotifications);
router.delete('/:id', deleteAdminNotification);

export default router;
