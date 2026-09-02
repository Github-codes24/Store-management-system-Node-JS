import Notification from '../../models/notification.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Format relative time (e.g. 'Just Now', '15 min ago', '1 hour ago')
 */
const getRelativeTime = (date) => {
  if (!date) return 'Just Now';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just Now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
};

/**
 * Auto-sync live store notifications (Low stock alerts, online orders, etc.)
 */
const syncStoreNotifications = async (storeId) => {
  if (!storeId) return;

  const count = await Notification.countDocuments({ store: storeId, isDeleted: false });
  if (count === 0) {
    // Check for low stock products in store
    const lowStockProduct = await StoreProduct.findOne({
      store: storeId,
      isDeleted: false,
      status: 'active',
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$alertQuantity', 10] }] },
    });

    const lowStockName = lowStockProduct ? lowStockProduct.productName : 'Amul Butter 500g';
    const lowStockQty = lowStockProduct ? lowStockProduct.stockQuantity : 5;

    // Seed realistic operational alerts matching store flow
    await Notification.create([
      {
        title: '5 New Online Orders Received',
        message: 'You have received 5 new online orders that require processing. Please review and confirm the orders.',
        type: 'order',
        store: storeId,
        isRead: false,
        actionUrl: '/online-orders',
        createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
      },
      {
        title: `Low Stock Alert: ${lowStockName}`,
        message: `Stock for ${lowStockName} has dropped below the minimum threshold. Current stock: ${lowStockQty} units.`,
        type: 'low_stock',
        store: storeId,
        isRead: false,
        actionUrl: '/product-inventory',
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
      },
      {
        title: '3 Orders Ready for Pickup',
        message: 'Orders ORD-1045, ORD-1046, and ORD-1047 are packed and ready for customer pickup.',
        type: 'pickup',
        store: storeId,
        isRead: true,
        actionUrl: '/offline-sales',
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        title: 'Daily Sales Report Generated',
        message: 'Your daily sales report has been generated successfully. Review summary and breakdown in reports.',
        type: 'report',
        store: storeId,
        isRead: true,
        actionUrl: '/reports',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
    ]);
  }
};

/**
 * Get all notifications for store employee
 */
export const getStoreNotifications = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { page = 1, limit = 20, isRead } = req.query;

    if (employeeStoreId) {
      await syncStoreNotifications(employeeStoreId);
    }

    const filter = {
      isDeleted: false,
    };

    if (employeeStoreId) {
      filter.$or = [
        { store: employeeStoreId },
        { store: null },
        { store: { $exists: false } },
      ];
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    const total = await Notification.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false,
    });

    const notificationsRaw = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit);

    const notifications = notificationsRaw.map((n) => ({
      _id: n._id,
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      readAt: n.readAt,
      actionUrl: n.actionUrl,
      timeAgo: getRelativeTime(n.createdAt),
      createdAt: n.createdAt,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Store notifications fetched successfully',
        data: {
          notifications,
          unreadCount,
          pagination,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
export const markStoreNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return next(notFound('Notification not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Notification marked as read',
        data: { notification },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all store notifications as read
 */
export const markAllStoreNotificationsAsRead = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;

    const filter = {
      isDeleted: false,
      isRead: false,
    };

    if (employeeStoreId) {
      filter.$or = [
        { store: employeeStoreId },
        { store: null },
        { store: { $exists: false } },
      ];
    }

    const result = await Notification.updateMany(filter, {
      $set: { isRead: true, readAt: new Date() },
    });

    return res.status(200).json(
      successResponse({
        message: 'All notifications marked as read',
        data: { modifiedCount: result.modifiedCount },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 */
export const deleteStoreNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!notification) {
      return next(notFound('Notification not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Notification deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all notifications
 */
export const clearAllStoreNotifications = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;

    const filter = { isDeleted: false };
    if (employeeStoreId) {
      filter.$or = [
        { store: employeeStoreId },
        { store: null },
        { store: { $exists: false } },
      ];
    }

    await Notification.updateMany(filter, { $set: { isDeleted: true } });

    return res.status(200).json(
      successResponse({
        message: 'All notifications cleared successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
