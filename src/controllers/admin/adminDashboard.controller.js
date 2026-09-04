import Store from '../../models/store.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import Notification from '../../models/notification.model.js';
import { successResponse } from '../../utils/api-response.js';

/**
 * Format numbers using Indian numbering grouping (e.g. 6,64,254)
 */
const formatIndianNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  const num = Math.round(Number(value));
  return num.toLocaleString('en-IN');
};

/**
 * Format currency using Indian Rupee format (e.g. ₹ 8,54,87,404)
 */
const formatCurrency = (value) => {
  return `₹ ${formatIndianNumber(value)}`;
};

/**
 * Format time to human readable HH:MM AM/PM
 */
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Fetch and compute all core dashboard statistics
 */
const fetchStatsData = async () => {
  // 1. Total Stores (excluding soft-deleted)
  const storesCount = await Store.countDocuments({ isDeleted: false });

  // 2. Total Products (admin master products or store products fallback)
  let productsCount = await AdminProduct.countDocuments({ isDeleted: false });
  if (productsCount === 0) {
    productsCount = await StoreProduct.countDocuments({ isDeleted: false });
  }

  // 3. Total Customers
  const customersCount = await Customer.countDocuments();

  // 4. Total Orders (StoreOrder + SellProduct)
  const storeOrdersCount = await StoreOrder.countDocuments({
    orderStatus: { $ne: 'Cancelled' },
  });
  const sellProductsCount = await SellProduct.countDocuments({
    isDeleted: false,
    status: { $ne: 'Cancelled' },
  });
  const totalOrdersCount = storeOrdersCount + sellProductsCount;

  // 5. Total Revenue (StoreOrder net + SellProduct net)
  const [storeOrderRevenueAgg, sellProductRevenueAgg] = await Promise.all([
    StoreOrder.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          total: {
            $sum: { $ifNull: ['$totalOrderNet', { $ifNull: ['$netAmount', 0] }] },
          },
        },
      },
    ]),
    SellProduct.aggregate([
      { $match: { isDeleted: false, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$netAmount', 0] } },
        },
      },
    ]),
  ]);

  const storeOrderRevenue = storeOrderRevenueAgg[0]?.total || 0;
  const sellProductRevenue = sellProductRevenueAgg[0]?.total || 0;
  const totalRevenue = storeOrderRevenue + sellProductRevenue;

  return {
    raw: {
      stores: storesCount,
      products: productsCount,
      customers: customersCount,
      orders: totalOrdersCount,
      revenue: Math.round(totalRevenue),
    },
    formatted: {
      stores: formatIndianNumber(storesCount),
      products: formatIndianNumber(productsCount),
      customers: formatIndianNumber(customersCount),
      orders: formatIndianNumber(totalOrdersCount),
      revenue: formatCurrency(totalRevenue),
    },
  };
};

/**
 * Fetch and compute growth chart analytics (This Year vs Last Year)
 */
const fetchChartsData = async () => {
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;
  const startDate = new Date(`${previousYear}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${currentYear}-12-31T23:59:59.999Z`);

  // 12 Months containers
  const customerGrowthThisYear = Array(12).fill(0);
  const customerGrowthLastYear = Array(12).fill(0);

  const orderGrowthThisYear = Array(12).fill(0);
  const orderGrowthLastYear = Array(12).fill(0);

  const revenueGrowthThisYear = Array(12).fill(0);
  const revenueGrowthLastYear = Array(12).fill(0);

  // Customer Growth Aggregation
  const customerAgg = await Customer.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  customerAgg.forEach((item) => {
    const monthIdx = item._id.month - 1;
    if (item._id.year === currentYear) {
      customerGrowthThisYear[monthIdx] = item.count;
    } else if (item._id.year === previousYear) {
      customerGrowthLastYear[monthIdx] = item.count;
    }
  });

  // Store Orders Aggregation
  const storeOrderAgg = await StoreOrder.aggregate([
    {
      $match: {
        orderStatus: { $ne: 'Cancelled' },
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        ordersCount: { $sum: 1 },
        revenueSum: {
          $sum: { $ifNull: ['$totalOrderNet', { $ifNull: ['$netAmount', 0] }] },
        },
      },
    },
  ]);

  storeOrderAgg.forEach((item) => {
    const monthIdx = item._id.month - 1;
    if (item._id.year === currentYear) {
      orderGrowthThisYear[monthIdx] += item.ordersCount;
      revenueGrowthThisYear[monthIdx] += Math.round(item.revenueSum);
    } else if (item._id.year === previousYear) {
      orderGrowthLastYear[monthIdx] += item.ordersCount;
      revenueGrowthLastYear[monthIdx] += Math.round(item.revenueSum);
    }
  });

  // Sell Products (Invoices) Aggregation
  const sellProductAgg = await SellProduct.aggregate([
    {
      $match: {
        isDeleted: false,
        status: { $ne: 'Cancelled' },
        billDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$billDate' },
          month: { $month: '$billDate' },
        },
        ordersCount: { $sum: 1 },
        revenueSum: { $sum: { $ifNull: ['$netAmount', 0] } },
      },
    },
  ]);

  sellProductAgg.forEach((item) => {
    const monthIdx = item._id.month - 1;
    if (item._id.year === currentYear) {
      orderGrowthThisYear[monthIdx] += item.ordersCount;
      revenueGrowthThisYear[monthIdx] += Math.round(item.revenueSum);
    } else if (item._id.year === previousYear) {
      orderGrowthLastYear[monthIdx] += item.ordersCount;
      revenueGrowthLastYear[monthIdx] += Math.round(item.revenueSum);
    }
  });

  return {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    customerGrowth: {
      thisYear: customerGrowthThisYear,
      lastYear: customerGrowthLastYear,
    },
    orderGrowth: {
      thisYear: orderGrowthThisYear,
      lastYear: orderGrowthLastYear,
    },
    revenueGrowth: {
      thisYear: revenueGrowthThisYear,
      lastYear: revenueGrowthLastYear,
    },
  };
};

/**
 * Fetch recent activity feed from notifications and orders
 */
const fetchActivitiesData = async (limit = 10) => {
  const [recentNotifications, recentOrders] = await Promise.all([
    Notification.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title message type createdAt'),
    StoreOrder.find({ orderStatus: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('orderId customer totalOrderNet createdAt'),
  ]);

  const activities = [];

  // Map notifications
  recentNotifications.forEach((n) => {
    activities.push({
      id: `notif-${n._id}`,
      time: formatTime(n.createdAt),
      activity: n.message || n.title,
      type: n.type || 'notification',
      timestamp: n.createdAt,
    });
  });

  // Map orders
  recentOrders.forEach((o) => {
    const custName = o.customer?.name || 'Walk-in Customer';
    const amount = o.totalOrderNet ? ` (${formatCurrency(o.totalOrderNet)})` : '';
    activities.push({
      id: `order-${o._id}`,
      time: formatTime(o.createdAt),
      activity: `Order #${o.orderId} placed by ${custName}${amount}`,
      type: 'order',
      timestamp: o.createdAt,
    });
  });

  // Sort unified activities chronologically descending
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return activities.slice(0, limit);
};

/**
 * Combined Admin Dashboard Overview
 * GET /api/admin/dashboard/overview
 */
export const getDashboardOverview = async (_req, res, next) => {
  try {
    const [statsResult, charts, activities] = await Promise.all([
      fetchStatsData(),
      fetchChartsData(),
      fetchActivitiesData(10),
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Admin dashboard overview retrieved successfully',
        data: {
          stores: statsResult.formatted.stores,
          products: statsResult.formatted.products,
          customers: statsResult.formatted.customers,
          orders: statsResult.formatted.orders,
          revenue: statsResult.formatted.revenue,
          rawStats: statsResult.raw,
          charts,
          activities,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Stats Only Endpoint
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = async (_req, res, next) => {
  try {
    const statsResult = await fetchStatsData();

    return res.status(200).json(
      successResponse({
        message: 'Admin dashboard stats retrieved successfully',
        data: {
          stores: statsResult.formatted.stores,
          products: statsResult.formatted.products,
          customers: statsResult.formatted.customers,
          orders: statsResult.formatted.orders,
          revenue: statsResult.formatted.revenue,
          rawStats: statsResult.raw,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Activities Only Endpoint
 * GET /api/admin/dashboard/activities
 */
export const getDashboardActivities = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const activities = await fetchActivitiesData(limit);

    return res.status(200).json(
      successResponse({
        message: 'Admin dashboard activities retrieved successfully',
        data: activities,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Charts Only Endpoint
 * GET /api/admin/dashboard/charts
 */
export const getDashboardCharts = async (_req, res, next) => {
  try {
    const charts = await fetchChartsData();

    return res.status(200).json(
      successResponse({
        message: 'Admin dashboard charts retrieved successfully',
        data: charts,
      })
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getDashboardOverview,
  getDashboardStats,
  getDashboardActivities,
  getDashboardCharts,
};
