import StoreOrder from '../../models/storeOrder.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import Store from '../../models/store.model.js';
import ProductType from '../../models/productType.model.js';
import Category from '../../models/category.model.js';
import Unit from '../../models/unit.model.js';
import ExcelJS from 'exceljs';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';

// Utility helper to format percentage growth
const formatGrowth = (current, previous) => {
  if (!previous || previous === 0) {
    if (!current || current === 0) return '+0.0%';
    return '+100.0%';
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
};

// Utility helper to build purchase price and metadata maps for products
const getProductMaps = async () => {
  const [storeProducts, adminProducts, categories, units, productTypes] = await Promise.all([
    StoreProduct.find({ isDeleted: false })
      .populate('category', 'name categoryName')
      .populate('unit', 'name unitName')
      .populate('productType', 'name')
      .lean(),
    AdminProduct.find({ isDeleted: false })
      .populate('category', 'name categoryName')
      .populate('unit', 'name unitName')
      .populate('productType', 'name')
      .lean(),
    Category.find({ isDeleted: false }).lean(),
    Unit.find({ isDeleted: false }).lean(),
    ProductType.find().lean(),
  ]);

  const priceMap = {};
  const categoryMap = {};
  const unitMap = {};
  const hsnMap = {};
  const productTypeMap = {};

  for (const p of storeProducts) {
    const idStr = String(p._id);
    priceMap[idStr] = Number(p.purchasePrice || 0);
    categoryMap[idStr] = p.category?.name || p.category?.categoryName || 'General';
    unitMap[idStr] = p.unit?.name || p.unit?.unitName || 'pc';
    hsnMap[idStr] = p.hsnCode || p.barcode || '1001';
    productTypeMap[idStr] = p.productType?._id ? String(p.productType._id) : null;
  }

  for (const p of adminProducts) {
    const idStr = String(p._id);
    priceMap[idStr] = Number(p.purchasePrice || 0);
    categoryMap[idStr] = p.category?.name || p.category?.categoryName || 'General';
    unitMap[idStr] = p.unit?.name || p.unit?.unitName || 'pc';
    hsnMap[idStr] = p.hsnCode || p.barcode || '1001';
    productTypeMap[idStr] = p.productType?._id ? String(p.productType._id) : null;
  }

  return { priceMap, categoryMap, unitMap, hsnMap, productTypeMap, productTypes };
};

/**
 * 1. Sales Register Report
 * GET /api/admin/reports/sales-register
 */
export const getSalesRegisterReport = async (req, res, next) => {
  try {
    const { startDate, endDate, storeId, saleType, page = 1, limit = 50 } = req.query;

    const orderQuery = {};
    const sellQuery = { isDeleted: false };

    if (storeId && storeId !== 'all' && storeId !== 'All') {
      orderQuery.store = storeId;
      sellQuery.store = storeId;
    }

    if (startDate || endDate) {
      orderQuery.createdAt = {};
      sellQuery.billDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        orderQuery.createdAt.$gte = start;
        sellQuery.billDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        orderQuery.createdAt.$lte = end;
        sellQuery.billDate.$lte = end;
      }
    }

    const [orders, sellProducts, { hsnMap }] = await Promise.all([
      StoreOrder.find(orderQuery).sort({ createdAt: -1 }).lean(),
      SellProduct.find(sellQuery).sort({ billDate: -1 }).lean(),
      getProductMaps(),
    ]);

    // Data structures for summary & detail rows
    let invoiceBillsCount = 0;
    let memoBillsCount = 0;
    const invoicePhoneSet = new Set();
    const memoPhoneSet = new Set();
    let invoiceTotalValue = 0;
    let memoTotalValue = 0;
    let invoiceTaxable = 0;
    let memoTaxable = 0;
    let invoiceCGST = 0;
    let memoCGST = 0;
    let invoiceSGST = 0;
    let memoSGST = 0;

    const details = [];
    let rowIndex = 1;

    // Process POS Memos (StoreOrders)
    if (!saleType || saleType.toLowerCase() === 'all' || saleType.toLowerCase() === 'memos') {
      for (const order of orders) {
        const custPhone = order.customer?.phone ? String(order.customer.phone).trim() : '';
        if (custPhone) memoPhoneSet.add(custPhone);

        const bills = Array.isArray(order.bills) ? order.bills : [];
        for (const bill of bills) {
          memoBillsCount += 1;
          const net = Number(bill.netAmount || 0);
          const taxable = Number(bill.subtotal || Math.max(0, net - (bill.gstTotal || 0)));
          const gst = Number(bill.gstTotal || 0);

          memoTotalValue += net;
          memoTaxable += taxable;
          memoCGST += gst / 2;
          memoSGST += gst / 2;

          const billDateObj = bill.billDate ? new Date(bill.billDate) : new Date(order.createdAt);
          const formattedDate = `${billDateObj.toLocaleDateString('en-US')} ${billDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;

          const items = Array.isArray(bill.items) ? bill.items : [];
          if (items.length > 0) {
            for (const item of items) {
              const itemQty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
              if (itemQty <= 0) continue;

              const itemVal = Number(item.totalAmount || (item.sellingPrice * itemQty));
              const itemHsn = hsnMap[String(item.product)] || item.barcode || '1001';

              details.push({
                id: item._id || `${order._id}_${bill.billId}_${rowIndex}`,
                sNo: rowIndex++,
                gstin: custPhone || '-',
                customer: order.customer?.name || 'vyshak',
                invoiceNo: bill.billId || order.orderId || '-',
                invoiceDate: formattedDate,
                invoiceValue: parseFloat(itemVal.toFixed(2)),
                hsn: itemHsn,
                productName: item.productName || 'Product',
                billType: 'Memos',
              });
            }
          } else {
            details.push({
              id: bill.billId || `${order._id}_${rowIndex}`,
              sNo: rowIndex++,
              gstin: custPhone || '-',
              customer: order.customer?.name || 'vyshak',
              invoiceNo: bill.billId || order.orderId || '-',
              invoiceDate: formattedDate,
              invoiceValue: parseFloat(net.toFixed(2)),
              hsn: '1001',
              productName: 'General Sale Item',
              billType: 'Memos',
            });
          }
        }
      }
    }

    // Process Admin / Online Invoices (SellProducts)
    if (!saleType || saleType.toLowerCase() === 'all' || saleType.toLowerCase() === 'invoices') {
      for (const sell of sellProducts) {
        invoiceBillsCount += 1;
        const net = Number(sell.netAmount || 0);
        const gst = Number(sell.gstAmount || 0);
        const taxable = Number(sell.grossAmount || (net - gst));

        invoiceTotalValue += net;
        invoiceTaxable += taxable;
        invoiceCGST += gst / 2;
        invoiceSGST += gst / 2;

        const billDateObj = sell.billDate ? new Date(sell.billDate) : new Date(sell.createdAt);
        const formattedDate = `${billDateObj.toLocaleDateString('en-US')} ${billDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;

        const items = Array.isArray(sell.items) ? sell.items : [];
        if (items.length > 0) {
          for (const item of items) {
            const itemQty = Number(item.quantity || 1);
            const itemVal = Number(item.totalAmount || (item.sellingPrice * itemQty));
            const itemHsn = hsnMap[String(item.product)] || '1001';

            details.push({
              id: item._id || `${sell._id}_${rowIndex}`,
              sNo: rowIndex++,
              gstin: '-',
              customer: sell.saleType || 'Online Customer',
              invoiceNo: sell.sellId || '-',
              invoiceDate: formattedDate,
              invoiceValue: parseFloat(itemVal.toFixed(2)),
              hsn: itemHsn,
              productName: item.productName || 'Product',
              billType: 'Invoices',
            });
          }
        } else {
          details.push({
            id: sell._id || `${rowIndex}`,
            sNo: rowIndex++,
            gstin: '-',
            customer: sell.saleType || 'Online Customer',
            invoiceNo: sell.sellId || '-',
            invoiceDate: formattedDate,
            invoiceValue: parseFloat(net.toFixed(2)),
            hsn: '1001',
            productName: 'Invoice Sale',
            billType: 'Invoices',
          });
        }
      }
    }

    const summary = [
      {
        billType: 'Invoices',
        noOfBills: invoiceBillsCount,
        noOfCustomerPhones: invoicePhoneSet.size,
        totalValue: parseFloat(invoiceTotalValue.toFixed(2)),
        totalTaxableValue: parseFloat(invoiceTaxable.toFixed(2)),
        totalCGST: parseFloat(invoiceCGST.toFixed(2)),
        totalSGST: parseFloat(invoiceSGST.toFixed(2)),
        totalCess: 0,
        totalAdditionalCess: 0,
      },
      {
        billType: 'Memos',
        noOfBills: memoBillsCount,
        noOfCustomerPhones: memoPhoneSet.size,
        totalValue: parseFloat(memoTotalValue.toFixed(2)),
        totalTaxableValue: parseFloat(memoTaxable.toFixed(2)),
        totalCGST: parseFloat(memoCGST.toFixed(2)),
        totalSGST: parseFloat(memoSGST.toFixed(2)),
        totalCess: 0,
        totalAdditionalCess: 0,
      },
    ];

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedDetails = details.slice(startIndex, startIndex + limitNum);

    return res.status(200).json(
      successResponse({
        message: 'Sales register report retrieved successfully',
        data: {
          summary,
          details: paginatedDetails,
          allDetails: details,
          totalAvailableRows: details.length,
          maxDisplayLimit: 500,
          pagination: {
            total: details.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(details.length / limitNum) || 1,
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Sales Summary Report
 * GET /api/admin/reports/sales-summary
 */
export const getSalesSummaryReport = async (req, res, next) => {
  try {
    const { startDate, endDate, storeId, page = 1, limit = 50 } = req.query;

    const orderQuery = {};
    const sellQuery = { isDeleted: false };

    if (storeId && storeId !== 'all' && storeId !== 'All') {
      orderQuery.store = storeId;
      sellQuery.store = storeId;
    }

    if (startDate || endDate) {
      orderQuery.createdAt = {};
      sellQuery.billDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        orderQuery.createdAt.$gte = start;
        sellQuery.billDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        orderQuery.createdAt.$lte = end;
        sellQuery.billDate.$lte = end;
      }
    }

    const [orders, sellProducts, { categoryMap, unitMap }] = await Promise.all([
      StoreOrder.find(orderQuery).lean(),
      SellProduct.find(sellQuery).lean(),
      getProductMaps(),
    ]);

    const productSalesMap = {};

    // Group store orders by product
    for (const order of orders) {
      const bills = Array.isArray(order.bills) ? order.bills : [];
      for (const bill of bills) {
        const items = Array.isArray(bill.items) ? bill.items : [];
        for (const item of items) {
          const pName = (item.productName || 'Product').trim();
          const pId = String(item.product || pName);
          const unitName = unitMap[pId] || item.unit || 'pc';
          const catName = categoryMap[pId] || 'General';

          const qty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
          if (qty <= 0) continue;

          const saleAmount = Number(item.totalAmount || (item.sellingPrice * qty));

          const key = `${pName}_${unitName}`;
          if (!productSalesMap[key]) {
            productSalesMap[key] = {
              productName: pName,
              unit: unitName,
              category: catName,
              totalQuantity: 0,
              totalSaleAmount: 0,
            };
          }
          productSalesMap[key].totalQuantity += qty;
          productSalesMap[key].totalSaleAmount += saleAmount;
        }
      }
    }

    // Group admin sell products
    for (const sell of sellProducts) {
      const items = Array.isArray(sell.items) ? sell.items : [];
      for (const item of items) {
        const pName = (item.productName || 'Product').trim();
        const pId = String(item.product || pName);
        const unitName = unitMap[pId] || 'pc';
        const catName = categoryMap[pId] || 'General';

        const qty = Number(item.quantity || 1);
        if (qty <= 0) continue;

        const saleAmount = Number(item.totalAmount || (item.sellingPrice * qty));

        const key = `${pName}_${unitName}`;
        if (!productSalesMap[key]) {
          productSalesMap[key] = {
            productName: pName,
            unit: unitName,
            category: catName,
            totalQuantity: 0,
            totalSaleAmount: 0,
          };
        }
        productSalesMap[key].totalQuantity += qty;
        productSalesMap[key].totalSaleAmount += saleAmount;
      }
    }

    const productSalesList = Object.values(productSalesMap).map(p => ({
      productName: p.productName,
      unit: p.unit,
      category: p.category,
      totalQuantity: p.totalQuantity,
      totalSaleAmount: parseFloat(p.totalSaleAmount.toFixed(0)),
    }));

    const totalSummary = {
      description: 'Total',
      totalQuantity: productSalesList.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalSaleAmount: parseFloat(productSalesList.reduce((sum, p) => sum + p.totalSaleAmount, 0).toFixed(0)),
    };

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedList = productSalesList.slice(startIndex, startIndex + limitNum);

    return res.status(200).json(
      successResponse({
        message: 'Sales summary report retrieved successfully',
        data: {
          productSales: paginatedList,
          allProductSales: productSalesList,
          totalSummary,
          totalAvailableRows: productSalesList.length,
          maxDisplayLimit: 500,
          pagination: {
            total: productSalesList.length,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(productSalesList.length / limitNum) || 1,
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Store P&L Report (Overview Page)
 * GET /api/admin/reports/store-pnl
 */
export const getStorePnLReport = async (req, res, next) => {
  try {
    const { startDate, endDate, storeId } = req.query;

    // Date range boundaries
    let currentStart = startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    let currentEnd = endDate ? new Date(endDate) : new Date();

    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    // Calculate previous period of equal duration for growth % comparison
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const [stores, { priceMap }] = await Promise.all([
      Store.find({ isDeleted: false }).sort({ name: 1 }).lean(),
      getProductMaps(),
    ]);

    // Helper to calculate revenue & cost for a given date range
    const calculateMetricsForRange = async (start, end, targetStoreId) => {
      const orderQuery = { createdAt: { $gte: start, $lte: end } };
      const sellQuery = { isDeleted: false, billDate: { $gte: start, $lte: end } };

      if (targetStoreId && targetStoreId !== 'all' && targetStoreId !== 'All') {
        orderQuery.store = targetStoreId;
        sellQuery.store = targetStoreId;
      }

      const [orders, sellProducts] = await Promise.all([
        StoreOrder.find(orderQuery).lean(),
        SellProduct.find(sellQuery).lean(),
      ]);

      const storeMetricsMap = {};
      for (const s of stores) {
        storeMetricsMap[String(s._id)] = {
          storeId: String(s._id),
          storeName: s.name,
          totalRevenue: 0,
          productCost: 0,
        };
      }

      let totalRevenue = 0;
      let productCost = 0;

      // Process StoreOrders
      for (const order of orders) {
        const sId = order.store ? String(order.store) : null;
        const bills = Array.isArray(order.bills) ? order.bills : [];
        for (const bill of bills) {
          const net = Number(bill.netAmount || 0);
          totalRevenue += net;
          if (sId && storeMetricsMap[sId]) {
            storeMetricsMap[sId].totalRevenue += net;
          }

          const items = Array.isArray(bill.items) ? bill.items : [];
          for (const item of items) {
            const qty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
            if (qty <= 0) continue;

            const pId = String(item.product);
            const costPerUnit = priceMap[pId] !== undefined ? priceMap[pId] : Number(item.sellingPrice * 0.67);
            const itemCost = qty * costPerUnit;

            productCost += itemCost;
            if (sId && storeMetricsMap[sId]) {
              storeMetricsMap[sId].productCost += itemCost;
            }
          }
        }
      }

      // Process SellProducts
      for (const sell of sellProducts) {
        const sId = sell.store ? String(sell.store) : null;
        const net = Number(sell.netAmount || 0);
        totalRevenue += net;
        if (sId && storeMetricsMap[sId]) {
          storeMetricsMap[sId].totalRevenue += net;
        }

        const items = Array.isArray(sell.items) ? sell.items : [];
        for (const item of items) {
          const qty = Number(item.quantity || 1);
          if (qty <= 0) continue;

          const pId = String(item.product);
          const costPerUnit = priceMap[pId] !== undefined ? priceMap[pId] : Number(item.sellingPrice * 0.67);
          const itemCost = qty * costPerUnit;

          productCost += itemCost;
          if (sId && storeMetricsMap[sId]) {
            storeMetricsMap[sId].productCost += itemCost;
          }
        }
      }

      const netProfit = totalRevenue - productCost;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        totalRevenue,
        productCost,
        netProfit,
        profitMargin,
        storeMetricsMap,
      };
    };

    const currentMetrics = await calculateMetricsForRange(currentStart, currentEnd, storeId);
    const prevMetrics = await calculateMetricsForRange(prevStart, prevEnd, storeId);

    // Summary Metric Cards
    const summaryCards = {
      totalRevenue: {
        value: parseFloat(currentMetrics.totalRevenue.toFixed(0)),
        formattedValue: `₹${currentMetrics.totalRevenue.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.totalRevenue, prevMetrics.totalRevenue),
      },
      productCost: {
        value: parseFloat(currentMetrics.productCost.toFixed(0)),
        formattedValue: `₹${currentMetrics.productCost.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.productCost, prevMetrics.productCost),
      },
      netProfit: {
        value: parseFloat(currentMetrics.netProfit.toFixed(0)),
        formattedValue: `₹${currentMetrics.netProfit.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.netProfit, prevMetrics.netProfit),
      },
      profitMargin: {
        value: parseFloat(currentMetrics.profitMargin.toFixed(2)),
        formattedValue: `${currentMetrics.profitMargin.toFixed(2)}%`,
        growth: formatGrowth(currentMetrics.profitMargin, prevMetrics.profitMargin),
      },
    };

    // Store P&L Table Rows
    const storePnlList = stores
      .filter(s => !storeId || storeId === 'all' || storeId === 'All' || String(s._id) === String(storeId))
      .map((s, index) => {
        const m = currentMetrics.storeMetricsMap[String(s._id)] || { totalRevenue: 0, productCost: 0 };
        const rev = m.totalRevenue;
        const cost = m.productCost;
        const profit = rev - cost;
        const margin = rev > 0 ? (profit / rev) * 100 : 0;

        return {
          srNo: index + 1,
          storeId: s._id,
          storeName: s.name,
          totalRevenue: parseFloat(rev.toFixed(0)),
          productCost: parseFloat(cost.toFixed(0)),
          netProfit: parseFloat(profit.toFixed(0)),
          pnlMargin: parseFloat(margin.toFixed(2)),
          pnlMarginFormatted: `${margin.toFixed(2)}%`,
        };
      });

    return res.status(200).json(
      successResponse({
        message: 'Store P&L report retrieved successfully',
        data: {
          summaryCards,
          storePnlList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Store P&L Details (Drilldown by Store & Product Type)
 * GET /api/admin/reports/store-pnl/:storeId
 */
export const getStorePnLDetailReport = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { startDate, endDate, productTypeId } = req.query;

    const store = await Store.findById(storeId).lean();
    if (!store) {
      return next(notFound('Store not found'));
    }

    let currentStart = startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    let currentEnd = endDate ? new Date(endDate) : new Date();

    currentStart.setHours(0, 0, 0, 0);
    currentEnd.setHours(23, 59, 59, 999);

    const durationMs = currentEnd.getTime() - currentStart.getTime();
    const prevEnd = new Date(currentStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);

    const { priceMap, productTypeMap, productTypes } = await getProductMaps();

    // Product Type ID to Name Map
    const typeNameMap = {};
    for (const pt of productTypes) {
      typeNameMap[String(pt._id)] = pt.name;
    }

    const calculateStoreDetailMetrics = async (start, end) => {
      const orderQuery = { store: storeId, createdAt: { $gte: start, $lte: end } };
      const sellQuery = { store: storeId, isDeleted: false, billDate: { $gte: start, $lte: end } };

      const [orders, sellProducts] = await Promise.all([
        StoreOrder.find(orderQuery).lean(),
        SellProduct.find(sellQuery).lean(),
      ]);

      const typeMetricsMap = {};
      for (const pt of productTypes) {
        typeMetricsMap[String(pt._id)] = {
          productTypeId: String(pt._id),
          productType: pt.name,
          revenue: 0,
          cost: 0,
        };
      }

      let totalRevenue = 0;
      let totalCost = 0;

      const processItem = (pId, qty, saleAmount) => {
        const costPerUnit = priceMap[pId] !== undefined ? priceMap[pId] : Number(saleAmount / qty) * 0.67;
        const itemCost = qty * costPerUnit;
        const ptId = productTypeMap[pId] || null;

        totalRevenue += saleAmount;
        totalCost += itemCost;

        if (ptId && typeMetricsMap[ptId]) {
          typeMetricsMap[ptId].revenue += saleAmount;
          typeMetricsMap[ptId].cost += itemCost;
        } else {
          // Unassigned fallback
          const defaultPtId = String(productTypes[0]?._id || 'general');
          if (typeMetricsMap[defaultPtId]) {
            typeMetricsMap[defaultPtId].revenue += saleAmount;
            typeMetricsMap[defaultPtId].cost += itemCost;
          }
        }
      };

      for (const order of orders) {
        for (const bill of order.bills || []) {
          for (const item of bill.items || []) {
            const qty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
            if (qty <= 0) continue;
            const saleAmt = Number(item.totalAmount || (item.sellingPrice * qty));
            processItem(String(item.product), qty, saleAmt);
          }
        }
      }

      for (const sell of sellProducts) {
        for (const item of sell.items || []) {
          const qty = Number(item.quantity || 1);
          if (qty <= 0) continue;
          const saleAmt = Number(item.totalAmount || (item.sellingPrice * qty));
          processItem(String(item.product), qty, saleAmt);
        }
      }

      const netProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      return {
        totalRevenue,
        totalCost,
        netProfit,
        profitMargin,
        typeMetricsMap,
      };
    };

    const currentMetrics = await calculateStoreDetailMetrics(currentStart, currentEnd);
    const prevMetrics = await calculateStoreDetailMetrics(prevStart, prevEnd);

    const summaryCards = {
      totalRevenue: {
        value: parseFloat(currentMetrics.totalRevenue.toFixed(0)),
        formattedValue: `₹${currentMetrics.totalRevenue.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.totalRevenue, prevMetrics.totalRevenue),
      },
      productCost: {
        value: parseFloat(currentMetrics.totalCost.toFixed(0)),
        formattedValue: `₹${currentMetrics.totalCost.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.totalCost, prevMetrics.totalCost),
      },
      netProfit: {
        value: parseFloat(currentMetrics.netProfit.toFixed(0)),
        formattedValue: `₹${currentMetrics.netProfit.toLocaleString('en-IN')}`,
        growth: formatGrowth(currentMetrics.netProfit, prevMetrics.netProfit),
      },
      profitMargin: {
        value: parseFloat(currentMetrics.profitMargin.toFixed(2)),
        formattedValue: `${currentMetrics.profitMargin.toFixed(2)}%`,
        growth: formatGrowth(currentMetrics.profitMargin, prevMetrics.profitMargin),
      },
    };

    let breakdownList = Object.values(currentMetrics.typeMetricsMap).map((pt, index) => {
      const rev = pt.revenue;
      const cost = pt.cost;
      const profit = rev - cost;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;

      return {
        srNo: index + 1,
        productTypeId: pt.productTypeId,
        productType: pt.productType,
        revenue: parseFloat(rev.toFixed(0)),
        cost: parseFloat(cost.toFixed(0)),
        netProfit: parseFloat(profit.toFixed(0)),
        pnlMargin: parseFloat(margin.toFixed(2)),
        pnlMarginFormatted: `${margin.toFixed(2)}%`,
      };
    });

    if (productTypeId && productTypeId !== 'all' && productTypeId !== 'All') {
      breakdownList = breakdownList.filter(b => String(b.productTypeId) === String(productTypeId));
    }

    const totalSummary = {
      productType: 'Total',
      revenue: breakdownList.reduce((sum, b) => sum + b.revenue, 0),
      cost: breakdownList.reduce((sum, b) => sum + b.cost, 0),
      netProfit: breakdownList.reduce((sum, b) => sum + b.netProfit, 0),
      pnlMargin: currentMetrics.totalRevenue > 0
        ? parseFloat(((currentMetrics.netProfit / currentMetrics.totalRevenue) * 100).toFixed(2))
        : 0,
    };

    return res.status(200).json(
      successResponse({
        message: 'Store P&L detail report retrieved successfully',
        data: {
          store: {
            id: store._id,
            name: store.name,
            storeCode: store.storeCode,
            location: store.location,
          },
          summaryCards,
          productTypeBreakdown: breakdownList,
          totalSummary,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Export Report (Excel / CSV)
 * GET /api/admin/reports/export
 */
export const exportReport = async (req, res, next) => {
  try {
    const { type = 'sales-register', format = 'excel', startDate, endDate, storeId, productTypeId } = req.query;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Store Management System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Report');

    if (type === 'sales-register') {
      worksheet.columns = [
        { header: 'S.No.', key: 'sNo', width: 8 },
        { header: 'GSTIN/UIN of Customer', key: 'gstin', width: 22 },
        { header: 'Name of Customer', key: 'customer', width: 22 },
        { header: 'Invoice No.', key: 'invoiceNo', width: 20 },
        { header: 'Invoice Date', key: 'invoiceDate', width: 22 },
        { header: 'Invoice Value (₹)', key: 'invoiceValue', width: 18 },
        { header: 'HSN', key: 'hsn', width: 12 },
        { header: 'Product Name', key: 'productName', width: 25 },
        { header: 'Bill Type', key: 'billType', width: 15 },
      ];

      // Fetch data internally using report query
      req.query.limit = 5000;
      const resMock = {
        status: () => resMock,
        json: (data) => data,
      };

      // Inline query execution for exporter
      const regReport = await new Promise((resolve, reject) => {
        getSalesRegisterReport(req, {
          status: () => ({ json: resolve }),
        }, reject);
      });

      const details = regReport?.data?.allDetails || [];
      for (const d of details) {
        worksheet.addRow(d);
      }
    } else if (type === 'sales-summary') {
      worksheet.columns = [
        { header: 'Product Name', key: 'productName', width: 28 },
        { header: 'Unit', key: 'unit', width: 12 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Total Quantity', key: 'totalQuantity', width: 18 },
        { header: 'Total Sale Amount (₹)', key: 'totalSaleAmount', width: 22 },
      ];

      req.query.limit = 5000;
      const sumReport = await new Promise((resolve, reject) => {
        getSalesSummaryReport(req, {
          status: () => ({ json: resolve }),
        }, reject);
      });

      const list = sumReport?.data?.allProductSales || [];
      for (const item of list) {
        worksheet.addRow(item);
      }
      if (sumReport?.data?.totalSummary) {
        const tot = sumReport.data.totalSummary;
        worksheet.addRow({
          productName: 'Total',
          unit: '-',
          category: '-',
          totalQuantity: tot.totalQuantity,
          totalSaleAmount: tot.totalSaleAmount,
        });
      }
    } else if (type === 'store-pnl') {
      worksheet.columns = [
        { header: 'Sr.No.', key: 'srNo', width: 8 },
        { header: 'Store Name', key: 'storeName', width: 25 },
        { header: 'Total Revenue (₹)', key: 'totalRevenue', width: 20 },
        { header: 'Product Cost (₹)', key: 'productCost', width: 20 },
        { header: 'Net Profit (₹)', key: 'netProfit', width: 20 },
        { header: 'P&L Margin (%)', key: 'pnlMarginFormatted', width: 18 },
      ];

      const pnlReport = await new Promise((resolve, reject) => {
        getStorePnLReport(req, {
          status: () => ({ json: resolve }),
        }, reject);
      });

      const list = pnlReport?.data?.storePnlList || [];
      for (const item of list) {
        worksheet.addRow(item);
      }
    } else if (type === 'store-pnl-detail') {
      const targetStoreId = req.query.storeId || storeId;
      req.params = { storeId: targetStoreId };
      worksheet.columns = [
        { header: 'Sr.No.', key: 'srNo', width: 8 },
        { header: 'Product Type', key: 'productType', width: 25 },
        { header: 'Revenue (₹)', key: 'revenue', width: 20 },
        { header: 'Product Cost (₹)', key: 'cost', width: 20 },
        { header: 'Net Profit (₹)', key: 'netProfit', width: 20 },
        { header: 'P&L Margin (%)', key: 'pnlMarginFormatted', width: 18 },
      ];

      const pnlDetailReport = await new Promise((resolve, reject) => {
        getStorePnLDetailReport(req, {
          status: () => ({ json: resolve }),
        }, reject);
      });

      const list = pnlDetailReport?.data?.productTypeBreakdown || [];
      for (const item of list) {
        worksheet.addRow(item);
      }
      if (pnlDetailReport?.data?.totalSummary) {
        const tot = pnlDetailReport.data.totalSummary;
        worksheet.addRow({
          srNo: '-',
          productType: 'Total',
          revenue: tot.revenue,
          cost: tot.cost,
          netProfit: tot.netProfit,
          pnlMarginFormatted: `${tot.pnlMargin}%`,
        });
      }
    }

    // Apply header row styling
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'EA580C' },
    };

    // Format total summary row if present
    const lastRowIndex = worksheet.rowCount;
    if (lastRowIndex > 1) {
      const lastRow = worksheet.getRow(lastRowIndex);
      const firstCellVal = String(lastRow.getCell(1).value || '');
      const secondCellVal = String(lastRow.getCell(2).value || '');
      if (firstCellVal === 'Total' || secondCellVal === 'Total') {
        lastRow.font = { bold: true };
      }
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_report.csv"`);
      return await workbook.csv.write(res);
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_report.xlsx"`);

    const buffer = await workbook.xlsx.writeBuffer();
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

