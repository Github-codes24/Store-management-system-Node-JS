import Notification from '../../models/notification.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Helper to create a customer notification (used internally on order status changes or special offers)
 */
export const createCustomerNotificationHelper = async ({
  customerId,
  title,
  message,
  type = 'system',
  actionUrl = '',
  metadata = {},
}) => {
  if (!customerId || !title || !message) return null;
  const normalizedType = (type || 'system').toLowerCase();
  const validTypes = ['order', 'low_stock', 'expiry', 'pickup', 'report', 'offer', 'system'];
  const finalType = validTypes.includes(normalizedType) ? normalizedType : 'system';

  return Notification.create({
    recipient: customerId,
    recipientType: 'Customer',
    title,
    message,
    type: finalType,
    actionUrl,
    metadata,
  });
};

/**
 * Get Customer Notifications List
 * GET /api/customer/notifications?page=1&limit=20
 */
export const getCustomerNotifications = async (req, res, next) => {
  try {
    const customerId = req.customer._id;
    const { page = 1, limit = 20 } = req.query;

    const filter = {
      recipient: customerId,
      recipientType: 'Customer',
    };

    const total = await Notification.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const rawNotifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();

    const notifications = rawNotifications.map((n) => {
      const dt = new Date(n.createdAt);
      const timeStr = dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type || 'system',
        isRead: Boolean(n.isRead),
        readAt: n.readAt || null,
        time: timeStr,
        formattedTime: timeStr,
        actionUrl: n.actionUrl || '',
        createdAt: n.createdAt,
      };
    });

    const unreadCount = await Notification.countDocuments({
      recipient: customerId,
      recipientType: 'Customer',
      isRead: false,
    });

    return res.status(200).json(
      successResponse({
        message: 'Notifications retrieved successfully',
        data: {
          unreadCount,
          notifications,
        },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Clear All Customer Notifications
 * DELETE /api/customer/notifications/clear-all
 */
export const clearAllCustomerNotifications = async (req, res, next) => {
  try {
    const customerId = req.customer._id;

    await Notification.deleteMany({
      recipient: customerId,
      recipientType: 'Customer',
    });

    return res.status(200).json(
      successResponse({
        message: 'All notifications cleared successfully',
        data: {
          unreadCount: 0,
          notifications: [],
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Mark Single Notification as Read
 * PATCH /api/customer/notifications/:id/read
 */
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const customerId = req.customer._id;
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: customerId,
        recipientType: 'Customer',
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
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
 * Mark All Customer Notifications as Read
 * PATCH /api/customer/notifications/read-all
 */
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const customerId = req.customer._id;

    await Notification.updateMany(
      {
        recipient: customerId,
        recipientType: 'Customer',
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json(
      successResponse({
        message: 'All notifications marked as read',
        data: { unreadCount: 0 },
      })
    );
  } catch (error) {
    next(error);
  }
};
