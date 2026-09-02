import Store from '../../models/store.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Main Store Panel Dashboard Overview
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;

    // 1. Store Header Info
    const storeInfo = await Store.findById(employeeStoreId).select('name storeCode location');
    const storeName = storeInfo ? storeInfo.name : 'Store';

    // 2. Metric Summary Cards
    const stockAggregate = await StoreProduct.aggregate([
      { $match: { storeId: employeeStoreId, isDeleted: false, status: 'active' } },
      { $group: { _id: null, totalStock: { $sum: '$stockQuantity' } } },
    ]);
    const availableStocks = stockAggregate.length > 0 ? stockAggregate[0].totalStock : 0;

    const totalProducts = await StoreProduct.countDocuments({
      storeId: employeeStoreId,
      isDeleted: false,
      status: 'active',
    });

    const totalCustomers = await Customer.countDocuments({
      $or: [{ storeId: employeeStoreId }, { storeId: null }],
      status: 'active',
    });

    const totalOrders = await SellProduct.countDocuments({
      store: employeeStoreId,
      isDeleted: false,
    });

    const revenueAggregate = await SellProduct.aggregate([
      { $match: { store: employeeStoreId, isDeleted: false } },
      { $group: { _id: null, totalRevenue: { $sum: '$netAmount' } } },
    ]);
    const totalRevenue = revenueAggregate.length > 0 ? revenueAggregate[0].totalRevenue : 0;

    // 3. Monthly Analytics Charts (This Year vs Last Year)
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Customer Growth Analytics
    const customerGrowthThisYear = Array(12).fill(0);
    const customerGrowthLastYear = Array(12).fill(0);

    const customerAgg = await Customer.aggregate([
      {
        $match: {
          $or: [{ storeId: employeeStoreId }, { storeId: null }],
          status: 'active',
          createdAt: { $gte: new Date(`${previousYear}-01-01`), $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`) },
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

    // Order & Revenue Growth Analytics
    const orderGrowthThisYear = Array(12).fill(0);
    const orderGrowthLastYear = Array(12).fill(0);
    const revenueGrowthThisYear = Array(12).fill(0);
    const revenueGrowthLastYear = Array(12).fill(0);

    const salesAgg = await SellProduct.aggregate([
      {
        $match: {
          store: employeeStoreId,
          isDeleted: false,
          billDate: { $gte: new Date(`${previousYear}-01-01`), $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$billDate' },
            month: { $month: '$billDate' },
          },
          ordersCount: { $sum: 1 },
          revenueSum: { $sum: '$netAmount' },
        },
      },
    ]);

    salesAgg.forEach((item) => {
      const monthIdx = item._id.month - 1;
      if (item._id.year === currentYear) {
        orderGrowthThisYear[monthIdx] = item.ordersCount;
        revenueGrowthThisYear[monthIdx] = item.revenueSum;
      } else if (item._id.year === previousYear) {
        orderGrowthLastYear[monthIdx] = item.ordersCount;
        revenueGrowthLastYear[monthIdx] = item.revenueSum;
      }
    });

    // 4. Preview Widgets (Top 5 items)
    // Recent Orders (Top 5)
    const recentOrdersRaw = await SellProduct.find({ store: employeeStoreId, isDeleted: false })
      .select('sellId netAmount billDate createdAt')
      .sort({ billDate: -1, createdAt: -1 })
      .limit(5);

    const recentOrders = recentOrdersRaw.map((o) => ({
      _id: o._id,
      orderId: o.sellId,
      amount: o.netAmount,
      time: o.billDate ? o.billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      date: o.billDate ? o.billDate.toISOString().split('T')[0] : '',
    }));

    // Recent Customers (Top 5)
    const recentCustomersRaw = await Customer.find({
      $or: [{ storeId: employeeStoreId }, { storeId: null }],
      status: 'active',
    })
      .select('name phone email createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentCustomers = recentCustomersRaw.map((c) => ({
      _id: c._id,
      customerName: c.name,
      mobile: c.phone,
      email: c.email,
      date: c.createdAt ? c.createdAt.toISOString().split('T')[0] : '',
    }));

    // Low Stock Products (Top 5 where stock <= 10 or <= alertQuantity)
    const lowStockRaw = await StoreProduct.find({
      storeId: employeeStoreId,
      isDeleted: false,
      status: 'active',
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$alertQuantity', 10] }] },
    })
      .populate('unit', 'name nameHindi')
      .select('productName stockQuantity alertQuantity unit')
      .sort({ stockQuantity: 1 })
      .limit(5);

    const lowStockProducts = lowStockRaw.map((p) => ({
      _id: p._id,
      productName: p.productName,
      quantity: p.unit ? p.unit.name : '1 Unit',
      stock: p.stockQuantity,
    }));

    // Expiring Products (Top 5 expiring within 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringRaw = await StoreProduct.find({
      storeId: employeeStoreId,
      isDeleted: false,
      status: 'active',
      expiryDate: { $ne: null, $gte: now, $lte: thirtyDaysFromNow },
    })
      .select('productName expiryDate stockQuantity')
      .sort({ expiryDate: 1 })
      .limit(5);

    const expiringProducts = expiringRaw.map((p) => {
      const exp = new Date(p.expiryDate);
      const diffTime = exp.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        _id: p._id,
        productName: p.productName,
        expiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
        daysLeft: `${daysLeft} Days`,
        stock: p.stockQuantity,
      };
    });

    // Most Demanding Products (Top 5 Best-Selling Products)
    const topProductsAgg = await SellProduct.aggregate([
      { $match: { store: employeeStoreId, isDeleted: false } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
      { $limit: 5 },
    ]);

    const mostDemandingProducts = topProductsAgg.map((item) => ({
      _id: item._id,
      productName: item.productName || 'Product',
      category: 'General',
      totalUnitsSold: item.totalUnitsSold,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Store dashboard overview fetched successfully',
        data: {
          storeInfo: {
            name: storeName,
            greeting: `Welcome To ${storeName}`,
            subtitle: 'Manage Store',
          },
          metrics: {
            availableStocks,
            totalProducts,
            totalCustomers,
            totalOrders,
            totalRevenue,
          },
          charts: {
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
          },
          recentOrders,
          recentCustomers,
          lowStockProducts,
          expiringProducts,
          mostDemandingProducts,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * See All - Recent Orders (Paginated)
 */
export const getSeeAllRecentOrders = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const { search, page = 1, limit = 10 } = req.query;

    const filter = { store: employeeStoreId, isDeleted: false };

    if (search) {
      filter.sellId = { $regex: search.trim(), $options: 'i' };
    }

    const total = await SellProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const ordersRaw = await SellProduct.find(filter)
      .select('sellId netAmount grossAmount billDate paymentStatus createdAt')
      .sort({ billDate: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const orders = ordersRaw.map((o) => ({
      _id: o._id,
      orderId: o.sellId,
      amount: o.netAmount,
      grossAmount: o.grossAmount,
      paymentStatus: o.paymentStatus,
      time: o.billDate ? o.billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      date: o.billDate ? o.billDate.toISOString().split('T')[0] : '',
    }));

    return res.status(200).json(
      successResponse({
        message: 'Recent orders fetched successfully',
        data: { orders },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * See All - Recent Customers (Paginated)
 */
export const getSeeAllRecentCustomers = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const { search, page = 1, limit = 10 } = req.query;

    const filter = {
      $or: [{ storeId: employeeStoreId }, { storeId: null }],
      status: 'active',
    };

    if (search) {
      const query = search.trim();
      filter.$and = [
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } },
          ],
        },
      ];
    }

    const total = await Customer.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const customersRaw = await Customer.find(filter)
      .select('name phone email totalPurchase amountDue createdAt')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const customers = customersRaw.map((c) => ({
      _id: c._id,
      customerName: c.name,
      mobile: c.phone,
      email: c.email,
      totalPurchase: c.totalPurchase || 0,
      amountDue: c.amountDue || 0,
      date: c.createdAt ? c.createdAt.toISOString().split('T')[0] : '',
    }));

    return res.status(200).json(
      successResponse({
        message: 'Recent customers fetched successfully',
        data: { customers },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * See All - Low Stock Products (Paginated)
 */
export const getSeeAllLowStockProducts = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const { search, threshold = 10, page = 1, limit = 10 } = req.query;

    const filter = {
      storeId: employeeStoreId,
      isDeleted: false,
      status: 'active',
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$alertQuantity', Number(threshold)] }] },
    };

    if (search) {
      filter.productName = { $regex: search.trim(), $options: 'i' };
    }

    const total = await StoreProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const lowStockRaw = await StoreProduct.find(filter)
      .populate('unit', 'name nameHindi')
      .populate('category', 'name')
      .select('productName stockQuantity alertQuantity unit category')
      .sort({ stockQuantity: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const products = lowStockRaw.map((p) => ({
      _id: p._id,
      productName: p.productName,
      category: p.category ? p.category.name : 'General',
      quantity: p.unit ? p.unit.name : '1 Unit',
      stock: p.stockQuantity,
      alertQuantity: p.alertQuantity || Number(threshold),
    }));

    return res.status(200).json(
      successResponse({
        message: 'Low stock products fetched successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * See All - Expiring Products (Paginated)
 */
export const getSeeAllExpiringProducts = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const { search, days = 30, page = 1, limit = 10 } = req.query;

    const now = new Date();
    const maxExpiryDate = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);

    const filter = {
      storeId: employeeStoreId,
      isDeleted: false,
      status: 'active',
      expiryDate: { $ne: null, $gte: now, $lte: maxExpiryDate },
    };

    if (search) {
      filter.productName = { $regex: search.trim(), $options: 'i' };
    }

    const total = await StoreProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const expiringRaw = await StoreProduct.find(filter)
      .select('productName expiryDate stockQuantity batch')
      .sort({ expiryDate: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    const products = expiringRaw.map((p) => {
      const exp = new Date(p.expiryDate);
      const diffTime = exp.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        _id: p._id,
        productName: p.productName,
        batch: p.batch || 'B1',
        expiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
        daysLeft: `${daysLeft} Days`,
        stock: p.stockQuantity,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Expiring products fetched successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * See All - Most Demanding Products (Paginated)
 */
export const getSeeAllMostDemandingProducts = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const { page = 1, limit = 10 } = req.query;

    const pipeline = [
      { $match: { store: employeeStoreId, isDeleted: false } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $sort: { totalUnitsSold: -1 } },
    ];

    const allAgg = await SellProduct.aggregate(pipeline);
    const total = allAgg.length;
    const pagination = getPagination({ page, limit, total });

    const paginatedItems = allAgg.slice(pagination.skip, pagination.skip + pagination.limit);

    const products = paginatedItems.map((item) => ({
      _id: item._id,
      productName: item.productName || 'Product',
      category: 'General',
      totalUnitsSold: item.totalUnitsSold,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Most demanding products fetched successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};
