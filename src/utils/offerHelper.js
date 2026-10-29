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
      StoreProduct.find({ _id: { $in: ids } }).select('_id productName barcode name').lean(),
      AdminProduct.find({ _id: { $in: ids } }).select('_id productName name barcode').lean(),
      Category.find({ _id: { $in: ids } }).select('_id name').lean(),
    ]);

    storeProducts.forEach((p) => {
      const name = p.productName || p.name || '';
      lookupMap.set(p._id.toString(), {
        _id: p._id,
        id: p._id.toString(),
        productName: name,
        name,
        barcode: p.barcode || '',
        type: 'product',
      });
    });

    adminProducts.forEach((p) => {
      const id = p._id.toString();
      if (!lookupMap.has(id)) {
        const name = p.productName || p.name || '';
        lookupMap.set(id, {
          _id: p._id,
          id: p._id.toString(),
          productName: name,
          name,
          barcode: p.barcode || '',
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

    // Resolve buyProduct
    if (item.buyDetails) {
      item.buyDetails = { ...item.buyDetails };
      const rawBuy = item.buyDetails.buyProduct;
      const buyId = extractIdString(rawBuy);

      if (rawBuy && typeof rawBuy === 'object' && (rawBuy.productName || rawBuy.name)) {
        const name = rawBuy.productName || rawBuy.name;
        item.buyDetails.buyProduct = {
          _id: rawBuy._id || buyId,
          id: (rawBuy._id || buyId)?.toString(),
          productName: name,
          name,
          barcode: rawBuy.barcode || '',
        };
      } else if (buyId && lookupMap.has(buyId)) {
        item.buyDetails.buyProduct = lookupMap.get(buyId);
      }
    }

    // Resolve freeProduct
    if (item.getFreeDetails) {
      item.getFreeDetails = { ...item.getFreeDetails };
      const rawFree = item.getFreeDetails.freeProduct;
      const freeId = extractIdString(rawFree);

      if (rawFree && typeof rawFree === 'object' && (rawFree.productName || rawFree.name)) {
        const name = rawFree.productName || rawFree.name;
        item.getFreeDetails.freeProduct = {
          _id: rawFree._id || freeId,
          id: (rawFree._id || freeId)?.toString(),
          productName: name,
          name,
          barcode: rawFree.barcode || '',
        };
      } else if (freeId && lookupMap.has(freeId)) {
        item.getFreeDetails.freeProduct = lookupMap.get(freeId);
      }
    }

    // Resolve products array
    const resolvedProductNames = [];
    const resolvedProducts = [];

    if (Array.isArray(item.products)) {
      item.products.forEach((p) => {
        const pId = extractIdString(p);
        if (pId && lookupMap.has(pId)) {
          const resolvedObj = lookupMap.get(pId);
          resolvedProducts.push(resolvedObj);
          resolvedProductNames.push(resolvedObj.productName);
        } else if (typeof p === 'object' && (p.productName || p.name)) {
          const name = p.productName || p.name;
          resolvedProducts.push({
            _id: p._id || pId,
            id: (p._id || pId)?.toString(),
            productName: name,
            name,
          });
          resolvedProductNames.push(name);
        } else if (typeof p === 'string' && p.trim()) {
          resolvedProducts.push({
            _id: isValidObjectId(p) ? p : null,
            id: p,
            productName: p,
            name: p,
          });
          resolvedProductNames.push(p);
        }
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
