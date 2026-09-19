import AdminProduct from '../../models/adminProduct.model.js';
import StoreProduct from '../../models/storeProduct.model.js';
import Category from '../../models/category.model.js';
import ProductType from '../../models/productType.model.js';
import Subcategory from '../../models/subcategory.model.js';
import Offer from '../../models/offer.model.js';
import StoreOrder from '../../models/storeOrder.model.js';
import Brand from '../../models/brand.model.js';
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
    _id: p._id,
    productName: p.productName,
    productImage: p.productImage || null,
    barcode: p.barcode || null,
    productType: p.productType || null,
    category: p.category || null,
    subcategory: p.subcategory || null,
    brand: p.brand || null,
    unit: p.unit || null,
    mrp,
    onlineSellingPrice: onlinePrice,
    stockQuantity: p.stockQuantity ?? p.piece ?? 0,
    status: p.status || 'active',
    attributes: Array.isArray(p.attributes) ? p.attributes : [],
    discountPercentage,
    discountTag: discountPercentage > 0 ? `${discountPercentage}% OFF` : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
};

/**
 * Helper to filter and sort formatted customer products in memory
 */
export const applyCustomerFiltersAndSort = (formattedProducts, query) => {
  let result = [...formattedProducts];
  const { brands, minDiscount, offers, units, sortBy, search } = query;

  // 1. Search text filter
  if (search && search.trim() !== '') {
    const regex = new RegExp(search.trim(), 'i');
    result = result.filter(
      (p) =>
        regex.test(p.productName || '') ||
        regex.test(p.barcode || '') ||
        regex.test(p.brand?.name || '')
    );
  }

  // 2. Multi-brand filter
  if (brands) {
    const brandIds = Array.isArray(brands)
      ? brands
      : String(brands)
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean);

    if (brandIds.length > 0) {
      result = result.filter((p) => {
        const bId = p.brand?._id ? p.brand._id.toString() : p.brand?.toString() || '';
        return brandIds.includes(bId);
      });
    }
  }

  // 3. Min Discount filter (10%, 20%, 30%, 40%, 50%)
  if (minDiscount !== undefined && minDiscount !== null && minDiscount !== '') {
    const minDiscNum = Number(minDiscount);
    if (!isNaN(minDiscNum)) {
      result = result.filter((p) => (p.discountPercentage || 0) >= minDiscNum);
    }
  }

  // 4. Offers filter
  if (offers) {
    result = result.filter((p) => p.discountPercentage > 0 || (p.offers && p.offers.length > 0));
  }

  // 5. Quantity / Unit filter
  if (units) {
    const unitList = Array.isArray(units)
      ? units
      : String(units)
          .split(',')
          .map((u) => u.trim().toLowerCase())
          .filter(Boolean);

    if (unitList.length > 0) {
      result = result.filter((p) => {
        const uName = (p.unit?.name || p.unit?.shortName || p.unit || '').toString().toLowerCase();
        return unitList.some((u) => uName.includes(u));
      });
    }
  }

  // 6. Sorting
  if (sortBy) {
    switch (sortBy) {
      case 'price_low_high':
        result.sort((a, b) => Number(a.onlineSellingPrice || 0) - Number(b.onlineSellingPrice || 0));
        break;
      case 'price_high_low':
        result.sort((a, b) => Number(b.onlineSellingPrice || 0) - Number(a.onlineSellingPrice || 0));
        break;
      case 'discount':
        result.sort((a, b) => Number(b.discountPercentage || 0) - Number(a.discountPercentage || 0));
        break;
      case 'popularity':
      default:
        result.sort((a, b) => Number(b.totalSalesCount || 0) - Number(a.totalSalesCount || 0));
        break;
    }
  }

  return result;
};

/**
 * Get Subcategory Page Products and Left Navigation Strip Sibling Subcategories
 * GET /api/customer/products/subcategory-page
 */
export const getSubcategoryPage = async (req, res, next) => {
  try {
    const { subcategory, category, productType, storeId, page = 1, limit = 20 } = req.query;

    let currentSubcategory = null;
    let targetCatId = category;

    if (subcategory) {
      currentSubcategory = await Subcategory.findOne({ _id: subcategory, status: 'active' })
        .populate('category', 'name')
        .populate('productType', 'name')
        .lean();

      if (currentSubcategory && currentSubcategory.category) {
        targetCatId = currentSubcategory.category._id || currentSubcategory.category;
      }
    }

    // Fetch sibling subcategories under the same parent category for the left vertical strip
    let siblingSubcategories = [];
    if (targetCatId) {
      siblingSubcategories = await Subcategory.find({
        category: targetCatId,
        status: 'active',
      })
        .select('name image description category productType _id')
        .sort({ name: 1 })
        .lean();
    }

    // Build Mongoose base filter
    const filter = { isDeleted: false, status: 'active' };
    if (subcategory) filter.subcategory = subcategory;
    else if (targetCatId) filter.category = targetCatId;
    if (productType) filter.productType = productType;

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...filter, storeId })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(filter)
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    }

    const formattedProducts = rawProducts.map(formatCustomerProduct);
    const filteredSortedProducts = applyCustomerFiltersAndSort(formattedProducts, req.query);

    const total = filteredSortedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const products = filteredSortedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Subcategory page products and navigation retrieved successfully',
        data: {
          subcategory: currentSubcategory,
          siblingSubcategories,
          products,
        },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Filter Options for Drawer (Brands, Offers, Discount Tiers, Pack Sizes, Dynamic Count)
 * GET /api/customer/products/filter-options
 */
export const getFilterOptions = async (req, res, next) => {
  try {
    const { subcategory, category, productType, storeId, searchBrand } = req.query;

    const filter = { isDeleted: false, status: 'active' };
    if (subcategory) filter.subcategory = subcategory;
    if (category) filter.category = category;
    if (productType) filter.productType = productType;

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...filter, storeId })
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(filter)
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    }

    const formattedProducts = rawProducts.map(formatCustomerProduct);
    const filteredProducts = applyCustomerFiltersAndSort(formattedProducts, req.query);

    // 1. Unique Brands aggregation with product counts
    const brandMap = new Map();
    rawProducts.forEach((p) => {
      if (p.brand && p.brand._id) {
        const bId = p.brand._id.toString();
        if (!brandMap.has(bId)) {
          brandMap.set(bId, {
            _id: p.brand._id,
            name: p.brand.name,
            logo: p.brand.logo || null,
            count: 0,
          });
        }
        brandMap.get(bId).count += 1;
      }
    });

    let brandsList = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (searchBrand && searchBrand.trim() !== '') {
      const regex = new RegExp(searchBrand.trim(), 'i');
      brandsList = brandsList.filter((b) => regex.test(b.name));
    }

    // 2. Offer Categories
    const offersList = [
      { id: 'store_wide', label: 'Store Wide Offer' },
      { id: 'special_offer', label: 'Special Offer' },
    ];

    // 3. Discount Tiers
    const discountRanges = [
      { value: 50, label: '50% or more' },
      { value: 40, label: '40% or more' },
      { value: 30, label: '30% or more' },
      { value: 20, label: '20% or more' },
      { value: 10, label: '10% or more' },
    ];

    // 4. Quantities / Pack Sizes
    const quantitySet = new Set();
    rawProducts.forEach((p) => {
      const uName = p.unit?.name || p.unit?.shortName || p.unit;
      if (uName) quantitySet.add(String(uName).trim());
    });
    const quantitiesList = Array.from(quantitySet)
      .sort()
      .map((q) => ({ id: q.toLowerCase(), label: q }));

    return res.status(200).json(
      successResponse({
        message: 'Filter options retrieved successfully',
        data: {
          brands: brandsList,
          offers: offersList,
          discountRanges,
          quantities: quantitiesList,
          totalMatchingProducts: filteredProducts.length,
        },
      })
    );
  } catch (error) {
    next(error);
  }
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
    let targetStoreId = req.query.storeId || req.customer?.storeId || null;

    // 1. Top Categories (Product Types / Main Categories for top horizontal bar)
    const topCategories = await ProductType.find({ status: 'active' })
      .select('name image _id')
      .sort({ name: 1 })
      .limit(10);

    // Base Product Filter
    const baseFilter = { isDeleted: false, status: 'active' };

    let rawProducts = [];
    if (targetStoreId) {
      rawProducts = await StoreProduct.find({ ...baseFilter, storeId: targetStoreId })
        .populate('unit', 'name shortName')
        .populate('brand', 'name')
        .lean();
    }

    if (rawProducts.length === 0) {
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
      .filter((p) => p.discountPercentage > 0)
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

    let formattedProducts = [];
    if (boughtProdIds.size > 0) {
      formattedProducts = rawProducts
        .map(formatCustomerProduct)
        .filter((p) => boughtProdIds.has(p._id.toString()));
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
 * Get Products List for Customer App (with search, category/type filter, multi-brand/discount/unit filters & sorting)
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

    let rawProducts = [];
    if (storeId) {
      rawProducts = await StoreProduct.find({ ...filter, storeId })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    } else {
      rawProducts = await AdminProduct.find(filter)
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name logo')
        .populate('unit', 'name shortName')
        .lean();
    }

    const formattedProducts = rawProducts.map(formatCustomerProduct);
    const filteredSortedProducts = applyCustomerFiltersAndSort(formattedProducts, req.query);

    const total = filteredSortedProducts.length;
    const pagination = getPagination({ page, limit, total });
    const products = filteredSortedProducts.slice(pagination.skip, pagination.skip + pagination.limit);

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
 * Helper to build Specifications table & Dynamic Selectable Attributes for Product Details
 */
const buildProductVariantsAndSpecs = (rawProduct, siblingProducts = []) => {
  const p = rawProduct.toObject ? rawProduct.toObject() : { ...rawProduct };
  const specifications = [];

  // 1. Core Specs
  specifications.push({ label: 'Pack Of', value: String(p.piece || 1) });

  if (p.brand && p.brand.name) {
    specifications.push({ label: 'Brand', value: p.brand.name });
  }

  const unitName = p.unit?.name || p.unit?.shortName;
  if (unitName) {
    specifications.push({ label: 'Quantity', value: unitName });
  }

  if (p.manufactureDate) {
    const d = new Date(p.manufactureDate);
    specifications.push({
      label: 'Manufacture Date',
      value: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
    });
  }

  if (p.expiryDate) {
    const d = new Date(p.expiryDate);
    specifications.push({
      label: 'Expiry Date',
      value: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
    });
  }

  // 2. Custom Attributes to Specs
  const attrList = Array.isArray(p.attributes) ? p.attributes : [];
  attrList.forEach((attr) => {
    const label = attr.displayLabel || attr.attributeKey;
    let valStr = '';

    if (Array.isArray(attr.value)) {
      const names = attr.value.map((v) => (typeof v === 'object' && v !== null ? v.name || v.label || v.hex : String(v)));
      valStr = names.join(', ');
    } else if (typeof attr.value === 'object' && attr.value !== null) {
      valStr = attr.value.name || attr.value.label || attr.value.hex || JSON.stringify(attr.value);
    } else if (attr.value !== undefined && attr.value !== null) {
      valStr = String(attr.value);
    }

    if (label && valStr) {
      specifications.push({ label, value: valStr });
    }
  });

  // 3. Selectable Attributes (Dynamic Variant Switcher)
  const selectableAttributes = [];
  const siblings = Array.isArray(siblingProducts) && siblingProducts.length > 0 ? siblingProducts : [p];

  // A) Colors
  const colorAttr = attrList.find(
    (a) => (a.attributeKey && a.attributeKey.toLowerCase() === 'color') || (a.fieldType && a.fieldType === 'Color Picker')
  );

  if (colorAttr) {
    const selectedColorName = typeof colorAttr.value === 'string'
      ? colorAttr.value
      : Array.isArray(colorAttr.value) && colorAttr.value.length > 0
        ? colorAttr.value[0]?.name || colorAttr.value[0]?.label || colorAttr.value[0]
        : '';

    let colorOptions = [];
    if (Array.isArray(colorAttr.value)) {
      colorOptions = colorAttr.value.map((cObj) => {
        const cName = typeof cObj === 'object' ? cObj.name || cObj.label : String(cObj);
        const cHex = typeof cObj === 'object' ? cObj.hex : null;
        return {
          label: cName,
          value: cHex || cName,
          productId: p._id,
          isSelected: String(cName).toLowerCase() === String(selectedColorName).toLowerCase(),
        };
      });
    } else if (typeof colorAttr.value === 'string') {
      const colorMap = new Map();
      siblings.forEach((sib) => {
        const sAttrs = Array.isArray(sib.attributes) ? sib.attributes : [];
        const sColor = sAttrs.find((a) => a.attributeKey === 'color' || a.fieldType === 'Color Picker');
        const cVal = sColor ? (typeof sColor.value === 'string' ? sColor.value : sColor.value?.[0]?.name) : null;
        if (cVal && !colorMap.has(cVal.toLowerCase())) {
          colorMap.set(cVal.toLowerCase(), {
            label: cVal,
            value: cVal,
            productId: sib._id,
            isSelected: sib._id.toString() === p._id.toString(),
          });
        }
      });

      colorOptions = Array.from(colorMap.values());
    }

    if (colorOptions.length > 0) {
      selectableAttributes.push({
        attributeKey: 'color',
        displayLabel: 'Selected Color',
        selected: selectedColorName || colorOptions[0].label,
        options: colorOptions,
      });
    }
  }

  // B) Size / Storage / RAM / Variant
  const variantAttrs = attrList.filter((a) => {
    const key = (a.attributeKey || '').toLowerCase();
    return key === 'size' || key === 'variant' || key === 'storage' || key === 'ram' || key === 'packsize';
  });

  if (variantAttrs.length > 0) {
    variantAttrs.forEach((vAttr) => {
      const vKey = vAttr.attributeKey.toLowerCase();
      const selectedVal = typeof vAttr.value === 'string' ? vAttr.value : String(vAttr.value || '');

      const optMap = new Map();
      siblings.forEach((sib) => {
        const sAttrs = Array.isArray(sib.attributes) ? sib.attributes : [];
        const matchAttr = sAttrs.find((a) => (a.attributeKey || '').toLowerCase() === vKey);
        if (matchAttr && matchAttr.value) {
          const optVal = String(matchAttr.value);
          if (!optMap.has(optVal.toLowerCase())) {
            optMap.set(optVal.toLowerCase(), {
              label: optVal,
              value: optVal,
              productId: sib._id,
              isSelected: sib._id.toString() === p._id.toString() || optVal.toLowerCase() === selectedVal.toLowerCase(),
            });
          }
        }
      });

      if (optMap.size === 0 && selectedVal) {
        optMap.set(selectedVal.toLowerCase(), {
          label: selectedVal,
          value: selectedVal,
          productId: p._id,
          isSelected: true,
        });
      }

      selectableAttributes.push({
        attributeKey: vAttr.attributeKey,
        displayLabel: vAttr.displayLabel || (vKey === 'size' ? 'Selected Size' : 'Variant'),
        selected: selectedVal,
        options: Array.from(optMap.values()),
      });
    });
  }

  return { specifications, selectableAttributes };
};

/**
 * Get Product Details by ID for Customer App (with Specifications & Dynamic Selectable Variants)
 * GET /api/customer/products/products/:id
 */
export const getCustomerProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let rawProduct = await AdminProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .lean();

    let isStoreProduct = false;
    if (!rawProduct) {
      rawProduct = await StoreProduct.findOne({ _id: id, isDeleted: false, status: 'active' })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName')
        .lean();
      isStoreProduct = true;
    }

    if (!rawProduct) {
      return next(notFound('Product not found or currently unavailable'));
    }

    const subcatId = rawProduct.subcategory?._id || rawProduct.subcategory;
    const brandId = rawProduct.brand?._id || rawProduct.brand;
    const filter = { isDeleted: false, status: 'active' };
    if (subcatId) filter.subcategory = subcatId;
    if (brandId) filter.brand = brandId;

    let siblingProducts = [];
    if (isStoreProduct && rawProduct.storeId) {
      filter.storeId = rawProduct.storeId;
      siblingProducts = await StoreProduct.find(filter).lean();
    } else {
      siblingProducts = await AdminProduct.find(filter).lean();
    }

    const product = formatCustomerProduct(rawProduct);
    const { specifications, selectableAttributes } = buildProductVariantsAndSpecs(rawProduct, siblingProducts);

    return res.status(200).json(
      successResponse({
        message: 'Product details retrieved successfully',
        data: {
          product: {
            ...product,
            manufactureDate: rawProduct.manufactureDate || null,
            expiryDate: rawProduct.expiryDate || null,
          },
          specifications,
          selectableAttributes,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Offers for Customer App (Supporting tabs: All, Upcoming, Active, Expired)
 * GET /api/customer/products/offers?tab=all|upcoming|active|expired
 */
export const getCustomerOffers = async (req, res, next) => {
  try {
    const { tab = 'all' } = req.query;
    const now = new Date();

    const rawOffers = await Offer.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    let upcomingCount = 0;
    let activeCount = 0;
    let expiredCount = 0;

    const formattedOffers = rawOffers.map((off) => {
      const validFrom = off.validFrom ? new Date(off.validFrom) : null;
      const validTo = off.validTo ? new Date(off.validTo) : null;

      let statusKey = 'active';
      let statusBadge = 'Active';

      if (validFrom && validFrom > now) {
        statusKey = 'upcoming';
        statusBadge = 'Upcoming';
        upcomingCount++;
      } else if (validTo && validTo < now) {
        statusKey = 'expired';
        statusBadge = 'Expired';
        expiredCount++;
      } else {
        statusKey = 'active';
        statusBadge = 'Active';
        activeCount++;
      }

      const discountTag =
        off.discountType === 'percentage'
          ? `${off.discountValue}% OFF`
          : `₹ ${off.discountValue} OFF`;

      const scopeMap = {
        store_only: 'All Store',
        online_only: 'Online',
        both: 'All Store & Online',
      };
      const scopeText = scopeMap[off.offersOn] || 'All Store & Online';

      const formatDateStr = (d) => {
        if (!d) return '';
        return new Date(d).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      };

      const validityText = `${formatDateStr(off.validFrom)} - ${formatDateStr(off.validTo)}`;

      let subtitle = off.description || 'All Products';
      if (Array.isArray(off.products) && off.products.length > 0) {
        subtitle = off.products.join(', ');
      }

      return {
        _id: off._id,
        name: off.name,
        subtitle,
        description: off.description || '',
        status: statusKey,
        statusBadge,
        discountType: off.discountType,
        discountValue: off.discountValue,
        discountTag,
        offersOn: off.offersOn || 'both',
        scopeText,
        validFrom: off.validFrom,
        validTo: off.validTo,
        validityText,
        image: off.image || null,
      };
    });

    const counts = {
      all: formattedOffers.length,
      upcoming: upcomingCount,
      active: activeCount,
      expired: expiredCount,
    };

    const targetTab = (tab || 'all').toLowerCase().trim();
    let offers = formattedOffers;

    if (targetTab !== 'all') {
      offers = formattedOffers.filter((o) => o.status === targetTab);
    }

    return res.status(200).json(
      successResponse({
        message: 'Offers retrieved successfully',
        data: {
          counts,
          offers,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

