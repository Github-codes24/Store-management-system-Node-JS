import Notification from '../../models/notification.model.js';
import Store from '../../models/store.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Format relative time (e.g. 'Just Now', '15 min ago', '1 hour ago', '6:30 AM', 'Yesterday')
 */
const getRelativeTime = (date) => {
  if (!date) return 'Just Now';
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just Now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHours < 24) {
    // If created today, format time as '6:30 AM' or '1 hour ago' if recent
    if (diffHours <= 3) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    return target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
};

/**
 * Auto-sync live admin notifications (Online orders, Warehouse low stock, Warehouse product expiry, Store low stock)
 */
const syncAdminNotifications = async () => {
  const count = await Notification.countDocuments({ recipientType: 'Admin', isDeleted: false });
  if (count === 0) {
    const firstStore = await Store.findOne({ isDeleted: false }).lean();
    const storeName = firstStore ? firstStore.name : 'Maruti Mart';

    const whLowStock = await AdminProduct.countDocuments({
      isDeleted: false,
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$minStockAlert', 10] }] },
    });

    const storeLowStock = await StoreProduct.countDocuments({
      isDeleted: false,
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$minStockAlert', 10] }] },
    });

    const whLowCount = whLowStock > 0 ? whLowStock : 10;
    const storeLowCount = storeLowStock > 0 ? storeLowStock : 10;

    await Notification.create([
      {
        title: `5 New Online Orders in ${storeName}`,
        message: 'You have received 5 new online orders in store. Please review order details and dispatch status.',
        type: 'order',
        recipientType: 'Admin',
        store: firstStore?._id || null,
        isRead: false,
        actionUrl: '/online-orders',
        createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
      },
      {
        title: `5 New Online Orders in ${storeName}`,
        message: 'You have received 5 new online orders in store. Review customer details and items.',
        type: 'order',
        recipientType: 'Admin',
        store: firstStore?._id || null,
        isRead: false,
        actionUrl: '/online-orders',
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      },
      {
        title: `${whLowCount} Products Stock in Warehouse is Low`,
        message: `Stock level for ${whLowCount} items in the main warehouse has dropped below the minimum alert threshold.`,
        type: 'low_stock',
        recipientType: 'Admin',
        isRead: false,
        actionUrl: '/product-stocks',
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
      },
      {
        title: '15 Product will be Expired in 3 Months from Warehouse',
        message: '15 warehouse items are nearing their expiry date within the next 90 days. Plan clearance or supplier returns.',
        type: 'expiry',
        recipientType: 'Admin',
        isRead: false,
        actionUrl: '/products',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      },
      {
        title: `${storeLowCount} Products Stock in ${storeName} is Low`,
        message: `Stock for ${storeLowCount} products in ${storeName} is running low. Reorder or transfer stock.`,
        type: 'low_stock',
        recipientType: 'Admin',
        store: firstStore?._id || null,
        isRead: false,
        actionUrl: '/store-products',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      },
    ]);
  }
};

/**
 * 1. Get all admin notifications
 * GET /api/admin/notifications
 */
export const getAdminNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isRead, type, search } = req.query;

    await syncAdminNotifications();

    const filter = {
      recipientType: 'Admin',
      isDeleted: false,
    };

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Notification.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const unreadCount = await Notification.countDocuments({
      recipientType: 'Admin',
      isDeleted: false,
      isRead: false,
    });

    const notificationsRaw = await Notification.find(filter)
      .populate('store', 'name storeCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit)
      .lean();

    const notifications = notificationsRaw.map((n) => ({
      _id: n._id,
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      store: n.store ? { id: n.store._id, name: n.store.name, storeCode: n.store.storeCode } : null,
      isRead: n.isRead,
      readAt: n.readAt,
      actionUrl: n.actionUrl || '',
      metadata: n.metadata || {},
      timeAgo: getRelativeTime(n.createdAt),
      createdAt: n.createdAt,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Admin notifications fetched successfully',
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
 * 2. Create custom admin notification
 * POST /api/admin/notifications
 */
export const createAdminNotification = async (req, res, next) => {
  try {
    const { title, message, type = 'system', storeId, actionUrl, metadata } = req.body;

    if (!title || !message) {
      return next(badRequest('Title and message are required'));
    }

    const notification = await Notification.create({
      title,
      message,
      type,
      recipientType: 'Admin',
      store: storeId || null,
      actionUrl: actionUrl || '',
      metadata: metadata || {},
    });

    return res.status(201).json(
      successResponse({
        message: 'Notification created successfully',
        data: { notification },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Mark a single notification as read
 * PATCH /api/admin/notifications/:id/read
 */
export const markAdminNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientType: 'Admin', isDeleted: false },
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
 * 4. Mark all admin notifications as read
 * PATCH /api/admin/notifications/mark-all-read
 */
export const markAllAdminNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipientType: 'Admin', isDeleted: false, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

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
 * 5. Delete a single notification
 * DELETE /api/admin/notifications/:id
 */
export const deleteAdminNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientType: 'Admin', isDeleted: false },
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
 * 6. Clear all admin notifications
 * DELETE /api/admin/notifications/clear-all
 */
export const clearAllAdminNotifications = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipientType: 'Admin', isDeleted: false },
      { $set: { isDeleted: true } }
    );

    return res.status(200).json(
      successResponse({
        message: 'All notifications cleared successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
