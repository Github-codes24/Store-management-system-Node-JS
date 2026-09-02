import Store from '../../models/store.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Main Store Panel Dashboard Overview
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;

    // 1. Store Header Info
    const storeInfo = employeeStoreId
      ? await Store.findById(employeeStoreId).select('name storeCode location')
      : null;
    const storeName = storeInfo ? storeInfo.name : 'Store';

    // Flexible store filter helper
    const getStoreFilter = (storeField = 'store') => {
      if (!employeeStoreId) return {};
      return {
        $or: [
          { [storeField]: employeeStoreId },
          { [storeField]: employeeStoreId.toString() },
          { store: employeeStoreId },
          { storeId: employeeStoreId },
          { [storeField]: null },
          { [storeField]: { $exists: false } },
        ],
      };
    };

    // 2. Metric Summary Cards
    const stockAggregate = await StoreProduct.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      { $group: { _id: null, totalStock: { $sum: '$stockQuantity' } } },
    ]);
    const availableStocks = stockAggregate.length > 0 ? stockAggregate[0].totalStock : 0;

    const totalProducts = await StoreProduct.countDocuments({
      ...getStoreFilter('store'),
      isDeleted: { $ne: true },
    });

    const totalCustomers = await Customer.countDocuments({
      ...getStoreFilter('storeId'),
      status: 'active',
    });

    const storeOrdersCount = await StoreOrder.countDocuments({
      ...getStoreFilter('store'),
      isDeleted: { $ne: true },
    });
    const sellProductsCount = await SellProduct.countDocuments({
      ...getStoreFilter('store'),
      isDeleted: false,
    });
    const totalOrders = storeOrdersCount + sellProductsCount;

    const storeOrderRevenueAgg = await StoreOrder.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $ifNull: ['$totalOrderNet', { $ifNull: ['$netAmount', 0] }] },
          },
        },
      },
    ]);
    const sellProductRevenueAgg = await SellProduct.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: false } },
      { $group: { _id: null, totalRevenue: { $sum: '$netAmount' } } },
    ]);
    const totalRevenue =
      (storeOrderRevenueAgg[0]?.totalRevenue || 0) + (sellProductRevenueAgg[0]?.totalRevenue || 0);

    // 3. Monthly Analytics Charts (This Year vs Last Year)
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Customer Growth Analytics
    const customerGrowthThisYear = Array(12).fill(0);
    const customerGrowthLastYear = Array(12).fill(0);

    const customerAgg = await Customer.aggregate([
      {
        $match: {
          ...getStoreFilter('storeId'),
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

    // Order & Revenue Growth Analytics (From both StoreOrder and SellProduct)
    const orderGrowthThisYear = Array(12).fill(0);
    const orderGrowthLastYear = Array(12).fill(0);
    const revenueGrowthThisYear = Array(12).fill(0);
    const revenueGrowthLastYear = Array(12).fill(0);

    const storeOrderSalesAgg = await StoreOrder.aggregate([
      {
        $match: {
          ...getStoreFilter('store'),
          isDeleted: { $ne: true },
          createdAt: { $gte: new Date(`${previousYear}-01-01`), $lte: new Date(`${currentYear}-12-31T23:59:59.999Z`) },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          ordersCount: { $sum: 1 },
          revenueSum: { $sum: '$netAmount' },
        },
      },
    ]);

    storeOrderSalesAgg.forEach((item) => {
      const monthIdx = item._id.month - 1;
      if (item._id.year === currentYear) {
        orderGrowthThisYear[monthIdx] += item.ordersCount;
        revenueGrowthThisYear[monthIdx] += item.revenueSum;
      } else if (item._id.year === previousYear) {
        orderGrowthLastYear[monthIdx] += item.ordersCount;
        revenueGrowthLastYear[monthIdx] += item.revenueSum;
      }
    });

    const sellProductSalesAgg = await SellProduct.aggregate([
      {
        $match: {
          ...getStoreFilter('store'),
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

    sellProductSalesAgg.forEach((item) => {
      const monthIdx = item._id.month - 1;
      if (item._id.year === currentYear) {
        orderGrowthThisYear[monthIdx] += item.ordersCount;
        revenueGrowthThisYear[monthIdx] += item.revenueSum;
      } else if (item._id.year === previousYear) {
        orderGrowthLastYear[monthIdx] += item.ordersCount;
        revenueGrowthLastYear[monthIdx] += item.revenueSum;
      }
    });

    // 4. Preview Widgets (Top 5 items)
    // Recent Orders (Fetch from both StoreOrder & SellProduct)
    const storeOrdersRaw = await StoreOrder.find({ ...getStoreFilter('store'), isDeleted: { $ne: true } })
      .select('orderId netAmount customer createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const sellProductsRaw = await SellProduct.find({ ...getStoreFilter('store'), isDeleted: false })
      .select('sellId netAmount billDate createdAt')
      .sort({ billDate: -1, createdAt: -1 })
      .limit(5);

    const combinedRecentOrders = [
      ...storeOrdersRaw.map((o) => ({
        _id: o._id,
        orderId: o.orderId,
        amount: o.netAmount,
        customerName: o.customer ? o.customer.name : 'Walk-in Customer',
        time: o.createdAt ? o.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        date: o.createdAt ? o.createdAt.toISOString().split('T')[0] : '',
        rawDate: o.createdAt,
      })),
      ...sellProductsRaw.map((o) => ({
        _id: o._id,
        orderId: o.sellId,
        amount: o.netAmount,
        customerName: 'Walk-in Customer',
        time: o.billDate ? o.billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        date: o.billDate ? o.billDate.toISOString().split('T')[0] : '',
        rawDate: o.billDate || o.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate))
      .slice(0, 5);

    // Recent Customers (Top 5)
    const recentCustomersRaw = await Customer.find({
      ...getStoreFilter('storeId'),
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

    // Low Stock Products (Top 5 where stock <= alertQuantity or <= 10)
    const lowStockRaw = await StoreProduct.find({
      ...getStoreFilter('storeId'),
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
      quantity: p.unit ? p.unit.name : 'piece',
      stock: p.stockQuantity,
    }));

    // Expiring Products (Top 5 expiring within 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringRaw = await StoreProduct.find({
      ...getStoreFilter('storeId'),
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

    // Most Demanding Products (Top 5 Best-Selling Products from StoreOrder & SellProduct)
    const storeOrderBillsAgg = await StoreOrder.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      { $unwind: { path: '$bills', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$bills.items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$bills.items.product', '$bills.items.productName'] },
          productName: { $first: '$bills.items.productName' },
          totalUnitsSold: { $sum: '$bills.items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const storeOrderTopItemsAgg = await StoreOrder.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$items.product', '$items.productName'] },
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const sellProductItemsAgg = await SellProduct.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: false } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const productSalesMap = {};

    [...storeOrderBillsAgg, ...storeOrderTopItemsAgg, ...sellProductItemsAgg].forEach((item) => {
      if (!item || !item.productName) return;
      const name = item.productName;
      if (!productSalesMap[name]) {
        productSalesMap[name] = { _id: item._id, productName: name, category: 'General', totalUnitsSold: 0 };
      }
      productSalesMap[name].totalUnitsSold += item.totalUnitsSold || 0;
    });

    const productNames = Object.keys(productSalesMap);
    if (productNames.length > 0) {
      try {
        const storeProducts = await StoreProduct.find({ productName: { $in: productNames } })
          .populate('category', 'name categoryName')
          .lean();
        const catMap = {};
        for (const sp of storeProducts) {
          catMap[sp.productName] = sp.category?.name || sp.category?.categoryName || 'General';
        }
        for (const key of Object.keys(productSalesMap)) {
          if (catMap[key]) {
            productSalesMap[key].category = catMap[key];
          }
        }
      } catch (e) {
        console.error('Error fetching categories for most demanding products:', e);
      }
    }

    const mostDemandingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
      .slice(0, 5)
      .map((item) => ({
        _id: item._id,
        productName: item.productName,
        category: item.category || 'General',
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
          recentOrders: combinedRecentOrders,
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
 * See All - Recent Orders (Paginated from StoreOrder & SellProduct)
 */
export const getSeeAllRecentOrders = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { search, page = 1, limit = 10 } = req.query;

    const getStoreFilter = (storeField = 'store') => {
      if (!employeeStoreId) return {};
      return {
        $or: [
          { [storeField]: employeeStoreId },
          { [storeField]: employeeStoreId.toString() },
          { [storeField]: null },
          { [storeField]: { $exists: false } },
        ],
      };
    };

    const storeOrderFilter = { ...getStoreFilter('store'), isDeleted: { $ne: true } };
    const sellProductFilter = { ...getStoreFilter('store'), isDeleted: false };

    if (search) {
      const reg = { $regex: search.trim(), $options: 'i' };
      storeOrderFilter.orderId = reg;
      sellProductFilter.sellId = reg;
    }

    const storeOrdersRaw = await StoreOrder.find(storeOrderFilter)
      .select('orderId netAmount customer createdAt')
      .sort({ createdAt: -1 });

    const sellProductsRaw = await SellProduct.find(sellProductFilter)
      .select('sellId netAmount billDate createdAt')
      .sort({ billDate: -1, createdAt: -1 });

    const combined = [
      ...storeOrdersRaw.map((o) => ({
        _id: o._id,
        orderId: o.orderId,
        amount: o.netAmount,
        customerName: o.customer ? o.customer.name : 'Walk-in Customer',
        time: o.createdAt ? o.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        date: o.createdAt ? o.createdAt.toISOString().split('T')[0] : '',
        rawDate: o.createdAt,
      })),
      ...sellProductsRaw.map((o) => ({
        _id: o._id,
        orderId: o.sellId,
        amount: o.netAmount,
        customerName: 'Walk-in Customer',
        time: o.billDate ? o.billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        date: o.billDate ? o.billDate.toISOString().split('T')[0] : '',
        rawDate: o.billDate || o.createdAt,
      })),
    ].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

    const total = combined.length;
    const pagination = getPagination({ page, limit, total });
    const orders = combined.slice(pagination.skip, pagination.skip + pagination.limit);

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
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { search, page = 1, limit = 10 } = req.query;

    const filter = {
      status: 'active',
    };

    if (employeeStoreId) {
      filter.$or = [
        { storeId: employeeStoreId },
        { storeId: employeeStoreId.toString() },
        { storeId: null },
        { storeId: { $exists: false } },
      ];
    }

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
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { search, threshold = 10, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
      status: 'active',
      $expr: { $lte: ['$stockQuantity', { $ifNull: ['$alertQuantity', Number(threshold)] }] },
    };

    if (employeeStoreId) {
      filter.$or = [
        { storeId: employeeStoreId },
        { storeId: employeeStoreId.toString() },
        { storeId: null },
        { storeId: { $exists: false } },
      ];
    }

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
      quantity: p.unit ? p.unit.name : 'piece',
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
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { search, days = 30, page = 1, limit = 10 } = req.query;

    const now = new Date();
    const maxExpiryDate = new Date(now.getTime() + Number(days) * 24 * 60 * 60 * 1000);

    const filter = {
      isDeleted: false,
      status: 'active',
      expiryDate: { $ne: null, $gte: now, $lte: maxExpiryDate },
    };

    if (employeeStoreId) {
      filter.$or = [
        { storeId: employeeStoreId },
        { storeId: employeeStoreId.toString() },
        { storeId: null },
        { storeId: { $exists: false } },
      ];
    }

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
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { page = 1, limit = 10 } = req.query;

    const getStoreFilter = (storeField = 'store') => {
      if (!employeeStoreId) return {};
      return {
        $or: [
          { [storeField]: employeeStoreId },
          { [storeField]: employeeStoreId.toString() },
          { [storeField]: null },
          { [storeField]: { $exists: false } },
        ],
      };
    };

    const storeOrderBillsAgg = await StoreOrder.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      { $unwind: { path: '$bills', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$bills.items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$bills.items.product', '$bills.items.productName'] },
          productName: { $first: '$bills.items.productName' },
          totalUnitsSold: { $sum: '$bills.items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const storeOrderTopItemsAgg = await StoreOrder.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: { $ne: true } } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$items.product', '$items.productName'] },
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const sellProductItemsAgg = await SellProduct.aggregate([
      { $match: { ...getStoreFilter('store'), isDeleted: false } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalUnitsSold: { $sum: '$items.quantity' },
        },
      },
      { $match: { productName: { $ne: null } } },
    ]);

    const productSalesMap = {};

    [...storeOrderBillsAgg, ...storeOrderTopItemsAgg, ...sellProductItemsAgg].forEach((item) => {
      if (!item || !item.productName) return;
      const name = item.productName;
      if (!productSalesMap[name]) {
        productSalesMap[name] = { _id: item._id, productName: name, totalUnitsSold: 0 };
      }
      productSalesMap[name].totalUnitsSold += item.totalUnitsSold || 0;
    });

    const sortedProducts = Object.values(productSalesMap).sort((a, b) => b.totalUnitsSold - a.totalUnitsSold);

    const total = sortedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const paginatedItems = sortedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

    const products = paginatedItems.map((item) => ({
      _id: item._id,
      productName: item.productName,
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
