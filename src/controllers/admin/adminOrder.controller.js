import StoreOrder from '../../models/storeOrder.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import Store from '../../models/store.model.js';
import Customer from '../../models/customer.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';
import { createCustomerNotificationHelper } from '../customer/customerNotification.controller.js';

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

    const [ordersRaw, statsOrders] = await Promise.all([
      StoreOrder.find(filter)
        .populate('store', 'name storeCode location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(queryLimit)
        .lean(),
      StoreOrder.find(filter)
        .select('payments bills.payments bills.paymentMethod bills.paidAmount bills.netAmount bills.totalRefunded totalOrderPaid totalOrderNet totalOrderRefunded')
        .lean(),
    ]);

    let totalCash = 0;
    let totalUPI = 0;
    let totalCard = 0;

    for (const o of statsOrders) {
      let oCash = 0;
      let oUpi = 0;
      let oCard = 0;
      const paymentsList = (Array.isArray(o.payments) && o.payments.length > 0)
        ? o.payments
        : (Array.isArray(o.bills?.[0]?.payments) && o.bills[0].payments.length > 0)
        ? o.bills[0].payments
        : [];

      if (paymentsList.length > 0) {
        for (const p of paymentsList) {
          const mode = (p.mode || '').trim().toLowerCase();
          const amt = Number(p.amount) || 0;
          if (mode === 'cash') oCash += amt;
          else if (mode === 'upi') oUpi += amt;
          else if (mode === 'card' || mode.includes('card')) oCard += amt;
        }
      }

      const firstBill = o.bills?.[0] || {};
      const netAmount = Number(firstBill.netAmount ?? o.totalOrderNet ?? 0);
      const refunded = Number(firstBill.totalRefunded || o.totalOrderRefunded || 0);
      const effective = Math.max(0, netAmount - refunded);
      const paid = Number(firstBill.paidAmount ?? o.totalOrderPaid ?? effective);

      if (oCash === 0 && oUpi === 0 && oCard === 0 && paid > 0) {
        const method = (firstBill.paymentMethod || o.paymentMethod || '').trim().toLowerCase();
        if (method === 'cash') oCash = paid;
        else if (method === 'upi') oUpi = paid;
        else if (method === 'card' || method.includes('card')) oCard = paid;
        else if (effective > 0) oCash = paid;
      }

      if (refunded > 0 && effective >= 0) {
        const recorded = oCash + oUpi + oCard;
        if (recorded > effective && recorded > 0) {
          const ratio = effective / recorded;
          oCash *= ratio;
          oUpi *= ratio;
          oCard *= ratio;
        }
      }

      totalCash += oCash;
      totalUPI += oUpi;
      totalCard += oCard;
    }

    const data = ordersRaw.map((o) => {
      const allItems = o.bills?.flatMap((b) => b.items || []) || [];
      const totalBill = o.totalOrderNet !== undefined ? o.totalOrderNet : o.bills?.reduce((acc, b) => acc + (b.netAmount || 0), 0) || 0;
      const credit = o.totalOrderDue !== undefined ? o.totalOrderDue : o.bills?.reduce((acc, b) => acc + (b.dueAmount || 0), 0) || 0;
      const orderDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-GB') : '—';

      let oCash = 0;
      let oUpi = 0;
      let oCard = 0;
      const paymentsList = (Array.isArray(o.payments) && o.payments.length > 0)
        ? o.payments
        : (Array.isArray(o.bills?.[0]?.payments) && o.bills[0].payments.length > 0)
        ? o.bills[0].payments
        : [];

      if (paymentsList.length > 0) {
        for (const p of paymentsList) {
          const mode = (p.mode || '').trim().toLowerCase();
          const amt = Number(p.amount) || 0;
          if (mode === 'cash') oCash += amt;
          else if (mode === 'upi') oUpi += amt;
          else if (mode === 'card' || mode.includes('card')) oCard += amt;
        }
      }

      const firstBill = o.bills?.[0] || {};
      const refunded = Number(firstBill.totalRefunded || o.totalOrderRefunded || 0);
      const effectiveTotal = Math.max(0, totalBill - refunded);
      const paidAmount = Number(firstBill.paidAmount ?? o.totalOrderPaid ?? effectiveTotal);

      if (oCash === 0 && oUpi === 0 && oCard === 0 && paidAmount > 0) {
        const method = (firstBill.paymentMethod || o.paymentMethod || '').trim().toLowerCase();
        if (method === 'cash') oCash = paidAmount;
        else if (method === 'upi') oUpi = paidAmount;
        else if (method === 'card' || method.includes('card')) oCard = paidAmount;
        else if (effectiveTotal > 0) oCash = paidAmount;
      }

      if (refunded > 0 && effectiveTotal >= 0) {
        const recorded = oCash + oUpi + oCard;
        if (recorded > effectiveTotal && recorded > 0) {
          const ratio = effectiveTotal / recorded;
          oCash *= ratio;
          oUpi *= ratio;
          oCard *= ratio;
        }
      }

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
        cash: oCash > 0 ? `₹ ${Math.round(oCash).toLocaleString('en-IN')}` : '-',
        rawCash: oCash,
        upi: oUpi > 0 ? `₹ ${Math.round(oUpi).toLocaleString('en-IN')}` : '-',
        rawUpi: oUpi,
        card: oCard > 0 ? `₹ ${Math.round(oCard).toLocaleString('en-IN')}` : '-',
        rawCard: oCard,
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
        stats: {
          totalCash: Math.round(totalCash * 100) / 100,
          totalUPI: Math.round(totalUPI * 100) / 100,
          totalCard: Math.round(totalCard * 100) / 100,
        },
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
    const { status, description } = req.body;

    if (!status) {
      return next(badRequest('Status is required'));
    }

    const order = await StoreOrder.findOne({ _id: id, isDeleted: { $ne: true } });

    if (!order) {
      return next(notFound('Order not found'));
    }

    order.orderStatus = status;

    if (!Array.isArray(order.statusHistory)) {
      order.statusHistory = [];
    }

    const statusTitleMap = {
      'New': 'Order Placed',
      'Order Placed': 'Order Placed',
      'Processing': 'Processing',
      'Out For Delivery': 'Out for Delivery',
      'Out for Delivery': 'Out for Delivery',
      'Delivered': 'Delivered',
      'Cancelled': 'Order Cancelled',
    };

    const statusDescMap = {
      'New': 'Order has been placed.',
      'Order Placed': 'Order has been placed.',
      'Processing': 'Your order is being prepared for delivery.',
      'Out For Delivery': 'Your order is out for delivery.',
      'Out for Delivery': 'Your order is out for delivery.',
      'Delivered': 'Order delivered successfully.',
      'Cancelled': 'Order was cancelled.',
    };

    const title = statusTitleMap[status] || status;
    const defaultDesc = statusDescMap[status] || `Order status updated to ${status}`;

    order.statusHistory.push({
      status,
      title,
      description: description || defaultDesc,
      timestamp: new Date(),
    });

    await order.save();

    let targetCustomerId = order.customer?.customerId || order.customerId;
    if (!targetCustomerId && order.customer?.phone) {
      const custDoc = await Customer.findOne({ phone: order.customer.phone.trim() });
      if (custDoc) targetCustomerId = custDoc._id;
    }

    if (targetCustomerId) {
      try {
        await createCustomerNotificationHelper({
          customerId: targetCustomerId,
          title: title || 'Order Status Update',
          message: description || defaultDesc,
          type: 'Order',
          actionUrl: `/orders/${order._id}`,
        });
      } catch (err) {
        console.error('Error creating customer notification in admin status update:', err);
      }
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

/**
 * 6. Assign Store to Online Order (for Global / unassigned orders)
 * PATCH /api/admin/online-orders/:id/assign-store
 */
export const assignAdminOrderStore = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { storeId } = req.body;

    if (!storeId) {
      return next(badRequest('Store ID is required'));
    }

    const targetStore = await Store.findById(storeId);
    if (!targetStore) {
      return next(notFound('Target store not found'));
    }

    const order = await StoreOrder.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { store: targetStore._id } },
      { new: true }
    ).populate('store', 'name storeCode location');

    if (!order) {
      return next(notFound('Order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: `Order successfully assigned to store: ${targetStore.name}`,
        data: order,
      })
    );
  } catch (error) {
    next(error);
  }
};
