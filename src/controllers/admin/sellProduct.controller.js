import ExcelJS from 'exceljs';
import AdminProduct from '../../models/adminProduct.model.js';
import Retailer from '../../models/retailer.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import SellProductPayment from '../../models/sellProductPayment.model.js';
import Store from '../../models/store.model.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

export const parseSafeDate = (inputDate) => {
  if (!inputDate) return new Date();
  if (typeof inputDate === 'function') return new Date();
  if (inputDate instanceof Date && !isNaN(inputDate.getTime())) return inputDate;

  if (typeof inputDate === 'string') {
    const trimmed = inputDate.trim();
    if (!trimmed) return new Date();

    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const [_, day, month, year] = dmyMatch;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
};

export const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

export const createSellProduct = async (req, res) => {
  const {
    sellId,
    billDate,
    saleType,
    store: storeId,
    retailer: retailerId,
    items,
    discountType = 'flat',
    discountValue = 0,
    payments = [],
  } = req.body;

  const adminId = req.admin?._id || req.userId;

  // 1. Validate Target Store / Retailer
  let targetStore = null;
  let targetRetailer = null;

  if (saleType === 'Own Store') {
    if (!storeId) {
      throw badRequest('Store selection is required when selling to Own Store');
    }
    targetStore = await Store.findOne({ _id: storeId, isDeleted: false });
    if (!targetStore) {
      throw notFound('Selected Store not found');
    }
  } else if (saleType === 'Other Retailer') {
    if (!retailerId) {
      throw badRequest('Retailer selection is required when selling to Other Retailer');
    }
    targetRetailer = await Retailer.findOne({ _id: retailerId, isDeleted: false });
    if (!targetRetailer) {
      throw notFound('Selected Retailer not found');
    }
  } else {
    throw badRequest("Invalid saleType. Must be 'Own Store' or 'Other Retailer'");
  }

  // 2. Auto-generate or verify sellId
  let finalSellId = sellId && typeof sellId === 'string' ? sellId.trim().toUpperCase() : '';

  if (!finalSellId) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 15) {
      const count = await SellProduct.countDocuments();
      const nextNum = count + 1 + attempts;
      finalSellId = `SODR${String(nextNum).padStart(5, '0')}`;

      const existing = await SellProduct.findOne({
        sellId: finalSellId,
        isDeleted: false,
      });
      if (!existing) {
        isUnique = true;
      } else {
        const randomPart = Math.floor(10000 + Math.random() * 90000);
        finalSellId = `SODR${randomPart}`;
        const existingRand = await SellProduct.findOne({
          sellId: finalSellId,
          isDeleted: false,
        });
        if (!existingRand) isUnique = true;
      }
      attempts++;
    }
  } else {
    const existingSell = await SellProduct.findOne({
      sellId: finalSellId,
      isDeleted: false,
    });
    if (existingSell) {
      throw conflict(`Sell ID '${finalSellId}' is already used for an active sale invoice`);
    }
  }

  // 3. Stock Availability Verification & Item Processing
  const processedItems = [];
  let grossAmount = 0;
  let sellingTotal = 0;
  let gstAmount = 0;

  for (const item of items) {
    const product = await AdminProduct.findOne({
      _id: item.product,
      isDeleted: false,
    });

    if (!product) {
      throw notFound(`Product with ID '${item.product}' not found`);
    }

    const qty = Number(item.quantity);
    if (qty <= 0) {
      throw badRequest(`Quantity for product '${product.productName}' must be at least 1`);
    }

    // Check inventory stock availability
    if (product.stockQuantity < qty) {
      throw badRequest(
        `Insufficient stock for '${product.productName}'. Available: ${product.stockQuantity}, Requested: ${qty}`
      );
    }

    const mrp = Number(item.mrp !== undefined ? item.mrp : product.mrp);
    const sellingPrice = Number(item.sellingPrice);
    const gstPct = Number(item.gstPercentage !== undefined ? item.gstPercentage : product.gstPercentage || 0);

    const baseLineTotal = qty * sellingPrice;
    const itemGst = (baseLineTotal * gstPct) / 100;
    const lineTotal = baseLineTotal + itemGst;

    grossAmount += qty * mrp;
    sellingTotal += baseLineTotal;
    gstAmount += itemGst;

    // Deduct stock quantity from AdminProduct
    product.stockQuantity -= qty;
    await product.save();

    processedItems.push({
      product: product._id,
      productName: item.productName || product.productName,
      mrp: round2(mrp),
      sellingPrice: round2(sellingPrice),
      quantity: qty,
      unit: item.unit || product.unit,
      gstPercentage: gstPct,
      totalAmount: round2(lineTotal),
    });
  }

  const savings = Math.max(0, grossAmount - sellingTotal);

  // 4. Calculate Discount & Net Amount
  let discountAmount = 0;
  const subtotalWithGst = sellingTotal + gstAmount;

  if (discountType === 'percentage') {
    discountAmount = (subtotalWithGst * Number(discountValue)) / 100;
  } else {
    discountAmount = Number(discountValue);
  }
  discountAmount = Math.min(discountAmount, subtotalWithGst);

  const netAmount = Math.max(0, subtotalWithGst - discountAmount);

  // 5. Create Sell Product Invoice Document
  const invoice = await SellProduct.create({
    sellId: finalSellId,
    billDate: parseSafeDate(billDate),
    saleType,
    store: saleType === 'Own Store' ? targetStore._id : null,
    retailer: saleType === 'Other Retailer' ? targetRetailer._id : null,
    items: processedItems,
    totalItems: processedItems.length,
    grossAmount: round2(grossAmount),
    savings: round2(savings),
    gstAmount: round2(gstAmount),
    discountType,
    discountValue: Number(discountValue),
    discountAmount: round2(discountAmount),
    netAmount: round2(netAmount),
    totalPaidAmount: 0,
    creditAmount: round2(netAmount),
    paymentStatus: 'Unpaid',
    status: 'Completed',
    createdBy: adminId,
  });

  // 6. Process Initial Payments if provided
  let totalPaidAmount = 0;
  const createdPayments = [];

  if (Array.isArray(payments) && payments.length > 0) {
    for (const p of payments) {
      if (p.amount && Number(p.amount) > 0) {
        const pAmt = round2(Number(p.amount));
        const paymentDoc = await SellProductPayment.create({
          sellInvoice: invoice._id,
          paymentDate: parseSafeDate(p.paymentDate),
          paymentMode: p.paymentMode,
          amount: pAmt,
          transactionId: p.transactionId || null,
          description: p.description || null,
          createdBy: adminId,
        });
        totalPaidAmount += pAmt;
        createdPayments.push(paymentDoc);
      }
    }
  }

  // Update payment balance
  if (saleType === 'Own Store') {
    invoice.totalPaidAmount = 0;
    invoice.creditAmount = 0;
    invoice.paymentStatus = 'Completed';
  } else {
    invoice.totalPaidAmount = round2(totalPaidAmount);
    invoice.creditAmount = round2(Math.max(0, invoice.netAmount - invoice.totalPaidAmount));
    if (totalPaidAmount >= netAmount && netAmount > 0) {
      invoice.paymentStatus = 'Paid';
    } else if (totalPaidAmount > 0) {
      invoice.paymentStatus = 'Partially Paid';
    } else {
      invoice.paymentStatus = 'Unpaid';
    }
  }
  await invoice.save();

  const populatedInvoice = await SellProduct.findById(invoice._id)
    .populate('store', 'storeCode name mobile email location')
    .populate('retailer', 'retailerCode name mobile email location')
    .populate('items.product', 'productName barcode productImage mrp offlineSellingPrice onlineSellingPrice')
    .populate('items.unit', 'name shortName')
    .populate('createdBy', 'name email');

  return res.status(201).json(
    successResponse({
      message: 'Sell product invoice created successfully',
      data: {
        invoice: populatedInvoice,
        payments: createdPayments,
      },
    })
  );
};

export const getSellProducts = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    saleType,
    paymentStatus,
    startDate,
    endDate,
  } = req.query;

  const filter = { isDeleted: false };

  if (saleType && saleType !== 'all') {
    filter.saleType = saleType;
  }
  if (paymentStatus && paymentStatus !== 'all') {
    filter.paymentStatus = paymentStatus;
  }

  if (startDate || endDate) {
    filter.billDate = {};
    if (startDate) {
      filter.billDate.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.billDate.$lte = end;
    }
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');

    // Find store IDs and retailer IDs matching search
    const matchingStores = await Store.find({
      $or: [{ name: searchRegex }, { storeCode: searchRegex }],
      isDeleted: false,
    }).select('_id');

    const matchingRetailers = await Retailer.find({
      $or: [{ name: searchRegex }, { retailerCode: searchRegex }],
      isDeleted: false,
    }).select('_id');

    const storeIds = matchingStores.map((s) => s._id);
    const retailerIds = matchingRetailers.map((r) => r._id);

    filter.$or = [
      { sellId: searchRegex },
      { store: { $in: storeIds } },
      { retailer: { $in: retailerIds } },
    ];
  }

  const total = await SellProduct.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const rawInvoices = await SellProduct.find(filter)
    .populate('store', 'storeCode name mobile email location')
    .populate('retailer', 'retailerCode name mobile email location')
    .populate('items.product', 'productName barcode')
    .populate('items.unit', 'name shortName')
    .sort({ billDate: -1, createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Format response rows to match Figma table structure
  const formattedInvoices = rawInvoices.map((inv, index) => {
    const srNo = pagination.skip + index + 1;
    const storeOrRetailerName =
      inv.saleType === 'Own Store'
        ? inv.store?.name || 'N/A'
        : inv.retailer?.name || 'N/A';

    let productsSummary = 'No products';
    if (inv.items && inv.items.length > 0) {
      const firstProductName = inv.items[0].productName || inv.items[0].product?.productName || 'Product';
      if (inv.items.length > 1) {
        productsSummary = `${firstProductName} ... +${inv.items.length - 1} more product`;
      } else {
        productsSummary = firstProductName;
      }
    }

    return {
      srNo,
      _id: inv._id,
      sellId: inv.sellId,
      billDate: inv.billDate,
      saleType: inv.saleType,
      storeOrRetailerName,
      store: inv.store,
      retailer: inv.retailer,
      productsSummary,
      itemsCount: inv.items.length,
      totalBill: round2(inv.netAmount),
      credit: inv.saleType === 'Own Store' ? 0 : round2(inv.creditAmount),
      totalPaidAmount: round2(inv.totalPaidAmount),
      paymentStatus: inv.paymentStatus,
      status: inv.status,
      createdAt: inv.createdAt,
    };
  });

  return res.status(200).json(
    successResponse({
      message: 'Sell product invoices retrieved successfully',
      data: formattedInvoices,
      pagination,
    })
  );
};

export const getSellProductById = async (req, res) => {
  const { id } = req.params;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false })
    .populate('store', 'storeCode name mobile email location')
    .populate('retailer', 'retailerCode name mobile email location')
    .populate('items.product', 'productName barcode productImage mrp offlineSellingPrice onlineSellingPrice stockQuantity')
    .populate('items.unit', 'name shortName')
    .populate('createdBy', 'name email');

  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  const payments = await SellProductPayment.find({
    sellInvoice: id,
    isDeleted: false,
  }).sort({ paymentDate: 1 });

  // Calculate target store/retailer total outstanding due
  let entityTotalDue = 0;
  if (invoice.saleType === 'Own Store' && invoice.store) {
    const dueAgg = await SellProduct.aggregate([
      { $match: { store: invoice.store._id, saleType: 'Own Store', isDeleted: false, status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, totalDue: { $sum: '$creditAmount' } } },
    ]);
    entityTotalDue = dueAgg.length > 0 ? dueAgg[0].totalDue : 0;
  } else if (invoice.saleType === 'Other Retailer' && invoice.retailer) {
    const dueAgg = await SellProduct.aggregate([
      { $match: { retailer: invoice.retailer._id, saleType: 'Other Retailer', isDeleted: false, status: { $ne: 'Cancelled' } } },
      { $group: { _id: null, totalDue: { $sum: '$creditAmount' } } },
    ]);
    entityTotalDue = dueAgg.length > 0 ? dueAgg[0].totalDue : 0;
  }

  return res.status(200).json(
    successResponse({
      message: 'Sell product invoice retrieved successfully',
      data: {
        invoice,
        payments,
        entityTotalDue,
      },
    })
  );
};

export const updateSellProduct = async (req, res) => {
  const { id } = req.params;
  const { billDate, saleType, store: storeId, retailer: retailerId, items, discountType, discountValue } = req.body;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  if (saleType) invoice.saleType = saleType;
  if (billDate) invoice.billDate = new Date(billDate);

  if (invoice.saleType === 'Own Store') {
    if (storeId) {
      const storeExists = await Store.findOne({ _id: storeId, isDeleted: false });
      if (!storeExists) throw notFound('Selected Store not found');
      invoice.store = storeId;
      invoice.retailer = null;
    }
  } else if (invoice.saleType === 'Other Retailer') {
    if (retailerId) {
      const retailerExists = await Retailer.findOne({ _id: retailerId, isDeleted: false });
      if (!retailerExists) throw notFound('Selected Retailer not found');
      invoice.retailer = retailerId;
      invoice.store = null;
    }
  }

  if (items && Array.isArray(items)) {
    // Step A: Restore previous item stock to AdminProduct
    for (const oldItem of invoice.items) {
      const product = await AdminProduct.findById(oldItem.product);
      if (product) {
        product.stockQuantity += oldItem.quantity;
        await product.save();
      }
    }

    // Step B: Validate & Deduct stock for updated items list
    const processedItems = [];
    let grossAmount = 0;
    let sellingTotal = 0;
    let gstAmount = 0;

    for (const item of items) {
      const product = await AdminProduct.findOne({ _id: item.product, isDeleted: false });
      if (!product) {
        throw notFound(`Product with ID '${item.product}' not found`);
      }

      const qty = Number(item.quantity);
      if (product.stockQuantity < qty) {
        throw badRequest(
          `Insufficient stock for '${product.productName}'. Available: ${product.stockQuantity}, Requested: ${qty}`
        );
      }

      const mrp = Number(item.mrp !== undefined ? item.mrp : product.mrp);
      const sellingPrice = Number(item.sellingPrice);
      const gstPct = Number(item.gstPercentage !== undefined ? item.gstPercentage : product.gstPercentage || 0);

      const baseLineTotal = qty * sellingPrice;
      const itemGst = (baseLineTotal * gstPct) / 100;
      const lineTotal = baseLineTotal + itemGst;

      grossAmount += qty * mrp;
      sellingTotal += baseLineTotal;
      gstAmount += itemGst;

      product.stockQuantity -= qty;
      await product.save();

      processedItems.push({
        product: product._id,
        productName: item.productName || product.productName,
        mrp,
        sellingPrice,
        quantity: qty,
        unit: item.unit || product.unit,
        gstPercentage: gstPct,
        totalAmount: lineTotal,
      });
    }

    invoice.items = processedItems;
    invoice.totalItems = processedItems.length;
    invoice.grossAmount = grossAmount;
    invoice.savings = Math.max(0, grossAmount - sellingTotal);
    invoice.gstAmount = gstAmount;
  }

  if (discountType) invoice.discountType = discountType;
  if (discountValue !== undefined) invoice.discountValue = Number(discountValue);

  // Recalculate discount & net amount
  const sellingTotalCalc = invoice.items.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
  const subtotalWithGst = sellingTotalCalc + invoice.gstAmount;

  let discountAmount = 0;
  if (invoice.discountType === 'percentage') {
    discountAmount = (subtotalWithGst * invoice.discountValue) / 100;
  } else {
    discountAmount = invoice.discountValue;
  }
  discountAmount = Math.min(discountAmount, subtotalWithGst);

  const netAmount = Math.max(0, subtotalWithGst - discountAmount);

  invoice.discountAmount = round2(discountAmount);
  invoice.netAmount = round2(netAmount);

  if (invoice.saleType === 'Own Store') {
    invoice.totalPaidAmount = 0;
    invoice.creditAmount = 0;
    invoice.paymentStatus = 'Completed';
  } else {
    invoice.creditAmount = round2(Math.max(0, invoice.netAmount - invoice.totalPaidAmount));
    if (invoice.totalPaidAmount >= invoice.netAmount && invoice.netAmount > 0) {
      invoice.paymentStatus = 'Paid';
    } else if (invoice.totalPaidAmount > 0) {
      invoice.paymentStatus = 'Partially Paid';
    } else {
      invoice.paymentStatus = 'Unpaid';
    }
  }

  await invoice.save();

  const updatedInvoice = await SellProduct.findById(invoice._id)
    .populate('store', 'storeCode name mobile email location')
    .populate('retailer', 'retailerCode name mobile email location')
    .populate('items.product', 'productName barcode productImage mrp offlineSellingPrice onlineSellingPrice')
    .populate('items.unit', 'name shortName');

  return res.status(200).json(
    successResponse({
      message: 'Sell product invoice updated successfully',
      data: updatedInvoice,
    })
  );
};

export const deleteSellProduct = async (req, res) => {
  const { id } = req.params;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  // Restore inventory stock for all items back to AdminProduct
  for (const item of invoice.items) {
    const product = await AdminProduct.findById(item.product);
    if (product) {
      product.stockQuantity += item.quantity;
      await product.save();
    }
  }

  invoice.status = 'Cancelled';
  invoice.isDeleted = true;
  await invoice.save();

  return res.status(200).json(
    successResponse({
      message: 'Sell product invoice deleted and stock restored successfully',
      data: { id: invoice._id },
    })
  );
};

export const addSellPayment = async (req, res) => {
  const { id } = req.params;
  const { paymentDate, paymentMode, amount, transactionId, description } = req.body;
  const adminId = req.admin?._id || req.userId;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  const pAmt = Number(amount);
  if (pAmt <= 0) {
    throw badRequest('Payment amount must be greater than 0');
  }

  const payment = await SellProductPayment.create({
    sellInvoice: invoice._id,
    paymentDate: parseSafeDate(paymentDate),
    paymentMode,
    amount: pAmt,
    transactionId: transactionId || null,
    description: description || null,
    createdBy: adminId,
  });

  const allPayments = await SellProductPayment.find({
    sellInvoice: invoice._id,
    isDeleted: false,
  });

  const newTotalPaid = round2(allPayments.reduce((sum, p) => sum + p.amount, 0));

  invoice.totalPaidAmount = newTotalPaid;
  invoice.creditAmount = round2(Math.max(0, invoice.netAmount - newTotalPaid));

  if (newTotalPaid >= invoice.netAmount && invoice.netAmount > 0) {
    invoice.paymentStatus = 'Paid';
  } else if (newTotalPaid > 0) {
    invoice.paymentStatus = 'Partially Paid';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }

  await invoice.save();

  return res.status(201).json(
    successResponse({
      message: 'Payment recorded successfully',
      data: {
        payment,
        summary: {
          totalPaidAmount: invoice.totalPaidAmount,
          creditAmount: invoice.creditAmount,
          paymentStatus: invoice.paymentStatus,
        },
      },
    })
  );
};

export const getSellPayments = async (req, res) => {
  const { id } = req.params;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  const payments = await SellProductPayment.find({
    sellInvoice: id,
    isDeleted: false,
  }).sort({ paymentDate: -1 });

  return res.status(200).json(
    successResponse({
      message: 'Payments retrieved successfully',
      data: payments,
    })
  );
};

export const deleteSellPayment = async (req, res) => {
  const { id, paymentId } = req.params;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  const payment = await SellProductPayment.findOne({ _id: paymentId, sellInvoice: id, isDeleted: false });
  if (!payment) {
    throw notFound('Payment transaction not found');
  }

  payment.isDeleted = true;
  await payment.save();

  const activePayments = await SellProductPayment.find({
    sellInvoice: id,
    isDeleted: false,
  });

  const newTotalPaid = activePayments.reduce((sum, p) => sum + p.amount, 0);

  invoice.totalPaidAmount = newTotalPaid;
  invoice.creditAmount = Math.max(0, invoice.netAmount - newTotalPaid);

  if (newTotalPaid >= invoice.netAmount && invoice.netAmount > 0) {
    invoice.paymentStatus = 'Paid';
  } else if (newTotalPaid > 0) {
    invoice.paymentStatus = 'Partially Paid';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }

  await invoice.save();

  return res.status(200).json(
    successResponse({
      message: 'Payment removed successfully',
      data: {
        totalPaidAmount: invoice.totalPaidAmount,
        creditAmount: invoice.creditAmount,
        paymentStatus: invoice.paymentStatus,
      },
    })
  );
};

export const exportSellProducts = async (req, res) => {
  const { search, saleType, paymentStatus, startDate, endDate, format = 'excel' } = req.query;

  const filter = { isDeleted: false };

  if (saleType && saleType !== 'all') filter.saleType = saleType;
  if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;

  if (startDate || endDate) {
    filter.billDate = {};
    if (startDate) filter.billDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.billDate.$lte = end;
    }
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    const matchingStores = await Store.find({ name: searchRegex, isDeleted: false }).select('_id');
    const matchingRetailers = await Retailer.find({ name: searchRegex, isDeleted: false }).select('_id');

    filter.$or = [
      { sellId: searchRegex },
      { store: { $in: matchingStores.map((s) => s._id) } },
      { retailer: { $in: matchingRetailers.map((r) => r._id) } },
    ];
  }

  const sales = await SellProduct.find(filter)
    .populate('store', 'name storeCode mobile email location')
    .populate('retailer', 'name retailerCode mobile email location')
    .sort({ billDate: -1 });

  const exportData = sales.map((sale, index) => ({
    srNo: index + 1,
    sellId: sale.sellId || 'N/A',
    billDate: sale.billDate ? new Date(sale.billDate).toLocaleDateString('en-GB') : '',
    saleType: sale.saleType || 'N/A',
    storeOrRetailer:
      sale.saleType === 'Own Store' ? sale.store?.name || 'N/A' : sale.retailer?.name || 'N/A',
    totalItems: sale.totalItems || sale.items?.length || 0,
    grossAmount: round2(sale.grossAmount),
    savings: round2(sale.savings),
    gstAmount: round2(sale.gstAmount),
    discountAmount: round2(sale.discountAmount),
    totalBill: round2(sale.netAmount),
    paidAmount: round2(sale.totalPaidAmount),
    credit: sale.saleType === 'Own Store' ? 0 : round2(sale.creditAmount),
    paymentStatus: sale.paymentStatus || 'Completed',
    status: sale.status || 'Completed',
  }));

  if (format === 'json') {
    return res.status(200).json(
      successResponse({
        message: 'Sell products report exported successfully',
        data: exportData,
      })
    );
  }

  // Generate Excel Workbook via ExcelJS
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sell Products');

  worksheet.columns = [
    { header: 'Sr.No.', key: 'srNo', width: 8 },
    { header: 'Sell ID', key: 'sellId', width: 16 },
    { header: 'Date', key: 'billDate', width: 14 },
    { header: 'Sale Type', key: 'saleType', width: 16 },
    { header: 'Store / Retailer', key: 'storeOrRetailer', width: 28 },
    { header: 'Total Items', key: 'totalItems', width: 12 },
    { header: 'Gross Amount (₹)', key: 'grossAmount', width: 18 },
    { header: 'Savings (₹)', key: 'savings', width: 14 },
    { header: 'GST Amount (₹)', key: 'gstAmount', width: 16 },
    { header: 'Discount (₹)', key: 'discountAmount', width: 14 },
    { header: 'Total Bill (₹)', key: 'totalBill', width: 18 },
    { header: 'Paid Amount (₹)', key: 'paidAmount', width: 16 },
    { header: 'Credit (₹)', key: 'credit', width: 14 },
    { header: 'Payment Status', key: 'paymentStatus', width: 16 },
    { header: 'Order Status', key: 'status', width: 14 },
  ];

  // Vibrant Orange Header Styling matching Admin POS theme
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'EA580C' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  exportData.forEach((row) => {
    worksheet.addRow(row);
  });

  // Auto align data cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.alignment = { vertical: 'middle' };
      row.height = 20;
    }
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="sell_products_report_${new Date().toISOString().slice(0, 10)}.xlsx"`
  );

  await workbook.xlsx.write(res);
  return res.end();
};

export const generateInvoice = async (req, res) => {
  const { id } = req.params;

  const invoice = await SellProduct.findOne({ _id: id, isDeleted: false })
    .populate('store', 'storeCode name mobile email location')
    .populate('retailer', 'retailerCode name mobile email location')
    .populate('items.product', 'productName barcode hsnCode')
    .populate('items.unit', 'name shortName')
    .populate('createdBy', 'name email');

  if (!invoice) {
    throw notFound('Sell product invoice not found');
  }

  const payments = await SellProductPayment.find({ sellInvoice: id, isDeleted: false }).sort({ paymentDate: 1 });

  const invoicePayload = {
    invoiceTitle: 'SALES INVOICE',
    sellId: invoice.sellId,
    billDate: invoice.billDate,
    saleType: invoice.saleType,
    customerDetails:
      invoice.saleType === 'Own Store'
        ? {
            type: 'Store',
            code: invoice.store?.storeCode,
            name: invoice.store?.name,
            mobile: invoice.store?.mobile,
            email: invoice.store?.email,
            address: invoice.store?.location,
          }
        : {
            type: 'Retailer',
            code: invoice.retailer?.retailerCode,
            name: invoice.retailer?.name,
            mobile: invoice.retailer?.mobile,
            email: invoice.retailer?.email,
            address: invoice.retailer?.location,
          },
    items: invoice.items.map((item, idx) => ({
      srNo: idx + 1,
      productName: item.productName,
      barcode: item.product?.barcode || '',
      hsnCode: item.product?.hsnCode || '',
      mrp: item.mrp,
      sellingPrice: item.sellingPrice,
      quantity: item.quantity,
      unit: item.unit?.shortName || item.unit?.name || '',
      gstPercentage: item.gstPercentage,
      totalAmount: item.totalAmount,
    })),
    summary: {
      totalItems: invoice.totalItems,
      grossAmount: invoice.grossAmount,
      savings: invoice.savings,
      gstAmount: invoice.gstAmount,
      discountAmount: invoice.discountAmount,
      netAmount: invoice.netAmount,
      totalPaidAmount: invoice.totalPaidAmount,
      creditAmount: invoice.creditAmount,
      paymentStatus: invoice.paymentStatus,
    },
    payments: payments.map((p) => ({
      paymentDate: p.paymentDate,
      paymentMode: p.paymentMode,
      amount: p.amount,
      transactionId: p.transactionId,
    })),
    generatedAt: new Date(),
  };

  return res.status(200).json(
    successResponse({
      message: 'Invoice metadata generated successfully',
      data: invoicePayload,
    })
  );
};
