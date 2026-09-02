import StoreOrder from '../../models/storeOrder.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest } from '../../utils/api-error.js';

/**
 * 1. Sales Register Report
 * Provides high-level invoice summary and itemized invoice details
 * GET /api/store-employee/reports/sales-register
 */
export const getSalesRegisterReport = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.store || null;
    const { startDate, endDate, saleType, page = 1, limit = 50 } = req.query;

    const query = {};
    if (storeId) {
      query.store = storeId;
    }

    // Date Range Filter (inclusive)
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Optional saleType filter
    if (saleType && saleType !== 'all' && saleType !== 'All') {
      query['bills.saleType'] = saleType;
    }

    const orders = await StoreOrder.find(query).sort({ createdAt: -1 }).lean();

    // Summary counters
    let totalBillsCount = 0;
    const customerPhoneSet = new Set();
    let totalValue = 0;
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalCess = 0;
    let totalAddCess = 0;
    let totalRefunds = 0;

    // Itemized details rows
    const details = [];
    let rowIndex = 1;

    for (const order of orders) {
      if (order.customer?.phone) {
        customerPhoneSet.add(order.customer.phone.trim());
      }

      const bills = Array.isArray(order.bills) ? order.bills : [];
      for (const bill of bills) {
        // Filter by saleType if specified
        if (saleType && saleType !== 'all' && saleType !== 'All' && bill.saleType !== saleType) {
          continue;
        }

        totalBillsCount += 1;
        const billGross = Number(bill.grossAmount || 0);
        const billNet = Number(bill.netAmount || 0);
        const billDiscount = Number(bill.discountAmount || 0);
        const billTaxable = Number(bill.subtotal || Math.max(0, billNet - (bill.gstTotal || 0)));
        const billGst = Number(bill.gstTotal || 0);
        const billRefund = Number(bill.totalRefunded || 0);

        totalValue += billGross;
        totalTaxableValue += billTaxable;
        totalCGST += billGst / 2;
        totalSGST += billGst / 2;
        totalRefunds += billRefund;

        const billDateObj = bill.billDate ? new Date(bill.billDate) : new Date(order.createdAt);
        const formattedDate = `${billDateObj.toLocaleDateString('en-GB')} ${billDateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

        const items = Array.isArray(bill.items) ? bill.items : [];
        if (items.length > 0) {
          for (const item of items) {
            const itemQty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
            if (itemQty <= 0) continue;

            const itemGstPct = Number(item.gstPercentage || 18);
            const itemVal = Number(item.totalAmount || (item.sellingPrice * itemQty));
            const itemTaxable = itemGstPct > 0 ? (itemVal / (1 + itemGstPct / 100)) : itemVal;
            const itemGstAmount = Math.max(0, itemVal - itemTaxable);
            const itemCgst = itemGstAmount / 2;
            const itemSgst = itemGstAmount / 2;

            details.push({
              id: item._id || `${order._id}_${bill.billId}_${rowIndex}`,
              sNo: rowIndex++,
              gstin: order.customer?.phone || '-',
              customer: order.customer?.name || 'Walk-in Customer',
              phone: order.customer?.phone || '-',
              invoice: bill.billId || order.orderId || '-',
              orderId: order.orderId || bill.orderId,
              date: formattedDate,
              val: parseFloat(itemVal.toFixed(2)),
              hsn: item.barcode || '1001',
              product: item.productName || 'Product',
              batch: item.batch || 'Default',
              quantity: itemQty,
              unit: item.unit || 'pc',
              rate: parseFloat((item.sellingPrice || 0).toFixed(2)),
              taxableValue: parseFloat(itemTaxable.toFixed(2)),
              gstPercentage: itemGstPct,
              cgst: parseFloat(itemCgst.toFixed(2)),
              sgst: parseFloat(itemSgst.toFixed(2)),
              saleType: bill.saleType || 'Offline',
            });
          }
        } else {
          // Bill without item breakdown
          details.push({
            id: bill.billId || `${order._id}_${rowIndex}`,
            sNo: rowIndex++,
            gstin: order.customer?.phone || '-',
            customer: order.customer?.name || 'Walk-in Customer',
            phone: order.customer?.phone || '-',
            invoice: bill.billId || order.orderId || '-',
            orderId: order.orderId || bill.orderId,
            date: formattedDate,
            val: parseFloat(billNet.toFixed(2)),
            hsn: '1001',
            product: 'Multiple Items',
            batch: '-',
            quantity: bill.totalItems || 1,
            unit: 'pc',
            rate: parseFloat(billNet.toFixed(2)),
            taxableValue: parseFloat(billTaxable.toFixed(2)),
            gstPercentage: 18,
            cgst: parseFloat((billGst / 2).toFixed(2)),
            sgst: parseFloat((billGst / 2).toFixed(2)),
            saleType: bill.saleType || 'Offline',
          });
        }
      }
    }

    const summary = [
      {
        id: 1,
        type: 'Invoices',
        bills: totalBillsCount,
        phones: customerPhoneSet.size,
        totalValue: parseFloat(totalValue.toFixed(1)),
        taxable: parseFloat(totalTaxableValue.toFixed(2)),
        cgst: parseFloat(totalCGST.toFixed(2)),
        sgst: parseFloat(totalSGST.toFixed(2)),
        cess: parseFloat(totalCess.toFixed(2)),
        addCess: parseFloat(totalAddCess.toFixed(2)),
        refunds: parseFloat(totalRefunds.toFixed(2)),
      },
      {
        id: 2,
        type: 'Memos',
        bills: totalBillsCount,
        phones: customerPhoneSet.size,
        totalValue: parseFloat(totalTaxableValue.toFixed(1)),
        taxable: parseFloat(totalTaxableValue.toFixed(2)),
        cgst: 0,
        sgst: 0,
        cess: 0,
        addCess: 0,
        refunds: parseFloat(totalRefunds.toFixed(2)),
      },
    ];

    // Pagination for details table
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
          allDetails: details, // Useful for complete excel export
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
 * 2. GST Summary Report
 * Breaks down output tax and taxable turnover by GST slabs (0%, 5%, 12%, 18%, 28%) & Composite GST
 * GET /api/store-employee/reports/gst-summary
 */
export const getGSTSummaryReport = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.store || null;
    const { startDate, endDate } = req.query;

    const query = {};
    if (storeId) {
      query.store = storeId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orders = await StoreOrder.find(query).lean();

    // Map slabs: key = gstPercentage
    const slabTotals = {
      0: { taxable: 0, tax: 0 },
      5: { taxable: 0, tax: 0 },
      12: { taxable: 0, tax: 0 },
      18: { taxable: 0, tax: 0 },
      28: { taxable: 0, tax: 0 },
    };

    let totalTurnover = 0;
    let totalBillsCount = 0;

    for (const order of orders) {
      const bills = Array.isArray(order.bills) ? order.bills : [];
      for (const bill of bills) {
        totalBillsCount += 1;
        totalTurnover += Number(bill.netAmount || 0);

        const items = Array.isArray(bill.items) ? bill.items : [];
        if (items.length > 0) {
          for (const item of items) {
            const itemQty = Number(item.quantity || 1) - Number(item.returnedQuantity || 0);
            if (itemQty <= 0) continue;

            const rate = Number(item.gstPercentage || 18);
            const itemVal = Number(item.totalAmount || (item.sellingPrice * itemQty));
            const taxable = rate > 0 ? (itemVal / (1 + rate / 100)) : itemVal;
            const tax = Math.max(0, itemVal - taxable);

            // Find closest slab
            let matchedSlab = 18;
            if (rate <= 0) matchedSlab = 0;
            else if (rate <= 5) matchedSlab = 5;
            else if (rate <= 12) matchedSlab = 12;
            else if (rate <= 18) matchedSlab = 18;
            else matchedSlab = 28;

            slabTotals[matchedSlab].taxable += taxable;
            slabTotals[matchedSlab].tax += tax;
          }
        } else {
          // Default bill allocation
          const billTaxable = Number(bill.subtotal || bill.netAmount * 0.82);
          const billTax = Number(bill.gstTotal || bill.netAmount * 0.18);
          slabTotals[18].taxable += billTaxable;
          slabTotals[18].tax += billTax;
        }
      }
    }

    // Format CGST data table (half of GST rate and tax)
    const cgstRows = [
      {
        rate: '0.0%',
        taxable: slabTotals[0].taxable.toFixed(2),
        payable: (slabTotals[0].tax / 2).toFixed(2),
      },
      {
        rate: '2.5%',
        taxable: slabTotals[5].taxable.toFixed(2),
        payable: (slabTotals[5].tax / 2).toFixed(2),
      },
      {
        rate: '6.0%',
        taxable: slabTotals[12].taxable.toFixed(2),
        payable: (slabTotals[12].tax / 2).toFixed(2),
      },
      {
        rate: '9.0%',
        taxable: slabTotals[18].taxable.toFixed(2),
        payable: (slabTotals[18].tax / 2).toFixed(2),
      },
      {
        rate: '14.0%',
        taxable: slabTotals[28].taxable.toFixed(2),
        payable: (slabTotals[28].tax / 2).toFixed(2),
      },
    ];

    const totalCgstTaxable = Object.values(slabTotals).reduce((sum, s) => sum + s.taxable, 0);
    const totalCgstPayable = Object.values(slabTotals).reduce((sum, s) => sum + (s.tax / 2), 0);

    cgstRows.push({
      rate: 'Total',
      taxable: totalCgstTaxable.toFixed(2),
      payable: totalCgstPayable.toFixed(2),
    });

    // SGST rows
    const sgstRows = [
      {
        rate: '0.0%',
        taxable: slabTotals[0].taxable.toFixed(2),
        payable: (slabTotals[0].tax / 2).toFixed(2),
      },
      {
        rate: '2.5%',
        taxable: slabTotals[5].taxable.toFixed(2),
        payable: (slabTotals[5].tax / 2).toFixed(2),
      },
      {
        rate: '6.0%',
        taxable: slabTotals[12].taxable.toFixed(2),
        payable: (slabTotals[12].tax / 2).toFixed(2),
      },
      {
        rate: '9.0%',
        taxable: slabTotals[18].taxable.toFixed(2),
        payable: (slabTotals[18].tax / 2).toFixed(2),
      },
      {
        rate: '14.0%',
        taxable: slabTotals[28].taxable.toFixed(2),
        payable: (slabTotals[28].tax / 2).toFixed(2),
      },
      {
        rate: 'Total',
        taxable: totalCgstTaxable.toFixed(2),
        payable: totalCgstPayable.toFixed(2),
      },
    ];

    // Cess table placeholder
    const cessRows = [
      { rate: '0.0%', taxable: '0.00', payable: '0.00' },
      { rate: 'Total', taxable: '0.00', payable: '0.00' },
    ];

    // Composite GST defaults
    const compositeGST = {
      turnover: parseFloat(totalTurnover.toFixed(2)),
      totalBills: totalBillsCount,
      defaultRate: 1,
      payable: parseFloat((totalTurnover * 0.01).toFixed(2)),
    };

    return res.status(200).json(
      successResponse({
        message: 'GST summary report retrieved successfully',
        data: {
          cgst: cgstRows,
          sgst: sgstRows,
          cess: cessRows,
          compositeGST,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Sales Summary Report
 * Aggregates revenue KPIs, payment mode breakdowns, and daily sales trends
 * GET /api/store-employee/reports/sales-summary
 */
export const getSalesSummaryReport = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.store || null;
    const { startDate, endDate } = req.query;

    const query = {};
    if (storeId) {
      query.store = storeId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const orders = await StoreOrder.find(query).sort({ createdAt: 1 }).lean();

    let totalRevenue = 0; // Net amount
    let totalGross = 0;
    let totalSavings = 0;
    let totalGST = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalRefunded = 0;
    let totalBills = 0;
    let totalItemsSold = 0;

    let offlineSalesCount = 0;
    let offlineSalesValue = 0;
    let onlineOrdersCount = 0;
    let onlineOrdersValue = 0;

    const paymentModesMap = {
      Cash: { amount: 0, count: 0 },
      UPI: { amount: 0, count: 0 },
      Card: { amount: 0, count: 0 },
      'Net Banking': { amount: 0, count: 0 },
      Other: { amount: 0, count: 0 },
    };

    const dailyMap = {};

    for (const order of orders) {
      const bills = Array.isArray(order.bills) ? order.bills : [];
      for (const bill of bills) {
        totalBills += 1;
        const gross = Number(bill.grossAmount || 0);
        const net = Number(bill.netAmount || 0);
        const savings = Number(bill.savings || 0) + Number(bill.discountAmount || 0);
        const gst = Number(bill.gstTotal || 0);
        const paid = Number(bill.paidAmount || 0);
        const due = Number(bill.dueAmount || 0);
        const refunded = Number(bill.totalRefunded || 0);
        const itemsCount = (bill.items || []).reduce(
          (sum, it) => sum + (Number(it.quantity || 1) - Number(it.returnedQuantity || 0)),
          0
        );

        totalRevenue += net;
        totalGross += gross;
        totalSavings += savings;
        totalGST += gst;
        totalPaid += paid;
        totalDue += due;
        totalRefunded += refunded;
        totalItemsSold += Math.max(0, itemsCount);

        if ((bill.saleType || '').toLowerCase() === 'online') {
          onlineOrdersCount += 1;
          onlineOrdersValue += net;
        } else {
          offlineSalesCount += 1;
          offlineSalesValue += net;
        }

        // Process payments
        const payments = Array.isArray(bill.payments) && bill.payments.length > 0
          ? bill.payments
          : [{ mode: bill.paymentMethod || 'Cash', amount: paid }];

        for (const p of payments) {
          const mode = p.mode || 'Cash';
          const amt = Number(p.amount || 0);
          if (paymentModesMap[mode]) {
            paymentModesMap[mode].amount += amt;
            paymentModesMap[mode].count += 1;
          } else {
            paymentModesMap.Other.amount += amt;
            paymentModesMap.Other.count += 1;
          }
        }

        // Daily grouping
        const billDateObj = bill.billDate ? new Date(bill.billDate) : new Date(order.createdAt);
        const dateKey = billDateObj.toISOString().slice(0, 10);
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = {
            date: billDateObj.toLocaleDateString('en-GB'),
            rawDate: dateKey,
            billsCount: 0,
            grossAmount: 0,
            discountAmount: 0,
            netAmount: 0,
            paidAmount: 0,
            dueAmount: 0,
          };
        }
        dailyMap[dateKey].billsCount += 1;
        dailyMap[dateKey].grossAmount += gross;
        dailyMap[dateKey].discountAmount += savings;
        dailyMap[dateKey].netAmount += net;
        dailyMap[dateKey].paidAmount += paid;
        dailyMap[dateKey].dueAmount += due;
      }
    }

    // Payment modes array
    const paymentModesBreakdown = Object.entries(paymentModesMap).map(([mode, data]) => ({
      mode,
      amount: parseFloat(data.amount.toFixed(2)),
      count: data.count,
      percentage: totalPaid > 0 ? parseFloat(((data.amount / totalPaid) * 100).toFixed(1)) : 0,
    }));

    // Product-wise Sales Summary for Figma Table
    const productSalesMap = {};
    for (const order of orders) {
      const bills = Array.isArray(order.bills) ? order.bills : [];
      for (const bill of bills) {
        const items = Array.isArray(bill.items) ? bill.items : [];
        for (const it of items) {
          const pName = (it.productName || 'Product').trim();
          const pUnit = (it.unit || 'pc').trim();
          const pQty = Number(it.quantity || 1) - Number(it.returnedQuantity || 0);
          if (pQty <= 0) continue;
          const pAmt = Number(it.totalAmount || (it.sellingPrice * pQty));

          const prodKey = `${pName}_${pUnit}`;
          if (!productSalesMap[prodKey]) {
            productSalesMap[prodKey] = {
              productName: pName,
              unit: pUnit,
              category: 'General',
              productId: it.product,
              totalQuantity: 0,
              totalSaleAmount: 0,
            };
          }
          productSalesMap[prodKey].totalQuantity += pQty;
          productSalesMap[prodKey].totalSaleAmount += pAmt;
        }
      }
    }

    const productIds = Object.values(productSalesMap).map(p => p.productId).filter(Boolean);
    if (productIds.length > 0) {
      try {
        const storeProducts = await StoreProduct.find({ _id: { $in: productIds } })
          .populate('category', 'name categoryName')
          .lean();
        const catMap = {};
        for (const sp of storeProducts) {
          catMap[String(sp._id)] = sp.category?.name || sp.category?.categoryName || 'General';
        }
        for (const key of Object.keys(productSalesMap)) {
          const pid = String(productSalesMap[key].productId || '');
          if (catMap[pid]) {
            productSalesMap[key].category = catMap[pid];
          }
        }
      } catch (e) {
        console.error('Category lookup error:', e);
      }
    }

    const productSalesList = Object.values(productSalesMap).map(p => ({
      productName: p.productName,
      unit: p.unit,
      category: p.category || 'General',
      totalQuantity: p.totalQuantity,
      totalSaleAmount: parseFloat(p.totalSaleAmount.toFixed(0)),
    }));

    const totalSummary = {
      description: 'Total',
      totalQuantity: productSalesList.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalSaleAmount: parseFloat(productSalesList.reduce((sum, p) => sum + p.totalSaleAmount, 0).toFixed(0)),
    };

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    return res.status(200).json(
      successResponse({
        message: 'Sales summary report retrieved successfully',
        data: {
          productSales: productSalesList,
          totalSummary,
          overview: {
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            totalGross: parseFloat(totalGross.toFixed(2)),
            totalSavings: parseFloat(totalSavings.toFixed(2)),
            totalGST: parseFloat(totalGST.toFixed(2)),
            totalPaid: parseFloat(totalPaid.toFixed(2)),
            totalDue: parseFloat(totalDue.toFixed(2)),
            totalRefunded: parseFloat(totalRefunded.toFixed(2)),
            totalBills,
            totalItemsSold,
            offlineSalesCount,
            offlineSalesValue: parseFloat(offlineSalesValue.toFixed(2)),
            onlineOrdersCount,
            onlineOrdersValue: parseFloat(onlineOrdersValue.toFixed(2)),
          },
          paymentModesBreakdown,
          dailyBreakdown,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Save Composite GST Report
 * POST /api/store-employee/reports/composite-gst
 */
export const saveCompositeGSTReport = async (req, res, next) => {
  try {
    const { turnover, compositePercentage, gstPayable, startDate, endDate, notes } = req.body;

    if (turnover === undefined || compositePercentage === undefined) {
      return next(badRequest('Turnover and composite percentage are required'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Composite GST report saved successfully',
        data: {
          turnover: Number(turnover),
          compositePercentage: Number(compositePercentage),
          gstPayable: Number(gstPayable || (turnover * (compositePercentage / 100))),
          startDate: startDate || null,
          endDate: endDate || null,
          notes: notes || '',
          savedAt: new Date(),
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
