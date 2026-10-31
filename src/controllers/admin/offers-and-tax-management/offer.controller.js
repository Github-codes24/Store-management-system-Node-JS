import Offer from '../../../models/offer.model.js';
import Store from '../../../models/store.model.js';
import Customer from '../../../models/customer.model.js';
import AdminProduct from '../../../models/adminProduct.model.js';
import Category from '../../../models/category.model.js';
import ProductType from '../../../models/productType.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, badRequest } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import { enrichOffersWithProducts, isOfferExpired, ensureEndOfDayIst } from '../../../utils/offerHelper.js';
import { parseFlexibleDate } from '../../../utils/date.util.js';

/**
 * Get Pre-Requisite Options for Create/Edit Offer Form (Stores, Push Target Customers, Live DB Products & Categories)
 * Supports store-based customer filtering via ?storeId=... or ?storeIds=id1,id2
 */
export const getOfferFormOptions = async (req, res, next) => {
  try {
    const { storeId, storeIds } = req.query;

    const stores = await Store.find({ isDeleted: false })
      .select('_id name storeCode location')
      .sort({ name: 1 });

    const formattedStores = stores.map((s) => ({
      label: s.name,
      value: s._id.toString(),
      storeCode: s.storeCode,
    }));

    // Customers list removed: all offers are broadcast to all customers automatically
    const formattedCustomers = [];

    // Fetch live products from AdminProduct collection
    const liveProducts = await AdminProduct.find({ isDeleted: false, status: 'active' })
      .select('_id productName status barcode mrp sellingPrice')
      .sort({ productName: 1 });

    // Fetch live categories from Category collection belonging to active ProductTypes
    const activePtIds = await ProductType.find({ status: 'active' }).distinct('_id');
    const liveCategories = await Category.find({ status: 'active', productType: { $in: activePtIds } })
      .select('_id name')
      .sort({ name: 1 });

    const formattedProducts = liveProducts.map((p) => {
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

    const formattedCategories = liveCategories.map((cat) => ({
      id: cat._id.toString(),
      name: `All ${cat.name}`,
      type: 'category',
    }));

    const combinedProductOptions = [
      { id: 'ALL_PRODUCTS', name: 'All Products', type: 'general' },
      ...formattedCategories,
      ...formattedProducts,
    ];

    return res.status(200).json(
      successResponse({
        message: 'Offer form options fetched successfully',
        data: {
          stores: formattedStores,
          customers: formattedCustomers,
          products: combinedProductOptions,
          categories: formattedCategories,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Offer (Store Wide or Special Offer)
 */
export const createOffer = async (req, res, next) => {
  try {
    const {
      name,
      description,
      offerType,
      offersOn,
      stores,
      applyToAllStores,
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

    const fromDate = parseFlexibleDate(validFrom, false);
    const toDate = parseFlexibleDate(validTo, true);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return next(badRequest('Invalid validFrom or validTo date format'));
    }

    if (toDate < fromDate) {
      return next(badRequest('Valid To date cannot be earlier than Valid From date'));
    }

    let validatedProductPricing = [];
    if (Array.isArray(productPricing) && productPricing.length > 0) {
      for (const item of productPricing) {
        const prodId = item.product || item.productId || item.id || item._id;
        if (!prodId) continue;

        let prod = await AdminProduct.findById(prodId).lean();
        if (!prod) {
          const StoreProduct = (await import('../../../models/storeProduct.model.js')).default;
          prod = await StoreProduct.findById(prodId).lean();
        }

        const prodName = prod?.productName || prod?.name || item.productName || 'Product';
        const realMrp = Number(prod?.mrp !== undefined ? prod.mrp : (item.mrp || 0));
        const originalSp = Number(prod?.sellingPrice || prod?.offlineSellingPrice || prod?.mrp || item.originalSellingPrice || 0);
        const updatedSp = Number(item.updatedSellingPrice !== undefined ? item.updatedSellingPrice : item.offerBasePrice);

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

        validatedProductPricing.push({
          product: prodId,
          productName: prodName,
          barcode: prod?.barcode || item.barcode || '',
          mrp: realMrp,
          originalSellingPrice: originalSp,
          updatedSellingPrice: updatedSp,
        });
      }
    }

    let resolvedProducts = Array.isArray(products) ? [...products] : [];
    if (validatedProductPricing.length > 0) {
      const pricingIds = validatedProductPricing.map((pp) => pp.product.toString());
      resolvedProducts = Array.from(new Set([...resolvedProducts, ...pricingIds]));
    }

    const offer = await Offer.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      offerType: (resolvedProducts.length > 0 || validatedProductPricing.length > 0) ? 'special' : (offerType || 'store_wide'),
      offersOn: offersOn || 'both',
      stores: Array.isArray(stores) ? stores : [],
      applyToAllStores: applyToAllStores !== undefined ? applyToAllStores : !stores || stores.length === 0,
      validFrom: fromDate,
      validTo: toDate,
      discountType,
      discountValue: Number(discountValue || 0),
      buyDetails: buyDetails || { buyProduct: null, buyQuantity: 1 },
      getFreeDetails: getFreeDetails || { freeProduct: null, freeQuantity: 1 },
      appliesTo: (resolvedProducts.length > 0 || validatedProductPricing.length > 0) ? 'product' : (appliesTo || 'all'),
      products: resolvedProducts,
      productPricing: validatedProductPricing,
      sendToAllCustomers: true,
      targetCustomers: [],
      status: status || 'active',
      createdBy: req.admin?._id,
    });

    const populatedOffer = await Offer.findById(offer._id)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue')
      .populate('createdBy', 'name email role')
      .populate('buyDetails.buyProduct', 'productName name barcode')
      .populate('getFreeDetails.freeProduct', 'productName name barcode');

    const enrichedOffer = await enrichOffersWithProducts(populatedOffer);

    return res.status(201).json(
      successResponse({
        message: 'Offer created successfully',
        data: { offer: enrichedOffer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Offers with search, status filter (active, inactive, expired), date filter, and pagination
 */
export const getOffers = async (req, res, next) => {
  try {
    const { search, status, startDate, endDate, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (startDate) {
      filter.validFrom = { $gte: new Date(startDate) };
    }

    if (endDate) {
      filter.validTo = { $lte: new Date(endDate) };
    }

    let offers = await Offer.find(filter)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email')
      .populate('createdBy', 'name email role')
      .populate('buyDetails.buyProduct', 'productName name barcode')
      .populate('getFreeDetails.freeProduct', 'productName name barcode')
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
      if (off.discountType === 'bogo') {
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
        message: 'Offers fetched successfully',
        data: { offers: paginatedOffers },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Offer details by ID
 */
export const getOfferById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const offer = await Offer.findOne({ _id: id, isDeleted: false })
      .populate('stores', 'name storeCode location')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue')
      .populate('createdBy', 'name email role')
      .populate('buyDetails.buyProduct', 'productName name barcode')
      .populate('getFreeDetails.freeProduct', 'productName name barcode');

    if (!offer) {
      return next(notFound('Offer not found'));
    }

    const enrichedOffer = await enrichOffersWithProducts(offer);

    const now = new Date();
    const isExpired = isOfferExpired(enrichedOffer.validTo, now);
    const displayStatus = isExpired ? 'expired' : enrichedOffer.status;

    return res.status(200).json(
      successResponse({
        message: 'Offer details fetched successfully',
        data: {
          offer: {
            ...enrichedOffer,
            displayStatus,
            isExpired,
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Offer details
 */
export const updateOffer = async (req, res, next) => {
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
    if (updateData.stores !== undefined) offer.stores = updateData.stores;
    if (updateData.applyToAllStores !== undefined) offer.applyToAllStores = updateData.applyToAllStores;
    if (updateData.validFrom !== undefined) offer.validFrom = parseFlexibleDate(updateData.validFrom, false);
    if (updateData.validTo !== undefined) offer.validTo = parseFlexibleDate(updateData.validTo, true);
    if (updateData.discountType !== undefined) offer.discountType = updateData.discountType;
    if (updateData.discountValue !== undefined) offer.discountValue = Number(updateData.discountValue);
    if (updateData.appliesTo !== undefined) offer.appliesTo = updateData.appliesTo;
    if (updateData.products !== undefined) offer.products = updateData.products;

    if (updateData.productPricing !== undefined) {
      if (Array.isArray(updateData.productPricing)) {
        let validatedPricing = [];
        for (const item of updateData.productPricing) {
          const prodId = item.product || item.productId || item.id || item._id;
          if (!prodId) continue;

          let prod = await AdminProduct.findById(prodId).lean();
          if (!prod) {
            const StoreProduct = (await import('../../../models/storeProduct.model.js')).default;
            prod = await StoreProduct.findById(prodId).lean();
          }

          const prodName = prod?.productName || prod?.name || item.productName || 'Product';
          const realMrp = Number(prod?.mrp !== undefined ? prod.mrp : (item.mrp || 0));
          const originalSp = Number(prod?.sellingPrice || prod?.offlineSellingPrice || prod?.mrp || item.originalSellingPrice || 0);
          const updatedSp = Number(item.updatedSellingPrice !== undefined ? item.updatedSellingPrice : item.offerBasePrice);

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
            barcode: prod?.barcode || item.barcode || '',
            mrp: realMrp,
            originalSellingPrice: originalSp,
            updatedSellingPrice: updatedSp,
          });
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
      .populate('createdBy', 'name email role')
      .populate('buyDetails.buyProduct', 'productName name barcode')
      .populate('getFreeDetails.freeProduct', 'productName name barcode');

    const enrichedOffer = await enrichOffersWithProducts(updatedOffer);

    return res.status(200).json(
      successResponse({
        message: 'Offer updated successfully',
        data: { offer: enrichedOffer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle Offer Status (active/inactive)
 */
export const toggleOfferStatus = async (req, res, next) => {
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
        message: `Offer status changed to ${offer.status}`,
        data: { id: offer._id, status: offer.status },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Offer (soft delete)
 */
export const deleteOffer = async (req, res, next) => {
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
        message: 'Offer deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Export Offers List
 */
export const exportOffers = async (_req, res, next) => {
  try {
    const offers = await Offer.find({ isDeleted: false })
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
        message: 'Offers export data generated successfully',
        data: { offers: exportData, totalCount: offers.length },
      })
    );
  } catch (error) {
    next(error);
  }
};
