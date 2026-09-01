import Offer from '../../models/offer.model.js';
import Customer from '../../models/customer.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import Category from '../../models/category.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Get Pre-Requisite Options for Store Panel Offer Form (Store-scoped Customers, Live Products & Categories)
 */
export const getStoreOfferFormOptions = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;

    // Fetch live customers registered at this employee's assigned store (or storeId null)
    const customerFilter = { status: 'active' };
    if (employeeStoreId) {
      customerFilter.$or = [
        { storeId: employeeStoreId },
        { storeId: null },
      ];
    }

    const customers = await Customer.find(customerFilter)
      .select('_id name phone email storeId totalPurchase amountDue')
      .sort({ name: 1 });

    const formattedCustomers = customers.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      mobile: c.phone,
      storeId: c.storeId ? c.storeId.toString() : null,
      totalPurchase: c.totalPurchase || 0,
      amountDue: c.amountDue || 0,
    }));

    // Fetch live products
    const liveProducts = await AdminProduct.find({ isDeleted: false })
      .select('_id productName status')
      .sort({ productName: 1 });

    // Fetch live categories
    const liveCategories = await Category.find({ status: 'active' })
      .select('_id name')
      .sort({ name: 1 });

    const formattedProducts = liveProducts.map((p) => ({
      id: p._id.toString(),
      name: p.productName || p.name,
      type: 'product',
    }));

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
        message: 'Store offer form options fetched successfully',
        data: {
          storeId: employeeStoreId ? employeeStoreId.toString() : null,
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
 * Create a new Offer from Store Panel (Automatically scoped to employee store)
 */
export const createStoreOffer = async (req, res, next) => {
  try {
    const employeeStoreId = req.storeEmployee?.storeId;
    const {
      name,
      description,
      offerType,
      offersOn,
      validFrom,
      validTo,
      discountType,
      discountValue,
      appliesTo,
      products,
      sendToAllCustomers,
      targetCustomers,
      status,
    } = req.body;

    const fromDate = new Date(validFrom);
    const toDate = new Date(validTo);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return next(badRequest('Invalid validFrom or validTo date format'));
    }

    if (toDate < fromDate) {
      return next(badRequest('Valid To date cannot be earlier than Valid From date'));
    }

    const offer = await Offer.create({
      name: name.trim(),
      description: description ? description.trim() : '',
      offerType: offerType || 'store_wide',
      offersOn: offersOn || 'both',
      stores: employeeStoreId ? [employeeStoreId] : [],
      applyToAllStores: !employeeStoreId,
      validFrom: fromDate,
      validTo: toDate,
      discountType,
      discountValue: Number(discountValue),
      appliesTo: appliesTo || 'all',
      products: Array.isArray(products) ? products : [],
      sendToAllCustomers: sendToAllCustomers !== undefined ? sendToAllCustomers : true,
      targetCustomers: Array.isArray(targetCustomers) ? targetCustomers : [],
      status: status || 'active',
    });

    const populatedOffer = await Offer.findById(offer._id)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue');

    return res.status(201).json(
      successResponse({
        message: 'Store offer created successfully',
        data: { offer: populatedOffer },
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
    const employeeStoreId = req.storeEmployee?.storeId;
    const { search, status, startDate, endDate, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (employeeStoreId) {
      filter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    if (startDate) {
      filter.validFrom = { $gte: new Date(startDate) };
    }

    if (endDate) {
      filter.validTo = { $lte: new Date(endDate) };
    }

    let offers = await Offer.find(filter)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email')
      .sort({ createdAt: -1 });

    const now = new Date();

    const formattedOffers = offers.map((off) => {
      const isExpired = new Date(off.validTo) < now;
      const displayStatus = isExpired ? 'expired' : off.status;
      const productLabel = off.products && off.products.length > 0 ? off.products.join(', ') : 'All Product';
      const pushOfferTo = off.sendToAllCustomers
        ? 'All Customer'
        : `${off.targetCustomers ? off.targetCustomers.length : 0} Customer`;
      const discountLabel = off.discountType === 'percentage' ? `${off.discountValue}%` : `₹ ${off.discountValue}`;

      return {
        _id: off._id,
        name: off.name,
        description: off.description,
        offerType: off.offerType,
        offersOn: off.offersOn,
        stores: off.stores,
        applyToAllStores: off.applyToAllStores,
        validFrom: off.validFrom,
        validTo: off.validTo,
        discountType: off.discountType,
        discountValue: off.discountValue,
        discountLabel,
        product: productLabel,
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

    const offer = await Offer.findOne({ _id: id, isDeleted: false })
      .populate('stores', 'name storeCode location')
      .populate('targetCustomers', 'name phone email totalPurchase amountDue');

    if (!offer) {
      return next(notFound('Offer not found'));
    }

    const now = new Date();
    const isExpired = new Date(offer.validTo) < now;
    const displayStatus = isExpired ? 'expired' : offer.status;

    return res.status(200).json(
      successResponse({
        message: 'Store offer details fetched successfully',
        data: {
          offer: {
            ...offer.toObject(),
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
    if (updateData.validFrom !== undefined) offer.validFrom = new Date(updateData.validFrom);
    if (updateData.validTo !== undefined) offer.validTo = new Date(updateData.validTo);
    if (updateData.discountType !== undefined) offer.discountType = updateData.discountType;
    if (updateData.discountValue !== undefined) offer.discountValue = Number(updateData.discountValue);
    if (updateData.appliesTo !== undefined) offer.appliesTo = updateData.appliesTo;
    if (updateData.products !== undefined) offer.products = updateData.products;
    if (updateData.sendToAllCustomers !== undefined) offer.sendToAllCustomers = updateData.sendToAllCustomers;
    if (updateData.targetCustomers !== undefined) offer.targetCustomers = updateData.targetCustomers;
    if (updateData.status !== undefined) offer.status = updateData.status;

    await offer.save();

    const updatedOffer = await Offer.findById(id)
      .populate('stores', 'name storeCode')
      .populate('targetCustomers', 'name phone email');

    return res.status(200).json(
      successResponse({
        message: 'Store offer updated successfully',
        data: { offer: updatedOffer },
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
    const employeeStoreId = req.storeEmployee?.storeId;
    const filter = { isDeleted: false };
    if (employeeStoreId) {
      filter.$or = [{ stores: employeeStoreId }, { applyToAllStores: true }];
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 });
    const now = new Date();

    const exportData = offers.map((off, index) => {
      const isExpired = new Date(off.validTo) < now;
      const statusLabel = isExpired ? 'Expired' : off.status.charAt(0).toUpperCase() + off.status.slice(1);
      const discountLabel = off.discountType === 'percentage' ? `${off.discountValue}%` : `₹ ${off.discountValue}`;

      return {
        srNo: index + 1,
        offerName: off.name,
        product: off.products && off.products.length > 0 ? off.products.join(', ') : 'All Product',
        pushOfferTo: off.sendToAllCustomers ? 'All Customer' : `${off.targetCustomers ? off.targetCustomers.length : 0} Customer`,
        discount: discountLabel,
        expiryDate: off.validTo.toISOString().split('T')[0],
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
