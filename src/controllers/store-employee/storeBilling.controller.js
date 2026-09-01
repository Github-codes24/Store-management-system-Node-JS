import StoreOrder from '../../models/storeOrder.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';

/**
 * Auto-generate a clean sequential Order ID in the backend (e.g. SODR00001 for Offline, OODR00001 for Online)
 */
const generateOrderId = async (saleType = 'Offline') => {
  const isOnline = (saleType || '').toLowerCase() === 'online';
  const prefix = isOnline ? 'OODR' : 'SODR';
  const count = await StoreOrder.countDocuments({
    $or: [
      { orderId: new RegExp(`^${prefix}`, 'i') },
      { 'bills.saleType': new RegExp(`^${isOnline ? 'Online' : 'Offline'}$`, 'i') }
    ]
  });
  const nextNum = String(count + 1).padStart(5, '0');
  return `${prefix}${nextNum}`;
};

/**
 * Generate a clean Bill/Invoice ID
 */
const generateBillId = (orderId, billNumber) => {
  return `INV-${orderId}-${billNumber}`;
};

/**
 * Generate a clean Return ID
 */
const generateReturnId = (orderId, returnNumber) => {
  return `RET-${orderId}-${returnNumber}`;
};

/**
 * Create a new Order with Bill 1 OR Append a subsequent Bill to an existing Order
 * POST /api/store-employee/billing/bills
 */
export const createOrAppendOrderBill = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.store || null;
    const employeeId = req.storeEmployee?._id || null;

    const {
      orderId, // If appending to existing order
      customer, // { name, phone, email, address, customerId }
      saleType = 'Offline', // 'Offline' or 'Online'
      items = [],
      grossAmount = 0,
      savings = 0,
      subtotal = 0,
      gstTotal = 0,
      discountType = '₹',
      discountValue = 0,
      discountAmount = 0,
      netAmount = 0,
      paymentStatus = 'Paid',
      paymentMethod = 'Cash',
      paidAmount = 0,
      dueAmount = 0,
      payments = [],
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return next(badRequest('Bill must contain at least one item'));
    }

    if (!customer?.name && !orderId) {
      return next(badRequest('Customer name is required for a new order'));
    }

    let order = null;
    let existingBillIndex = -1;

    if (orderId) {
      // Find existing order (by session orderId, bill orderId, billId, or Mongo _id)
      const isObjectId = typeof orderId === 'string' && orderId.match(/^[0-9a-fA-F]{24}$/);
      order = await StoreOrder.findOne({
        $or: [
          { orderId },
          { 'bills.orderId': orderId },
          { 'bills.billId': orderId },
          ...(isObjectId ? [{ _id: orderId }] : [])
        ],
      });

      if (!order) {
        return next(notFound(`Order with ID ${orderId} not found`));
      }

      // Check if we are updating an existing bill within this order
      const targetBillId = req.body.billId || orderId;
      existingBillIndex = order.bills.findIndex(
        (b) => b.billId === targetBillId || b.orderId === targetBillId || b.orderId === orderId || b.billId === orderId
      );

      // If user is editing this order session and not explicitly adding a new sub-bill, update bill 0
      if (existingBillIndex < 0 && order.bills.length > 0 && !req.body.isNewSubBill) {
        existingBillIndex = 0;
      }

      // If updating an existing bill, first restore the previous stock of that bill
      if (existingBillIndex >= 0 && order.bills[existingBillIndex]) {
        const oldBill = order.bills[existingBillIndex];
        for (const oldItem of (oldBill.items || [])) {
          const oldQty = (oldItem.quantity || 0) - (oldItem.returnedQuantity || 0);
          if (oldQty <= 0) continue;

          let storeProd = null;
          if (oldItem.product) storeProd = await StoreProduct.findById(oldItem.product);
          if (!storeProd && oldItem.barcode) storeProd = await StoreProduct.findOne({ barcode: oldItem.barcode });
          if (!storeProd && oldItem.productName) storeProd = await StoreProduct.findOne({ productName: oldItem.productName });

          if (storeProd) {
            const itemBatch = (oldItem.batch || storeProd.batch || 'Default').trim();
            if (Array.isArray(storeProd.batches) && storeProd.batches.length > 0) {
              let bIdx = storeProd.batches.findIndex(
                (b) => (b.batchNumber || '').trim().toLowerCase() === itemBatch.toLowerCase()
              );
              if (bIdx < 0) bIdx = 0;
              storeProd.batches[bIdx].stockQuantity = (Number(storeProd.batches[bIdx].stockQuantity) || 0) + oldQty;
              storeProd.stockQuantity = storeProd.batches.reduce((s, b) => s + (Number(b.stockQuantity) || 0), 0);
            } else {
              storeProd.stockQuantity = (Number(storeProd.stockQuantity) || 0) + oldQty;
            }
            await storeProd.save();
          }
        }
      }
    }

    // Verify products and deduct stock from selected batch
    const processedItems = [];
    for (const item of items) {
      let storeProd = null;
      if (item.product) {
        storeProd = await StoreProduct.findById(item.product);
      }
      if (!storeProd && item.barcode) {
        storeProd = await StoreProduct.findOne({ barcode: item.barcode });
      }
      if (!storeProd && item.productName) {
        storeProd = await StoreProduct.findOne({ productName: item.productName });
      }

      if (!storeProd) {
        return next(notFound(`Product "${item.productName || item.product}" not found in store inventory`));
      }

      const itemBatch = (item.batch || storeProd.batch || 'Default').trim();
      const qty = parseInt(item.quantity, 10) || 1;
      const unitPrice = parseFloat(item.sellingPrice) || 0;
      const itemTotal = parseFloat(item.totalAmount) || unitPrice * qty;

      // Decrement stock from specific batch in storeProduct
      if (Array.isArray(storeProd.batches) && storeProd.batches.length > 0) {
        let batchIndex = storeProd.batches.findIndex(
          (b) => (b.batchNumber || '').trim().toLowerCase() === itemBatch.toLowerCase()
        );

        if (batchIndex < 0 && (itemBatch.toLowerCase() === 'default' || !itemBatch)) {
          batchIndex = storeProd.batches.findIndex((b) => (Number(b.stockQuantity) || 0) > 0);
        }

        if (batchIndex < 0) {
          batchIndex = 0;
        }

        if (batchIndex >= 0 && storeProd.batches[batchIndex]) {
          storeProd.batches[batchIndex].stockQuantity = Math.max(
            0,
            (Number(storeProd.batches[batchIndex].stockQuantity) || 0) - qty
          );
        }

        // Recalculate total product stock quantity
        storeProd.stockQuantity = storeProd.batches.reduce(
          (sum, b) => sum + (Number(b.stockQuantity) || 0),
          0
        );
      } else {
        storeProd.stockQuantity = Math.max(0, (Number(storeProd.stockQuantity) || 0) - qty);
      }

      await storeProd.save();

      processedItems.push({
        product: storeProd._id,
        productName: item.productName || storeProd.productName,
        barcode: item.barcode || storeProd.barcode || '',
        batch: itemBatch,
        mrp: parseFloat(item.mrp || storeProd.mrp || 0),
        sellingPrice: unitPrice,
        quantity: qty,
        unit: item.unit || storeProd.unit || 'pc',
        gstPercentage: parseFloat(item.gstPercentage || 0),
        totalAmount: itemTotal,
        returnedQuantity: 0,
      });
    }

    // Customer lookup or link
    let linkedCustomerId = customer?.customerId || null;
    if (!linkedCustomerId && customer?.phone) {
      const existingCustomer = await Customer.findOne({ phone: customer.phone.trim() });
      if (existingCustomer) {
        linkedCustomerId = existingCustomer._id;
      }
    }

    // Process payments array and calculate paid amount accurately
    const todayFormatted = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    let processedPayments = [];

    if (Array.isArray(payments) && payments.length > 0) {
      processedPayments = payments.map((p) => ({
        date: p.date || todayFormatted,
        mode: p.mode || paymentMethod || 'Cash',
        amount: parseFloat(p.amount) || 0,
        transactionId: (p.transactionId || '').trim(),
        description: (p.description || '').trim(),
      }));
    } else if (Array.isArray(payments) && payments.length === 0) {
      // User explicitly cleared all payments (unpaid bill / full credit)
      processedPayments = [];
    } else if (paidAmount !== undefined && paidAmount !== null && !isNaN(Number(paidAmount))) {
      const pAmt = parseFloat(paidAmount);
      if (pAmt > 0) {
        processedPayments = [
          {
            date: todayFormatted,
            mode: paymentMethod || 'Cash',
            amount: pAmt,
            transactionId: '',
            description: '',
          },
        ];
      }
    } else {
      // Default to full payment in Cash only for fresh new bills when no payment array is passed
      const nAmt = parseFloat(netAmount) || 0;
      processedPayments = [
        {
          date: todayFormatted,
          mode: paymentMethod || 'Cash',
          amount: nAmt,
          transactionId: '',
          description: '',
        },
      ];
    }

    const calculatedPaidAmount = processedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const calculatedNetAmount = parseFloat(netAmount) || 0;
    const calculatedDueAmount = Math.max(0, calculatedNetAmount - calculatedPaidAmount);
    const calculatedPaymentStatus = calculatedPaidAmount >= calculatedNetAmount ? 'Paid' : calculatedPaidAmount > 0 ? 'Partial' : 'Unpaid';
    const primaryPaymentMethod = processedPayments[0]?.mode || paymentMethod || 'Cash';

    // If updating an existing bill inside this order
    if (order && existingBillIndex >= 0) {
      if (customer?.name) {
        order.customer = {
          name: customer.name.trim(),
          phone: (customer.phone || '').trim(),
          email: (customer.email || '').trim(),
          address: (customer.address || '').trim(),
          customerId: linkedCustomerId || order.customer?.customerId,
        };
      }

      const existingBill = order.bills[existingBillIndex];
      existingBill.items = processedItems;
      existingBill.totalItems = processedItems.reduce((sum, it) => sum + it.quantity, 0);
      existingBill.grossAmount = parseFloat(grossAmount) || 0;
      existingBill.savings = parseFloat(savings) || 0;
      existingBill.subtotal = parseFloat(subtotal) || 0;
      existingBill.gstTotal = parseFloat(gstTotal) || 0;
      existingBill.discountType = discountType;
      existingBill.discountValue = parseFloat(discountValue) || 0;
      existingBill.discountAmount = parseFloat(discountAmount) || 0;
      existingBill.netAmount = calculatedNetAmount;
      existingBill.paymentStatus = calculatedPaymentStatus;
      existingBill.paymentMethod = primaryPaymentMethod;
      existingBill.paidAmount = calculatedPaidAmount;
      existingBill.dueAmount = calculatedDueAmount;
      existingBill.payments = processedPayments;
      if (saleType) existingBill.saleType = saleType;

      order.totalOrderGross = order.bills.reduce((sum, b) => sum + (b.grossAmount || 0), 0);
      order.totalOrderNet = order.bills.reduce((sum, b) => sum + (b.netAmount || 0), 0);
      order.totalOrderPaid = order.bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      order.payments = order.bills.flatMap((b) => b.payments || []);
      order.markModified('bills');
      order.markModified('customer');
      order.markModified('payments');
      await order.save();

      return res.status(200).json(
        successResponse({
          message: 'Bill updated successfully',
          data: {
            order,
            bill: existingBill,
            orderId: existingBill.orderId || order.orderId,
            sessionOrderId: order.orderId,
            billId: existingBill.billId,
          },
        })
      );
    }

    // Generate unique Order ID for this specific bill (e.g. SODR00001 for Offline, OODR00001 for Online)
    const thisBillOrderId = await generateOrderId(saleType);
    const billNumber = order ? (order.bills.length + 1) : 1;
    const sessionOrderId = order ? order.orderId : thisBillOrderId;
    const billId = `INV-${thisBillOrderId}-${billNumber}`;

    const newBill = {
      orderId: thisBillOrderId,
      billId,
      billNumber,
      saleType,
      billDate: new Date(),
      items: processedItems,
      totalItems: processedItems.reduce((sum, it) => sum + it.quantity, 0),
      grossAmount: parseFloat(grossAmount) || 0,
      savings: parseFloat(savings) || 0,
      subtotal: parseFloat(subtotal) || 0,
      gstTotal: parseFloat(gstTotal) || 0,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      discountAmount: parseFloat(discountAmount) || 0,
      netAmount: calculatedNetAmount,
      paymentStatus: calculatedPaymentStatus,
      paymentMethod: primaryPaymentMethod,
      paidAmount: calculatedPaidAmount,
      dueAmount: calculatedDueAmount,
      payments: processedPayments,
    };

    const isOnline = (saleType || '').toLowerCase() === 'online';

    if (order) {
      // Append bill to existing order purchase session
      order.bills.push(newBill);
      order.totalOrderGross = order.bills.reduce((sum, b) => sum + (b.grossAmount || 0), 0);
      order.totalOrderNet = order.bills.reduce((sum, b) => sum + (b.netAmount || 0), 0);
      order.totalOrderPaid = order.bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      order.payments = order.bills.flatMap((b) => b.payments || []);
      order.markModified('bills');
      order.markModified('payments');
      await order.save();
    } else {
      // Create new purchase order session
      order = await StoreOrder.create({
        orderId: sessionOrderId,
        store: storeId,
        employee: employeeId,
        customer: {
          name: customer.name.trim(),
          phone: (customer.phone || '').trim(),
          email: (customer.email || '').trim(),
          address: (customer.address || '').trim(),
          customerId: linkedCustomerId,
        },
        bills: [newBill],
        returns: [],
        payments: processedPayments,
        totalOrderGross: newBill.grossAmount,
        totalOrderNet: newBill.netAmount,
        totalOrderPaid: calculatedPaidAmount,
        totalOrderRefunded: 0,
        orderStatus: isOnline ? 'New' : 'Completed',
      });
    }

    return res.status(201).json(
      successResponse({
        message: 'Bill created successfully',
        data: {
          order,
          bill: newBill,
          orderId: thisBillOrderId,
          sessionOrderId: order.orderId,
          billId: newBill.billId,
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * List Store Orders with filtering and pagination
 * GET /api/store-employee/billing/orders
 */
export const getStoreOrders = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.store || null;
    const { 
      search = '', 
      status = '', 
      saleType = '', 
      startDate = '', 
      endDate = '', 
      page = 1, 
      limit = 20 
    } = req.query;

    const query = {};
    if (storeId) query.store = storeId;

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { orderId: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.phone': searchRegex },
        { 'bills.billId': searchRegex },
        { 'bills.items.productName': searchRegex },
      ];
    }

    if (status.trim() && status !== 'all') {
      query.orderStatus = new RegExp(`^${status.trim()}$`, 'i');
    }

    if (saleType.trim()) {
      query['bills.saleType'] = new RegExp(`^${saleType.trim()}$`, 'i');
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }
      if (Object.keys(query.createdAt).length === 0) {
        delete query.createdAt;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      StoreOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      StoreOrder.countDocuments(query),
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Orders fetched successfully',
        data: { orders },
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Get Order details by ID or orderId
 * GET /api/store-employee/billing/orders/:id
 */
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await StoreOrder.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { orderId: id }],
    }).populate('bills.items.product returns.items.product');

    if (!order) {
      return next(notFound('Order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Order details fetched successfully',
        data: { order },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Update Order status (e.g. New -> Processing -> Out For Delivery -> Delivered)
 * PATCH /api/store-employee/billing/orders/:id/status
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return next(badRequest('Status is required'));
    }

    const order = await StoreOrder.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { orderId: id }],
    });

    if (!order) {
      return next(notFound('Order not found'));
    }

    order.orderStatus = status;
    await order.save();

    return res.status(200).json(
      successResponse({
        message: `Order status updated to ${status}`,
        data: { order },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Delete / Cancel Store Order
 * DELETE /api/store-employee/billing/orders/:id
 */
export const deleteStoreOrder = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await StoreOrder.findOneAndDelete({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { orderId: id }],
    });

    if (!order) {
      return next(notFound('Order not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Order deleted successfully',
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Lookup bill for returns by Order ID, Bill No, or Customer Phone
 * GET /api/store-employee/billing/lookup-bill/:identifier
 */
export const lookupBillForReturn = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const term = (identifier || '').trim();

    if (!term) {
      return next(badRequest('Please provide an Order ID, Bill Number, or Customer Phone'));
    }

    const searchRegex = new RegExp(term, 'i');
    const orders = await StoreOrder.find({
      $or: [
        { orderId: searchRegex },
        { 'bills.orderId': searchRegex },
        { 'bills.billId': searchRegex },
        { 'customer.phone': searchRegex },
        { 'customer.name': searchRegex },
      ],
    }).sort({ createdAt: -1 }).limit(10).lean();

    if (!orders || orders.length === 0) {
      return res.status(200).json(
        successResponse({
          message: 'No matching orders found',
          data: { exists: false, orders: [] },
        })
      );
    }

    // Process orders to calculate returnable quantities for each item
    const formattedOrders = orders.map((order) => {
      const processedBills = (order.bills || []).map((bill) => {
        const processedItems = (bill.items || []).map((item) => {
          const availableToReturn = Math.max(0, (item.quantity || 0) - (item.returnedQuantity || 0));
          return {
            ...item,
            availableToReturn,
            isReturnable: availableToReturn > 0,
          };
        });

        const canReturnAny = processedItems.some((it) => it.isReturnable);
        return {
          ...bill,
          items: processedItems,
          canReturnAny,
        };
      });

      return {
        ...order,
        bills: processedBills,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Matching orders found',
        data: {
          exists: true,
          orders: formattedOrders,
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Process returns against an existing bill / order
 * POST /api/store-employee/billing/returns
 */
export const processBillReturn = async (req, res, next) => {
  try {
    const {
      orderId,
      billId,
      items = [], // [{ product, quantity, sellingPrice, refundAmount, reason }]
      refundMethod = 'Cash',
      notes = '',
    } = req.body;

    if (!orderId || !billId) {
      return next(badRequest('Order ID and Bill ID are required to process a return'));
    }

    if (!Array.isArray(items) || items.length === 0) {
      return next(badRequest('At least one return item must be specified'));
    }

    const order = await StoreOrder.findOne({
      $or: [{ orderId }, { 'bills.orderId': orderId }, { 'bills.billId': billId }, { 'bills.orderId': billId }],
    });
    if (!order) {
      return next(notFound(`Order with ID ${orderId} not found`));
    }

    const targetBill = order.bills.find(
      (b) => b.billId === billId || b.orderId === billId || b.orderId === orderId || b.billId === orderId
    );
    if (!targetBill) {
      return next(notFound(`Bill with ID ${billId} not found in Order ${orderId}`));
    }

    const returnNumber = (order.returns?.length || 0) + 1;
    const returnId = generateReturnId(order.orderId, returnNumber);

    const processedReturnItems = [];
    let totalRefund = 0;

    const getItemProdId = (p) => (p && p._id ? p._id.toString() : p ? p.toString() : '');

    for (const returnReq of items) {
      const returnQty = parseInt(returnReq.quantity, 10) || 0;
      if (returnQty <= 0) continue;

      const reqProdId = getItemProdId(returnReq.product);
      const reqItemId = returnReq.itemId ? returnReq.itemId.toString() : '';
      const reqBatch = (returnReq.batch || '').trim().toLowerCase();
      const reqName = (returnReq.productName || '').trim().toLowerCase();

      // Find matching item in target bill
      const billItem = targetBill.items.find((it) => {
        const itProdId = getItemProdId(it.product);
        const itItemId = it._id ? it._id.toString() : '';
        const itBatch = (it.batch || '').trim().toLowerCase();
        const itName = (it.productName || '').trim().toLowerCase();

        if (reqItemId && itItemId === reqItemId) return true;
        if (reqProdId && itProdId === reqProdId && (!reqBatch || itBatch === reqBatch)) return true;
        if (reqProdId && itProdId === reqProdId) return true;
        if (returnReq.barcode && it.barcode && returnReq.barcode === it.barcode) return true;
        if (reqName && itName === reqName && (!reqBatch || itBatch === reqBatch)) return true;
        return false;
      });

      if (!billItem) {
        return next(badRequest(`Item ${returnReq.productName || returnReq.product} is not part of Bill ${billId}`));
      }

      const availableQty = (billItem.quantity || 0) - (billItem.returnedQuantity || 0);
      if (returnQty > availableQty) {
        return next(badRequest(`Cannot return ${returnQty} of ${billItem.productName}. Maximum returnable is ${availableQty}`));
      }

      const unitPrice = parseFloat(billItem.sellingPrice) || 0;
      const refundAmt = parseFloat(returnReq.refundAmount) || (returnQty * unitPrice);

      // 1. Update returned quantity on bill item in invoice
      billItem.returnedQuantity = (billItem.returnedQuantity || 0) + returnQty;

      // 2. Restore stock to specific batch in StoreProduct inventory
      const returnBatch = (billItem.batch || returnReq.batch || '').trim();
      const storeProdId = getItemProdId(billItem.product) || reqProdId;
      let storeProd = null;

      if (storeProdId) {
        storeProd = await StoreProduct.findById(storeProdId);
      }
      if (!storeProd && billItem.barcode) {
        storeProd = await StoreProduct.findOne({ barcode: billItem.barcode });
      }
      if (!storeProd && billItem.productName) {
        storeProd = await StoreProduct.findOne({ productName: billItem.productName });
      }

      if (storeProd) {
        const targetBatchName = returnBatch || storeProd.batch || 'Default';

        if (Array.isArray(storeProd.batches) && storeProd.batches.length > 0) {
          let batchIndex = storeProd.batches.findIndex(
            (b) => b.batchNumber && b.batchNumber.toLowerCase() === targetBatchName.toLowerCase()
          );

          if (batchIndex >= 0) {
            storeProd.batches[batchIndex].stockQuantity =
              (Number(storeProd.batches[batchIndex].stockQuantity) || 0) + returnQty;
          } else {
            storeProd.batches.push({
              batchNumber: targetBatchName,
              stockQuantity: returnQty,
              mrp: billItem.mrp || storeProd.mrp || 0,
              offlineSellingPrice: billItem.sellingPrice || storeProd.offlineSellingPrice || 0,
              onlineSellingPrice: billItem.sellingPrice || storeProd.onlineSellingPrice || 0,
            });
          }

          storeProd.stockQuantity = storeProd.batches.reduce(
            (sum, b) => sum + (Number(b.stockQuantity) || 0),
            0
          );
        } else {
          storeProd.stockQuantity = (Number(storeProd.stockQuantity) || 0) + returnQty;
        }

        await storeProd.save();
      }

      processedReturnItems.push({
        product: billItem.product,
        productName: billItem.productName,
        barcode: billItem.barcode || '',
        batch: returnBatch,
        sellingPrice: unitPrice,
        quantity: returnQty,
        unit: billItem.unit || 'pc',
        refundAmount: refundAmt,
        reason: returnReq.reason || 'Customer Return',
      });

      totalRefund += refundAmt;
    }

    if (processedReturnItems.length === 0) {
      return next(badRequest('No valid return items provided'));
    }

    const returnRecord = {
      returnId,
      billId,
      returnDate: new Date(),
      items: processedReturnItems,
      totalRefundAmount: totalRefund,
      refundMethod,
      notes,
    };

    order.returns.push(returnRecord);
    order.totalOrderRefunded = (order.totalOrderRefunded || 0) + totalRefund;

    // Adjust target bill due if customer had outstanding balance
    if (targetBill.dueAmount > 0) {
      targetBill.dueAmount = Math.max(0, targetBill.dueAmount - totalRefund);
    }

    // Check if order is fully or partially returned
    let allItemsReturned = true;
    let anyItemReturned = false;

    for (const b of order.bills) {
      for (const it of b.items) {
        if ((it.returnedQuantity || 0) > 0) anyItemReturned = true;
        if ((it.returnedQuantity || 0) < it.quantity) allItemsReturned = false;
      }
    }

    order.orderStatus = allItemsReturned ? 'Fully Returned' : anyItemReturned ? 'Partially Returned' : 'Completed';
    order.markModified('bills');
    order.markModified('returns');
    await order.save();

    return res.status(201).json(
      successResponse({
        message: 'Return processed successfully and stock restored',
        data: {
          order,
          returnRecord,
          returnId,
          totalRefundAmount: totalRefund,
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Customer search for billing autocomplete
 * GET /api/store-employee/billing/customers
 */
export const getStoreCustomers = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const query = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    const customers = await Customer.find(query).limit(10).lean();
    return res.status(200).json(
      successResponse({
        message: 'Customers fetched successfully',
        data: { customers },
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Quick create / add customer for store billing
 * POST /api/store-employee/billing/customers
 */
export const createStoreCustomer = async (req, res, next) => {
  try {
    const { name, phone, email = '', address = '' } = req.body;

    if (!name || !name.trim()) {
      return next(badRequest('Customer name is required'));
    }

    if (!phone || !phone.trim()) {
      return next(badRequest('Customer phone number is required'));
    }

    let customer = await Customer.findOne({ phone: phone.trim() });
    if (customer) {
      customer.name = name.trim();
      if (email.trim()) customer.email = email.trim();
      if (address.trim()) customer.address = address.trim();
      await customer.save();
    } else {
      customer = await Customer.create({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
      });
    }

    return res.status(201).json(
      successResponse({
        message: 'Customer saved successfully',
        data: { customer },
      })
    );
  } catch (error) {
    return next(error);
  }
};
