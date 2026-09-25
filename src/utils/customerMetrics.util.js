import StoreOrder from '../models/storeOrder.model.js';
import Customer from '../models/customer.model.js';

/**
 * Calculate accurate real-time metrics, spent chart, top products, and bills for a single customer
 * from all non-cancelled StoreOrders.
 */
export const calculateCustomerMetrics = async (customer, storeId = null) => {
  if (!customer) return null;

  const customerId = customer._id;
  const customerPhone = customer.phone && customer.phone.trim() && customer.phone.trim() !== '0000000000'
    ? customer.phone.trim()
    : null;

  const orderQuery = {
    $or: [
      { 'customer.customerId': customerId },
      ...(customerPhone ? [{ 'customer.phone': customerPhone }] : []),
    ],
    orderStatus: { $ne: 'Cancelled' },
  };

  const orders = await StoreOrder.find(orderQuery).sort({ createdAt: -1 }).lean();

  let totalOrders = orders.length;
  let totalBillAmount = 0;
  let totalDueAmount = 0;
  const allBills = [];
  const productMap = new Map();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const monthlyTotals = new Array(12).fill(0);

  for (const order of orders) {
    const orderRefund = Number(order.totalOrderRefunded) || 0;
    const orderNet = (order.bills || []).reduce((sum, b) => sum + (Number(b.netAmount) || 0), 0);
    const netPurchased = Math.max(0, orderNet - orderRefund);
    totalBillAmount += netPurchased;

    for (const b of order.bills || []) {
      const bDue = Number(b.dueAmount) || 0;
      const bNet = Number(b.netAmount) || 0;
      const bPaid = Number(b.paidAmount) || 0;
      totalDueAmount += bDue;

      const billDateObj = b.billDate ? new Date(b.billDate) : (order.createdAt ? new Date(order.createdAt) : new Date());
      const billDateStr = !isNaN(billDateObj.getTime())
        ? billDateObj.toLocaleDateString('en-GB')
        : '';

      // Monthly spending
      if (!isNaN(billDateObj.getTime()) && billDateObj.getFullYear() === currentYear) {
        monthlyTotals[billDateObj.getMonth()] += bNet;
      }

      // Collect items for top purchased products
      for (const item of b.items || []) {
        const prodName = (item.productName || item.product || 'Unknown Item').trim();
        const rawQty = Number(item.quantity) - (Number(item.returnedQuantity) || 0);
        if (rawQty <= 0) continue;
        const unit = item.unit || 'pc';

        if (!productMap.has(prodName)) {
          productMap.set(prodName, { name: prodName, item: prodName, quantityNum: 0, unit });
        }
        productMap.get(prodName).quantityNum += rawQty;
      }

      allBills.push({
        _id: b._id,
        billId: b.billId || `INV-${b.orderId || order.orderId}`,
        billNo: b.billId || `#${b.orderId || order.orderId}`,
        orderId: b.orderId || order.orderId,
        sessionOrderId: order.orderId,
        saleType: b.saleType || 'Offline',
        billDate: b.billDate || order.createdAt,
        date: billDateStr,
        totalItems: b.totalItems || (b.items ? b.items.length : 0),
        grossAmount: Number(b.grossAmount) || 0,
        savings: Number(b.savings) || 0,
        subtotal: Number(b.subtotal) || 0,
        gstTotal: Number(b.gstTotal) || 0,
        netAmount: bNet,
        amount: bNet,
        paidAmount: bPaid,
        dueAmount: bDue,
        paymentStatus: b.paymentStatus || (bDue > 0 ? (bPaid > 0 ? 'Partial' : 'Unpaid') : 'Paid'),
        status: b.paymentStatus || (bDue > 0 ? (bPaid > 0 ? 'Partial' : 'Unpaid') : 'Paid'),
        paymentMethod: b.paymentMethod || 'Cash',
        items: b.items || [],
        payments: b.payments || [],
        createdAt: b.createdAt || order.createdAt,
      });
    }
  }

  // Sort bills by date descending
  allBills.sort((a, b) => new Date(b.billDate || b.createdAt) - new Date(a.billDate || a.createdAt));

  // Top 5 purchased products
  const topPurchasedProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantityNum - a.quantityNum)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      item: p.name,
      quantity: `${p.quantityNum} ${p.unit}`,
      qty: `${p.quantityNum} ${p.unit}`,
      quantityNum: p.quantityNum,
      unit: p.unit,
    }));

  // Spent chart
  const spentChart = monthNames.map((month, idx) => ({
    month,
    amount: Math.round(monthlyTotals[idx] * 100) / 100,
  }));

  // Summary statistics
  const distinctVisitDates = new Set(
    allBills.map((b) => {
      const d = new Date(b.billDate || b.createdAt);
      return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
    }).filter(Boolean)
  );
  const totalStoreVisits = Math.max(distinctVisitDates.size, totalOrders, Number(customer.totalStoreVisits) || 0);

  const customerCreated = customer.createdAt ? new Date(customer.createdAt) : new Date();
  const monthsActive = Math.max(1, Math.ceil((Date.now() - customerCreated.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const avgStoreVisitsPerMonth = totalStoreVisits > 0
    ? Math.max(1, Math.round(totalStoreVisits / monthsActive))
    : 0;

  const roundedTotalBillAmount = Math.round(totalBillAmount * 100) / 100;
  const roundedTotalDueAmount = Math.round(totalDueAmount * 100) / 100;
  const avgMonthlyBillValue = totalOrders > 0
    ? Math.round(roundedTotalBillAmount / totalOrders)
    : 0;

  const summary = {
    avgStoreVisitsPerMonth,
    totalStoreVisits,
    avgMonthlyBillValue,
  };

  return {
    totalOrders,
    totalBillAmount: roundedTotalBillAmount,
    totalDueAmount: roundedTotalDueAmount,
    summary,
    spentChart,
    topPurchasedProducts,
    bills: allBills,
    orders,
  };
};

/**
 * Efficiently batch-calculate and attach metrics for an array of customers
 * (Used in Customer List, Recent Customers, and Export)
 */
export const batchPopulateCustomerMetrics = async (customers, storeId = null) => {
  if (!Array.isArray(customers) || customers.length === 0) return customers;

  const customerIds = customers.map((c) => c._id).filter(Boolean);
  const customerPhones = customers
    .map((c) => (c.phone || '').trim())
    .filter((p) => p && p !== '0000000000');

  const orderQuery = {
    $or: [
      { 'customer.customerId': { $in: customerIds } },
      ...(customerPhones.length > 0 ? [{ 'customer.phone': { $in: customerPhones } }] : []),
    ],
    orderStatus: { $ne: 'Cancelled' },
  };

  const orders = await StoreOrder.find(orderQuery)
    .select('orderId customer bills totalOrderRefunded createdAt')
    .lean();

  // Index orders by customerId string and phone string
  const ordersByCustId = new Map();
  const ordersByPhone = new Map();

  for (const order of orders) {
    const custId = order.customer?.customerId ? order.customer.customerId.toString() : null;
    const phone = order.customer?.phone ? order.customer.phone.trim() : null;

    if (custId) {
      if (!ordersByCustId.has(custId)) ordersByCustId.set(custId, []);
      ordersByCustId.get(custId).push(order);
    }
    if (phone && phone !== '0000000000') {
      if (!ordersByPhone.has(phone)) ordersByPhone.set(phone, []);
      ordersByPhone.get(phone).push(order);
    }
  }

  // Populate metrics for each customer in array
  for (const c of customers) {
    const cid = c._id ? c._id.toString() : null;
    const phone = (c.phone || '').trim();

    // Collect matched orders without duplicates
    const matchedOrdersMap = new Map();
    if (cid && ordersByCustId.has(cid)) {
      for (const o of ordersByCustId.get(cid)) {
        matchedOrdersMap.set(o._id.toString(), o);
      }
    }
    if (phone && phone !== '0000000000' && ordersByPhone.has(phone)) {
      for (const o of ordersByPhone.get(phone)) {
        matchedOrdersMap.set(o._id.toString(), o);
      }
    }

    const matchedOrders = Array.from(matchedOrdersMap.values());

    let calcPurchase = 0;
    let calcDue = 0;
    const calcOrders = matchedOrders.length;

    for (const order of matchedOrders) {
      const orderRefund = Number(order.totalOrderRefunded) || 0;
      const orderNet = (order.bills || []).reduce((sum, b) => sum + (Number(b.netAmount) || 0), 0);
      calcPurchase += Math.max(0, orderNet - orderRefund);

      for (const b of order.bills || []) {
        calcDue += Number(b.dueAmount) || 0;
      }
    }

    calcPurchase = Math.round(calcPurchase * 100) / 100;
    calcDue = Math.round(calcDue * 100) / 100;

    // Use calculated if orders exist, else fallback to customer existing or 0
    if (matchedOrders.length > 0) {
      c.totalPurchase = calcPurchase;
      c.amountDue = calcDue;
      c.totalOrders = calcOrders;

      // Persist in background if different from DB
      Customer.updateOne(
        { _id: c._id },
        {
          $set: {
            totalPurchase: calcPurchase,
            amountDue: calcDue,
            totalOrders: calcOrders,
            ...(c.totalStoreVisits < calcOrders ? { totalStoreVisits: calcOrders } : {}),
          },
        }
      ).catch(() => {});
    } else {
      c.totalPurchase = Number(c.totalPurchase) || 0;
      c.amountDue = Number(c.amountDue) || 0;
      c.totalOrders = Number(c.totalOrders) || 0;
    }
  }

  return customers;
};

/**
 * Synchronize a customer's record in MongoDB with their current StoreOrder metrics.
 */
export const syncCustomerMetricsInDb = async (customerId, phone = null) => {
  if (!customerId && !phone) return null;

  const customer = customerId
    ? await Customer.findById(customerId)
    : await Customer.findOne({ phone: phone.trim() });

  if (!customer) return null;

  const metrics = await calculateCustomerMetrics(customer);
  if (!metrics) return null;

  customer.totalPurchase = metrics.totalBillAmount;
  customer.amountDue = metrics.totalDueAmount;
  customer.totalOrders = metrics.totalOrders;
  if (!customer.totalStoreVisits || customer.totalStoreVisits < metrics.summary.totalStoreVisits) {
    customer.totalStoreVisits = metrics.summary.totalStoreVisits;
  }

  await customer.save();
  return customer;
};
