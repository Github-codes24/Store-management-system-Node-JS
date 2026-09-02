import StoreProduct from '../../models/storeProduct.model.js';
import AdminProduct from '../../models/adminProduct.model.js';
import Attribute from '../../models/attribute.model.js';
import ProductType from '../../models/productType.model.js';
import Category from '../../models/category.model.js';
import Subcategory from '../../models/subcategory.model.js';
import Brand from '../../models/brand.model.js';
import Unit from '../../models/unit.model.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { generateBarcode, generateBarcodeSvg, generateBarcodePdfBuffer } from '../../utils/barcode.util.js';
import { getPagination } from '../../utils/pagination.js';
import { processUploadedFile } from '../../utils/file-upload.js';
import ExcelJS from 'exceljs';

/**
 * Computes badge text and code for a store product record
 */
export const computeStockStatus = (product) => {
  if (product.status === 'inactive') {
    return { statusText: 'Inactive', statusCode: 'inactive' };
  }

  const stock = Number(product.stockQuantity) || 0;
  if (stock === 0) {
    return { statusText: 'Sold', statusCode: 'out_of_stock' };
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (product.expiryDate && new Date(product.expiryDate) <= thirtyDaysLater) {
    return { statusText: 'Near Expiry', statusCode: 'near_expiry' };
  }

  const minAlert = Number(product.alertQuantity || product.minStockAlert) || 0;
  const reorder = Number(product.reorderPoint) || 0;
  const threshold = minAlert > 0 ? minAlert : reorder;

  if (threshold > 0 && stock <= threshold) {
    return { statusText: 'Low Stock', statusCode: 'low_stock' };
  }

  return { statusText: 'Active', statusCode: 'active' };
};

/**
 * Helper to build Mongoose filter query
 */
const buildStoreProductFilter = (queryParams, storeId = null) => {
  const { search, productType, category, subcategory, brand, status } = queryParams;

  const filter = { isDeleted: false };

  if (storeId) {
    // Optionally scope by store
    filter.$or = [{ storeId }, { storeId: null }];
  }

  if (productType) filter.productType = productType;
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (brand) filter.brand = brand;

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    const searchConditions = [
      { productName: searchRegex },
      { barcode: searchRegex },
      { hsnCode: searchRegex },
      { batch: searchRegex },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (status && status !== 'all' && status !== 'All Status' && status !== 'All Statuses') {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'active':
        filter.status = 'active';
        filter.stockQuantity = { $gt: 0 };
        break;
      case 'inactive':
        filter.status = 'inactive';
        break;
      case 'sold':
      case 'out_of_stock':
        filter.stockQuantity = 0;
        break;
      case 'low_stock':
      case 'low stock':
        filter.stockQuantity = { $gt: 0 };
        filter.$expr = {
          $lte: [
            '$stockQuantity',
            { $cond: [{ $gt: ['$alertQuantity', 0] }, '$alertQuantity', '$minStockAlert'] },
          ],
        };
        break;
      case 'near_expiry':
      case 'near expiry':
        filter.expiryDate = { $ne: null, $lte: thirtyDaysLater };
        break;
      default:
        break;
    }
  }

  return filter;
};

/**
 * GET Store Products List
 */
export const getStoreProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      productType,
      category,
      subcategory,
      brand,
      status = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const storeId = req.storeEmployee?.storeId?._id || req.storeEmployee?.storeId || null;
    const filter = buildStoreProductFilter(
      { search, productType, category, subcategory, brand, status },
      storeId
    );

    const total = await StoreProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await StoreProduct.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .sort(sortOption)
      .skip(pagination.skip)
      .limit(pagination.limit);

    const stockItems = products.map((product, index) => {
      const { statusText, statusCode } = computeStockStatus(product);
      const unitShortName = product.unit?.shortName || product.unit?.name || 'pc';
      const brandName = product.brand?.name || '—';

      return {
        _id: product._id,
        id: product._id,
        srNo: pagination.skip + index + 1,
        productName: product.productName,
        productImage: product.productImage,
        barcode: product.barcode,
        brand: product.brand,
        brandName,
        productType: product.productType,
        category: product.category,
        subcategory: product.subcategory,
        batchType: product.batchType,
        batch: product.batch,
        unit: product.unit,
        unitShortName,
        piece: product.piece,
        mrp: product.mrp,
        onlineSellingPrice: product.onlineSellingPrice,
        offlineSellingPrice: product.offlineSellingPrice,
        purchasePrice: product.purchasePrice,
        stockQuantity: product.stockQuantity,
        stockDisplay: `${product.stockQuantity} ${unitShortName}`,
        minStockAlert: product.minStockAlert,
        alertQuantity: product.alertQuantity,
        manufactureDate: product.manufactureDate,
        expiryDate: product.expiryDate,
        attributes: product.attributes || [],
        status: product.status,
        stockStatus: statusText,
        stockStatusCode: statusCode,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Store products retrieved successfully',
        data: stockItems,
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET Store Product By ID
 */
export const getStoreProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .populate('attributes.attributeId');

    if (!product) {
      throw notFound('Store product record not found');
    }

    const { statusText, statusCode } = computeStockStatus(product);
    const unitShortName = product.unit?.shortName || product.unit?.name || 'pc';

    return res.status(200).json(
      successResponse({
        message: 'Store product details retrieved successfully',
        data: {
          product,
          stockStatus: statusText,
          stockStatusCode: statusCode,
          unitShortName,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * CREATE Store Product / ADD Stock
 * Accepts barcode from frontend or auto-generates if empty.
 * If active product with same barcode already exists in store, increases inventory.
 */
export const createStoreProduct = async (req, res, next) => {
  try {
    let {
      barcode,
      productImage,
      productName,
      productType,
      category,
      subcategory,
      brand,
      batchType,
      batch,
      unit,
      piece,
      stockQuantity,
      alertQuantity,
      minStockAlert,
      mrp,
      offlineSellingPrice,
      onlineSellingPrice,
      purchasePrice,
      manufactureDate,
      expiryDate,
      hsnCode,
      attributes,
      status,
    } = req.body;

    const cleanProductName = String(productName !== undefined && productName !== null ? productName : '').trim();
    if (!cleanProductName) {
      throw badRequest('Product name is required');
    }
    if (!productType) throw badRequest('Product type is required');
    if (!category) throw badRequest('Category is required');
    if (!subcategory) throw badRequest('Subcategory is required');
    if (!brand) throw badRequest('Brand is required');
    if (!unit) throw badRequest('Unit is required');

    const storeId = req.storeEmployee?.storeId?._id || req.storeEmployee?.storeId || null;
    const createdBy = req.storeEmployee?._id || null;
    const incomingQty = Number(stockQuantity) || 0;
    const alertQty = Number(alertQuantity !== undefined ? alertQuantity : minStockAlert) || 0;

    // Process image
    const imageUrl = await processUploadedFile(req.file, productImage, req);

    // Parse attributes if string
    let parsedAttributes = attributes;
    if (typeof attributes === 'string') {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (_e) {
        parsedAttributes = [];
      }
    }

    // Barcode resolution
    let finalBarcode = barcode !== undefined && barcode !== null ? String(barcode).trim() : '';
    const resolvedBatchCode = (batch || newBatchCode || '').trim();

    if (finalBarcode !== '') {
      // Check if product with this barcode already exists in this store
      const existingProduct = await StoreProduct.findOne({
        barcode: finalBarcode,
        isDeleted: false,
        ...(storeId ? { storeId } : {}),
      });

      if (existingProduct) {
        // INCREASE INVENTORY for existing product
        existingProduct.stockQuantity = (Number(existingProduct.stockQuantity) || 0) + incomingQty;
        if (cleanProductName) existingProduct.productName = cleanProductName;
        if (productType) existingProduct.productType = productType;
        if (category) existingProduct.category = category;
        if (subcategory) existingProduct.subcategory = subcategory;
        if (brand) existingProduct.brand = brand;
        if (unit) existingProduct.unit = unit;
        if (piece !== undefined) existingProduct.piece = Number(piece) || existingProduct.piece;
        if (alertQty > 0) {
          existingProduct.alertQuantity = alertQty;
          existingProduct.minStockAlert = alertQty;
        }
        if (mrp !== undefined) existingProduct.mrp = Number(mrp) || existingProduct.mrp;
        if (offlineSellingPrice !== undefined) existingProduct.offlineSellingPrice = Number(offlineSellingPrice) || existingProduct.offlineSellingPrice;
        if (onlineSellingPrice !== undefined) existingProduct.onlineSellingPrice = Number(onlineSellingPrice) || existingProduct.onlineSellingPrice;
        if (purchasePrice !== undefined) existingProduct.purchasePrice = Number(purchasePrice) || existingProduct.purchasePrice;
        if (manufactureDate) existingProduct.manufactureDate = new Date(manufactureDate);
        if (expiryDate) existingProduct.expiryDate = new Date(expiryDate);
        if (hsnCode) existingProduct.hsnCode = String(hsnCode).trim();
        if (imageUrl) existingProduct.productImage = imageUrl;
        if (Array.isArray(parsedAttributes) && parsedAttributes.length > 0) {
          existingProduct.attributes = parsedAttributes;
        }
        existingProduct.status = 'active';

        // Manage product's own independent batches
        if (!Array.isArray(existingProduct.batches)) {
          existingProduct.batches = [];
        }

        if (resolvedBatchCode) {
          const batchIndex = existingProduct.batches.findIndex(
            (b) => b.batchNumber && b.batchNumber.toLowerCase() === resolvedBatchCode.toLowerCase()
          );

          if (batchIndex >= 0) {
            existingProduct.batches[batchIndex].stockQuantity =
              (Number(existingProduct.batches[batchIndex].stockQuantity) || 0) + incomingQty;
            if (mrp !== undefined) existingProduct.batches[batchIndex].mrp = Number(mrp) || existingProduct.batches[batchIndex].mrp;
            if (offlineSellingPrice !== undefined) existingProduct.batches[batchIndex].offlineSellingPrice = Number(offlineSellingPrice) || existingProduct.batches[batchIndex].offlineSellingPrice;
            if (onlineSellingPrice !== undefined) existingProduct.batches[batchIndex].onlineSellingPrice = Number(onlineSellingPrice) || existingProduct.batches[batchIndex].onlineSellingPrice;
            if (manufactureDate) existingProduct.batches[batchIndex].manufactureDate = new Date(manufactureDate);
            if (expiryDate) existingProduct.batches[batchIndex].expiryDate = new Date(expiryDate);
          } else {
            existingProduct.batches.push({
              batchNumber: resolvedBatchCode,
              stockQuantity: incomingQty,
              mrp: Number(mrp) || 0,
              offlineSellingPrice: Number(offlineSellingPrice) || 0,
              onlineSellingPrice: Number(onlineSellingPrice) || 0,
              manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
              expiryDate: expiryDate ? new Date(expiryDate) : null,
            });
          }
          existingProduct.batch = resolvedBatchCode;
          existingProduct.batchType = batchType ? String(batchType).trim() : 'Old Batch';
        }

        await existingProduct.save();

        const populatedExisting = await StoreProduct.findById(existingProduct._id)
          .populate('productType', 'name')
          .populate('category', 'name')
          .populate('subcategory', 'name')
          .populate('brand', 'name')
          .populate('unit', 'name shortName');

        const { statusText, statusCode } = computeStockStatus(populatedExisting);

        return res.status(200).json(
          successResponse({
            message: `Product stock inventory updated successfully. New total stock: ${populatedExisting.stockQuantity}`,
            data: {
              product: populatedExisting,
              stockStatus: statusText,
              stockStatusCode: statusCode,
              isUpdatedStock: true,
            },
          })
        );
      }
    } else {
      // Auto-generate barcode if not provided
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        finalBarcode = generateBarcode();
        const existing = await StoreProduct.findOne({ barcode: finalBarcode, isDeleted: false });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      if (!isUnique) {
        throw badRequest('Failed to generate unique barcode. Please try again.');
      }
    }

    const defaultInitialBatch = resolvedBatchCode || `B${new Date().toISOString().slice(2, 10).replace(/-/g, '')}A`;
    const initialBatches = [
      {
        batchNumber: defaultInitialBatch,
        stockQuantity: incomingQty,
        mrp: Number(mrp) || 0,
        offlineSellingPrice: Number(offlineSellingPrice) || 0,
        onlineSellingPrice: Number(onlineSellingPrice) || 0,
        manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
      },
    ];

    const newProduct = await StoreProduct.create({
      barcode: finalBarcode,
      productImage: imageUrl,
      productName: cleanProductName,
      productType,
      category,
      subcategory,
      brand,
      batchType: batchType ? String(batchType).trim() : 'New Batch',
      batch: defaultInitialBatch,
      batches: initialBatches,
      unit,
      piece: Number(piece) || 1,
      stockQuantity: incomingQty,
      alertQuantity: alertQty,
      minStockAlert: alertQty,
      mrp: Number(mrp) || 0,
      offlineSellingPrice: Number(offlineSellingPrice) || 0,
      onlineSellingPrice: Number(onlineSellingPrice) || 0,
      purchasePrice: Number(purchasePrice) || 0,
      manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      hsnCode: hsnCode !== undefined && hsnCode !== null ? String(hsnCode).trim() : null,
      attributes: Array.isArray(parsedAttributes) ? parsedAttributes : [],
      status: status || 'active',
      storeId,
      createdBy,
    });

    const populated = await StoreProduct.findById(newProduct._id)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    const { statusText, statusCode } = computeStockStatus(populated);

    return res.status(201).json(
      successResponse({
        message: 'Store product created successfully',
        data: {
          product: populated,
          stockStatus: statusText,
          stockStatusCode: statusCode,
          isUpdatedStock: false,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * UPDATE Store Product
 */
export const updateStoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { productImage, attributes, ...updateData } = req.body;

    const existingProduct = await StoreProduct.findOne({ _id: id, isDeleted: false });
    if (!existingProduct) {
      throw notFound('Store product not found');
    }

    if (updateData.productName !== undefined && updateData.productName !== null) {
      updateData.productName = String(updateData.productName).trim();
    }
    if (updateData.barcode !== undefined && updateData.barcode !== null) {
      updateData.barcode = String(updateData.barcode).trim();
      if (updateData.barcode !== '' && updateData.barcode !== existingProduct.barcode) {
        const duplicate = await StoreProduct.findOne({
          barcode: updateData.barcode,
          isDeleted: false,
          _id: { $ne: id },
        });
        if (duplicate) {
          throw conflict('An active product with this barcode already exists');
        }
      }
    }
    if (updateData.batch !== undefined && updateData.batch !== null) {
      updateData.batch = String(updateData.batch).trim();
    }
    if (updateData.hsnCode !== undefined && updateData.hsnCode !== null) {
      updateData.hsnCode = String(updateData.hsnCode).trim();
    }

    const newImageUrl = await processUploadedFile(req.file, productImage, req);
    if (newImageUrl) {
      updateData.productImage = newImageUrl;
    }

    if (attributes !== undefined) {
      let parsedAttributes = attributes;
      if (typeof attributes === 'string') {
        try {
          parsedAttributes = JSON.parse(attributes);
        } catch (_e) {
          parsedAttributes = [];
        }
      }
      updateData.attributes = Array.isArray(parsedAttributes) ? parsedAttributes : [];
    }

    if (updateData.alertQuantity !== undefined) {
      updateData.minStockAlert = updateData.alertQuantity;
    }

    const updatedProduct = await StoreProduct.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    const { statusText, statusCode } = computeStockStatus(updatedProduct);

    return res.status(200).json(
      successResponse({
        message: 'Store product updated successfully',
        data: {
          product: updatedProduct,
          stockStatus: statusText,
          stockStatusCode: statusCode,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * TOGGLE Product Status (Active / Inactive)
 */
export const toggleStoreProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Store product not found');
    }

    product.status = status || (product.status === 'active' ? 'inactive' : 'active');
    await product.save();

    const { statusText, statusCode } = computeStockStatus(product);

    return res.status(200).json(
      successResponse({
        message: `Store product status updated to ${product.status}`,
        data: {
          _id: product._id,
          status: product.status,
          stockStatus: statusText,
          stockStatusCode: statusCode,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * SOFT DELETE Store Product
 */
export const deleteStoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Store product not found');
    }

    product.isDeleted = true;
    await product.save();

    return res.status(200).json(
      successResponse({
        message: 'Store product deleted successfully',
        data: { id: product._id },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET Dynamic Attributes according to Subcategory, Category & ProductType
 */
export const getStoreProductAttributes = async (req, res, next) => {
  try {
    const { subcategory, category, productType } = req.query;

    const filter = {
      isDeleted: false,
      status: 'active',
    };

    const conditions = [];

    if (subcategory) {
      conditions.push({ subcategories: subcategory });
    }
    if (category) {
      conditions.push({ categories: category });
    }
    if (productType) {
      conditions.push({ productTypes: productType });
    }

    // Also include global attributes (attributes that don't restrict to any subcat/cat/type)
    conditions.push({
      subcategories: { $size: 0 },
      categories: { $size: 0 },
      productTypes: { $size: 0 },
    });

    if (conditions.length > 0) {
      filter.$or = conditions;
    }

    const attributes = await Attribute.find(filter)
      .populate('productTypes', 'name')
      .populate('categories', 'name')
      .populate('subcategories', 'name')
      .sort({ createdAt: 1 });

    return res.status(200).json(
      successResponse({
        message: 'Attributes fetched successfully for selected criteria',
        data: {
          attributes,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET Dropdown Options (Product Types, Categories, Subcategories, Brands, Units, Batches)
 */
export const getStoreProductDropdownOptions = async (req, res, next) => {
  try {
    const { productType, category, productId, barcode } = req.query;

    // Active Product Types
    const productTypes = await ProductType.find({ status: 'active' })
      .select('name _id')
      .sort({ name: 1 });

    // Active Categories (filtered by productType if given)
    const catFilter = { status: 'active' };
    if (productType) catFilter.productType = productType;
    const categories = await Category.find(catFilter)
      .select('name _id productType')
      .sort({ name: 1 });

    // Active Subcategories (filtered by category/productType if given)
    const subcatFilter = { status: 'active' };
    if (category) subcatFilter.category = category;
    else if (productType) subcatFilter.productType = productType;
    const subcategories = await Subcategory.find(subcatFilter)
      .select('name _id category productType')
      .sort({ name: 1 });

    // Active Brands
    const brands = await Brand.find({ status: 'active' })
      .select('name _id')
      .sort({ name: 1 });

    // Active Units
    const units = await Unit.find({ status: 'active' })
      .select('name shortName _id')
      .sort({ name: 1 });

    // Product-specific batches (loaded only for the specified product)
    let productBatches = [];
    if (productId || barcode) {
      const targetProd = await StoreProduct.findOne({
        ...(productId ? { _id: productId } : { barcode: String(barcode).trim() }),
        isDeleted: false,
      });

      if (targetProd) {
        if (Array.isArray(targetProd.batches) && targetProd.batches.length > 0) {
          productBatches = targetProd.batches.map((b) => ({
            label: `${b.batchNumber} (Stock: ${b.stockQuantity || 0})`,
            value: b.batchNumber,
            batchNumber: b.batchNumber,
            stockQuantity: b.stockQuantity,
            mrp: b.mrp,
            offlineSellingPrice: b.offlineSellingPrice,
            onlineSellingPrice: b.onlineSellingPrice,
            manufactureDate: b.manufactureDate,
            expiryDate: b.expiryDate,
          }));
        } else if (targetProd.batch) {
          productBatches = [
            {
              label: `${targetProd.batch} (Stock: ${targetProd.stockQuantity || 0})`,
              value: targetProd.batch,
              batchNumber: targetProd.batch,
              stockQuantity: targetProd.stockQuantity,
            },
          ];
        }
      }
    }

    return res.status(200).json(
      successResponse({
        message: 'Dropdown options fetched successfully',
        data: {
          productTypes: productTypes.map((pt) => ({ label: pt.name, value: pt._id })),
          categories: categories.map((c) => ({ label: c.name, value: c._id, productType: c.productType })),
          subcategories: subcategories.map((s) => ({ label: s.name, value: s._id, category: s.category })),
          brands: brands.map((b) => ({ label: b.name, value: b._id })),
          units: units.map((u) => ({ label: `${u.name} (${u.shortName || u.name})`, value: u._id, name: u.name, shortName: u.shortName })),
          batches: productBatches,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * EXPORT Store Products (Excel / CSV / JSON)
 */
export const exportStoreProducts = async (req, res, next) => {
  try {
    const { search, productType, category, subcategory, brand, status = 'all', format = 'excel' } = req.query;
    const storeId = req.storeEmployee?.storeId?._id || req.storeEmployee?.storeId || null;

    const filter = buildStoreProductFilter(
      { search, productType, category, subcategory, brand, status },
      storeId
    );

    const products = await StoreProduct.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName')
      .sort({ productName: 1 });

    const exportRows = products.map((p, index) => {
      const { statusText } = computeStockStatus(p);
      const unitStr = p.unit?.shortName || p.unit?.name || 'pc';

      return {
        srNo: index + 1,
        productName: p.productName,
        barcode: p.barcode,
        brand: p.brand?.name || '—',
        category: p.category?.name || '—',
        subcategory: p.subcategory?.name || '—',
        mrp: p.mrp || 0,
        onlinePrice: p.onlineSellingPrice || 0,
        offlinePrice: p.offlineSellingPrice || 0,
        stockQuantity: p.stockQuantity,
        stockDisplay: `${p.stockQuantity} ${unitStr}`,
        status: statusText,
      };
    });

    if (format === 'json') {
      return res.status(200).json(
        successResponse({
          message: 'Export data generated successfully',
          data: { exportRows, totalCount: exportRows.length },
        })
      );
    }

    if (format === 'csv') {
      let csvContent = 'Sr.No.,Product Name,Barcode,Brand,Category,MRP,Online Price,Offline Price,Stock,Status\n';
      exportRows.forEach((r) => {
        csvContent += `"${r.srNo}","${r.productName.replace(/"/g, '""')}","${r.barcode}","${r.brand}","${r.category}",${r.mrp},${r.onlinePrice},${r.offlinePrice},"${r.stockDisplay}","${r.status}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="store_product_inventory.csv"');
      return res.status(200).send(csvContent);
    }

    // Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Inventory');

    worksheet.columns = [
      { header: 'Sr.No.', key: 'srNo', width: 8 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'MRP (₹)', key: 'mrp', width: 12 },
      { header: 'Online Price (₹)', key: 'onlinePrice', width: 16 },
      { header: 'Offline Price (₹)', key: 'offlinePrice', width: 16 },
      { header: 'Stock', key: 'stockDisplay', width: 14 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E65100' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    exportRows.forEach((row) => {
      worksheet.addRow(row);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="store_product_inventory.xlsx"');

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * LOOKUP Product by Barcode for Store Employee
 */
export const lookupStoreProductBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    if (!barcode) {
      throw badRequest('Barcode is required');
    }

    const cleanBarcode = String(barcode).trim();
    const storeId = req.storeEmployee?.storeId?._id || req.storeEmployee?.storeId || null;

    // First check StoreProduct in current store
    let product = await StoreProduct.findOne({
      barcode: cleanBarcode,
      isDeleted: false,
      ...(storeId ? { storeId } : {}),
    })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    // If not found in store, fallback to AdminProduct catalogue
    if (!product) {
      product = await AdminProduct.findOne({
        barcode: cleanBarcode,
        isDeleted: false,
      })
        .populate('productType', 'name')
        .populate('category', 'name')
        .populate('subcategory', 'name')
        .populate('brand', 'name')
        .populate('unit', 'name shortName');
    }

    if (!product) {
      return res.status(200).json(
        successResponse({
          message: `No active product found with barcode ${cleanBarcode}`,
          data: {
            exists: false,
            barcode: cleanBarcode,
          },
        })
      );
    }

    return res.status(200).json(
      successResponse({
        message: 'Product retrieved successfully by barcode',
        data: {
          exists: true,
          product,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * PRINT Store Product Barcode Labels
 */
export const printStoreProductBarcode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quantity = req.body?.quantity || req.query?.quantity || 1;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false })
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    if (!product) {
      throw notFound('Store product not found');
    }

    const printableQty = Math.max(1, parseInt(quantity, 10) || 1);

    const isPdfRequest = req.query.format === 'pdf' || req.headers.accept?.includes('application/pdf') || req.method === 'GET';

    if (isPdfRequest) {
      const pdfBuffer = await generateBarcodePdfBuffer(product, printableQty);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="barcode_${product.barcode}_qty${printableQty}.pdf"`
      );
      return res.status(200).send(pdfBuffer);
    }

    const barcodeSvg = generateBarcodeSvg(product.barcode);

    return res.status(200).json(
      successResponse({
        message: `Barcode print payload generated for ${printableQty} copies`,
        data: {
          product: {
            _id: product._id,
            productName: product.productName,
            barcode: product.barcode,
            barcodeSvg,
            brandName: product.brand?.name || '',
            mrp: product.mrp,
            onlineSellingPrice: product.onlineSellingPrice,
            offlineSellingPrice: product.offlineSellingPrice,
          },
          printQuantity: printableQty,
          labels: Array(printableQty).fill({
            productName: product.productName,
            barcode: product.barcode,
            price: product.offlineSellingPrice || product.onlineSellingPrice || product.mrp,
          }),
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
