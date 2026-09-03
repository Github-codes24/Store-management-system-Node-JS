import AdminProduct from '../../models/adminProduct.model.js';
import Distributor from '../../models/distributor.model.js';
import ProductPurchaseInvoice from '../../models/productPurchaseInvoice.model.js';
import ProductPurchasePayment from '../../models/productPurchasePayment.model.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { generateBarcode } from '../../utils/barcode.util.js';
import { getPagination } from '../../utils/pagination.js';

export const createProductPurchase = async (req, res) => {
  const {
    purchaseId,
    billDate,
    distributor: distributorId,
    items,
    discountType = 'flat',
    discountValue = 0,
    payments = [],
  } = req.body;

  const adminId = req.admin?._id || req.userId;

  // 1. Verify distributor
  const distributorExists = await Distributor.findOne({
    _id: distributorId,
    isDeleted: false,
  });
  if (!distributorExists) {
    throw notFound('Distributor not found');
  }

  // 2. Auto-generate or verify purchaseId
  let finalPurchaseId = purchaseId && typeof purchaseId === 'string' ? purchaseId.trim() : '';

  if (!finalPurchaseId) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.floor(1000 + Math.random() * 9000);
      finalPurchaseId = `PUR-${dateStr}-${randomPart}`;

      const existing = await ProductPurchaseInvoice.findOne({
        purchaseId: finalPurchaseId,
        isDeleted: false,
      });
      if (!existing) isUnique = true;
      attempts++;
    }
  } else {
    const existingPurchase = await ProductPurchaseInvoice.findOne({
      purchaseId: finalPurchaseId,
      isDeleted: false,
    });
    if (existingPurchase) {
      throw conflict(`Purchase ID '${finalPurchaseId}' is already used for an active purchase invoice`);
    }
  }

  // 3. Process line items & update/create products
  let grossAmount = 0;
  let gstAmount = 0;
  const processedItems = [];

  for (const item of items) {
    let product = null;

    // Check by ID if provided
    if (item.product) {
      product = await AdminProduct.findOne({
        _id: item.product,
        isDeleted: false,
      });
    }

    // Check by barcode if product not found by ID yet
    if (!product && item.barcode && item.barcode.trim() !== '') {
      product = await AdminProduct.findOne({
        barcode: item.barcode.trim(),
        isDeleted: false,
      });
    }

    const qty = Number(item.quantity);

    // If product exists -> increase stock
    if (product) {
      product.stockQuantity += qty;
      await product.save();
    } else {
      // Create NEW AdminProduct atomically
      let itemBarcode = item.barcode ? item.barcode.trim() : '';
      if (!itemBarcode) {
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
          itemBarcode = generateBarcode();
          const existBc = await AdminProduct.findOne({ barcode: itemBarcode, isDeleted: false });
          if (!existBc) isUnique = true;
          attempts++;
        }
      }

      if (!item.productType || !item.category || !item.subcategory || !item.brand) {
        throw badRequest(
          `Missing category/brand/type references to create new product '${item.productName}'`
        );
      }

      product = await AdminProduct.create({
        barcode: itemBarcode,
        productName: item.productName,
        productType: item.productType,
        category: item.category,
        subcategory: item.subcategory,
        brand: item.brand,
        mrp: Number(item.mrp),
        purchasePrice: Number(item.purchasePrice),
        offlineSellingPrice: Number(item.offlineSellingPrice || 0),
        onlineSellingPrice: Number(item.onlineSellingPrice || 0),
        taxType: item.taxType || 'GST Invoice',
        gstPercentage: Number(item.gstPercentage || 0),
        cgstPercentage: Number(item.cgstPercentage || 0),
        sgstPercentage: Number(item.sgstPercentage || 0),
        unit: item.unit,
        stockQuantity: qty, // initial stock set to purchased quantity
        minStockAlert: Number(item.minStockAlert || 0),
        reorderPoint: Number(item.reorderPoint || 0),
        manufactureDate: item.manufactureDate ? new Date(item.manufactureDate) : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        hsnCode: item.hsnCode || null,
        productImage:
          typeof (item.productImage || item.image) === 'string' &&
          !(item.productImage || item.image).startsWith('blob:') &&
          !(item.productImage || item.image).startsWith('data:')
            ? (item.productImage || item.image).trim()
            : null,
      });
    }

    const pp = Number(item.purchasePrice || product.purchasePrice);
    const mrp = Number(item.mrp || product.mrp);
    const ofp = Number(item.offlineSellingPrice || product.offlineSellingPrice);
    const onp = Number(item.onlineSellingPrice || product.onlineSellingPrice);
    const gstPct = Number(
      item.gstPercentage !== undefined ? item.gstPercentage : product.gstPercentage
    );

    const baseAmount = qty * pp;
    const itemGst = (baseAmount * gstPct) / 100;
    const lineTotal = baseAmount + itemGst;

    grossAmount += baseAmount;
    gstAmount += itemGst;

    processedItems.push({
      product: product._id,
      productName: item.productName || product.productName,
      mrp,
      purchasePrice: pp,
      offlineSellingPrice: ofp,
      onlineSellingPrice: onp,
      quantity: qty,
      unit: item.unit || product.unit,
      gstPercentage: gstPct,
      totalAmount: lineTotal,
    });
  }

  // 4. Calculate discount & net amount
  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = (grossAmount * Number(discountValue)) / 100;
  } else {
    discountAmount = Number(discountValue);
  }
  discountAmount = Math.min(discountAmount, grossAmount + gstAmount);

  const netAmount = Math.max(0, grossAmount + gstAmount - discountAmount);

  // 5. Create Purchase Invoice Document
  const invoice = await ProductPurchaseInvoice.create({
    purchaseId: finalPurchaseId,
    billDate: billDate ? new Date(billDate) : new Date(),
    distributor: distributorId,
    items: processedItems,
    grossAmount,
    gstAmount,
    discountType,
    discountValue: Number(discountValue),
    discountAmount,
    netAmount,
    totalPaidAmount: 0,
    creditAmount: netAmount,
    paymentStatus: 'Unpaid',
    status: 'Completed',
    createdBy: adminId,
  });

  // 6. Record Initial Payments if provided
  let totalPaidAmount = 0;
  const createdPayments = [];

  if (Array.isArray(payments) && payments.length > 0) {
    for (const p of payments) {
      if (p.amount && Number(p.amount) > 0) {
        const pAmt = Number(p.amount);
        const paymentDoc = await ProductPurchasePayment.create({
          purchaseInvoice: invoice._id,
          paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
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

  // Update payment status on invoice
  invoice.totalPaidAmount = totalPaidAmount;
  invoice.creditAmount = Math.max(0, netAmount - totalPaidAmount);
  if (totalPaidAmount >= netAmount && netAmount > 0) {
    invoice.paymentStatus = 'Paid';
  } else if (totalPaidAmount > 0) {
    invoice.paymentStatus = 'Partially Paid';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }
  await invoice.save();

  const populatedInvoice = await ProductPurchaseInvoice.findById(invoice._id)
    .populate('distributor', 'name mobile email gstin address salesperson')
    .populate('items.product', 'productName barcode productImage')
    .populate('items.unit', 'name shortName')
    .populate('createdBy', 'name email');

  return res.status(201).json(
    successResponse({
      message: 'Product purchase invoice created successfully',
      data: {
        invoice: populatedInvoice,
        payments: createdPayments,
      },
    })
  );
};

export const updateProductPurchase = async (req, res) => {
  const { id } = req.params;
  const { billDate, distributor: distributorId, items, discountType, discountValue } = req.body;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  if (distributorId) {
    const distExists = await Distributor.findOne({ _id: distributorId, isDeleted: false });
    if (!distExists) {
      throw notFound('Distributor not found');
    }
    invoice.distributor = distributorId;
  }

  if (billDate) {
    invoice.billDate = new Date(billDate);
  }

  if (items && Array.isArray(items)) {
    // Revert stock for all old items
    for (const oldItem of invoice.items) {
      const product = await AdminProduct.findById(oldItem.product);
      if (product) {
        product.stockQuantity = Math.max(0, product.stockQuantity - oldItem.quantity);
        await product.save();
      }
    }

    // Process new items list & update stock
    let grossAmount = 0;
    let gstAmount = 0;
    const processedItems = [];

    for (const item of items) {
      let product = null;

      if (item.product) {
        product = await AdminProduct.findOne({ _id: item.product, isDeleted: false });
      }

      if (!product && item.barcode && item.barcode.trim() !== '') {
        product = await AdminProduct.findOne({ barcode: item.barcode.trim(), isDeleted: false });
      }

      const qty = Number(item.quantity);

      if (product) {
        product.stockQuantity += qty;
        await product.save();
      } else {
        let itemBarcode = item.barcode ? item.barcode.trim() : '';
        if (!itemBarcode) {
          let isUnique = false;
          let attempts = 0;
          while (!isUnique && attempts < 10) {
            itemBarcode = generateBarcode();
            const existBc = await AdminProduct.findOne({ barcode: itemBarcode, isDeleted: false });
            if (!existBc) isUnique = true;
            attempts++;
          }
        }

        product = await AdminProduct.create({
          barcode: itemBarcode,
          productName: item.productName,
          productType: item.productType,
          category: item.category,
          subcategory: item.subcategory,
          brand: item.brand,
          mrp: Number(item.mrp),
          purchasePrice: Number(item.purchasePrice),
          offlineSellingPrice: Number(item.offlineSellingPrice || 0),
          onlineSellingPrice: Number(item.onlineSellingPrice || 0),
          taxType: item.taxType || 'GST Invoice',
          gstPercentage: Number(item.gstPercentage || 0),
          unit: item.unit,
          stockQuantity: qty,
          minStockAlert: Number(item.minStockAlert || 0),
          reorderPoint: Number(item.reorderPoint || 0),
          hsnCode: item.hsnCode || null,
        });
      }

      const pp = Number(item.purchasePrice || product.purchasePrice);
      const mrp = Number(item.mrp || product.mrp);
      const ofp = Number(item.offlineSellingPrice || product.offlineSellingPrice);
      const onp = Number(item.onlineSellingPrice || product.onlineSellingPrice);
      const gstPct = Number(
        item.gstPercentage !== undefined ? item.gstPercentage : product.gstPercentage
      );

      const baseAmount = qty * pp;
      const itemGst = (baseAmount * gstPct) / 100;
      const lineTotal = baseAmount + itemGst;

      grossAmount += baseAmount;
      gstAmount += itemGst;

      processedItems.push({
        product: product._id,
        productName: item.productName || product.productName,
        mrp,
        purchasePrice: pp,
        offlineSellingPrice: ofp,
        onlineSellingPrice: onp,
        quantity: qty,
        unit: item.unit || product.unit,
        gstPercentage: gstPct,
        totalAmount: lineTotal,
      });
    }

    invoice.items = processedItems;
    invoice.grossAmount = grossAmount;
    invoice.gstAmount = gstAmount;
  }

  if (discountType) {
    invoice.discountType = discountType;
  }
  if (discountValue !== undefined) {
    invoice.discountValue = Number(discountValue);
  }

  let discountAmount = 0;
  if (invoice.discountType === 'percentage') {
    discountAmount = (invoice.grossAmount * invoice.discountValue) / 100;
  } else {
    discountAmount = invoice.discountValue;
  }
  discountAmount = Math.min(discountAmount, invoice.grossAmount + invoice.gstAmount);

  const netAmount = Math.max(0, invoice.grossAmount + invoice.gstAmount - discountAmount);

  invoice.discountAmount = discountAmount;
  invoice.netAmount = netAmount;
  invoice.creditAmount = Math.max(0, netAmount - invoice.totalPaidAmount);

  if (invoice.totalPaidAmount >= netAmount && netAmount > 0) {
    invoice.paymentStatus = 'Paid';
  } else if (invoice.totalPaidAmount > 0) {
    invoice.paymentStatus = 'Partially Paid';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }

  await invoice.save();

  const updatedInvoice = await ProductPurchaseInvoice.findById(invoice._id)
    .populate('distributor', 'name mobile email gstin address salesperson')
    .populate('items.product', 'productName barcode productImage')
    .populate('items.unit', 'name shortName');

  return res.status(200).json(
    successResponse({
      message: 'Product purchase invoice updated successfully',
      data: updatedInvoice,
    })
  );
};

export const getProductPurchases = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    distributor,
    paymentStatus,
    startDate,
    endDate,
  } = req.query;

  const filter = { isDeleted: false };

  if (distributor) {
    filter.distributor = distributor;
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
      filter.billDate.$lte = new Date(endDate);
    }
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [{ purchaseId: searchRegex }];
  }

  const total = await ProductPurchaseInvoice.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const purchases = await ProductPurchaseInvoice.find(filter)
    .populate('distributor', 'name mobile email gstin salesperson')
    .populate('items.unit', 'name shortName')
    .sort({ billDate: -1, createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return res.status(200).json(
    successResponse({
      message: 'Product purchase invoices retrieved successfully',
      data: purchases,
      pagination,
    })
  );
};

export const getProductPurchaseById = async (req, res) => {
  const { id } = req.params;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false })
    .populate('distributor', 'name mobile email gstin address salesperson')
    .populate('items.product', 'productName barcode productImage mrp purchasePrice')
    .populate('items.unit', 'name shortName')
    .populate('createdBy', 'name email');

  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  const payments = await ProductPurchasePayment.find({
    purchaseInvoice: id,
    isDeleted: false,
  }).sort({ paymentDate: 1 });

  return res.status(200).json(
    successResponse({
      message: 'Product purchase invoice retrieved successfully',
      data: {
        invoice,
        payments,
      },
    })
  );
};

export const addPurchasePayment = async (req, res) => {
  const { id } = req.params;
  const { paymentDate, paymentMode, amount, transactionId, description } = req.body;
  const adminId = req.admin?._id || req.userId;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  const paymentAmount = Number(amount);
  if (paymentAmount <= 0) {
    throw badRequest('Payment amount must be greater than 0');
  }

  const payment = await ProductPurchasePayment.create({
    purchaseInvoice: invoice._id,
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    paymentMode,
    amount: paymentAmount,
    transactionId: transactionId || null,
    description: description || null,
    createdBy: adminId,
  });

  const allPayments = await ProductPurchasePayment.find({
    purchaseInvoice: invoice._id,
    isDeleted: false,
  });

  const newTotalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

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

  return res.status(201).json(
    successResponse({
      message: 'Payment added successfully',
      data: {
        payment,
        invoiceSummary: {
          totalPaidAmount: invoice.totalPaidAmount,
          creditAmount: invoice.creditAmount,
          paymentStatus: invoice.paymentStatus,
        },
      },
    })
  );
};

export const getPurchasePayments = async (req, res) => {
  const { id } = req.params;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  const payments = await ProductPurchasePayment.find({
    purchaseInvoice: id,
    isDeleted: false,
  }).sort({ paymentDate: -1 });

  return res.status(200).json(
    successResponse({
      message: 'Payments retrieved successfully',
      data: payments,
    })
  );
};

export const deletePurchaseItem = async (req, res) => {
  const { id, itemId } = req.params;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  const itemIndex = invoice.items.findIndex((item) => item._id.toString() === itemId);
  if (itemIndex === -1) {
    throw notFound('Purchase item not found in this invoice');
  }

  const [removedItem] = invoice.items.splice(itemIndex, 1);

  // Decrement product stock
  const product = await AdminProduct.findById(removedItem.product);
  if (product) {
    product.stockQuantity = Math.max(0, product.stockQuantity - removedItem.quantity);
    await product.save();
  }

  // Recalculate totals
  let grossAmount = 0;
  let gstAmount = 0;

  for (const item of invoice.items) {
    const qty = item.quantity;
    const pp = item.purchasePrice;
    const gstPct = item.gstPercentage || 0;

    const baseAmount = qty * pp;
    const itemGst = (baseAmount * gstPct) / 100;

    grossAmount += baseAmount;
    gstAmount += itemGst;
  }

  let discountAmount = 0;
  if (invoice.discountType === 'percentage') {
    discountAmount = (grossAmount * invoice.discountValue) / 100;
  } else {
    discountAmount = invoice.discountValue;
  }
  discountAmount = Math.min(discountAmount, grossAmount + gstAmount);

  const netAmount = Math.max(0, grossAmount + gstAmount - discountAmount);

  invoice.grossAmount = grossAmount;
  invoice.gstAmount = gstAmount;
  invoice.discountAmount = discountAmount;
  invoice.netAmount = netAmount;
  invoice.creditAmount = Math.max(0, netAmount - invoice.totalPaidAmount);

  if (invoice.totalPaidAmount >= netAmount && netAmount > 0) {
    invoice.paymentStatus = 'Paid';
  } else if (invoice.totalPaidAmount > 0) {
    invoice.paymentStatus = 'Partially Paid';
  } else {
    invoice.paymentStatus = 'Unpaid';
  }

  await invoice.save();

  return res.status(200).json(
    successResponse({
      message: 'Item removed from purchase invoice successfully',
      data: invoice,
    })
  );
};

export const cancelProductPurchase = async (req, res) => {
  const { id } = req.params;

  const invoice = await ProductPurchaseInvoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) {
    throw notFound('Product purchase invoice not found');
  }

  // Revert stock for all items
  for (const item of invoice.items) {
    const product = await AdminProduct.findById(item.product);
    if (product) {
      product.stockQuantity = Math.max(0, product.stockQuantity - item.quantity);
      await product.save();
    }
  }

  invoice.status = 'Cancelled';
  invoice.isDeleted = true;
  await invoice.save();

  return res.status(200).json(
    successResponse({
      message: 'Product purchase invoice cancelled and deleted successfully',
      data: { id: invoice._id },
    })
  );
};
