import Store from '../../models/store.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import ProductPurchaseInvoice from '../../models/productPurchaseInvoice.model.js';
import Retailer from '../../models/retailer.model.js';
import Distributor from '../../models/distributor.model.js';
import Notification from '../../models/notification.model.js';
import { successResponse } from '../../utils/api-response.js';
import { getKolkataTodayRange } from '../../utils/timezone.js';

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
 * Format time to human readable HH:MM AM/PM in IST (Asia/Kolkata)
 */
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Fetch and compute all core dashboard statistics
 */
const fetchStatsData = async () => {
  const { start: todayStart, end: todayEnd } = getKolkataTodayRange();

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

  // 5. Total Revenue & Today's Earning (StoreOrder net + SellProduct net)
  const [
    storeOrderRevenueAgg,
    sellProductRevenueAgg,
    todayStoreOrderRevenueAgg,
    todaySellProductRevenueAgg,
  ] = await Promise.all([
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
    StoreOrder.aggregate([
      {
        $match: {
          orderStatus: { $ne: 'Cancelled' },
          createdAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
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
      {
        $match: {
          isDeleted: false,
          status: { $ne: 'Cancelled' },
          $or: [
            { billDate: { $gte: todayStart, $lte: todayEnd } },
            { billDate: null, createdAt: { $gte: todayStart, $lte: todayEnd } },
          ],
        },
      },
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

  const todayStoreOrderRevenue = todayStoreOrderRevenueAgg[0]?.total || 0;
  const todaySellProductRevenue = todaySellProductRevenueAgg[0]?.total || 0;
  const todayEarning = todayStoreOrderRevenue + todaySellProductRevenue;

  // 6. Today's Orders
  const [todayStoreOrdersCount, todaySellProductsCount] = await Promise.all([
    StoreOrder.countDocuments({
      orderStatus: { $ne: 'Cancelled' },
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }),
    SellProduct.countDocuments({
      isDeleted: false,
      status: { $ne: 'Cancelled' },
      $or: [
        { billDate: { $gte: todayStart, $lte: todayEnd } },
        { billDate: null, createdAt: { $gte: todayStart, $lte: todayEnd } },
      ],
    }),
  ]);
  const todayOrdersCount = todayStoreOrdersCount + todaySellProductsCount;

  return {
    raw: {
      stores: storesCount,
      products: productsCount,
      customers: customersCount,
      orders: totalOrdersCount,
      todayOrders: todayOrdersCount,
      revenue: Math.round(totalRevenue),
      todayEarning: Math.round(todayEarning),
      todayRevenue: Math.round(todayEarning),
    },
    formatted: {
      stores: formatIndianNumber(storesCount),
      products: formatIndianNumber(productsCount),
      customers: formatIndianNumber(customersCount),
      orders: formatIndianNumber(totalOrdersCount),
      todayOrders: formatIndianNumber(todayOrdersCount),
      revenue: formatCurrency(totalRevenue),
      todayEarning: formatCurrency(todayEarning),
      todayRevenue: formatCurrency(todayEarning),
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
 * Fetch real live recent activity feed from actual database models
 */
const fetchActivitiesData = async (limit = 10) => {
  const [
    recentNotifications,
    recentOrders,
    recentSales,
    recentPurchases,
    recentCustomers,
    recentProducts,
  ] = await Promise.all([
    Notification.find({ isDeleted: { $ne: true }, recipientType: 'Admin' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('title message type createdAt'),
    StoreOrder.find({ orderStatus: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customer', 'name phone')
      .populate('store', 'name')
      .select('orderId customer store totalOrderNet netAmount createdAt'),
    SellProduct.find({ isDeleted: false, status: { $ne: 'Cancelled' } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('store', 'name')
      .populate('retailer', 'name')
      .select('sellId saleType store retailer netAmount createdAt'),
    ProductPurchaseInvoice.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('distributor', 'name')
      .select('purchaseId distributor netAmount createdAt'),
    Customer.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name phone createdAt'),
    AdminProduct.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('productName createdAt'),
  ]);

  const activities = [];

  // 1. Map real notifications
  recentNotifications.forEach((n) => {
    activities.push({
      id: `notif-${n._id}`,
      time: formatTime(n.createdAt),
      activity: n.title || n.message,
      type: n.type || 'notification',
      timestamp: n.createdAt,
    });
  });

  // 2. Map customer / store orders
  recentOrders.forEach((o) => {
    const custName = o.customer?.name ? o.customer.name.split(' ')[0] : 'Customer';
    const net = o.totalOrderNet || o.netAmount || 0;
    const amountStr = net > 0 ? ` (${formatCurrency(net)})` : '';
    activities.push({
      id: `order-${o._id}`,
      time: formatTime(o.createdAt),
      activity: `Order #${o.orderId || o._id} - ${custName}${amountStr}`,
      type: 'order',
      timestamp: o.createdAt,
    });
  });

  // 3. Map POS Sales
  recentSales.forEach((s) => {
    const storeOrRetailer = s.saleType === 'Own Store' ? s.store?.name || 'Store' : s.retailer?.name || 'Retailer';
    const amountStr = s.netAmount ? ` (${formatCurrency(s.netAmount)})` : '';
    activities.push({
      id: `sale-${s._id}`,
      time: formatTime(s.createdAt),
      activity: `POS Sale #${s.sellId} - ${storeOrRetailer}${amountStr}`,
      type: 'sale',
      timestamp: s.createdAt,
    });
  });

  // 4. Map Distributor Purchases
  recentPurchases.forEach((p) => {
    const amountStr = p.netAmount ? ` (${formatCurrency(p.netAmount)})` : '';
    activities.push({
      id: `purchase-${p._id}`,
      time: formatTime(p.createdAt),
      activity: `Purchase #${p.purchaseId}${amountStr}`,
      type: 'purchase',
      timestamp: p.createdAt,
    });
  });

  // 5. Map Customer Registrations
  recentCustomers.forEach((c) => {
    activities.push({
      id: `cust-${c._id}`,
      time: formatTime(c.createdAt),
      activity: `Customer '${c.name || 'Customer'}' registered`,
      type: 'customer',
      timestamp: c.createdAt,
    });
  });

  // 6. Map Master Products Added
  recentProducts.forEach((p) => {
    activities.push({
      id: `prod-${p._id}`,
      time: formatTime(p.createdAt),
      activity: `Product '${p.productName}' added`,
      type: 'product',
      timestamp: p.createdAt,
    });
  });

  // Sort all real activities chronologically descending
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return activities.slice(0, limit);
};

/**
 * Fetch products expiring within one month (30 days) for Dashboard display
 */
const fetchExpiringProductsData = async (limit = 10, days = 30) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const maxExpiryDate = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);

  const [adminExpiring, storeExpiring] = await Promise.all([
    AdminProduct.find({
      isDeleted: false,
      status: 'active',
      expiryDate: { $ne: null, $gte: startOfToday, $lte: maxExpiryDate },
    })
      .populate('category', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .sort({ expiryDate: 1 })
      .limit(limit),
    StoreProduct.find({
      isDeleted: false,
      status: 'active',
      expiryDate: { $ne: null, $gte: startOfToday, $lte: maxExpiryDate },
    })
      .populate('category', 'name categoryName')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .populate('storeId', 'name storeCode')
      .sort({ expiryDate: 1 })
      .limit(limit),
  ]);

  const list = [];
  const seenBarcodes = new Set();

  adminExpiring.forEach((p) => {
    const exp = new Date(p.expiryDate);
    const diffTime = exp.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (p.barcode) seenBarcodes.add(p.barcode);

    list.push({
      _id: p._id,
      id: p._id,
      productName: p.productName,
      barcode: p.barcode || '-',
      brand: p.brand?.name || '—',
      category: p.category?.name || '—',
      expiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
      daysLeft: daysLeft > 0 ? `${daysLeft} Days` : daysLeft === 0 ? 'Today' : 'Expired',
      stock: p.stockQuantity,
      unit: p.unit?.shortName || p.unit?.name || 'pc',
      source: 'Admin Master',
    });
  });

  storeExpiring.forEach((p) => {
    if (list.length >= limit) return;
    if (p.barcode && seenBarcodes.has(p.barcode)) return;

    const exp = new Date(p.expiryDate);
    const diffTime = exp.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    list.push({
      _id: p._id,
      id: p._id,
      productName: p.productName,
      barcode: p.barcode || '-',
      brand: p.brand?.name || '—',
      category: p.category?.name || p.category?.categoryName || '—',
      expiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
      daysLeft: daysLeft > 0 ? `${daysLeft} Days` : daysLeft === 0 ? 'Today' : 'Expired',
      stock: p.stockQuantity,
      unit: p.unit?.shortName || p.unit?.name || 'pc',
      storeName: p.storeId?.name || null,
      source: 'Store Inventory',
    });
  });

  return list.slice(0, limit);
};

/**
 * Combined Admin Dashboard Overview
 * GET /api/admin/dashboard/overview
 */
export const getDashboardOverview = async (_req, res, next) => {
  try {
    const [statsResult, charts, activities, expiringProducts] = await Promise.all([
      fetchStatsData(),
      fetchChartsData(),
      fetchActivitiesData(10),
      fetchExpiringProductsData(10, 30),
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Admin dashboard overview retrieved successfully',
        data: {
          stores: statsResult.formatted.stores,
          products: statsResult.formatted.products,
          customers: statsResult.formatted.customers,
          orders: statsResult.formatted.orders,
          todayOrders: statsResult.formatted.todayOrders,
          revenue: statsResult.formatted.revenue,
          todayEarning: statsResult.formatted.todayEarning,
          todayRevenue: statsResult.formatted.todayRevenue,
          rawStats: statsResult.raw,
          charts,
          activities,
          expiringProducts,
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
          todayOrders: statsResult.formatted.todayOrders,
          revenue: statsResult.formatted.revenue,
          todayEarning: statsResult.formatted.todayEarning,
          todayRevenue: statsResult.formatted.todayRevenue,
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
 * Expiring Products Only Endpoint
 * GET /api/admin/dashboard/expiring-products
 */
export const getDashboardExpiringProducts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const days = parseInt(req.query.days, 10) || 30;
    const expiringProducts = await fetchExpiringProductsData(limit, days);

    return res.status(200).json(
      successResponse({
        message: 'Expiring products before one month retrieved successfully',
        data: {
          expiringProducts,
          total: expiringProducts.length,
        },
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
  getDashboardExpiringProducts,
};
