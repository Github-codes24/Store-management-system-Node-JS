import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Category from '../../models/category.model.js';
import ProductType from '../../models/productType.model.js';
import Subcategory from '../../models/subcategory.model.js';
import Offer from '../../models/offer.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Format Customer Product object with discount percentage and tag
 */
export const formatCustomerProduct = (prod) => {
  const p = prod.toObject ? prod.toObject() : { ...prod };
  const mrp = Number(p.mrp || 0);
  const onlinePrice = Number(p.onlineSellingPrice || 0);

  let discountPercentage = 0;
  if (mrp > 0 && onlinePrice > 0 && mrp > onlinePrice) {
    discountPercentage = Math.round(((mrp - onlinePrice) / mrp) * 100);
  }

  return {
    ...p,
    discountPercentage,
    discountTag: discountPercentage > 0 ? `${discountPercentage}% OFF` : null,
  };
};

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
 * Get Category Tree for Customer App (ProductTypes + Nested Categories & Subcategories)
 * GET /api/customer/products/category-tree
 */
export const getCategoryTree = async (req, res, next) => {
  try {
    const { productType } = req.query;

    const productTypes = await ProductType.find({ status: 'active' })
      .select('name image description _id')
      .sort({ name: 1 })
      .lean();

    if (productTypes.length === 0) {
      return res.status(200).json(
        successResponse({
          message: 'Category tree retrieved successfully',
          data: {
            productTypes: [],
            selectedProductType: null,
            categories: [],
          },
        })
      );
    }

    let selectedPt = null;
    if (productType) {
      selectedPt = productTypes.find((pt) => pt._id.toString() === String(productType));
    }
    if (!selectedPt) {
      selectedPt = productTypes[0];
    }

    const categories = await Category.find({
      status: 'active',
      productType: selectedPt._id,
    })
      .select('name image description _id')
      .sort({ name: 1 })
      .lean();

    const catIds = categories.map((c) => c._id);
    const subcategories = await Subcategory.find({
      status: 'active',
      category: { $in: catIds },
      productType: selectedPt._id,
    })
      .select('name image description category _id')
      .sort({ name: 1 })
      .lean();

    const categoriesWithSub = categories.map((cat) => {
      const subs = subcategories.filter(
        (sub) => sub.category && sub.category.toString() === cat._id.toString()
      );
      return {
        ...cat,
        subcategories: subs,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Category tree retrieved successfully',
        data: {
          productTypes,
          selectedProductType: selectedPt,
          categories: categoriesWithSub,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Home Dashboard Payload (Categories, Best Discounts, Recommended, Previously Bought)
 * GET /api/customer/products/home-dashboard
 */
export const getHomeDashboard = async (req, res, next) => {
  try {
    const { storeId } = req.query;

    // 1. Top Categories (Product Types / Main Categories for top horizontal bar)
    const topCategories = await ProductType.find({ status: 'active' })
      .select('name image _id')
      .sort({ name: 1 })
      .limit(10);

    // Base Product Filter
    const baseFilter = { isDeleted: false, status: 'active' };

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...baseFilter, storeId })
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(baseFilter)
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    }

    const formattedProducts = rawProducts.map(formatCustomerProduct);

    // 2. Best Discount Offers: Filter discountPercentage > 0 & sort DESC
    const bestDiscountOffers = [...formattedProducts]
      .filter((p) => p.discountPercentage > 0)
      .sort((a, b) => b.discountPercentage - a.discountPercentage)
      .slice(0, 10);

    if (bestDiscountOffers.length < 10) {
      const existingIds = new Set(bestDiscountOffers.map((p) => p._id.toString()));
      for (const p of formattedProducts) {
        if (!existingIds.has(p._id.toString())) {
          bestDiscountOffers.push(p);
          if (bestDiscountOffers.length >= 10) break;
        }
      }
    }

    // 3. Recommended Products: Most ordered / popular products
    const recommendedProducts = [...formattedProducts]
      .sort((a, b) => (b.totalSalesCount || 0) - (a.totalSalesCount || 0))
      .slice(0, 10);

    // 4. Previously Bought Items: Customer past ordered products (or top active fallback)
    let previouslyBoughtItems = [];
    if (req.customer) {
      const orders = await StoreOrder.find({
        $or: [
          { 'customer.customerId': req.customer._id },
          { 'customer.phone': req.customer.phone },
        ],
      })
        .select('bills.items.product')
        .lean();

      const boughtProdIds = new Set();
      orders.forEach((ord) => {
        if (Array.isArray(ord.bills)) {
          ord.bills.forEach((b) => {
            if (Array.isArray(b.items)) {
              b.items.forEach((item) => {
                if (item.product) boughtProdIds.add(item.product.toString());
              });
            }
          });
        }
      });

      if (boughtProdIds.size > 0) {
        previouslyBoughtItems = formattedProducts
          .filter((p) => boughtProdIds.has(p._id.toString()))
          .slice(0, 10);
      }
    }

    if (previouslyBoughtItems.length === 0) {
      previouslyBoughtItems = formattedProducts.slice(0, 10);
    }

    return res.status(200).json(
      successResponse({
        message: 'Home dashboard content retrieved successfully',
        data: {
          topCategories,
          bestDiscountOffers,
          recommendedProducts,
          previouslyBoughtItems,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Best Discount Products (Paginated View All)
 * GET /api/customer/products/best-discounts
 */
export const getBestDiscounts = async (req, res, next) => {
  try {
    const { storeId, page = 1, limit = 20 } = req.query;
    const baseFilter = { isDeleted: false, status: 'active' };

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...baseFilter, storeId })
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(baseFilter)
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    }

    const formattedProducts = rawProducts
      .map(formatCustomerProduct)
      .sort((a, b) => b.discountPercentage - a.discountPercentage);

    const total = formattedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const products = formattedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Best discount products retrieved successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Recommended Products (Paginated View All)
 * GET /api/customer/products/recommended
 */
export const getRecommendedProducts = async (req, res, next) => {
  try {
    const { storeId, page = 1, limit = 20 } = req.query;
    const baseFilter = { isDeleted: false, status: 'active' };

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...baseFilter, storeId })
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(baseFilter)
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    }

    const formattedProducts = rawProducts
      .map(formatCustomerProduct)
      .sort((a, b) => (b.totalSalesCount || 0) - (a.totalSalesCount || 0));

    const total = formattedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const products = formattedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Recommended products retrieved successfully',
        data: { products },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Previously Bought Products for Customer (Paginated View All)
 * GET /api/customer/products/previously-bought
 */
export const getPreviouslyBought = async (req, res, next) => {
  try {
    const { storeId, page = 1, limit = 20 } = req.query;

    const orders = await StoreOrder.find({
      $or: [
        { 'customer.customerId': req.customer._id },
        { 'customer.phone': req.customer.phone },
      ],
    })
      .select('bills.items.product')
      .lean();

    const boughtProdIds = new Set();
    orders.forEach((ord) => {
      if (Array.isArray(ord.bills)) {
        ord.bills.forEach((b) => {
          if (Array.isArray(b.items)) {
            b.items.forEach((item) => {
              if (item.product) boughtProdIds.add(item.product.toString());
            });
          }
        });
      }
    });

    const baseFilter = { isDeleted: false, status: 'active' };

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...baseFilter, storeId })
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(baseFilter)
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    }

    let formattedProducts = rawProducts
      .map(formatCustomerProduct)
      .filter((p) => boughtProdIds.has(p._id.toString()));

    if (formattedProducts.length === 0) {
      formattedProducts = rawProducts.map(formatCustomerProduct);
    }

    const total = formattedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const products = formattedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Previously bought products retrieved successfully',
        data: { products },
        pagination,
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

      const rawProds = await StoreProduct.find(storeFilter)
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit);

      products = rawProds.map(formatCustomerProduct);

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

    const rawProds = await AdminProduct.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    products = rawProds.map(formatCustomerProduct);

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

    let rawProduct = await AdminProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    if (!rawProduct) {
      rawProduct = await StoreProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName');
    }

    if (!rawProduct) {
      return next(notFound('Product not found or currently unavailable'));
    }

    const product = formatCustomerProduct(rawProduct);

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
