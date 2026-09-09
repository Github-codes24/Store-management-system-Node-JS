import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Category from '../../models/category.model.js';
import ProductType from '../../models/productType.model.js';
import Subcategory from '../../models/subcategory.model.js';
import Offer from '../../models/offer.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Get Product Types for Customer App
 */
export const getCustomerProductTypes = async (_req, res, next) => {
  try {
    const productTypes = await ProductType.find({ status: 'active' })
      .select('name image description _id')
      .sort({ name: 1 });

    return res.status(200).json(
      successResponse({
        message: 'Product types retrieved successfully',
        data: { productTypes },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Categories for Customer App
 */
export const getCustomerCategories = async (req, res, next) => {
  try {
    const { productType } = req.query;

    const activePtIds = await ProductType.find({ status: 'active' }).distinct('_id');

    const filter = {
      status: 'active',
      productType: { $in: activePtIds },
    };

    if (productType) {
      filter.productType = productType;
    }

    const categories = await Category.find(filter)
      .populate('productType', 'name')
      .select('name image description productType _id')
      .sort({ name: 1 });

    return res.status(200).json(
      successResponse({
        message: 'Categories retrieved successfully',
        data: { categories },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Subcategories for Customer App
 */
export const getCustomerSubcategories = async (req, res, next) => {
  try {
    const { category, productType } = req.query;

    const activePtIds = await ProductType.find({ status: 'active' }).distinct('_id');
    const activeCatIds = await Category.find({ status: 'active', productType: { $in: activePtIds } }).distinct('_id');

    const filter = {
      status: 'active',
      category: { $in: activeCatIds },
      productType: { $in: activePtIds },
    };

    if (category) filter.category = category;
    if (productType) filter.productType = productType;

    const subcategories = await Subcategory.find(filter)
      .populate('category', 'name')
      .populate('productType', 'name')
      .select('name image description category productType _id')
      .sort({ name: 1 });

    return res.status(200).json(
      successResponse({
        message: 'Subcategories retrieved successfully',
        data: { subcategories },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Products List for Customer App (with search, category/type filter & pagination)
 */
export const getCustomerProducts = async (req, res, next) => {
  try {
    const { search, productType, category, subcategory, storeId, page = 1, limit = 20 } = req.query;

    const filter = { isDeleted: false, status: 'active' };

    const activePtIds = await ProductType.find({ status: 'active' }).distinct('_id');
    const activeCatIds = await Category.find({ status: 'active', productType: { $in: activePtIds } }).distinct('_id');

    filter.productType = productType ? productType : { $in: activePtIds };
    filter.category = category ? category : { $in: activeCatIds };
    if (subcategory) filter.subcategory = subcategory;

    if (search && search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ productName: regex }, { barcode: regex }, { hsnCode: regex }];
    }

    let products = [];
    let total = 0;

    if (storeId) {
      // Store-specific products
      const storeFilter = { ...filter, storeId };
      total = await StoreProduct.countDocuments(storeFilter);
      const pagination = getPagination({ page, limit, total });

      products = await StoreProduct.find(storeFilter)
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit);

      return res.status(200).json(
        successResponse({
          message: 'Customer products retrieved successfully',
          data: { products },
          pagination,
        })
      );
    }

    // Default Admin catalog products
    total = await AdminProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    products = await AdminProduct.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Customer products retrieved successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Product Details by ID for Customer App
 */
export const getCustomerProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let product = await AdminProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    if (!product) {
      product = await StoreProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName');
    }

    if (!product) {
      return next(notFound('Product not found or currently unavailable'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Product details retrieved successfully',
        data: { product },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Active Offers for Customer App
 */
export const getCustomerOffers = async (_req, res, next) => {
  try {
    const now = new Date();
    const offers = await Offer.find({
      isDeleted: false,
      status: 'active',
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .select('name description discountType discountValue validFrom validTo products')
      .sort({ createdAt: -1 });

    return res.status(200).json(
      successResponse({
        message: 'Active offers retrieved successfully',
        data: { offers },
      })
    );
  } catch (error) {
    next(error);
  }
};
