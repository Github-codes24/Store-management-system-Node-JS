import StoreOrder from '../../models/storeOrder.model.js';
import Customer from '../../models/customer.model.js';
import Cart from '../../models/cart.model.js';
import { buildCartPayload } from './customer.cart.controller.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Place Order from Customer Cart (Checkout)
 * POST /api/customer/orders/place-order
 */
export const placeOrder = async (req, res, next) => {
  try {
    const { paymentMethod = 'COD', deliveryAddressId = null } = req.body;
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

    // Select delivery address if custom address ID provided
    let deliverToAddress = cartPayload.deliverTo;
    if (deliveryAddressId && Array.isArray(customer.addresses)) {
      const matchedAddr = customer.addresses.id(deliveryAddressId);
      if (matchedAddr) {
        deliverToAddress = {
          addressId: matchedAddr._id,
          name: customer.name || 'Customer',
          formattedAddress: matchedAddr.formattedAddress || `${matchedAddr.flatNoStreetArea}, ${matchedAddr.city}`,
          phone: customer.phone || '',
          addressType: matchedAddr.addressType || 'Home',
        };
      }
    }

    // Generate Order ID & Bill ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ORD-${Date.now()}-${randomSuffix}`;
    const billId = `BILL-${Date.now()}-${randomSuffix}`;

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
      customer: {
        name: deliverToAddress.name || customer.name || 'Customer',
        phone: deliverToAddress.phone || customer.phone || '',
        email: customer.email || '',
        address: deliverToAddress.formattedAddress || customer.address || '',
        customerId: customer._id,
      },
      bills: [billObj],
      totalOrderGross: cartPayload.summary.totalMrp,
      totalOrderNet: cartPayload.summary.totalAmount,
      totalOrderPaid: isPaidNow ? cartPayload.summary.totalAmount : 0,
      orderStatus: 'New',
    });

    await newOrder.save();

    // Clear Customer Cart
    const cart = await Cart.findOne({ customer: customerId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    // Update Customer Statistics
    customer.totalOrders = (customer.totalOrders || 0) + 1;
    customer.totalPurchase = (customer.totalPurchase || 0) + cartPayload.summary.totalAmount;
    await customer.save();

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

    const orders = rawOrders.map((ord) => {
      const primaryBill = ord.bills?.[0] || {};
      return {
        _id: ord._id,
        orderId: ord.orderId,
        orderStatus: ord.orderStatus,
        paymentStatus: primaryBill.paymentStatus || 'Paid',
        paymentMethod: primaryBill.paymentMethod || 'Cash',
        totalItems: primaryBill.totalItems || primaryBill.items?.length || 0,
        totalAmount: ord.totalOrderNet || primaryBill.netAmount || 0,
        savings: primaryBill.savings || primaryBill.discountAmount || 0,
        customerName: ord.customer?.name,
        deliveryAddress: ord.customer?.address,
        createdAt: ord.createdAt,
        items: (primaryBill.items || []).map((item) => ({
          productId: item.product,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.sellingPrice,
          totalAmount: item.totalAmount,
        })),
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

    const orderDetails = {
      _id: ord._id,
      orderId: ord.orderId,
      orderStatus: ord.orderStatus,
      paymentStatus: primaryBill.paymentStatus || 'Paid',
      paymentMethod: primaryBill.paymentMethod || 'Cash',
      deliverTo: {
        name: ord.customer?.name,
        phone: ord.customer?.phone,
        formattedAddress: ord.customer?.address,
      },
      summary: {
        totalItemsCount: primaryBill.items?.length || 0,
        totalMrp: primaryBill.subtotal || ord.totalOrderGross,
        totalDiscount: primaryBill.savings || primaryBill.discountAmount || 0,
        totalAmount: ord.totalOrderNet || primaryBill.netAmount,
      },
      items: (primaryBill.items || []).map((item) => ({
        productId: item.product,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        mrp: item.mrp,
        onlineSellingPrice: item.sellingPrice,
        totalAmount: item.totalAmount,
      })),
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
