import StoreOrder from '../../models/storeOrder.model.js';
import Customer from '../../models/customer.model.js';
import Cart from '../../models/cart.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import { buildCartPayload } from './customer.cart.controller.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';
import { createCustomerNotificationHelper } from './customerNotification.controller.js';
import razorpayInstance from '../../config/razorpay.js';

/**
 * Format helper for Order Cards UI
 */
const formatDateLabel = (orderStatus, date) => {
  if (!date) return '';
  const dt = new Date(date);
  const formattedDate = dt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const statusLower = (orderStatus || '').toLowerCase();
  if (statusLower === 'delivered') return `Delivered On: ${formattedDate}`;
  if (statusLower === 'cancelled') return `Cancelled On: ${formattedDate}`;
  return `Ordered On: ${formattedDate}`;
};

const formatSummaryTitle = (items = []) => {
  if (!items || items.length === 0) return 'Order';
  const firstItemName = items[0].productName || 'Product';
  const extraCount = items.length - 1;
  return extraCount > 0 ? `${firstItemName} + ${extraCount} more items` : firstItemName;
};

const fetchProductImagesMap = async (productIds = []) => {
  const imageMap = new Map();
  if (!productIds || productIds.length === 0) return imageMap;

  const validIds = productIds.filter(Boolean);
  if (validIds.length === 0) return imageMap;

  const [storeProds, adminProds] = await Promise.all([
    StoreProduct.find({ _id: { $in: validIds } }).select('_id productImage productId').lean(),
    AdminProduct.find({ _id: { $in: validIds } }).select('_id productImage').lean(),
  ]);

  for (const sp of storeProds) {
    if (sp.productImage) {
      imageMap.set(String(sp._id), sp.productImage);
    }
  }

  for (const ap of adminProds) {
    if (ap.productImage && !imageMap.has(String(ap._id))) {
      imageMap.set(String(ap._id), ap.productImage);
    }
  }

  return imageMap;
};

/**
 * Place Order from Customer Cart (Checkout)
 * POST /api/customer/orders/place-order
 */
export const placeOrder = async (req, res, next) => {
  try {
    const {
      paymentMethod = 'COD',
      deliveryAddressId = null,
      customerName,
      name,
      customerEmail,
      email,
      deliveryAddress,
      address,
    } = req.body;
    const customerId = req.customer._id;

    // Fetch active cart payload
    const cartPayload = await buildCartPayload(customerId);

    if (!cartPayload.items || cartPayload.items.length === 0) {
      return next(badRequest('Your cart is empty. Please add items to cart before placing an order.'));
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return next(notFound('Customer account not found.'));
    }

    // Save profile details if provided during checkout
    let profileUpdated = false;
    const reqName = (customerName || name || '').trim();
    if (reqName) {
      customer.name = reqName;
      profileUpdated = true;
    }

    const reqEmail = (customerEmail || email || '').trim().toLowerCase();
    if (reqEmail) {
      customer.email = reqEmail;
      profileUpdated = true;
    }

    // Select delivery address
    let deliverToAddress = cartPayload.deliverTo;
    if (deliveryAddressId && Array.isArray(customer.addresses)) {
      const matchedAddr = customer.addresses.id(deliveryAddressId);
      if (matchedAddr) {
        deliverToAddress = {
          addressId: matchedAddr._id,
          name: (matchedAddr.name || '').trim(),
          formattedAddress: (matchedAddr.formattedAddress || customer.address || '').trim(),
          phone: (matchedAddr.phone || customer.phone || '').trim(),
          addressType: matchedAddr.addressType || 'Home',
        };
      }
    } else if (deliveryAddress || address) {
      const customAddrObj = deliveryAddress || address;
      const addrStr = typeof customAddrObj === 'string' ? customAddrObj.trim() : (customAddrObj?.formattedAddress || customAddrObj?.address || '').trim();
      const customName = typeof customAddrObj === 'object' && customAddrObj.name ? customAddrObj.name.trim() : '';
      const customPhone = typeof customAddrObj === 'object' && customAddrObj.phone ? customAddrObj.phone.trim() : '';
      if (addrStr) {
        deliverToAddress = {
          addressId: null,
          name: customName,
          formattedAddress: addrStr,
          phone: customPhone || customer.phone || '',
          addressType: typeof customAddrObj === 'object' && customAddrObj.addressType ? customAddrObj.addressType : 'Home',
        };
        if (!customer.address) {
          customer.address = addrStr;
          profileUpdated = true;
        }
      }
    }

    // Auto-update profile name/phone if profile currently has generic "Customer"
    const potentialName = (deliverToAddress?.name || reqName || '').trim();
    if (potentialName && potentialName.toLowerCase() !== 'customer') {
      if (!customer.name || customer.name.toLowerCase() === 'customer') {
        customer.name = potentialName;
        profileUpdated = true;
      }
    }

    if (profileUpdated) {
      await customer.save();
    }

    // Validate Customer Profile Details (Name, Email, Delivery Address)
    const finalName = (customer.name || deliverToAddress?.name || '').trim();
    if (!finalName || finalName.toLowerCase() === 'customer') {
      return next(badRequest('Please enter your full name before placing an order.'));
    }

    const finalEmail = (customer.email || '').trim();
    if (!finalEmail) {
      return next(badRequest('Please enter your email address before placing an order.'));
    }

    const finalFormattedAddress = (deliverToAddress?.formattedAddress || customer.address || '').trim();
    if (!finalFormattedAddress) {
      return next(badRequest('Please select or enter a valid delivery address before placing an order.'));
    }

    const orderId = `ORD-${Date.now()}`;
    const billId = `BILL-${Date.now()}`;

    const billItems = cartPayload.items.map((item) => ({
      product: item.productId,
      productName: item.productName,
      mrp: item.mrp,
      sellingPrice: item.onlineSellingPrice,
      quantity: item.quantity,
      unit: item.variantSubtitle || 'pc',
      totalAmount: item.itemTotalOnlinePrice,
    }));

    const methodEnumMap = {
      COD: 'Cash',
      UPI: 'UPI',
      CARD: 'Card',
      NET_BANKING: 'Card',
    };
    const mappedPaymentMode = methodEnumMap[paymentMethod.toUpperCase()] || 'Cash';
    const isPaidNow = paymentMethod.toUpperCase() !== 'COD';

    const billObj = {
      billId,
      orderId,
      billNumber: 1,
      saleType: 'Online',
      billDate: new Date(),
      items: billItems,
      totalItems: cartPayload.summary.totalItemsCount,
      grossAmount: cartPayload.summary.totalMrp,
      savings: cartPayload.summary.totalDiscount,
      subtotal: cartPayload.summary.totalMrp,
      discountAmount: cartPayload.summary.totalDiscount,
      netAmount: cartPayload.summary.totalAmount,
      paymentStatus: isPaidNow ? 'Paid' : 'Unpaid',
      paymentMethod: mappedPaymentMode,
      paidAmount: isPaidNow ? cartPayload.summary.totalAmount : 0,
      dueAmount: isPaidNow ? 0 : cartPayload.summary.totalAmount,
      payments: [
        {
          date: new Date().toISOString(),
          mode: mappedPaymentMode,
          amount: isPaidNow ? cartPayload.summary.totalAmount : 0,
          transactionId: isPaidNow ? `TXN-${Date.now()}` : '',
          description: `Customer Checkout via ${paymentMethod}`,
        },
      ],
    };

    const newOrder = new StoreOrder({
      orderId,
      store: customer.storeId || null,
      customer: {
        name: finalName,
        phone: (deliverToAddress?.phone || customer.phone || '').trim(),
        email: customer.email || '',
        address: finalFormattedAddress,
        customerId: customer._id,
      },
      bills: [billObj],
      totalOrderGross: cartPayload.summary.totalMrp,
      totalOrderNet: cartPayload.summary.totalAmount,
      totalOrderPaid: isPaidNow ? cartPayload.summary.totalAmount : 0,
      orderStatus: 'Order Placed',
      statusHistory: [
        {
          status: 'Order Placed',
          title: 'Order Placed',
          description: 'Order has been placed.',
          timestamp: new Date(),
        },
      ],
    });

    await newOrder.save();

    // Clear Customer Cart ONLY for COD orders (for online payments, cart is cleared upon successful verification)
    if (paymentMethod.toUpperCase() === 'COD') {
      const cart = await Cart.findOne({ customer: customerId });
      if (cart) {
        cart.items = [];
        await cart.save();
      }
    }

    // Update Customer Statistics
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    customer.totalPurchase = (customer.totalPurchase || 0) + cartPayload.summary.totalAmount;
    await customer.save();

    // Trigger customer notification
    const orderSummaryName = formatSummaryTitle(billItems);
    try {
      await createCustomerNotificationHelper({
        customerId: customer._id,
        title: 'Order Placed',
        message: `Your order for "${orderSummaryName}" has been placed successfully.`,
        type: 'Order',
        actionUrl: `/orders/${newOrder._id}`,
      });
    } catch (err) {
      console.error('Error creating order notification:', err);
    }

    return res.status(200).json(
      successResponse({
        message: 'Payment Successful! Your order has been successfully placed.',
        data: {
          orderId: newOrder._id,
          orderNumber: newOrder.orderId,
          orderStatus: newOrder.orderStatus,
          paymentStatus: billObj.paymentStatus,
          paymentMethod,
          totalAmount: cartPayload.summary.totalAmount,
          savings: cartPayload.summary.totalDiscount,
          deliverTo: deliverToAddress,
          items: cartPayload.items,
          createdAt: newOrder.createdAt,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Orders (Paginated History & Tracking)
 * GET /api/customer/orders/my-orders
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {
      $or: [
        { 'customer.customerId': req.customer._id },
        { 'customer.phone': req.customer.phone },
      ],
    };

    if (status) {
      filter.orderStatus = status;
    }

    const total = await StoreOrder.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const rawOrders = await StoreOrder.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();

    const allProductIds = [];
    rawOrders.forEach((ord) => {
      const items = ord.bills?.[0]?.items || [];
      items.forEach((item) => {
        if (item.product) allProductIds.push(item.product);
      });
    });

    const imageMap = await fetchProductImagesMap(allProductIds);

    const orders = rawOrders.map((ord) => {
      const primaryBill = ord.bills?.[0] || {};
      const rawItems = primaryBill.items || [];

      const items = rawItems.map((item) => {
        const pIdStr = item.product ? String(item.product) : '';
        const img = imageMap.get(pIdStr) || item.image || null;
        return {
          productId: item.product,
          productName: item.productName,
          productImage: img,
          quantity: item.quantity,
          unit: item.unit,
          price: item.sellingPrice,
          totalAmount: item.totalAmount,
        };
      });

      const firstImage = items.find((i) => i.productImage)?.productImage || null;

      return {
        _id: ord._id,
        orderId: ord.orderId,
        orderStatus: ord.orderStatus || 'Order Placed',
        dateLabel: formatDateLabel(ord.orderStatus, ord.createdAt),
        summaryTitle: formatSummaryTitle(items),
        productImage: firstImage,
        paymentStatus: primaryBill.paymentStatus || 'Paid',
        paymentMethod: primaryBill.paymentMethod || 'Cash',
        totalItems: primaryBill.totalItems || items.length || 0,
        totalAmount: ord.totalOrderNet || primaryBill.netAmount || 0,
        savings: primaryBill.savings || primaryBill.discountAmount || 0,
        customerName: ord.customer?.name || 'Customer',
        customerPhone: ord.customer?.phone || '',
        deliveryAddress: ord.customer?.address || '',
        deliverTo: {
          name: ord.customer?.name || 'Customer',
          phone: ord.customer?.phone || '',
          formattedAddress: ord.customer?.address || '',
          addressType: 'Home',
        },
        createdAt: ord.createdAt,
        items,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Customer orders retrieved successfully',
        data: { orders },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to build Order Updates timeline for Customer Order Details
 */
const buildOrderUpdatesTimeline = (statusHistory = [], currentStatus = 'Order Placed', createdAt = new Date()) => {
  const historyMap = new Map();
  if (Array.isArray(statusHistory)) {
    statusHistory.forEach((item) => {
      const key = (item.status || '').toLowerCase().trim();
      historyMap.set(key, item);
    });
  }

  const stages = [
    {
      key: 'order placed',
      status: 'Order Placed',
      title: 'Order Placed',
      description: 'Order has been placed.',
      fallbackDate: createdAt,
    },
    {
      key: 'processing',
      status: 'Processing',
      title: 'Processing',
      description: 'Your order is being prepared for delivery.',
      fallbackDate: null,
    },
    {
      key: 'out for delivery',
      status: 'Out for Delivery',
      title: 'Out for Delivery',
      description: 'Your order is out for delivery.',
      fallbackDate: null,
    },
    {
      key: 'delivered',
      status: 'Delivered',
      title: 'Delivered',
      description: 'Order delivered successfully.',
      fallbackDate: null,
    },
  ];

  const currentLower = (currentStatus || '').toLowerCase().trim();
  if (currentLower === 'cancelled') {
    const cancelItem = historyMap.get('cancelled');
    stages.push({
      key: 'cancelled',
      status: 'Cancelled',
      title: 'Order Cancelled',
      description: cancelItem?.description || 'Order was cancelled.',
      fallbackDate: cancelItem?.timestamp || new Date(),
    });
  }

  const progression = ['new', 'order placed', 'processing', 'out for delivery', 'delivered'];
  let currentIdx = progression.indexOf(currentLower);
  if (currentLower === 'active') currentIdx = 1;

  return stages.map((stage, idx) => {
    const histItem = historyMap.get(stage.key);
    let isCompleted = false;

    if (currentLower === 'cancelled') {
      isCompleted = !!histItem || stage.key === 'order placed';
    } else if (currentIdx >= 0) {
      isCompleted = idx <= currentIdx || !!histItem;
    } else {
      isCompleted = !!histItem || idx === 0;
    }

    const timestamp = histItem?.timestamp || (isCompleted ? stage.fallbackDate : null);
    let formattedTime = '';
    if (timestamp) {
      const dt = new Date(timestamp);
      formattedTime =
        dt.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }) +
        ' - ' +
        dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    }

    return {
      status: stage.status,
      title: histItem?.title || stage.title,
      description: histItem?.description || stage.description,
      isCompleted,
      timestamp,
      formattedTime,
    };
  });
};

/**
 * Get Customer Order Details by ID
 * GET /api/customer/orders/:orderId
 */
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const ord = await StoreOrder.findOne({
      _id: orderId,
      $or: [
        { 'customer.customerId': req.customer._id },
        { 'customer.phone': req.customer.phone },
      ],
    }).lean();

    if (!ord) {
      return next(notFound('Order not found'));
    }

    const primaryBill = ord.bills?.[0] || {};
    const rawItems = primaryBill.items || [];
    const productIds = rawItems.map((item) => item.product).filter(Boolean);
    const imageMap = await fetchProductImagesMap(productIds);

    const items = rawItems.map((item) => {
      const pIdStr = item.product ? String(item.product) : '';
      const img = imageMap.get(pIdStr) || item.image || null;
      const mrp = Number(item.mrp || item.sellingPrice || 0);
      const onlinePrice = Number(item.sellingPrice || 0);
      const discountPercentage = mrp > onlinePrice ? Math.round(((mrp - onlinePrice) / mrp) * 100) : 0;

      return {
        productId: item.product,
        productName: item.productName,
        productImage: img,
        quantity: item.quantity,
        unit: item.unit,
        mrp,
        onlineSellingPrice: onlinePrice,
        discountPercentage,
        discountBadge: discountPercentage > 0 ? `↓ ${discountPercentage}%` : '',
        totalAmount: item.totalAmount,
      };
    });

    const firstImage = items.find((i) => i.productImage)?.productImage || null;
    const currentStatus = ord.orderStatus || 'Order Placed';
    const isCancelable = ['new', 'order placed', 'processing', 'active'].includes(currentStatus.toLowerCase());

    const orderUpdates = buildOrderUpdatesTimeline(ord.statusHistory || [], currentStatus, ord.createdAt);

    const orderDetails = {
      _id: ord._id,
      orderId: ord.orderId,
      orderStatus: currentStatus,
      dateLabel: formatDateLabel(currentStatus, ord.createdAt),
      summaryTitle: formatSummaryTitle(items),
      productImage: firstImage,
      paymentStatus: primaryBill.paymentStatus || 'Paid',
      paymentMethod: primaryBill.paymentMethod || 'Cash',
      isCancelable,
      cancelReason: ord.cancelReason || '',
      deliverTo: {
        name: ord.customer?.name || 'Customer',
        phone: ord.customer?.phone || '',
        formattedAddress: ord.customer?.address || '',
        addressType: 'Home',
      },
      deliveryAddress: {
        name: ord.customer?.name || 'Customer',
        phone: ord.customer?.phone || '',
        formattedAddress: ord.customer?.address || '',
        addressType: 'Home',
      },
      summary: {
        totalItemsCount: items.length,
        totalMrp: primaryBill.subtotal || ord.totalOrderGross,
        totalDiscount: primaryBill.savings || primaryBill.discountAmount || 0,
        totalAmount: ord.totalOrderNet || primaryBill.netAmount,
      },
      orderUpdates,
      items,
      payments: primaryBill.payments || ord.payments || [],
      createdAt: ord.createdAt,
    };

    return res.status(200).json(
      successResponse({
        message: 'Order details retrieved successfully',
        data: { order: orderDetails },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Customer Order
 * POST /api/customer/orders/:orderId/cancel
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;

    if (!cancelReason || !cancelReason.trim()) {
      return next(badRequest('Please enter a cancellation reason.'));
    }

    const ord = await StoreOrder.findOne({
      _id: orderId,
      $or: [
        { 'customer.customerId': req.customer._id },
        { 'customer.phone': req.customer.phone },
      ],
    });

    if (!ord) {
      return next(notFound('Order not found'));
    }

    const currentStatus = ord.orderStatus || 'Order Placed';
    const nonCancelableStatuses = ['out for delivery', 'delivered', 'cancelled', 'completed', 'partially returned', 'fully returned'];

    if (nonCancelableStatuses.includes(currentStatus.toLowerCase())) {
      return next(badRequest(`Order cannot be cancelled as it is already ${currentStatus}.`));
    }

    ord.orderStatus = 'Cancelled';
    ord.cancelReason = cancelReason.trim();

    if (!Array.isArray(ord.statusHistory)) {
      ord.statusHistory = [];
    }

    ord.statusHistory.push({
      status: 'Cancelled',
      title: 'Order Cancelled',
      description: `Order cancelled by customer: ${cancelReason.trim()}`,
      timestamp: new Date(),
    });

    // Auto-initiate Razorpay Refund if order was paid online
    let refundInfo = null;
    const bill = ord.bills?.[0];
    const isPaidOnline = bill && bill.paymentStatus === 'Paid' && (bill.paidAmount > 0 || ord.totalOrderPaid > 0);
    const paymentTxn = (bill?.payments || []).find((p) => p.transactionId && p.transactionId.startsWith('pay_'));
    const rzpPaymentId = paymentTxn?.transactionId || (typeof bill?.transactionId === 'string' && bill.transactionId.startsWith('pay_') ? bill.transactionId : null);

    if (isPaidOnline && rzpPaymentId && razorpayInstance) {
      try {
        const refundAmt = bill?.paidAmount || ord.totalOrderPaid || ord.totalOrderNet;
        const refund = await razorpayInstance.payments.refund(rzpPaymentId, {
          amount: Math.round(refundAmt * 100),
          notes: {
            reason: cancelReason.trim(),
            orderId: ord.orderId,
            customerId: String(req.customer._id),
          },
        });
        if (bill) {
          bill.paymentStatus = 'Refunded';
          bill.dueAmount = 0;
        }
        ord.totalOrderRefunded = refundAmt;
        refundInfo = {
          refundId: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
          message: 'Refund initiated successfully to your original payment account.',
        };
      } catch (rzpRefundErr) {
        console.warn('[Razorpay Auto Refund Warning]:', rzpRefundErr.message || rzpRefundErr);
        refundInfo = {
          status: 'pending_processing',
          message: 'Order cancelled. Refund will be processed to your account within 2-3 business days.',
        };
      }
    }

    await ord.save();

    // Trigger customer notification
    const cancelSummaryName = formatSummaryTitle(ord.bills?.[0]?.items || []);
    try {
      await createCustomerNotificationHelper({
        customerId: req.customer._id,
        title: 'Order Cancelled',
        message: `Your order for "${cancelSummaryName}" has been cancelled.`,
        type: 'Order',
        actionUrl: `/orders/${ord._id}`,
      });
    } catch (err) {
      console.error('Error creating order cancel notification:', err);
    }

    return res.status(200).json(
      successResponse({
        message: isPaidOnline
          ? 'Your order has been cancelled and refund has been initiated to your original payment method.'
          : 'Your order has been cancelled successfully.',
        data: {
          orderId: ord._id,
          orderNumber: ord.orderId,
          orderStatus: ord.orderStatus,
          cancelReason: ord.cancelReason,
          refundInfo,
          updatedAt: ord.updatedAt,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Request Return for Delivered Order (Customer Mobile App)
 * POST /api/customer/orders/:orderId/return
 * Body: { items: [{ product, quantity, reason }], returnReason }
 */
export const requestOrderReturn = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { items = [], returnReason } = req.body;

    if (!returnReason || !returnReason.trim()) {
      return next(badRequest('Please enter a reason for returning the item(s).'));
    }

    const ord = await StoreOrder.findOne({
      _id: orderId,
      $or: [
        { 'customer.customerId': req.customer._id },
        { 'customer.phone': req.customer.phone },
      ],
    });

    if (!ord) {
      return next(notFound('Order not found'));
    }

    const statusLower = (ord.orderStatus || '').toLowerCase();
    if (statusLower !== 'delivered' && statusLower !== 'completed') {
      return next(badRequest('Return can only be requested for orders that have been delivered.'));
    }

    // Record return request on order
    const returnNumber = (ord.returns?.length || 0) + 1;
    const returnId = `RET-${ord.orderId}-${returnNumber}`;

    const newReturn = {
      returnId,
      items: Array.isArray(items) ? items : [],
      returnReason: returnReason.trim(),
      status: 'Requested',
      requestedAt: new Date(),
    };

    if (!Array.isArray(ord.returns)) {
      ord.returns = [];
    }

    ord.returns.push(newReturn);
    ord.orderStatus = 'Return Requested';

    if (!Array.isArray(ord.statusHistory)) {
      ord.statusHistory = [];
    }

    ord.statusHistory.push({
      status: 'Return Requested',
      title: 'Return Requested',
      description: `Customer requested return: ${returnReason.trim()}`,
      timestamp: new Date(),
    });

    await ord.save();

    return res.status(200).json(
      successResponse({
        message: 'Return request submitted successfully. Our store team will process it shortly.',
        data: {
          returnId,
          orderId: ord._id,
          orderNumber: ord.orderId,
          orderStatus: ord.orderStatus,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
