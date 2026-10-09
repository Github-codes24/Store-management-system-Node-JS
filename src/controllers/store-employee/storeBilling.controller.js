import StoreOrder from '../../models/storeOrder.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Customer from '../../models/customer.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';
import { createCustomerNotificationHelper } from '../customer/customerNotification.controller.js';
import { syncCustomerMetricsInDb } from '../../utils/customerMetrics.util.js';
import razorpayInstance from '../../config/razorpay.js';
import env from '../../config/env.js';

/**
 * Auto-generate a clean sequential Order ID in the backend (e.g. SODR00001 for Offline, OODR00001 for Online).
 * Finds the highest existing sequence number instead of naive countDocuments, avoiding duplicate key errors when records have gaps or were deleted.
 */
const generateOrderId = async (saleType = 'Offline') => {
  const isOnline = (saleType || '').toLowerCase() === 'online';
  const prefix = isOnline ? 'OODR' : 'SODR';

  // 1. Find the highest orderId in store orders matching this prefix
  const latestOrder = await StoreOrder.findOne({
    orderId: new RegExp(`^${prefix}\\d+`, 'i')
  })
    .sort({ orderId: -1 })
    .collation({ locale: 'en', numericOrdering: true })
    .select('orderId')
    .lean();

  let maxNum = 0;
  if (latestOrder?.orderId) {
    const match = latestOrder.orderId.match(new RegExp(`^${prefix}(\\d+)`, 'i'));
    if (match) {
      maxNum = parseInt(match[1], 10) || 0;
    }
  }

  // 2. Also check if any nested bill has a higher orderId
  const latestBillOrder = await StoreOrder.findOne({
    'bills.orderId': new RegExp(`^${prefix}\\d+`, 'i')
  })
    .sort({ 'bills.orderId': -1 })
    .collation({ locale: 'en', numericOrdering: true })
    .select('bills.orderId')
    .lean();

  if (latestBillOrder?.bills?.length) {
    for (const b of latestBillOrder.bills) {
      const match = (b.orderId || '').match(new RegExp(`^${prefix}(\\d+)`, 'i'));
      if (match) {
        const num = parseInt(match[1], 10) || 0;
        if (num > maxNum) maxNum = num;
      }
    }
  }

  // 3. Fallback: ensure nextNum is at least countDocuments
  const count = await StoreOrder.countDocuments({
    orderId: new RegExp(`^${prefix}`, 'i')
  });
  if (count > maxNum) {
    maxNum = count;
  }

  let nextNum = maxNum + 1;
  let candidateId = `${prefix}${String(nextNum).padStart(5, '0')}`;

  // 4. Guarantee uniqueness by advancing if candidateId already exists
  while (
    await StoreOrder.exists({
      $or: [{ orderId: candidateId }, { 'bills.orderId': candidateId }]
    })
  ) {
    nextNum += 1;
    candidateId = `${prefix}${String(nextNum).padStart(5, '0')}`;
  }

  return candidateId;
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
    const storeId = req.storeEmployee?.storeId || req.storeEmployee?.store || null;
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
      offerId = null,
    } = req.body;

    const customerObj = (customer && typeof customer === 'object') ? customer : {
      name: req.body.customerName || req.body.name || 'Walk-in Customer',
      phone: req.body.customerPhone || req.body.phone || '',
      email: req.body.customerEmail || req.body.email || '',
      address: req.body.customerAddress || req.body.address || '',
      customerId: req.body.customerId || null,
    };

    if (!Array.isArray(items) || items.length === 0) {
      return next(badRequest('Bill must contain at least one item'));
    }

    if (!customerObj?.name && !orderId) {
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

    // Lookup active offer if offerId is provided
    let appliedOffer = null;
    if (offerId) {
      try {
        const Offer = (await import('../../models/offer.model.js')).default;
        appliedOffer = await Offer.findOne({ _id: offerId, isDeleted: false, status: 'active' });
      } catch (e) {
        console.error('Error looking up offerId in billing:', e);
      }
    }

    // Verify products and deduct stock from selected batch
    const processedItems = [];
    let autoComputedGross = 0;
    let autoComputedSubtotal = 0;

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
      let rawQty = Number(item.quantity);
      if (isNaN(rawQty) || rawQty <= 0) rawQty = 1;
      if (rawQty > 9999) {
        return next(badRequest(`Invalid quantity (${item.quantity}) for product "${storeProd.productName}". Maximum allowed quantity is 9999.`));
      }
      const qty = Math.floor(rawQty);

      const itemMrp = parseFloat(item.mrp !== undefined ? item.mrp : (storeProd.mrp || 0));
      const unitPrice = parseFloat(item.sellingPrice !== undefined ? item.sellingPrice : (storeProd.offlineSellingPrice || storeProd.onlineSellingPrice || storeProd.mrp || 0));
      const itemTotal = parseFloat(item.totalAmount !== undefined ? item.totalAmount : (unitPrice * qty));

      autoComputedGross += (itemMrp * qty);
      autoComputedSubtotal += itemTotal;

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

        // Clean up / remove batches that have 0 stock
        storeProd.batches = storeProd.batches.filter((b) => (Number(b.stockQuantity) || 0) > 0);

        // Update active batch name field to first remaining active batch
        if (storeProd.batches.length > 0) {
          storeProd.batch = storeProd.batches[0].batchNumber || '';
        } else {
          storeProd.batch = '';
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
        mrp: itemMrp,
        sellingPrice: unitPrice,
        purchasePrice: parseFloat(item.purchasePrice !== undefined ? item.purchasePrice : (storeProd.purchasePrice || 0)),
        quantity: qty,
        unit: item.unit || (storeProd.unit?.shortName || storeProd.unit?.name || 'pc'),
        gstPercentage: parseFloat(item.gstPercentage || storeProd.gstPercentage || 0),
        totalAmount: itemTotal,
        returnedQuantity: 0,
      });
    }

    // Auto calculate Gross, Subtotal, Discount & Net Amount if not provided
    const finalGrossAmount = (grossAmount && Number(grossAmount) > 0) ? parseFloat(grossAmount) : autoComputedGross;
    const finalSubtotal = (subtotal && Number(subtotal) > 0) ? parseFloat(subtotal) : autoComputedSubtotal;

    let finalDiscountType = discountType;
    let finalDiscountValue = parseFloat(discountValue) || 0;
    let finalDiscountAmount = parseFloat(discountAmount) || 0;

    if (appliedOffer) {
      if (appliedOffer.discountType === 'bogo') {
        finalDiscountType = 'BOGO';
        const buyProdId = appliedOffer.buyDetails?.buyProduct ? String(appliedOffer.buyDetails.buyProduct) : (appliedOffer.products?.[0] ? String(appliedOffer.products[0]) : null);
        const buyQty = Number(appliedOffer.buyDetails?.buyQuantity || 1);
        const freeQtyRatio = Number(appliedOffer.getFreeDetails?.freeQuantity || 1);
        const setSize = buyQty + freeQtyRatio;

        let totalFreeQty = 0;
        let unitSellingPrice = 0;

        for (const pItem of processedItems) {
          const pIdStr = String(pItem.product);
          if (!buyProdId || pIdStr === buyProdId) {
            const purchasedQty = pItem.quantity;
            totalFreeQty += Math.floor(purchasedQty / setSize) * freeQtyRatio;
            unitSellingPrice = pItem.sellingPrice;
          }
        }
        finalDiscountAmount = parseFloat((totalFreeQty * unitSellingPrice).toFixed(2));
      } else if (appliedOffer.discountType === 'bxgy') {
        finalDiscountType = 'BXGY';
        const buyProdId = appliedOffer.buyDetails?.buyProduct ? String(appliedOffer.buyDetails.buyProduct) : null;
        const freeProdId = appliedOffer.getFreeDetails?.freeProduct ? String(appliedOffer.getFreeDetails.freeProduct) : null;
        const buyQty = Number(appliedOffer.buyDetails?.buyQuantity || 1);
        const freeQtyRatio = Number(appliedOffer.getFreeDetails?.freeQuantity || 1);

        const buyItem = processedItems.find((i) => String(i.product) === buyProdId);
        const freeItem = processedItems.find((i) => String(i.product) === freeProdId);

        if (buyItem && buyItem.quantity >= buyQty && freeItem) {
          const numSets = Math.floor(buyItem.quantity / buyQty);
          const totalFreeQty = Math.min(freeItem.quantity, numSets * freeQtyRatio);
          finalDiscountAmount = parseFloat((totalFreeQty * freeItem.sellingPrice).toFixed(2));
        } else {
          finalDiscountAmount = 0;
        }
      } else if (appliedOffer.discountType === 'percentage') {
        finalDiscountType = '%';
        finalDiscountValue = appliedOffer.discountValue || 0;
        finalDiscountAmount = parseFloat(((finalSubtotal * finalDiscountValue) / 100).toFixed(2));
      } else {
        finalDiscountType = '₹';
        finalDiscountValue = appliedOffer.discountValue || 0;
        finalDiscountAmount = Math.min(finalSubtotal, finalDiscountValue);
      }
    } else if (finalDiscountAmount === 0 && finalDiscountValue > 0) {
      if (finalDiscountType === '%' || finalDiscountType === 'percentage') {
        finalDiscountAmount = parseFloat(((finalSubtotal * finalDiscountValue) / 100).toFixed(2));
      } else {
        finalDiscountAmount = Math.min(finalSubtotal, finalDiscountValue);
      }
    }

    const finalSavings = (savings && Number(savings) > 0 && !appliedOffer)
      ? parseFloat(savings)
      : Math.max(0, finalGrossAmount - finalSubtotal + finalDiscountAmount);
    const finalNetAmount = (netAmount && Number(netAmount) > 0 && !appliedOffer)
      ? parseFloat(netAmount)
      : Math.max(0, finalSubtotal - finalDiscountAmount);

    // Customer lookup or link
    let linkedCustomerId = customerObj.customerId || null;
    if (!linkedCustomerId && customerObj.phone) {
      const existingCustomer = await Customer.findOne({ phone: customerObj.phone.trim() });
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
    } else if (paidAmount !== undefined && paidAmount !== null && !isNaN(Number(paidAmount)) && Number(paidAmount) > 0) {
      const pAmt = parseFloat(paidAmount);
      processedPayments = [
        {
          date: todayFormatted,
          mode: paymentMethod || 'Cash',
          amount: pAmt,
          transactionId: '',
          description: '',
        },
      ];
    } else {
      // Default to full payment in Cash only for fresh new bills when no payment array is passed
      processedPayments = [
        {
          date: todayFormatted,
          mode: paymentMethod || 'Cash',
          amount: finalNetAmount,
          transactionId: '',
          description: '',
        },
      ];
    }

    const calculatedPaidAmount = processedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const calculatedNetAmount = finalNetAmount;
    const calculatedDueAmount = Math.max(0, calculatedNetAmount - calculatedPaidAmount);
    const calculatedPaymentStatus = calculatedPaidAmount >= calculatedNetAmount ? 'Paid' : calculatedPaidAmount > 0 ? 'Partial' : 'Unpaid';
    const primaryPaymentMethod = processedPayments[0]?.mode || paymentMethod || 'Cash';

    // If updating an existing bill inside this order
    if (order && existingBillIndex >= 0) {
      if (customerObj?.name) {
        order.customer = {
          name: customerObj.name.trim(),
          phone: (customerObj.phone || '').trim(),
          email: (customerObj.email || '').trim(),
          address: (customerObj.address || '').trim(),
          customerId: linkedCustomerId || order.customer?.customerId,
        };
      }

      const existingBill = order.bills[existingBillIndex];
      existingBill.items = processedItems;
      existingBill.totalItems = processedItems.reduce((sum, it) => sum + it.quantity, 0);
      existingBill.grossAmount = (grossAmount && Number(grossAmount) > 0) ? parseFloat(grossAmount) : finalGrossAmount;
      existingBill.savings = (savings && Number(savings) > 0) ? parseFloat(savings) : finalSavings;
      existingBill.subtotal = (subtotal && Number(subtotal) > 0) ? parseFloat(subtotal) : finalSubtotal;
      existingBill.gstTotal = parseFloat(gstTotal) || 0;
      existingBill.discountType = finalDiscountType;
      existingBill.discountValue = finalDiscountValue;
      existingBill.discountAmount = finalDiscountAmount;
      if (offerId) existingBill.offerId = offerId;
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

      // Synchronize customer's metrics in background / immediately
      if (order.customer?.customerId) {
        await syncCustomerMetricsInDb(order.customer.customerId).catch(() => {});
      } else if (order.customer?.phone) {
        await syncCustomerMetricsInDb(null, order.customer.phone).catch(() => {});
      }

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
    let thisBillOrderId = await generateOrderId(saleType);
    const billNumber = order ? (order.bills.length + 1) : 1;
    let sessionOrderId = order ? order.orderId : thisBillOrderId;
    let billId = `INV-${thisBillOrderId}-${billNumber}`;

    const newBill = {
      orderId: thisBillOrderId,
      billId,
      billNumber,
      saleType,
      billDate: new Date(),
      items: processedItems,
      totalItems: processedItems.reduce((sum, it) => sum + it.quantity, 0),
      grossAmount: (grossAmount && Number(grossAmount) > 0) ? parseFloat(grossAmount) : finalGrossAmount,
      savings: (savings && Number(savings) > 0) ? parseFloat(savings) : finalSavings,
      subtotal: (subtotal && Number(subtotal) > 0) ? parseFloat(subtotal) : finalSubtotal,
      gstTotal: parseFloat(gstTotal) || 0,
      discountType: finalDiscountType,
      discountValue: finalDiscountValue,
      discountAmount: finalDiscountAmount,
      offerId: offerId || null,
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
      // Create new purchase order session with concurrency collision retry
      let created = false;
      let attempts = 0;
      while (!created && attempts < 5) {
        try {
          order = await StoreOrder.create({
            orderId: sessionOrderId,
            store: storeId,
            employee: employeeId,
            customer: {
              name: (customerObj.name || 'Walk-in Customer').trim(),
              phone: (customerObj.phone || '').trim(),
              email: (customerObj.email || '').trim(),
              address: (customerObj.address || '').trim(),
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
          created = true;
        } catch (createErr) {
          if (createErr?.code === 11000 && attempts < 4) {
            attempts++;
            thisBillOrderId = await generateOrderId(saleType);
            sessionOrderId = thisBillOrderId;
            newBill.orderId = thisBillOrderId;
            newBill.billId = `INV-${thisBillOrderId}-${billNumber}`;
          } else {
            throw createErr;
          }
        }
      }
    }

    // Synchronize customer's metrics in DB
    const custId = order.customer?.customerId || linkedCustomerId;
    if (custId) {
      await syncCustomerMetricsInDb(custId).catch(() => {});
    } else if (order.customer?.phone) {
      await syncCustomerMetricsInDb(null, order.customer.phone).catch(() => {});
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
 * Helper to calculate Cash, UPI, Card payment statistics from orders list
 */
const calculateOrderPaymentStats = (statsOrders) => {
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

    const bill = o.bills?.[0] || {};
    const netAmount = Number(bill.netAmount ?? o.totalOrderNet ?? 0);
    const refunded = Number(bill.totalRefunded || o.totalOrderRefunded || 0);
    const effective = Math.max(0, netAmount - refunded);
    const paid = Number(bill.paidAmount ?? o.totalOrderPaid ?? effective);

    if (oCash === 0 && oUpi === 0 && oCard === 0 && paid > 0) {
      const method = (bill.paymentMethod || o.paymentMethod || '').trim().toLowerCase();
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

  return {
    totalCash: Math.round(totalCash * 100) / 100,
    totalUPI: Math.round(totalUPI * 100) / 100,
    totalCard: Math.round(totalCard * 100) / 100,
    totalAmount: Math.round((totalCash + totalUPI + totalCard) * 100) / 100,
  };
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
      isToday = '',
      dateFilter = '',
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

    // Check if user requested "Today" shortcut filter
    const isTodayRequested = String(isToday).toLowerCase() === 'true' || String(dateFilter).toLowerCase() === 'today';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (isTodayRequested) {
      query.createdAt = {
        $gte: todayStart,
        $lte: todayEnd,
      };
    } else if (startDate || endDate) {
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

    // Build dedicated today's query for todayStats calculation
    const todayQuery = {
      ...query,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    };

    const [orders, total, statsOrders, todayOrders] = await Promise.all([
      StoreOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      StoreOrder.countDocuments(query),
      StoreOrder.find(query)
        .select('payments bills.payments bills.paymentMethod bills.paidAmount bills.netAmount bills.totalRefunded totalOrderPaid totalOrderNet totalOrderRefunded')
        .lean(),
      StoreOrder.find(todayQuery)
        .select('payments bills.payments bills.paymentMethod bills.paidAmount bills.netAmount bills.totalRefunded totalOrderPaid totalOrderNet totalOrderRefunded')
        .lean(),
    ]);

    const stats = calculateOrderPaymentStats(statsOrders);
    const todayStatsRaw = calculateOrderPaymentStats(todayOrders);

    const todayStats = {
      todayCash: todayStatsRaw.totalCash,
      todayUPI: todayStatsRaw.totalUPI,
      todayCard: todayStatsRaw.totalCard,
      todayTotal: todayStatsRaw.totalAmount,
    };

    return res.status(200).json(
      successResponse({
        message: 'Orders fetched successfully',
        data: { 
          orders,
          stats: {
            ...stats,
            todayCash: todayStats.todayCash,
            todayUPI: todayStats.todayUPI,
            todayCard: todayStats.todayCard,
            todayTotal: todayStats.todayTotal,
          },
          todayStats,
        },
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
    const { status, description } = req.body;

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

    const items = order.bills?.[0]?.items || [];
    const firstItemName = items.length > 0 ? (items[0].productName || 'Product') : '';
    const extraCount = items.length - 1;
    const orderSummaryName = firstItemName
      ? (extraCount > 0 ? `${firstItemName} + ${extraCount} more items` : firstItemName)
      : 'Order';

    const statusDescMap = {
      'New': `Your order for "${orderSummaryName}" has been placed successfully.`,
      'Order Placed': `Your order for "${orderSummaryName}" has been placed successfully.`,
      'Processing': `Your order for "${orderSummaryName}" is being prepared for delivery.`,
      'Out For Delivery': `Your order for "${orderSummaryName}" is out for delivery.`,
      'Out for Delivery': `Your order for "${orderSummaryName}" is out for delivery.`,
      'Delivered': `Your order for "${orderSummaryName}" was delivered successfully.`,
      'Cancelled': `Your order for "${orderSummaryName}" was cancelled by store.`,
    };

    const title = statusTitleMap[status] || status;
    const defaultDesc = statusDescMap[status] || `Your order for "${orderSummaryName}" status updated to ${status}`;

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
        await syncCustomerMetricsInDb(targetCustomerId).catch(() => {});
        await createCustomerNotificationHelper({
          customerId: targetCustomerId,
          title: title || 'Order Status Update',
          message: description || defaultDesc,
          type: 'Order',
          actionUrl: `/orders/${order._id}`,
        });
      } catch (err) {
        console.error('Error in store status update customer sync/notification:', err);
      }
    }

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

    // Sync metrics for customer
    const custId = order.customer?.customerId || order.customerId;
    if (custId) {
      await syncCustomerMetricsInDb(custId).catch(() => {});
    } else if (order.customer?.phone) {
      await syncCustomerMetricsInDb(null, order.customer.phone).catch(() => {});
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
        purchasePrice: parseFloat(billItem.purchasePrice || (storeProd ? storeProd.purchasePrice : 0) || 0),
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

    // Auto-trigger Razorpay API refund if refund method is UPI/Card/Online or if bill was paid online
    let gatewayRefundInfo = null;
    const isOnlineRefund = ['upi', 'card', 'online', 'razorpay'].includes((refundMethod || '').toLowerCase());
    const paymentTxn = (targetBill?.payments || []).find((p) => p.transactionId && p.transactionId.startsWith('pay_'));
    const rzpPaymentId = paymentTxn?.transactionId || (typeof targetBill?.transactionId === 'string' && targetBill.transactionId.startsWith('pay_') ? targetBill.transactionId : null);

    if (isOnlineRefund && rzpPaymentId && razorpayInstance) {
      try {
        const rzpRefund = await razorpayInstance.payments.refund(rzpPaymentId, {
          amount: Math.round(totalRefund * 100),
          notes: {
            returnId,
            billId,
            orderId: order.orderId,
            reason: notes || 'Store Return Refund',
          },
        });
        gatewayRefundInfo = {
          refundId: rzpRefund.id,
          status: rzpRefund.status,
          amount: rzpRefund.amount / 100,
        };
      } catch (rzpErr) {
        console.warn('[Store Return Razorpay Refund Warning]:', rzpErr.message || rzpErr);
      }
    }

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

    // Synchronize customer metrics
    const custId = order.customer?.customerId || order.customerId;
    if (custId) {
      await syncCustomerMetricsInDb(custId).catch(() => {});
    } else if (order.customer?.phone) {
      await syncCustomerMetricsInDb(null, order.customer.phone).catch(() => {});
    }

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

/**
 * Generate POS Billing Dynamic UPI QR Code for In-Store Counter Payment
 * POST /api/store-employee/billing/generate-qr
 * Body: { amount, billId, storeOrderId }
 */
export const generatePosBillingQrCode = async (req, res, next) => {
  try {
    const { amount, billId, storeOrderId, notes = {} } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return next(badRequest('Valid bill payment amount is required'));
    }

    const numAmount = Number(amount);
    const amountInPaise = Math.round(numAmount * 100);
    const refId = billId || storeOrderId || `POS_${Date.now()}`;

    let qrCodeData = null;

    try {
      if (razorpayInstance && razorpayInstance.qrCode) {
        const qrResponse = await razorpayInstance.qrCode.create({
          type: 'upi_qr',
          name: `POS Payment - ${refId}`,
          usage: 'single_use',
          fixed_amount: true,
          payment_amount: amountInPaise,
          description: `In-Store POS Counter Payment for ${refId}`,
          notes: {
            refId,
            ...(storeOrderId ? { storeOrderId } : {}),
            ...notes,
          },
        });

        qrCodeData = {
          qrId: qrResponse.id,
          imageUrl: qrResponse.image_url,
          status: qrResponse.status,
          amount: numAmount,
          refId,
          method: 'Razorpay Dynamic QR',
        };
      }
    } catch (rzpErr) {
      console.warn('[POS Razorpay QR API Warning]:', rzpErr.message || rzpErr);
    }

    // Fallback dynamic UPI QR generator if Razorpay QR endpoint is not supported on standard test plan
    if (!qrCodeData) {
      const payeeAddress = env.STORE_UPI_ID || `${env.RAZORPAY_KEY_ID || 'apnamart'}@razorpay`;
      const upiString = `upi://pay?pa=${payeeAddress}&pn=ApnaMart%20Store&am=${numAmount.toFixed(2)}&tr=${refId}&tn=POS%20Counter%20Bill`;
      const encodedUpi = encodeURIComponent(upiString);
      const fallbackQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedUpi}`;

      qrCodeData = {
        qrId: `qr_${refId}`,
        imageUrl: fallbackQrImageUrl,
        upiString,
        status: 'active',
        amount: numAmount,
        refId,
        method: 'Dynamic UPI QR',
      };
    }

    return res.status(200).json(
      successResponse({
        message: 'POS Billing QR Code generated successfully',
        data: qrCodeData,
      })
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Check POS Billing QR Code Payment Status
 * GET /api/store-employee/billing/qr-status/:qrId
 */
export const checkPosBillingQrStatus = async (req, res, next) => {
  try {
    const { qrId } = req.params;

    if (!qrId) {
      return next(badRequest('QR ID or Reference ID parameter is required'));
    }

    // 1. Check StoreOrder database first
    const order = await StoreOrder.findOne({
      $or: [
        { _id: qrId.match(/^[0-9a-fA-F]{24}$/) ? qrId : null },
        { orderId: qrId },
        { 'bills.billId': qrId },
      ],
    }).lean();

    if (order) {
      const bill = order.bills[0] || {};
      const isPaid = bill.paymentStatus === 'Paid' || order.totalOrderPaid >= order.totalOrderNet;
      return res.status(200).json(
        successResponse({
          message: 'POS payment status retrieved from database',
          data: {
            qrId,
            isPaid,
            paymentStatus: bill.paymentStatus || (isPaid ? 'Paid' : 'Unpaid'),
            paidAmount: order.totalOrderPaid,
            totalAmount: order.totalOrderNet,
          },
        })
      );
    }

    // 2. Query Razorpay API directly if razorpay qr_ ID passed
    if (qrId.startsWith('qr_') && razorpayInstance && razorpayInstance.qrCode) {
      try {
        const rzpQr = await razorpayInstance.qrCode.fetch(qrId);
        const isPaid = rzpQr.status === 'closed' && rzpQr.payments_amount_received > 0;
        return res.status(200).json(
          successResponse({
            message: 'POS payment status retrieved from Razorpay QR API',
            data: {
              qrId: rzpQr.id,
              isPaid,
              paymentStatus: isPaid ? 'Paid' : 'Unpaid',
              paymentsAmountReceived: rzpQr.payments_amount_received / 100,
              status: rzpQr.status,
            },
          })
        );
      } catch (err) {
        console.warn('[Razorpay Fetch QR Warning]:', err.message);
      }
    }

    return res.status(200).json(
      successResponse({
        message: 'QR Payment is pending scan/completion',
        data: {
          qrId,
          isPaid: false,
          paymentStatus: 'Unpaid',
        },
      })
    );
  } catch (error) {
    return next(error);
  }
};
