import Offer from '../../models/offer.model.js';
import Customer from '../../models/customer.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Category from '../../models/category.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { enrichOffersWithProducts, buildOfferPerformanceData, isOfferExpired, ensureEndOfDayIst, ensureStartOfDayIst } from '../../utils/offerHelper.js';
import { getKolkataTodayRange } from '../../utils/timezone.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Get Pre-Requisite Options for Store Panel Offer Form (Store-scoped Customers, Live Products & Categories)
 */
export const getStoreOfferFormOptions = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;

    // Customers list removed: all offers are broadcast to all customers automatically
    const formattedCustomers = [];

    // Fetch live products (from StoreProduct with storeId / store filter, fallback to all StoreProducts and AdminProducts)
    let productItems = [];
    if (employeeStoreId) {
      const storeProducts = await StoreProduct.find({
        $or: [{ storeId: employeeStoreId }, { store: employeeStoreId }, { storeId: null }],
        isDeleted: { $ne: true },
      })
        .select('_id productName barcode batch mrp offlineSellingPrice onlineSellingPrice stockQuantity')
        .sort({ productName: 1 })
        .lean();

      if (storeProducts.length > 0) {
        productItems = storeProducts.map((p) => {
          const mrp = Number(p.mrp) || 0;
          const originalSellingPrice = Number(
            p.offlineSellingPrice !== undefined && p.offlineSellingPrice !== null
              ? p.offlineSellingPrice
              : (p.onlineSellingPrice || p.mrp || 0)
          );
          return {
            id: p._id.toString(),
            _id: p._id.toString(),
            name: p.productName,
            productName: p.productName,
            barcode: p.barcode || '',
            mrp,
            originalSellingPrice,
            sellingPrice: originalSellingPrice,
            stockQuantity: Number(p.stockQuantity) || 0,
            type: 'store_product',
          };
        });
      }
    }

    if (productItems.length === 0) {
      const allStoreProducts = await StoreProduct.find({ isDeleted: { $ne: true } })
        .select('_id productName barcode batch mrp offlineSellingPrice onlineSellingPrice stockQuantity')
        .sort({ productName: 1 })
        .lean();

      if (allStoreProducts.length > 0) {
        productItems = allStoreProducts.map((p) => {
          const mrp = Number(p.mrp) || 0;
          const originalSellingPrice = Number(
            p.offlineSellingPrice !== undefined && p.offlineSellingPrice !== null
              ? p.offlineSellingPrice
              : (p.onlineSellingPrice || p.mrp || 0)
          );
          return {
            id: p._id.toString(),
            _id: p._id.toString(),
            name: p.productName,
            productName: p.productName,
            barcode: p.barcode || '',
            mrp,
            originalSellingPrice,
            sellingPrice: originalSellingPrice,
            stockQuantity: Number(p.stockQuantity) || 0,
            type: 'store_product',
          };
        });
      }
    }

    if (productItems.length === 0) {
      const liveProducts = await AdminProduct.find({ isDeleted: false })
        .select('_id productName barcode mrp sellingPrice')
        .sort({ productName: 1 })
        .lean();

      productItems = liveProducts.map((p) => {
        const mrp = Number(p.mrp) || 0;
        const originalSellingPrice = Number(p.sellingPrice || p.mrp || 0);
        return {
          id: p._id.toString(),
          _id: p._id.toString(),
          name: p.productName || p.name,
          productName: p.productName || p.name,
          barcode: p.barcode || '',
          mrp,
          originalSellingPrice,
          sellingPrice: originalSellingPrice,
          type: 'product',
        };
      });
    }

    // Extract current offer ID if being viewed/edited (via query or referer URL like /offers/edit/:id)
    const referer = req.headers?.referer || req.headers?.referrer || '';
    const refererMatch = referer.match(/offers\/edit\/([0-9a-fA-F]{24})/);
    const currentOfferId = req.query?.offerId || (refererMatch ? refererMatch[1] : null);

    const offerPriceMap = new Map();

    if (currentOfferId) {
      const currentOffer = await Offer.findOne({ _id: currentOfferId, isDeleted: false }).lean();
      if (currentOffer) {
        if (Array.isArray(currentOffer.productPricing)) {
          for (const pp of currentOffer.productPricing) {
            const pId = pp.product ? (pp.product._id || pp.product.id || pp.product).toString() : null;
            const pPrice = pp.updatedSellingPrice !== undefined
              ? pp.updatedSellingPrice
              : (pp.offerBasePrice !== undefined
                  ? pp.offerBasePrice
                  : (pp.price !== undefined ? pp.price : (pp.offerPrice !== undefined ? pp.offerPrice : pp.sellingPrice)));
            if (pId && pPrice !== undefined && pPrice !== null && !isNaN(Number(pPrice))) {
              offerPriceMap.set(pId, Number(pPrice));
            }
          }
        }

        if (currentOffer.buyDetails && currentOffer.buyDetails.buyProduct) {
          const bProd = currentOffer.buyDetails.buyProduct;
          const bId = (bProd._id || bProd.id || bProd).toString();
          const bPrice = currentOffer.buyDetails.updatedSellingPrice !== undefined
            ? currentOffer.buyDetails.updatedSellingPrice
            : (currentOffer.buyDetails.offerBasePrice !== undefined
                ? currentOffer.buyDetails.offerBasePrice
                : (currentOffer.buyDetails.sellingPrice !== undefined
                    ? currentOffer.buyDetails.sellingPrice
                    : (currentOffer.buyDetails.offerPrice !== undefined ? currentOffer.buyDetails.offerPrice : currentOffer.buyDetails.price)));
          if (bId && bPrice !== undefined && bPrice !== null && !isNaN(Number(bPrice))) {
            offerPriceMap.set(bId, Number(bPrice));
          }
        }

        if (currentOffer.getFreeDetails && currentOffer.getFreeDetails.freeProduct) {
          const fProd = currentOffer.getFreeDetails.freeProduct;
          const fId = (fProd._id || fProd.id || fProd).toString();
          const fPrice = currentOffer.getFreeDetails.updatedSellingPrice !== undefined
            ? currentOffer.getFreeDetails.updatedSellingPrice
            : (currentOffer.getFreeDetails.offerBasePrice !== undefined
                ? currentOffer.getFreeDetails.offerBasePrice
                : (currentOffer.getFreeDetails.sellingPrice !== undefined
                    ? currentOffer.getFreeDetails.sellingPrice
                    : (currentOffer.getFreeDetails.offerPrice !== undefined ? currentOffer.getFreeDetails.offerPrice : currentOffer.getFreeDetails.price)));
          if (fId && fPrice !== undefined && fPrice !== null && !isNaN(Number(fPrice))) {
            offerPriceMap.set(fId, Number(fPrice));
          }
        }
      }
    }

    // Fetch recent non-deleted offers for this store to enrich remaining product options with current offer promotional pricing
    const offerFilter = { isDeleted: false };
    if (employeeStoreId) {
      offerFilter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    const recentOffers = await Offer.find(offerFilter)
      .sort({ updatedAt: -1 })
      .lean();

    for (const off of recentOffers) {
      if (Array.isArray(off.productPricing)) {
        for (const pp of off.productPricing) {
          const pId = pp.product ? (pp.product._id || pp.product.id || pp.product).toString() : null;
          const pPrice = pp.updatedSellingPrice !== undefined
            ? pp.updatedSellingPrice
            : (pp.offerBasePrice !== undefined
                ? pp.offerBasePrice
                : (pp.price !== undefined ? pp.price : (pp.offerPrice !== undefined ? pp.offerPrice : pp.sellingPrice)));
          if (pId && pPrice !== undefined && pPrice !== null && !isNaN(Number(pPrice)) && !offerPriceMap.has(pId)) {
            offerPriceMap.set(pId, Number(pPrice));
          }
        }
      }

      if (off.buyDetails && off.buyDetails.buyProduct) {
        const bProd = off.buyDetails.buyProduct;
        const bId = (bProd._id || bProd.id || bProd).toString();
        const bPrice = off.buyDetails.updatedSellingPrice !== undefined
          ? off.buyDetails.updatedSellingPrice
          : (off.buyDetails.offerBasePrice !== undefined
              ? off.buyDetails.offerBasePrice
              : (off.buyDetails.sellingPrice !== undefined
                  ? off.buyDetails.sellingPrice
                  : (off.buyDetails.offerPrice !== undefined ? off.buyDetails.offerPrice : off.buyDetails.price)));
        if (bId && bPrice !== undefined && bPrice !== null && !isNaN(Number(bPrice)) && !offerPriceMap.has(bId)) {
          offerPriceMap.set(bId, Number(bPrice));
        }
      }

      if (off.getFreeDetails && off.getFreeDetails.freeProduct) {
        const fProd = off.getFreeDetails.freeProduct;
        const fId = (fProd._id || fProd.id || fProd).toString();
        const fPrice = off.getFreeDetails.updatedSellingPrice !== undefined
          ? off.getFreeDetails.updatedSellingPrice
          : (off.getFreeDetails.offerBasePrice !== undefined
              ? off.getFreeDetails.offerBasePrice
              : (off.getFreeDetails.sellingPrice !== undefined
                  ? off.getFreeDetails.sellingPrice
                  : (off.getFreeDetails.offerPrice !== undefined ? off.getFreeDetails.offerPrice : off.getFreeDetails.price)));
        if (fId && fPrice !== undefined && fPrice !== null && !isNaN(Number(fPrice)) && !offerPriceMap.has(fId)) {
          offerPriceMap.set(fId, Number(fPrice));
        }
      }
    }

    productItems = productItems.map((item) => {
      const pIdStr = (item._id || item.id).toString();
      const offerSp = offerPriceMap.get(pIdStr);
      if (offerSp !== undefined && offerSp !== null && !isNaN(Number(offerSp))) {
        return {
          ...item,
          updatedSellingPrice: Number(offerSp),
          offerPrice: Number(offerSp),
          offerSellingPrice: Number(offerSp),
          offerSP: Number(offerSp),
          specialPrice: Number(offerSp),
          promotionalSellingPrice: Number(offerSp),
        };
      }
      return item;
    });

    // Fetch live categories
    const liveCategories = await Category.find({ status: 'active' })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    const formattedCategories = liveCategories.map((cat) => ({
      id: cat._id.toString(),
      _id: cat._id.toString(),
      name: `All ${cat.name}`,
      type: 'category',
    }));

    return res.status(200).json(
      successResponse({
        message: 'Store offer form options fetched successfully',
        data: {
          storeId: employeeStoreId ? employeeStoreId.toString() : null,
          customers: formattedCustomers,
          products: productItems,
          rawProducts: productItems,
          categories: formattedCategories,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to parse multiple date formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO)
 */
export const parseFlexibleDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) return dateStr;

  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const standard = new Date(trimmed);
    if (!isNaN(standard.getTime())) return standard;
  }
  return null;
};

/**
 * Create a new Offer from Store Panel (Automatically scoped to employee store)
 */
export const createStoreOffer = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;
    const {
      name,
      description,
      offerType,
      offersOn,
      validFrom,
      validTo,
      discountType,
      discountValue,
      buyDetails,
      getFreeDetails,
      appliesTo,
      products,
      productPricing,
      sendToAllCustomers,
      targetCustomers,
      status,
    } = req.body;

    const fromDate = parseFlexibleDate(validFrom);
    const toDate = parseFlexibleDate(validTo, true);

    if (!fromDate || !toDate) {
      return next(badRequest('Invalid validFrom or validTo date format. Please use DD/MM/YYYY or YYYY-MM-DD'));
    }

    if (toDate < fromDate) {
      return next(badRequest('Valid To date cannot be earlier than Valid From date'));
    }

    // Process and validate productPricing items (check that updatedSellingPrice <= mrp)
    let validatedProductPricing = [];
    if (Array.isArray(productPricing) && productPricing.length > 0) {
      for (const item of productPricing) {
        const prodId = item.product || item.productId || item.id || item._id;
        if (!prodId) continue;

        let storeProd = await StoreProduct.findById(prodId).lean();
        if (!storeProd) {
          storeProd = await AdminProduct.findById(prodId).lean();
        }

        const prodName = storeProd?.productName || storeProd?.name || item.productName || 'Product';
        const realMrp = Number(storeProd?.mrp !== undefined ? storeProd.mrp : (item.mrp || 0));
        const originalSp = Number(
          storeProd?.offlineSellingPrice !== undefined && storeProd?.offlineSellingPrice !== null
            ? storeProd.offlineSellingPrice
            : (storeProd?.sellingPrice || storeProd?.mrp || item.originalSellingPrice || 0)
        );
        const rawPrice = item.updatedSellingPrice !== undefined
          ? item.updatedSellingPrice
          : (item.offerBasePrice !== undefined ? item.offerBasePrice : (item.price !== undefined ? item.price : item.sellingPrice));
        const updatedSp = rawPrice !== undefined && rawPrice !== null && !isNaN(Number(rawPrice))
          ? Number(rawPrice)
          : originalSp;

        if (isNaN(updatedSp) || updatedSp < 0) {
          return next(badRequest(`Invalid updated selling price for product "${prodName}"`));
        }

        // Validation constraint: updatedSellingPrice must not exceed MRP
        if (realMrp > 0 && updatedSp > realMrp) {
          return next(
            badRequest(
              `Updated selling price (₹${updatedSp}) cannot exceed MRP (₹${realMrp}) for product "${prodName}"`
            )
          );
        }

        validatedProductPricing.push({
          product: prodId,
          productName: prodName,
          barcode: storeProd?.barcode || item.barcode || '',
          mrp: realMrp,
          originalSellingPrice: originalSp,
          updatedSellingPrice: updatedSp,
        });
      }
    }

    if (buyDetails && buyDetails.buyProduct) {
      const bProdId = (buyDetails.buyProduct._id || buyDetails.buyProduct.id || buyDetails.buyProduct).toString();
      const bRawPrice = buyDetails.updatedSellingPrice !== undefined
        ? buyDetails.updatedSellingPrice
        : (buyDetails.offerBasePrice !== undefined
            ? buyDetails.offerBasePrice
            : (buyDetails.sellingPrice !== undefined ? buyDetails.sellingPrice : buyDetails.price));

      if (bProdId && bRawPrice !== undefined && bRawPrice !== null && !isNaN(Number(bRawPrice))) {
        const existingIdx = validatedProductPricing.findIndex((pp) => String(pp.product) === String(bProdId));
        if (existingIdx >= 0) {
          validatedProductPricing[existingIdx].updatedSellingPrice = Number(bRawPrice);
        } else {
          let storeProd = await StoreProduct.findById(bProdId).lean() || await AdminProduct.findById(bProdId).lean();
          const prodName = storeProd?.productName || storeProd?.name || 'Product';
          const realMrp = Number(storeProd?.mrp || 0);
          const originalSp = Number(storeProd?.offlineSellingPrice !== undefined ? storeProd.offlineSellingPrice : (storeProd?.sellingPrice || realMrp));
          validatedProductPricing.push({
            product: bProdId,
            productName: prodName,
            barcode: storeProd?.barcode || '',
            mrp: realMrp,
            originalSellingPrice: originalSp,
            updatedSellingPrice: Number(bRawPrice),
          });
        }
      }
    }

    let resolvedProducts = Array.isArray(products) ? [...products] : [];
    if (validatedProductPricing.length > 0) {
      const pricingIds = validatedProductPricing.map((pp) => pp.product.toString());
      resolvedProducts = Array.from(new Set([...resolvedProducts, ...pricingIds]));
    }

    const resolvedAppliesTo = (appliesTo === 'all' && resolvedProducts.length > 0)
      ? 'product'
      : (appliesTo || (resolvedProducts.length > 0 ? 'product' : 'all'));
    const resolvedOfferType = (resolvedAppliesTo === 'product') ? 'special' : (offerType || 'store_wide');

    const offer = await Offer.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      offerType: resolvedOfferType,
      offersOn: offersOn || 'both',
      stores: employeeStoreId ? [employeeStoreId] : [],
      applyToAllStores: !employeeStoreId,
      validFrom: fromDate,
      validTo: toDate,
      discountType,
      discountValue: Number(discountValue || 0),
      buyDetails: buyDetails || { buyProduct: null, buyQuantity: 1 },
      getFreeDetails: getFreeDetails || { freeProduct: null, freeQuantity: 1 },
      appliesTo: resolvedAppliesTo,
      products: resolvedProducts,
      productPricing: validatedProductPricing,
      sendToAllCustomers: true,
      targetCustomers: [],
      status: status || 'active',
    });

    const populatedOffer = await Offer.findById(offer._id)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue')
      .populate('buyDetails.buyProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .populate('getFreeDetails.freeProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice');

    const enrichedOffer = await enrichOffersWithProducts(populatedOffer);

    return res.status(201).json(
      successResponse({
        message: 'Store offer created successfully',
        data: { offer: enrichedOffer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Offers for Store Panel (Applicable to employee store)
 */
export const getStoreOffers = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;
    const { search, status, startDate, endDate, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (employeeStoreId) {
      filter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    if (startDate) {
      const d = parseFlexibleDate(startDate);
      if (d) filter.validFrom = { $gte: d };
    }

    if (endDate) {
      const d = parseFlexibleDate(endDate);
      if (d) filter.validTo = { $lte: d };
    }

    let offers = await Offer.find(filter)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email')
      .populate('buyDetails.buyProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .populate('getFreeDetails.freeProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .sort({ createdAt: -1 });

    const enrichedOffers = await enrichOffersWithProducts(offers);
    const now = new Date();

    const formattedOffers = enrichedOffers.map((off) => {
      const isExpired = isOfferExpired(off.validTo, now);
      const displayStatus = isExpired ? 'expired' : off.status;
      const productLabel = off.product || (off.products && off.products.length > 0 ? off.products.join(', ') : 'All Product');
      const pushOfferTo = off.sendToAllCustomers
        ? 'All Customer'
        : `${off.targetCustomers ? off.targetCustomers.length : 0} Customer`;

      let discountLabel = off.discountType === 'percentage' ? `${off.discountValue}%` : `₹ ${off.discountValue}`;
      if (off.discountType === 'special_price') {
        discountLabel = 'Special Promotional Price';
      } else if (off.discountType === 'bogo') {
        discountLabel = `Buy ${off.buyDetails?.buyQuantity || 1} Get ${off.getFreeDetails?.freeQuantity || 1} Free`;
      } else if (off.discountType === 'bxgy') {
        discountLabel = `Buy ${off.buyDetails?.buyQuantity || 1} Get ${off.getFreeDetails?.freeQuantity || 1} Free`;
      }

      return {
        _id: off._id,
        name: off.name,
        description: off.description,
        offerType: off.offerType,
        offersOn: off.offersOn,
        stores: off.stores,
        applyToAllStores: off.applyToAllStores,
        validFrom: off.validFrom,
        validTo: ensureEndOfDayIst(off.validTo),
        discountType: off.discountType,
        discountValue: off.discountValue,
        buyDetails: off.buyDetails,
        getFreeDetails: off.getFreeDetails,
        discountLabel,
        product: productLabel,
        products: off.resolvedProducts && off.resolvedProducts.length > 0 ? off.resolvedProducts : off.products,
        productPricing: off.productPricing || [],
        pushOfferTo,
        sendToAllCustomers: off.sendToAllCustomers,
        targetCustomersCount: off.targetCustomers ? off.targetCustomers.length : 0,
        status: displayStatus,
        rawStatus: off.status,
        isExpired,
        createdAt: off.createdAt,
        updatedAt: off.updatedAt,
      };
    });

    let result = formattedOffers;

    if (search) {
      const query = search.trim().toLowerCase();
      result = result.filter((off) => off.name.toLowerCase().includes(query) || off.product.toLowerCase().includes(query));
    }

    if (status && ['active', 'inactive', 'expired'].includes(status.toLowerCase())) {
      result = result.filter((off) => off.status.toLowerCase() === status.toLowerCase());
    }

    const total = result.length;
    const pagination = getPagination({ page, limit, total });
    const paginatedOffers = result.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Store offers fetched successfully',
        data: { offers: paginatedOffers },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Store Offer details by ID
 */
export const getStoreOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;

    const offer = await Offer.findOne({ _id: id, isDeleted: false })
      .populate('stores', 'name storeCode location')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue')
      .populate('buyDetails.buyProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .populate('getFreeDetails.freeProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice');

    if (!offer) {
      return next(notFound('Offer not found'));
    }

    const enrichedOffer = await enrichOffersWithProducts(offer);
    if (enrichedOffer && enrichedOffer.validTo) {
      enrichedOffer.validTo = ensureEndOfDayIst(enrichedOffer.validTo);
    }

    const now = new Date();
    const isExpired = isOfferExpired(enrichedOffer.validTo, now);
    const displayStatus = isExpired ? 'expired' : enrichedOffer.status;

    const performanceReport = await buildOfferPerformanceData(offer, employeeStoreId);

    return res.status(200).json(
      successResponse({
        message: 'Store offer details fetched successfully',
        data: {
          offer: {
            ...enrichedOffer,
            displayStatus,
            isExpired,
            performance: performanceReport,
            report: performanceReport,
          },
          performance: performanceReport,
          report: performanceReport,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Offer Performance & Profit / Loss Report
 * Calculates KPI metrics and product sales breakdown with both positive profit and negative loss.
 */
export const getStoreOfferPerformanceReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;

    const offer = await Offer.findOne({ _id: id, isDeleted: false })
      .populate('stores', 'name storeCode location')
      .populate('buyDetails.buyProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .populate('getFreeDetails.freeProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice');

    if (!offer) {
      return next(notFound('Offer not found'));
    }

    const performanceData = await buildOfferPerformanceData(offer, employeeStoreId);

    return res.status(200).json(
      successResponse({
        message: 'Offer performance and profit report retrieved successfully',
        data: performanceData,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Store Offer details
 */
export const updateStoreOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) {
      return next(notFound('Offer not found'));
    }

    if (updateData.name !== undefined) offer.name = updateData.name.trim();
    if (updateData.description !== undefined) offer.description = updateData.description.trim();
    if (updateData.offerType !== undefined) offer.offerType = updateData.offerType;
    if (updateData.offersOn !== undefined) offer.offersOn = updateData.offersOn;
    if (updateData.validFrom !== undefined) {
      const d = parseFlexibleDate(updateData.validFrom);
      if (d) offer.validFrom = d;
    }
    if (updateData.validTo !== undefined) {
      const d = parseFlexibleDate(updateData.validTo, true);
      if (d) offer.validTo = d;
    }
    if (updateData.discountType !== undefined) offer.discountType = updateData.discountType;
    if (updateData.discountValue !== undefined) offer.discountValue = Number(updateData.discountValue);

    let buyUpdatedSp;
    let bProdId = null;
    if (updateData.buyDetails !== undefined) {
      const bProduct = updateData.buyDetails.buyProduct || updateData.buyDetails.product || updateData.buyDetails.productId;
      bProdId = bProduct ? (bProduct._id || bProduct.id || bProduct).toString() : null;
      offer.buyDetails = {
        buyProduct: bProdId || null,
        buyQuantity: Number(updateData.buyDetails.buyQuantity) || 1,
      };

      const rawBuySp = updateData.buyDetails.updatedSellingPrice !== undefined
        ? updateData.buyDetails.updatedSellingPrice
        : (updateData.buyDetails.offerBasePrice !== undefined
            ? updateData.buyDetails.offerBasePrice
            : (updateData.buyDetails.sellingPrice !== undefined
                ? updateData.buyDetails.sellingPrice
                : (updateData.buyDetails.offerPrice !== undefined
                    ? updateData.buyDetails.offerPrice
                    : (updateData.buyDetails.offerSellingPrice !== undefined
                        ? updateData.buyDetails.offerSellingPrice
                        : (updateData.buyDetails.offerSP !== undefined
                            ? updateData.buyDetails.offerSP
                            : updateData.buyDetails.price)))));

      if (rawBuySp !== undefined && rawBuySp !== null && !isNaN(Number(rawBuySp))) {
        buyUpdatedSp = Number(rawBuySp);
      }

      if (bProdId && buyUpdatedSp !== undefined) {
        if (!Array.isArray(offer.productPricing)) offer.productPricing = [];
        const existingIdx = offer.productPricing.findIndex((pp) => String(pp.product) === String(bProdId));
        if (existingIdx >= 0) {
          offer.productPricing[existingIdx].updatedSellingPrice = buyUpdatedSp;
        } else {
          offer.productPricing.push({
            product: bProdId,
            updatedSellingPrice: buyUpdatedSp,
          });
        }
      }
    }

    let freeUpdatedSp;
    let fProdId = null;
    if (updateData.getFreeDetails !== undefined) {
      const fProduct = updateData.getFreeDetails.freeProduct || updateData.getFreeDetails.product || updateData.getFreeDetails.productId;
      fProdId = fProduct ? (fProduct._id || fProduct.id || fProduct).toString() : null;
      offer.getFreeDetails = {
        freeProduct: fProdId || null,
        freeQuantity: Number(updateData.getFreeDetails.freeQuantity) || 1,
      };

      const rawFreeSp = updateData.getFreeDetails.updatedSellingPrice !== undefined
        ? updateData.getFreeDetails.updatedSellingPrice
        : (updateData.getFreeDetails.offerBasePrice !== undefined
            ? updateData.getFreeDetails.offerBasePrice
            : (updateData.getFreeDetails.sellingPrice !== undefined
                ? updateData.getFreeDetails.sellingPrice
                : (updateData.getFreeDetails.offerPrice !== undefined
                    ? updateData.getFreeDetails.offerPrice
                    : (updateData.getFreeDetails.offerSellingPrice !== undefined
                        ? updateData.getFreeDetails.offerSellingPrice
                        : (updateData.getFreeDetails.offerSP !== undefined
                            ? updateData.getFreeDetails.offerSP
                            : updateData.getFreeDetails.price)))));

      if (rawFreeSp !== undefined && rawFreeSp !== null && !isNaN(Number(rawFreeSp))) {
        freeUpdatedSp = Number(rawFreeSp);
      }

      if (fProdId && freeUpdatedSp !== undefined) {
        if (!Array.isArray(offer.productPricing)) offer.productPricing = [];
        const existingIdx = offer.productPricing.findIndex((pp) => String(pp.product) === String(fProdId));
        if (existingIdx >= 0) {
          offer.productPricing[existingIdx].updatedSellingPrice = freeUpdatedSp;
        } else {
          offer.productPricing.push({
            product: fProdId,
            updatedSellingPrice: freeUpdatedSp,
          });
        }
      }
    }

    if (updateData.appliesTo !== undefined) offer.appliesTo = updateData.appliesTo;
    if (updateData.products !== undefined) offer.products = updateData.products;

    if (updateData.productPricing !== undefined) {
      if (Array.isArray(updateData.productPricing)) {
        let validatedPricing = [];
        for (const item of updateData.productPricing) {
          const prodId = item.product || item.productId || item.id || item._id;
          if (!prodId) continue;

          let storeProd = await StoreProduct.findById(prodId).lean();
          if (!storeProd) {
            storeProd = await AdminProduct.findById(prodId).lean();
          }

          const prodName = storeProd?.productName || storeProd?.name || item.productName || 'Product';
          const realMrp = Number(storeProd?.mrp !== undefined ? storeProd.mrp : (item.mrp || 0));
          const originalSp = Number(
            storeProd?.offlineSellingPrice !== undefined && storeProd?.offlineSellingPrice !== null
              ? storeProd.offlineSellingPrice
              : (storeProd?.sellingPrice || storeProd?.mrp || item.originalSellingPrice || 0)
          );
          let rawPrice = item.updatedSellingPrice !== undefined
            ? item.updatedSellingPrice
            : (item.offerBasePrice !== undefined
                ? item.offerBasePrice
                : (item.price !== undefined
                    ? item.price
                    : (item.offerPrice !== undefined
                        ? item.offerPrice
                        : (item.offerSellingPrice !== undefined
                            ? item.offerSellingPrice
                            : (item.offerSP !== undefined ? item.offerSP : item.sellingPrice)))));

          // Check if buyDetails or getFreeDetails had an updated price for this product
          if ((rawPrice === undefined || rawPrice === null || rawPrice === '') && bProdId && String(prodId) === String(bProdId) && buyUpdatedSp !== undefined) {
            rawPrice = buyUpdatedSp;
          }
          if ((rawPrice === undefined || rawPrice === null || rawPrice === '') && fProdId && String(prodId) === String(fProdId) && freeUpdatedSp !== undefined) {
            rawPrice = freeUpdatedSp;
          }

          const updatedSp = rawPrice !== undefined && rawPrice !== null && !isNaN(Number(rawPrice))
            ? Number(rawPrice)
            : originalSp;

          if (isNaN(updatedSp) || updatedSp < 0) {
            return next(badRequest(`Invalid updated selling price for product "${prodName}"`));
          }

          if (realMrp > 0 && updatedSp > realMrp) {
            return next(
              badRequest(
                `Updated selling price (₹${updatedSp}) cannot exceed MRP (₹${realMrp}) for product "${prodName}"`
              )
            );
          }

          validatedPricing.push({
            product: prodId,
            productName: prodName,
            barcode: storeProd?.barcode || item.barcode || '',
            mrp: realMrp,
            originalSellingPrice: originalSp,
            updatedSellingPrice: updatedSp,
          });
        }

        // Guarantee buyProduct is in validatedPricing if buyUpdatedSp is set
        if (bProdId && buyUpdatedSp !== undefined) {
          const hasBProd = validatedPricing.some((pp) => String(pp.product) === String(bProdId));
          if (!hasBProd) {
            let storeProd = await StoreProduct.findById(bProdId).lean() || await AdminProduct.findById(bProdId).lean();
            validatedPricing.push({
              product: bProdId,
              productName: storeProd?.productName || storeProd?.name || 'Product A',
              barcode: storeProd?.barcode || '',
              mrp: Number(storeProd?.mrp || 0),
              originalSellingPrice: Number(storeProd?.offlineSellingPrice || storeProd?.sellingPrice || 0),
              updatedSellingPrice: buyUpdatedSp,
            });
          }
        }

        offer.productPricing = validatedPricing;
        if (validatedPricing.length > 0) {
          const pricingIds = validatedPricing.map((pp) => pp.product.toString());
          offer.products = Array.from(new Set([...(offer.products || []), ...pricingIds]));
          offer.appliesTo = 'product';
          offer.offerType = 'special';
        }
      }
    }

    if (updateData.sendToAllCustomers !== undefined) offer.sendToAllCustomers = updateData.sendToAllCustomers;
    if (updateData.targetCustomers !== undefined) offer.targetCustomers = updateData.targetCustomers;
    if (updateData.status !== undefined) offer.status = updateData.status;

    await offer.save();

    const updatedOffer = await Offer.findById(id)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email')
      .populate('buyDetails.buyProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice')
      .populate('getFreeDetails.freeProduct', 'productName name barcode mrp purchasePrice offlineSellingPrice');

    const enrichedOffer = await enrichOffersWithProducts(updatedOffer);

    return res.status(200).json(
      successResponse({
        message: 'Store offer updated successfully',
        data: { offer: enrichedOffer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Store Offer Status
 */
export const toggleStoreOfferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) {
      return next(notFound('Offer not found'));
    }

    offer.status = status || (offer.status === 'active' ? 'inactive' : 'active');
    await offer.save();

    return res.status(200).json(
      successResponse({
        message: `Store offer status changed to ${offer.status}`,
        data: { id: offer._id, status: offer.status },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Store Offer
 */
export const deleteStoreOffer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findOne({ _id: id, isDeleted: false });
    if (!offer) {
      return next(notFound('Offer not found'));
    }

    offer.isDeleted = true;
    await offer.save();

    return res.status(200).json(
      successResponse({
        message: 'Store offer deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Export Store Offers List
 */
export const exportStoreOffers = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store;
    const filter = { isDeleted: false };
    if (employeeStoreId) {
      filter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    const offers = await Offer.find(filter)
      .populate('buyDetails.buyProduct', 'productName name barcode')
      .populate('getFreeDetails.freeProduct', 'productName name barcode')
      .sort({ createdAt: -1 });

    const enrichedOffers = await enrichOffersWithProducts(offers);
    const now = new Date();

    const exportData = enrichedOffers.map((off, index) => {
      const isExpired = isOfferExpired(off.validTo, now);
      const statusLabel = isExpired ? 'Expired' : off.status.charAt(0).toUpperCase() + off.status.slice(1);
      const discountLabel = off.discountType === 'percentage' ? `${off.discountValue}%` : `₹ ${off.discountValue}`;

      return {
        srNo: index + 1,
        offerName: off.name,
        product: off.product || (off.products && off.products.length > 0 ? off.products.join(', ') : 'All Product'),
        pushOfferTo: off.sendToAllCustomers ? 'All Customer' : `${off.targetCustomers ? off.targetCustomers.length : 0} Customer`,
        discount: discountLabel,
        expiryDate: off.validTo instanceof Date ? off.validTo.toISOString().split('T')[0] : new Date(off.validTo).toISOString().split('T')[0],
        status: statusLabel,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Store offers export data generated successfully',
        data: { offers: exportData, totalCount: offers.length },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Active Applicable Offers for POS Billing & Counter Checkout
 * GET /api/store-employee/offers/active OR /api/store-employee/billing/applicable-offers
 */
export const getStoreBillingApplicableOffers = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId || req.storeEmployee?.store || req.query.storeId || null;

    const now = new Date();
    const { start: todayStartIst, end: todayEndIst } = getKolkataTodayRange(now);
    const startUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const startOfToday = new Date(Math.min(todayStartIst.getTime(), startUtc.getTime()));
    const endOfToday = new Date(Math.max(todayEndIst.getTime(), endUtc.getTime()));

    const filter = {
      isDeleted: false,
      status: 'active',
      validFrom: { $lte: endOfToday },
      validTo: { $gte: startOfToday },
      offersOn: { $in: ['store_only', 'both'] },
    };

    if (employeeStoreId) {
      filter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    const offers = await Offer.find(filter)
      .populate('stores', 'name storeCode')
      .sort({ discountValue: -1 })
      .lean();

    const storeWideOffers = [];
    const specialOffers = [];

    const formattedOffers = offers.map((off) => {
      const discountTag = off.discountType === 'percentage' ? `${off.discountValue}% OFF` : `₹${off.discountValue} OFF`;
      const isStoreWide = (off.offerType === 'store_wide' || off.appliesTo === 'all') && (!off.products || off.products.length === 0);

      const formatted = {
        _id: off._id,
        id: off._id,
        name: off.name,
        description: off.description,
        offerType: off.offerType,
        offersOn: off.offersOn,
        discountType: off.discountType,
        discountValue: off.discountValue,
        discountTag,
        appliesTo: off.appliesTo,
        products: off.products || [],
        productPricing: off.productPricing || [],
        sendToAllCustomers: off.sendToAllCustomers,
        validFrom: off.validFrom,
        validTo: off.validTo,
        isStoreWide,
      };

      if (isStoreWide) {
        storeWideOffers.push(formatted);
      } else {
        specialOffers.push(formatted);
      }

      return formatted;
    });

    return res.status(200).json(
      successResponse({
        message: 'Active store offers fetched successfully for POS billing',
        data: {
          activeOffers: formattedOffers,
          storeWideOffers,
          specialOffers,
          totalActiveOffers: formattedOffers.length,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

