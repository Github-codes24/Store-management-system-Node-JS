import StoreProduct from '../models/storeProduct.model.js';
import AdminProduct from '../models/adminProduct.model.js';
import Category from '../models/category.model.js';

export const isValidObjectId = (val) => {
  if (!val) return false;
  const str = typeof val === 'object' && val._id ? val._id.toString() : val.toString();
  return /^[0-9a-fA-F]{24}$/.test(str);
};

export const extractIdString = (val) => {
  if (!val) return null;
  if (typeof val === 'object') {
    if (val._id) return val._id.toString();
    if (val.id) return val.id.toString();
  }
  return val.toString();
};

/**
 * Enriches offer documents by resolving buyProduct, freeProduct, and products array
 * into human-readable product names and structured objects, falling back to StoreProduct,
 * AdminProduct, or Category as needed.
 */
export const enrichOffersWithProducts = async (rawOffers) => {
  const isArray = Array.isArray(rawOffers);
  const offersList = isArray ? rawOffers : [rawOffers];
  if (!offersList || offersList.length === 0 || !offersList[0]) {
    return isArray ? [] : null;
  }

  // 1. Gather all potential 24-hex IDs from buyProduct, freeProduct, and products
  const idSet = new Set();

  offersList.forEach((off) => {
    if (!off) return;
    const doc = typeof off.toObject === 'function' ? off.toObject() : off;

    const buyProdId = extractIdString(doc.buyDetails?.buyProduct);
    if (isValidObjectId(buyProdId)) idSet.add(buyProdId);

    const freeProdId = extractIdString(doc.getFreeDetails?.freeProduct);
    if (isValidObjectId(freeProdId)) idSet.add(freeProdId);

    if (Array.isArray(doc.products)) {
      doc.products.forEach((p) => {
        const pId = extractIdString(p);
        if (isValidObjectId(pId)) idSet.add(pId);
      });
    }

    if (Array.isArray(doc.productPricing)) {
      doc.productPricing.forEach((pp) => {
        const pId = extractIdString(pp.product);
        if (isValidObjectId(pId)) idSet.add(pId);
      });
    }
  });

  const ids = Array.from(idSet);
  const lookupMap = new Map();

  if (ids.length > 0) {
    // 2. Query StoreProduct, AdminProduct, Category in parallel
    const [storeProducts, adminProducts, categories] = await Promise.all([
      StoreProduct.find({ _id: { $in: ids } })
        .select('_id productName barcode name mrp offlineSellingPrice onlineSellingPrice purchasePrice sellingPrice')
        .lean(),
      AdminProduct.find({ _id: { $in: ids } })
        .select('_id productName name barcode mrp sellingPrice')
        .lean(),
      Category.find({ _id: { $in: ids } }).select('_id name').lean(),
    ]);

    storeProducts.forEach((p) => {
      const name = p.productName || p.name || '';
      const mrp = Number(p.mrp) || 0;
      const originalSellingPrice = Number(
        p.offlineSellingPrice !== undefined && p.offlineSellingPrice !== null
          ? p.offlineSellingPrice
          : (p.onlineSellingPrice || p.mrp || 0)
      );
      lookupMap.set(p._id.toString(), {
        _id: p._id,
        id: p._id.toString(),
        productName: name,
        name,
        barcode: p.barcode || '',
        mrp,
        originalSellingPrice,
        sellingPrice: originalSellingPrice,
        offlineSellingPrice: originalSellingPrice,
        purchasePrice: Number(p.purchasePrice) || 0,
        type: 'product',
      });
    });

    adminProducts.forEach((p) => {
      const id = p._id.toString();
      if (!lookupMap.has(id)) {
        const name = p.productName || p.name || '';
        const mrp = Number(p.mrp) || 0;
        const originalSellingPrice = Number(p.sellingPrice || p.mrp || 0);
        lookupMap.set(id, {
          _id: p._id,
          id: p._id.toString(),
          productName: name,
          name,
          barcode: p.barcode || '',
          mrp,
          originalSellingPrice,
          sellingPrice: originalSellingPrice,
          offlineSellingPrice: originalSellingPrice,
          purchasePrice: 0,
          type: 'product',
        });
      }
    });

    categories.forEach((c) => {
      const id = c._id.toString();
      if (!lookupMap.has(id)) {
        const name = `All ${c.name}`;
        lookupMap.set(id, {
          _id: c._id,
          id: c._id.toString(),
          productName: name,
          name,
          type: 'category',
        });
      }
    });
  }

  // 3. Enrich each offer
  const enriched = offersList.map((off) => {
    if (!off) return null;
    const item = typeof off.toObject === 'function' ? off.toObject() : { ...off };

    const pricingMap = new Map();
    if (Array.isArray(item.productPricing)) {
      item.productPricing.forEach((pp) => {
        const pId = extractIdString(pp.product);
        if (pId) pricingMap.set(pId, pp);
      });
    }

    // Resolve buyProduct
    if (item.buyDetails) {
      item.buyDetails = { ...item.buyDetails };
      const rawBuy = item.buyDetails.buyProduct;
      const buyId = extractIdString(rawBuy);
      const baseInfo = (buyId && lookupMap.get(buyId)) || (rawBuy && typeof rawBuy === 'object' ? rawBuy : {}) || {};
      const pricingInfo = buyId ? pricingMap.get(buyId) : null;

      const mrp = Number(pricingInfo?.mrp !== undefined ? pricingInfo.mrp : (baseInfo.mrp || rawBuy?.mrp || 0));
      const originalSellingPrice = Number(
        pricingInfo?.originalSellingPrice !== undefined
          ? pricingInfo.originalSellingPrice
          : (baseInfo.offlineSellingPrice || baseInfo.sellingPrice || rawBuy?.offlineSellingPrice || rawBuy?.sellingPrice || mrp)
      );
      const updatedSellingPrice = pricingInfo && pricingInfo.updatedSellingPrice !== undefined
        ? Number(pricingInfo.updatedSellingPrice)
        : originalSellingPrice;

      const name = rawBuy?.productName || rawBuy?.name || baseInfo.productName || baseInfo.name || '';
      const barcode = rawBuy?.barcode || baseInfo.barcode || '';

      item.buyDetails.buyProduct = {
        _id: rawBuy?._id || buyId,
        id: (rawBuy?._id || buyId)?.toString(),
        productName: name,
        name,
        barcode,
        mrp,
        originalSellingPrice,
        offlineSellingPrice: originalSellingPrice,
        updatedSellingPrice,
        sellingPrice: updatedSellingPrice,
        price: updatedSellingPrice,
        offerBasePrice: updatedSellingPrice,
        promotionalSellingPrice: updatedSellingPrice,
        offerPrice: updatedSellingPrice,
        offerSellingPrice: updatedSellingPrice,
        offerSP: updatedSellingPrice,
        specialPrice: updatedSellingPrice,
      };

      item.buyDetails.updatedSellingPrice = updatedSellingPrice;
      item.buyDetails.sellingPrice = updatedSellingPrice;
      item.buyDetails.price = updatedSellingPrice;
      item.buyDetails.offerBasePrice = updatedSellingPrice;
      item.buyDetails.promotionalSellingPrice = updatedSellingPrice;
      item.buyDetails.offerPrice = updatedSellingPrice;
      item.buyDetails.offerSellingPrice = updatedSellingPrice;
      item.buyDetails.offerSP = updatedSellingPrice;
      item.buyDetails.specialPrice = updatedSellingPrice;
    }

    // Resolve freeProduct
    if (item.getFreeDetails) {
      item.getFreeDetails = { ...item.getFreeDetails };
      const rawFree = item.getFreeDetails.freeProduct;
      const freeId = extractIdString(rawFree);
      const baseInfo = (freeId && lookupMap.get(freeId)) || (rawFree && typeof rawFree === 'object' ? rawFree : {}) || {};
      const pricingInfo = freeId ? pricingMap.get(freeId) : null;

      const mrp = Number(pricingInfo?.mrp !== undefined ? pricingInfo.mrp : (baseInfo.mrp || rawFree?.mrp || 0));
      const originalSellingPrice = Number(
        pricingInfo?.originalSellingPrice !== undefined
          ? pricingInfo.originalSellingPrice
          : (baseInfo.offlineSellingPrice || baseInfo.sellingPrice || rawFree?.offlineSellingPrice || rawFree?.sellingPrice || mrp)
      );
      const updatedSellingPrice = pricingInfo && pricingInfo.updatedSellingPrice !== undefined
        ? Number(pricingInfo.updatedSellingPrice)
        : 0;

      const name = rawFree?.productName || rawFree?.name || baseInfo.productName || baseInfo.name || '';
      const barcode = rawFree?.barcode || baseInfo.barcode || '';

      item.getFreeDetails.freeProduct = {
        _id: rawFree?._id || freeId,
        id: (rawFree?._id || freeId)?.toString(),
        productName: name,
        name,
        barcode,
        mrp,
        originalSellingPrice,
        offlineSellingPrice: originalSellingPrice,
        updatedSellingPrice,
        sellingPrice: updatedSellingPrice,
        price: updatedSellingPrice,
        offerBasePrice: updatedSellingPrice,
        promotionalSellingPrice: updatedSellingPrice,
        offerPrice: updatedSellingPrice,
        offerSellingPrice: updatedSellingPrice,
        offerSP: updatedSellingPrice,
        specialPrice: updatedSellingPrice,
      };

      item.getFreeDetails.updatedSellingPrice = updatedSellingPrice;
      item.getFreeDetails.sellingPrice = updatedSellingPrice;
      item.getFreeDetails.price = updatedSellingPrice;
      item.getFreeDetails.offerBasePrice = updatedSellingPrice;
      item.getFreeDetails.promotionalSellingPrice = updatedSellingPrice;
      item.getFreeDetails.offerPrice = updatedSellingPrice;
      item.getFreeDetails.offerSellingPrice = updatedSellingPrice;
      item.getFreeDetails.offerSP = updatedSellingPrice;
      item.getFreeDetails.specialPrice = updatedSellingPrice;
    }

    // Enrich productPricing items with all aliases
    if (Array.isArray(item.productPricing)) {
      item.productPricing = item.productPricing.map((pp) => {
        const pId = extractIdString(pp.product);
        const baseInfo = (pId && lookupMap.get(pId)) || {};
        const name = pp.productName || baseInfo.productName || baseInfo.name || 'Product';
        const barcode = pp.barcode || baseInfo.barcode || '';
        const mrp = Number(pp.mrp !== undefined ? pp.mrp : (baseInfo.mrp || 0));
        const originalSellingPrice = Number(
          pp.originalSellingPrice !== undefined
            ? pp.originalSellingPrice
            : (baseInfo.offlineSellingPrice || baseInfo.sellingPrice || mrp)
        );
        const updatedSellingPrice = Number(
          pp.updatedSellingPrice !== undefined
            ? pp.updatedSellingPrice
            : (pp.offerBasePrice !== undefined
                ? pp.offerBasePrice
                : (pp.price !== undefined ? pp.price : (pp.offerPrice !== undefined ? pp.offerPrice : pp.sellingPrice)))
        );

        return {
          ...pp,
          product: pId || pp.product,
          productId: pId || pp.product,
          id: pId || pp.product,
          _id: pId || pp.product,
          productName: name,
          name,
          barcode,
          mrp,
          originalSellingPrice,
          offlineSellingPrice: originalSellingPrice,
          updatedSellingPrice,
          sellingPrice: updatedSellingPrice,
          price: updatedSellingPrice,
          offerBasePrice: updatedSellingPrice,
          promotionalSellingPrice: updatedSellingPrice,
          offerPrice: updatedSellingPrice,
          offerSellingPrice: updatedSellingPrice,
          offerSP: updatedSellingPrice,
          specialPrice: updatedSellingPrice,
        };
      });
    }

    // Resolve products array
    const resolvedProductNames = [];
    const resolvedProducts = [];

    if (Array.isArray(item.products)) {
      item.products.forEach((p) => {
        const pId = extractIdString(p);
        const baseInfo = (pId && lookupMap.get(pId)) || {};
        const pricingInfo = pId ? pricingMap.get(pId) : null;
        const name = (typeof p === 'object' && (p.productName || p.name)) ? (p.productName || p.name) : (baseInfo.productName || baseInfo.name || p);
        const mrp = Number(pricingInfo?.mrp !== undefined ? pricingInfo.mrp : (baseInfo.mrp || 0));
        const originalSellingPrice = Number(
          pricingInfo?.originalSellingPrice !== undefined
            ? pricingInfo.originalSellingPrice
            : (baseInfo.offlineSellingPrice || baseInfo.sellingPrice || mrp)
        );
        const updatedSellingPrice = pricingInfo && pricingInfo.updatedSellingPrice !== undefined
          ? Number(pricingInfo.updatedSellingPrice)
          : originalSellingPrice;

        resolvedProducts.push({
          _id: isValidObjectId(pId) ? pId : (p._id || null),
          id: pId || p,
          productName: name,
          name,
          barcode: baseInfo.barcode || (typeof p === 'object' ? p.barcode : '') || '',
          mrp,
          originalSellingPrice,
          offlineSellingPrice: originalSellingPrice,
          updatedSellingPrice,
          sellingPrice: updatedSellingPrice,
          price: updatedSellingPrice,
          offerBasePrice: updatedSellingPrice,
          promotionalSellingPrice: updatedSellingPrice,
          type: baseInfo.type || 'product',
        });
        resolvedProductNames.push(name);
      });
    }

    if (resolvedProductNames.length === 0 && Array.isArray(item.productPricing) && item.productPricing.length > 0) {
      item.productPricing.forEach((pp) => {
        const name = pp.productName || (pp.product && lookupMap.get(extractIdString(pp.product))?.productName);
        if (name && !resolvedProductNames.includes(name)) {
          resolvedProductNames.push(name);
        }
      });
    }

    item.resolvedProducts = resolvedProducts;

    // Build human-friendly product label
    const buyProdName = item.buyDetails?.buyProduct?.productName || item.buyDetails?.buyProduct?.name;
    const freeProdName = item.getFreeDetails?.freeProduct?.productName || item.getFreeDetails?.freeProduct?.name;

    let computedProductLabel = 'All Product';
    if (item.discountType === 'bogo') {
      computedProductLabel = buyProdName || freeProdName || (resolvedProductNames.length > 0 ? resolvedProductNames.join(', ') : 'All Product');
    } else if (item.discountType === 'bxgy') {
      if (buyProdName && freeProdName) {
        computedProductLabel = `${buyProdName} -> Free: ${freeProdName}`;
      } else {
        computedProductLabel = buyProdName || freeProdName || 'All Product';
      }
    } else if (resolvedProductNames.length > 0) {
      computedProductLabel = resolvedProductNames.join(', ');
    } else if (item.products && item.products.length > 0) {
      computedProductLabel = item.products.join(', ');
    }

    item.product = computedProductLabel;
    item.productLabel = computedProductLabel;

    return item;
  });

  return isArray ? enriched : enriched[0];
};

/**
 * Returns a Map of productId -> promotional pricing metadata for all active offers
 * matching the given storeId and current validity window.
 */
export const getActiveProductPricingMap = async (storeId = null) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const pricingMap = new Map();

  try {
    const Offer = (await import('../models/offer.model.js')).default;
    const storeFilter = storeId
      ? { $or: [{ stores: storeId }, { applyToAllStores: true }] }
      : {};

    const activeOffers = await Offer.find({
      status: 'active',
      isDeleted: false,
      validFrom: { $lte: endOfToday },
      validTo: { $gte: startOfToday },
      'productPricing.0': { $exists: true },
      ...storeFilter,
    }).sort({ createdAt: -1 }).lean();

    for (const off of activeOffers) {
      if (Array.isArray(off.productPricing)) {
        for (const pp of off.productPricing) {
          const pId = extractIdString(pp.product);
          if (pId && !pricingMap.has(pId) && pp.updatedSellingPrice !== undefined && Number(pp.updatedSellingPrice) > 0) {
            pricingMap.set(pId, {
              updatedSellingPrice: Number(pp.updatedSellingPrice),
              originalSellingPrice: Number(pp.originalSellingPrice) || undefined,
              mrp: Number(pp.mrp) || undefined,
              offerId: off._id,
              offerName: off.name,
              discountType: off.discountType,
              discountValue: off.discountValue,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error in getActiveProductPricingMap:', err);
  }

  return pricingMap;
};

/**
 * Builds comprehensive performance, sales, and profit/loss report data for a specific offer.
 * Calculates both positive margins (profit) and negative margins (loss) accurately.
 */
export const buildOfferPerformanceData = async (offerDoc, storeId = null) => {
  if (!offerDoc) return null;
  const offer = typeof offerDoc.toObject === 'function' ? offerDoc.toObject() : offerDoc;

  const now = new Date();
  const validFromDate = offer.validFrom ? new Date(offer.validFrom) : null;
  const validToDate = offer.validTo ? new Date(offer.validTo) : null;
  const isExpired = validToDate && validToDate < now;
  const isPaused = offer.status === 'inactive' && !isExpired;
  const displayStatus = isExpired ? 'Expired' : (offer.status === 'active' ? 'Active' : 'Inactive');

  const formatDateStr = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const validFromFormatted = formatDateStr(validFromDate);
  const validToFormatted = formatDateStr(validToDate);

  let statusNote = '';
  if (isExpired) {
    statusNote = `Offer Expired on ${validToFormatted} (Final Lifetime Report): This offer has expired. The metrics above represent the final lifetime report for this offer period. Counter billing at POS has automatically reverted to the regular Selling Price.`;
  } else if (isPaused) {
    statusNote = `Offer is Currently Inactive / Paused: This offer was manually turned off. While inactive, products are billed at regular Selling Price at the POS counter. The data above reflects sales while the offer was active. You can re-activate it anytime using the toggle switch in the table.`;
  } else {
    statusNote = `Offer is Currently Active: Profit per unit is calculated as Updated Selling Price - Purchasing Price. Live units sold, revenue, and realized profit will automatically accumulate here as items are billed at the POS counter.`;
  }

  // 1. Gather all product IDs and pricing info from this offer
  const productInfoMap = new Map();

  // If productPricing is set
  if (Array.isArray(offer.productPricing)) {
    for (const pp of offer.productPricing) {
      const pId = extractIdString(pp.product);
      if (pId) {
        productInfoMap.set(pId, {
          productId: pId,
          productName: pp.productName || '',
          barcode: pp.barcode || '',
          mrp: Number(pp.mrp) || 0,
          originalSellingPrice: Number(pp.originalSellingPrice) || 0,
          updatedSellingPrice: Number(pp.updatedSellingPrice !== undefined ? pp.updatedSellingPrice : pp.originalSellingPrice || 0),
        });
      }
    }
  }

  // If buyDetails / getFreeDetails is set (BOGO / BXGY)
  const buyProdId = extractIdString(offer.buyDetails?.buyProduct);
  if (buyProdId && !productInfoMap.has(buyProdId)) {
    productInfoMap.set(buyProdId, {
      productId: buyProdId,
      productName: offer.buyDetails?.buyProduct?.productName || '',
      barcode: offer.buyDetails?.buyProduct?.barcode || '',
      mrp: Number(offer.buyDetails?.buyProduct?.mrp) || 0,
      originalSellingPrice: Number(offer.buyDetails?.buyProduct?.offlineSellingPrice || offer.buyDetails?.buyProduct?.sellingPrice) || 0,
      updatedSellingPrice: Number(offer.buyDetails?.buyProduct?.offlineSellingPrice || offer.buyDetails?.buyProduct?.sellingPrice) || 0,
    });
  }

  const freeProdId = extractIdString(offer.getFreeDetails?.freeProduct);
  if (freeProdId && !productInfoMap.has(freeProdId)) {
    productInfoMap.set(freeProdId, {
      productId: freeProdId,
      productName: offer.getFreeDetails?.freeProduct?.productName || '',
      barcode: offer.getFreeDetails?.freeProduct?.barcode || '',
      mrp: Number(offer.getFreeDetails?.freeProduct?.mrp) || 0,
      originalSellingPrice: Number(offer.getFreeDetails?.freeProduct?.offlineSellingPrice || offer.getFreeDetails?.freeProduct?.sellingPrice) || 0,
      updatedSellingPrice: 0,
    });
  }

  // If products array is set
  if (Array.isArray(offer.products)) {
    for (const p of offer.products) {
      const pId = extractIdString(p);
      if (pId && !productInfoMap.has(pId)) {
        productInfoMap.set(pId, {
          productId: pId,
          productName: p.productName || '',
          barcode: p.barcode || '',
          mrp: Number(p.mrp) || 0,
          originalSellingPrice: Number(p.offlineSellingPrice || p.sellingPrice) || 0,
          updatedSellingPrice: Number(p.offlineSellingPrice || p.sellingPrice) || 0,
        });
      }
    }
  }

  // 2. Fetch full product docs for purchasingPrice, accurate mrp, etc.
  const allProdIds = Array.from(productInfoMap.keys()).filter(isValidObjectId);
  if (allProdIds.length > 0) {
    const [storeProds, adminProds] = await Promise.all([
      StoreProduct.find({ _id: { $in: allProdIds } }).lean(),
      AdminProduct.find({ _id: { $in: allProdIds } }).lean(),
    ]);

    const docMap = new Map();
    storeProds.forEach((p) => docMap.set(String(p._id), p));
    adminProds.forEach((p) => {
      if (!docMap.has(String(p._id))) docMap.set(String(p._id), p);
    });

    for (const [pId, info] of productInfoMap.entries()) {
      const doc = docMap.get(pId);
      if (doc) {
        info.productName = info.productName || doc.productName || doc.name || 'Product';
        info.barcode = info.barcode || doc.barcode || '';
        info.mrp = info.mrp || Number(doc.mrp) || 0;
        info.purchasingPrice = Number(doc.purchasePrice) || 0;
        info.sellingPrice = Number(doc.offlineSellingPrice !== undefined ? doc.offlineSellingPrice : (doc.sellingPrice || doc.mrp || 0));
        if (info.updatedSellingPrice === undefined || isNaN(info.updatedSellingPrice)) {
          info.updatedSellingPrice = info.sellingPrice;
        }
      } else {
        info.purchasingPrice = 0;
        info.sellingPrice = info.originalSellingPrice || info.updatedSellingPrice || 0;
      }
    }
  }

  const isStoreWideAllProducts = productInfoMap.size === 0;

  // 3. Query StoreOrder for sales under this offer
  const StoreOrder = (await import('../models/storeOrder.model.js')).default;

  const orderQuery = {
    isDeleted: { $ne: true },
    'bills.offerId': offer._id,
  };

  if (storeId) {
    orderQuery.store = storeId;
  }

  const matchingOrders = await StoreOrder.find(orderQuery).lean();

  let totalSold = 0;
  let totalRevenue = 0;
  let totalDiscountGiven = 0;
  let totalCost = 0;
  let totalBillsCount = 0;

  const salesMap = new Map();
  for (const pId of productInfoMap.keys()) {
    salesMap.set(pId, { unitsSold: 0, revenue: 0, cost: 0 });
  }

  for (const order of matchingOrders) {
    if (Array.isArray(order.bills)) {
      for (const bill of order.bills) {
        const billMatchesOffer = String(bill.offerId) === String(offer._id);
        if (!billMatchesOffer) continue;

        totalBillsCount++;
        totalDiscountGiven += Number(bill.discountAmount) || 0;

        if (Array.isArray(bill.items)) {
          for (const item of bill.items) {
            const pId = String(item.product);
            const qty = Math.max(0, (Number(item.quantity) || 0) - (Number(item.returnedQuantity) || 0));
            const itemRev = Number(item.totalAmount !== undefined ? item.totalAmount : (item.sellingPrice * qty)) || 0;
            const itemCost = (Number(item.purchasePrice) || (productInfoMap.get(pId)?.purchasingPrice) || 0) * qty;

            if (productInfoMap.has(pId)) {
              totalSold += qty;
              totalRevenue += itemRev;
              totalCost += itemCost;

              const s = salesMap.get(pId);
              s.unitsSold += qty;
              s.revenue += itemRev;
              s.cost += itemCost;
            } else if (isStoreWideAllProducts) {
              totalSold += qty;
              totalRevenue += itemRev;
              totalCost += itemCost;
            }
          }
        }
      }
    }
  }

  // 4. Build productBreakdown array
  const productBreakdown = [];

  if (isStoreWideAllProducts) {
    productBreakdown.push({
      product: 'All Products',
      productName: 'All Products',
      barcode: '—',
      mrp: 0,
      purchasingPrice: 0,
      sellingPrice: 0,
      updatedSellingPrice: 0,
      profitPerUnit: 0,
      isUnitLoss: false,
      unitMargin: 0,
      unitMarginPercentage: 0,
      unitsSold: totalSold,
      revenue: parseFloat(totalRevenue.toFixed(2)),
      realizedProfit: parseFloat((totalRevenue - totalCost).toFixed(2)),
      isRealizedLoss: (totalRevenue - totalCost) < 0,
      statusText: displayStatus,
    });
  } else {
    for (const [pId, info] of productInfoMap.entries()) {
      const stats = salesMap.get(pId) || { unitsSold: 0, revenue: 0, cost: 0 };
      const purchasingPrice = Number(info.purchasingPrice || 0);
      const updatedSellingPrice = Number(info.updatedSellingPrice !== undefined ? info.updatedSellingPrice : info.sellingPrice);
      const profitPerUnit = parseFloat((updatedSellingPrice - purchasingPrice).toFixed(2));
      const isUnitLoss = profitPerUnit < 0;
      const unitMargin = updatedSellingPrice > 0
        ? parseFloat(((profitPerUnit / updatedSellingPrice) * 100).toFixed(2))
        : (purchasingPrice > 0 ? -100 : 0);

      const realizedProfit = parseFloat((stats.revenue - stats.cost).toFixed(2));
      const isRealizedLoss = realizedProfit < 0;

      productBreakdown.push({
        product: info.productName || 'Product',
        productName: info.productName || 'Product',
        productId: pId,
        id: pId,
        barcode: info.barcode || '',
        mrp: info.mrp || 0,
        purchasingPrice,
        sellingPrice: info.sellingPrice,
        updatedSellingPrice,
        profitPerUnit,
        isUnitLoss,
        unitMargin,
        unitMarginPercentage: unitMargin,
        unitsSold: stats.unitsSold,
        revenue: parseFloat(stats.revenue.toFixed(2)),
        realizedProfit,
        isRealizedLoss,
        statusText: displayStatus,
      });
    }
  }

  const netProfit = parseFloat((totalRevenue - totalCost).toFixed(2));
  const isLoss = netProfit < 0;
  const marginPercentage = totalRevenue > 0
    ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2))
    : 0;

  return {
    offer: {
      id: offer._id,
      _id: offer._id,
      name: offer.name,
      description: offer.description,
      offerType: offer.offerType,
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      status: displayStatus,
      displayStatus,
      isExpired,
      isPaused,
      validFrom: offer.validFrom,
      validTo: offer.validTo,
      validFromFormatted,
      validToFormatted,
      duration: `${validFromFormatted} -> ${validToFormatted}`,
      statusNote,
    },
    summary: {
      totalSold,
      totalSoldUnit: 'pc',
      totalBills: totalBillsCount,
      totalBillsCount,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      discountGiven: parseFloat(totalDiscountGiven.toFixed(2)),
      totalDiscountGiven: parseFloat(totalDiscountGiven.toFixed(2)),
      netProfit,
      netProfitEarned: netProfit,
      isLoss,
      margin: marginPercentage,
      marginPercentage,
    },
    productBreakdown,
    products: productBreakdown,
    totalProductsInOffer: productBreakdown.length,
  };
};

