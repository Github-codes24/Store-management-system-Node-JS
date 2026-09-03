import StoreOrder from '../../models/storeOrder.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import Store from '../../models/store.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Format flexible date (DD/MM/YYYY, YYYY-MM-DD, ISO)
 */
const parseDateRange = (startDate, endDate) => {
  const dateFilter = {};
  if (startDate) {
    const s = startDate.trim();
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      dateFilter.$gte = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    } else {
      const d = new Date(s);
      if (!isNaN(d.getTime())) dateFilter.$gte = d;
    }
  }

  if (endDate) {
    const e = endDate.trim();
    const dmy = e.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      dateFilter.$lte = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59, 59, 999);
    } else {
      const d = new Date(e);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        dateFilter.$lte = d;
      }
    }
  }

  return Object.keys(dateFilter).length > 0 ? dateFilter : null;
};

/**
 * Format product summary string: e.g. "Product1 ... +3 more product"
 */
const formatProductSummary = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 'No items';
  const firstItemName = items[0].productName || items[0].product?.productName || 'Product';
  if (items.length === 1) return firstItemName;
  return `${firstItemName} ... +${items.length - 1} more product`;
};

/**
 * 1. Get Offline Sales for Admin Panel (Across all stores or filtered by store)
 */
export const getAdminOfflineSales = async (req, res, next) => {
  try {
    const {
      store,
      storeId,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {
      isDeleted: { $ne: true },
      $or: [
        { 'bills.saleType': 'Offline' },
        { orderId: /^SODR/i },
        { 'bills.saleType': { $exists: false } },
      ],
    };

    // Store Filter
    const targetStore = storeId || store;
    if (targetStore && targetStore !== 'All Store' && targetStore !== 'All Stores' && targetStore.trim() !== '') {
      let storeObjId = targetStore;
      if (typeof targetStore === 'string' && targetStore.length !== 24) {
        const found = await Store.findOne({ name: new RegExp(`^${targetStore}$`, 'i'), isDeleted: false });
        if (found) storeObjId = found._id;
      }
      filter.store = storeObjId;
    }

    // Search filter
    if (search && search.trim() !== '') {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { orderId: regex },
          { 'customer.name': regex },
          { 'customer.phone': regex },
          { 'bills.billId': regex },
        ],
      });
    }

    // Date range filter
    const dateRange = parseDateRange(startDate, endDate);
    if (dateRange) {
      filter.createdAt = dateRange;
    }

    const total = await StoreOrder.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const ordersRaw = await StoreOrder.find(filter)
      .populate('store', 'name storeCode location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit);

    const data = ordersRaw.map((o) => {
      const allItems = o.bills?.flatMap((b) => b.items || []) || [];
      const totalBill = o.totalOrderNet !== undefined ? o.totalOrderNet : o.bills?.reduce((acc, b) => acc + (b.netAmount || 0), 0) || 0;
      const credit = o.totalOrderDue !== undefined ? o.totalOrderDue : o.bills?.reduce((acc, b) => acc + (b.dueAmount || 0), 0) || 0;
      const orderDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '—';

      return {
        _id: o._id,
        id: o._id,
        orderId: o.orderId || `SODR${String(o._id).slice(-5)}`,
        customerName: o.customer?.name || 'Walk-in Customer',
        customerPhone: o.customer?.phone || '—',
        customerAddress: o.customer?.address || '—',
        products: formatProductSummary(allItems),
        items: allItems,
        totalBill: `₹ ${Number(totalBill).toLocaleString('en-IN')}`,
        rawTotalBill: totalBill,
        credit: `₹ ${Number(credit).toLocaleString('en-IN')}`,
        rawCredit: credit,
        date: orderDate,
        rawDate: o.createdAt,
        store: o.store?.name || 'Daily Choice Mart',
        storeId: o.store?._id || o.store,
        paymentStatus: credit > 0 ? 'Due' : 'Paid',
        bills: o.bills || [],
        returns: o.returns || [],
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Offline sales retrieved successfully',
        data,
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Offline Sale details
 */
export const getAdminOfflineSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await StoreOrder.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).populate('store', 'name storeCode location email phone');

    if (!order) {
      return next(notFound('Offline sale order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Offline sale details fetched successfully',
        data: order,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get Online Orders for Admin Panel (Across all stores or filtered by store)
 */
export const getAdminOnlineOrders = async (req, res, next) => {
  try {
    const {
      store,
      storeId,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {
      isDeleted: { $ne: true },
      $or: [
        { 'bills.saleType': 'Online' },
        { orderId: /^OODR/i },
      ],
    };

    // Store Filter
    const targetStore = storeId || store;
    if (targetStore && targetStore !== 'All Stores' && targetStore !== 'All Store' && targetStore.trim() !== '') {
      let storeObjId = targetStore;
      if (typeof targetStore === 'string' && targetStore.length !== 24) {
        const found = await Store.findOne({ name: new RegExp(`^${targetStore}$`, 'i'), isDeleted: false });
        if (found) storeObjId = found._id;
      }
      filter.store = storeObjId;
    }

    // Status Filter (New, Processing, Out for Delivery, Delivered, Cancelled)
    if (status && status !== 'All Statuses' && status.trim() !== '') {
      filter.orderStatus = new RegExp(`^${status.trim()}$`, 'i');
    }

    // Search Filter
    if (search && search.trim() !== '') {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { orderId: regex },
          { 'customer.name': regex },
          { 'customer.phone': regex },
        ],
      });
    }

    // Date range filter
    const dateRange = parseDateRange(startDate, endDate);
    if (dateRange) {
      filter.createdAt = dateRange;
    }

    const total = await StoreOrder.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const ordersRaw = await StoreOrder.find(filter)
      .populate('store', 'name storeCode location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit);

    const data = ordersRaw.map((o) => {
      const allItems = o.bills?.flatMap((b) => b.items || []) || [];
      const totalBill = o.totalOrderNet !== undefined ? o.totalOrderNet : o.bills?.reduce((acc, b) => acc + (b.netAmount || 0), 0) || 0;
      const orderDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '—';
      const orderStatus = o.orderStatus || 'New';

      return {
        _id: o._id,
        id: o._id,
        orderId: o.orderId || `OODR${String(o._id).slice(-5)}`,
        customerName: o.customer?.name || 'Online Customer',
        customerPhone: o.customer?.phone || '—',
        customerAddress: o.customer?.address || '—',
        products: formatProductSummary(allItems),
        items: allItems,
        totalBill: `₹ ${Number(totalBill).toLocaleString('en-IN')}`,
        rawTotalBill: totalBill,
        date: orderDate,
        rawDate: o.createdAt,
        status: orderStatus,
        store: o.store?.name || 'Daily Choice Mart',
        storeId: o.store?._id || o.store,
        bills: o.bills || [],
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Online orders retrieved successfully',
        data,
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Get Single Online Order details
 */
export const getAdminOnlineOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await StoreOrder.findOne({
      _id: id,
      isDeleted: { $ne: true },
    }).populate('store', 'name storeCode location email phone');

    if (!order) {
      return next(notFound('Online order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Online order details fetched successfully',
        data: order,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Update Online Order Status (e.g. New -> Processing -> Out for Delivery -> Delivered)
 */
export const updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(badRequest('Status is required'));
    }

    const order = await StoreOrder.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { orderStatus: status } },
      { new: true }
    );

    if (!order) {
      return next(notFound('Order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: `Order status updated to ${status}`,
        data: order,
      })
    );
  } catch (error) {
    next(error);
  }
};
