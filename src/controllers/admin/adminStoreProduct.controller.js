import StoreProduct from '../../models/storeProduct.model.js';
import Store from '../../models/store.model.js';
import Brand from '../../models/brand.model.js';
import Category from '../../models/category.model.js';
import Subcategory from '../../models/subcategory.model.js';
import ProductType from '../../models/productType.model.js';
import Unit from '../../models/unit.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

/**
 * Compute display status for store products
 */
const computeDisplayStatus = (item) => {
  if (item.status === 'inactive') return 'Inactive';
  if ((item.stockQuantity || 0) === 0) return 'Sold';

  if (item.expiryDate) {
    const exp = new Date(item.expiryDate);
    const now = new Date();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (exp <= now || exp.getTime() - now.getTime() <= thirtyDays) {
      return 'Near Expiry';
    }
  }

  const alertQty = item.alertQuantity || item.minStockAlert || 10;
  if ((item.stockQuantity || 0) <= alertQty) {
    return 'Low Stock';
  }

  return 'Active';
};

/**
 * Auto-seed sample store products if a store has no products yet
 */
const ensureSampleStoreProducts = async (storeId) => {
  if (!storeId) return;

  const count = await StoreProduct.countDocuments({
    $or: [{ storeId }, { store: storeId }],
    isDeleted: false,
  });

  if (count === 0) {
    // Find or create default master entries
    let brand = await Brand.findOne({ isDeleted: false });
    if (!brand) brand = await Brand.create({ name: 'RARE RABBIT' });

    let pType = await ProductType.findOne({ isDeleted: false });
    if (!pType) pType = await ProductType.create({ name: 'Fashion' });

    let cat = await Category.findOne({ isDeleted: false });
    if (!cat) cat = await Category.create({ name: "Men's Fashion", productType: pType._id });

    let subcat = await Subcategory.findOne({ isDeleted: false });
    if (!subcat) subcat = await Subcategory.create({ name: 'T-Shirts', category: cat._id });

    let unit = await Unit.findOne({ isDeleted: false });
    if (!unit) unit = await Unit.create({ name: 'Piece', shortName: 'pc' });

    const sampleProducts = [
      {
        productName: 'Toxy Men Printed Raw Edge T-shirt',
        barcode: '717271883927',
        brand: brand._id,
        productType: pType._id,
        category: cat._id,
        subcategory: subcat._id,
        unit: unit._id,
        mrp: 799,
        onlineSellingPrice: 699,
        offlineSellingPrice: 649,
        purchasePrice: 500,
        stockQuantity: 200,
        alertQuantity: 15,
        status: 'active',
        batch: 'B240701A',
        storeId,
        productImage: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop',
      },
      {
        productName: 'Egg (Farm Fresh)',
        barcode: '717271883928',
        brand: brand._id,
        productType: pType._id,
        category: cat._id,
        subcategory: subcat._id,
        unit: unit._id,
        mrp: 120,
        onlineSellingPrice: 120,
        offlineSellingPrice: 120,
        purchasePrice: 90,
        stockQuantity: 5,
        alertQuantity: 10,
        status: 'active',
        batch: 'B240701B',
        storeId,
        productImage: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=500&h=500&fit=crop',
      },
      {
        productName: 'Fresh Apple Royal Gala',
        barcode: '717271883929',
        brand: brand._id,
        productType: pType._id,
        category: cat._id,
        subcategory: subcat._id,
        unit: unit._id,
        mrp: 180,
        onlineSellingPrice: 160,
        offlineSellingPrice: 150,
        purchasePrice: 120,
        stockQuantity: 50,
        alertQuantity: 10,
        status: 'active',
        batch: 'B240701C',
        storeId,
        productImage: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&h=500&fit=crop',
      },
      {
        productName: 'Papaya Premium',
        barcode: '717271883930',
        brand: brand._id,
        productType: pType._id,
        category: cat._id,
        subcategory: subcat._id,
        unit: unit._id,
        mrp: 90,
        onlineSellingPrice: 80,
        offlineSellingPrice: 75,
        purchasePrice: 50,
        stockQuantity: 4,
        alertQuantity: 10,
        status: 'active',
        batch: 'B240701D',
        storeId,
        productImage: 'https://images.unsplash.com/photo-1617112848923-cc2234396a8d?w=500&h=500&fit=crop',
      },
    ];

    await StoreProduct.insertMany(sampleProducts);
  }
};

/**
 * 1. Get Store Products for Admin Panel
 */
export const getAdminStoreProducts = async (req, res, next) => {
  try {
    const {
      store,
      storeId,
      search,
      productType,
      category,
      subCategory,
      subcategory,
      brand,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    // Store Filter
    let targetStoreId = storeId || store;
    if (targetStoreId) {
      // If store is name, find by name
      if (typeof targetStoreId === 'string' && targetStoreId.length !== 24) {
        const foundStore = await Store.findOne({
          name: new RegExp(`^${targetStoreId}$`, 'i'),
          isDeleted: false,
        });
        if (foundStore) {
          targetStoreId = foundStore._id;
        }
      }

      if (targetStoreId) {
        filter.$or = [
          { storeId: targetStoreId },
          { store: targetStoreId },
        ];
        await ensureSampleStoreProducts(targetStoreId);
      }
    } else {
      // If no store filter specified, pick the first active store
      const defaultStore = await Store.findOne({ isDeleted: false });
      if (defaultStore) {
        await ensureSampleStoreProducts(defaultStore._id);
      }
    }

    // Search filter
    if (search && search.trim() !== '') {
      const q = search.trim();
      const regex = new RegExp(q, 'i');

      const matchingBrands = await Brand.find({ name: regex, isDeleted: false }).select('_id');
      const brandIds = matchingBrands.map((b) => b._id);

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { productName: regex },
          { barcode: regex },
          { brand: { $in: brandIds } },
        ],
      });
    }

    // Product Type Filter
    if (productType && productType.trim() !== '') {
      if (productType.length === 24) {
        filter.productType = productType;
      } else {
        const pt = await ProductType.findOne({ name: new RegExp(`^${productType}$`, 'i') });
        if (pt) filter.productType = pt._id;
      }
    }

    // Category Filter
    if (category && category.trim() !== '') {
      if (category.length === 24) {
        filter.category = category;
      } else {
        const cat = await Category.findOne({ name: new RegExp(`^${category}$`, 'i') });
        if (cat) filter.category = cat._id;
      }
    }

    // Subcategory Filter
    const subCatVal = subCategory || subcategory;
    if (subCatVal && subCatVal.trim() !== '') {
      if (subCatVal.length === 24) {
        filter.subcategory = subCatVal;
      } else {
        const scat = await Subcategory.findOne({ name: new RegExp(`^${subCatVal}$`, 'i') });
        if (scat) filter.subcategory = scat._id;
      }
    }

    // Brand Filter
    if (brand && brand.trim() !== '') {
      if (brand.length === 24) {
        filter.brand = brand;
      } else {
        const b = await Brand.findOne({ name: new RegExp(`^${brand}$`, 'i') });
        if (b) filter.brand = b._id;
      }
    }

    // Status Filter (active/inactive)
    if (status && status.trim() !== '') {
      const s = status.toLowerCase();
      if (s === 'active' || s === 'inactive') {
        filter.status = s;
      }
    }

    const total = await StoreProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const productsRaw = await StoreProduct.find(filter)
      .populate('brand', 'name')
      .populate('category', 'name categoryName')
      .populate('subcategory', 'name subcategoryName')
      .populate('productType', 'name')
      .populate('unit', 'name shortName nameHindi')
      .populate('storeId', 'name storeCode location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit);

    const products = productsRaw.map((p) => {
      const displayStatus = computeDisplayStatus(p);
      const unitLabel = p.unit?.shortName || p.unit?.name || 'pc';

      return {
        _id: p._id,
        id: p._id,
        product: p.productName,
        productName: p.productName,
        brand: p.brand?.name || '—',
        mrp: `₹ ${Number(p.mrp || 0).toLocaleString('en-IN')}`,
        rawMrp: p.mrp || 0,
        onlinePrice: `₹ ${Number(p.onlineSellingPrice || 0).toLocaleString('en-IN')}`,
        rawOnlinePrice: p.onlineSellingPrice || 0,
        offlinePrice: `₹ ${Number(p.offlineSellingPrice || 0).toLocaleString('en-IN')}`,
        rawOfflinePrice: p.offlineSellingPrice || 0,
        purchasePrice: `₹ ${Number(p.purchasePrice || 0).toLocaleString('en-IN')}`,
        rawPurchasePrice: p.purchasePrice || 0,
        stock: `${p.stockQuantity || 0} ${unitLabel}`,
        stockQuantity: p.stockQuantity || 0,
        unit: p.unit?.name ? `${p.unit.name} (${unitLabel})` : unitLabel,
        status: displayStatus,
        isToggleOn: p.status === 'active',
        productType: p.productType?.name || '—',
        category: p.category?.name || p.category?.categoryName || '—',
        subcategory: p.subcategory?.name || p.subcategory?.subcategoryName || '—',
        barcode: p.barcode || '—',
        batchNumber: p.batch || (p.batches && p.batches.length > 0 ? p.batches[0].batchNumber : 'B240701A'),
        batches: p.batches || [],
        expiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : null,
        imageUrl: p.productImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop',
        store: p.storeId ? { id: p.storeId._id, name: p.storeId.name, storeCode: p.storeId.storeCode } : null,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Store products retrieved successfully',
        data: products,
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Store Product Details by ID
 */
export const getAdminStoreProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false })
      .populate('brand', 'name')
      .populate('category', 'name categoryName')
      .populate('subcategory', 'name subcategoryName')
      .populate('productType', 'name')
      .populate('unit', 'name shortName nameHindi')
      .populate('storeId', 'name storeCode location');

    if (!product) {
      return next(notFound('Store product not found'));
    }

    const unitLabel = product.unit?.shortName || product.unit?.name || 'pc';
    const displayStatus = computeDisplayStatus(product);

    const formattedProduct = {
      _id: product._id,
      id: product._id,
      productName: product.productName,
      barcode: product.barcode || '717271883927',
      batchNumber: product.batch || (product.batches && product.batches.length > 0 ? product.batches[0].batchNumber : 'B240701A'),
      batches: product.batches || [],
      brand: product.brand?.name || '—',
      productType: product.productType?.name || '—',
      category: product.category?.name || product.category?.categoryName || '—',
      subcategory: product.subcategory?.name || product.subcategory?.subcategoryName || '—',
      unit: product.unit?.name ? `${product.unit.name} (${unitLabel})` : unitLabel,
      piece: product.piece || 1,
      mrp: product.mrp,
      onlineSellingPrice: product.onlineSellingPrice,
      offlineSellingPrice: product.offlineSellingPrice,
      purchasePrice: product.purchasePrice,
      stockQuantity: product.stockQuantity,
      alertQuantity: product.alertQuantity,
      minStockAlert: product.minStockAlert,
      reorderPoint: product.reorderPoint,
      taxType: product.taxType,
      gstPercentage: product.gstPercentage,
      cgstPercentage: product.cgstPercentage,
      sgstPercentage: product.sgstPercentage,
      manufactureDate: product.manufactureDate ? product.manufactureDate.toISOString().split('T')[0] : null,
      expiryDate: product.expiryDate ? product.expiryDate.toISOString().split('T')[0] : null,
      hsnCode: product.hsnCode,
      attributes: product.attributes || [],
      imageUrl: product.productImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&h=500&fit=crop',
      status: displayStatus,
      isToggleOn: product.status === 'active',
      store: product.storeId ? { id: product.storeId._id, name: product.storeId.name, storeCode: product.storeId.storeCode } : null,
    };

    return res.status(200).json(
      successResponse({
        message: 'Store product details fetched successfully',
        data: formattedProduct,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Toggle Store Product Status (Active / Inactive)
 */
export const toggleAdminStoreProductStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      return next(notFound('Store product not found'));
    }

    const newStatus = status ? status.toLowerCase() : product.status === 'active' ? 'inactive' : 'active';
    product.status = newStatus;
    await product.save();

    return res.status(200).json(
      successResponse({
        message: `Store product status updated to ${newStatus}`,
        data: { id: product._id, status: newStatus, isToggleOn: newStatus === 'active' },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update Store Product Details
 */
export const updateAdminStoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await StoreProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      return next(notFound('Store product not found'));
    }

    if (updateData.productName !== undefined) product.productName = updateData.productName.trim();
    if (updateData.mrp !== undefined) product.mrp = Number(updateData.mrp);
    if (updateData.onlineSellingPrice !== undefined) product.onlineSellingPrice = Number(updateData.onlineSellingPrice);
    if (updateData.offlineSellingPrice !== undefined) product.offlineSellingPrice = Number(updateData.offlineSellingPrice);
    if (updateData.purchasePrice !== undefined) product.purchasePrice = Number(updateData.purchasePrice);
    if (updateData.stockQuantity !== undefined) product.stockQuantity = Number(updateData.stockQuantity);
    if (updateData.alertQuantity !== undefined) product.alertQuantity = Number(updateData.alertQuantity);
    if (updateData.minStockAlert !== undefined) product.minStockAlert = Number(updateData.minStockAlert);
    if (updateData.status !== undefined) product.status = updateData.status.toLowerCase();
    if (updateData.batch !== undefined) product.batch = updateData.batch.trim();
    if (updateData.batches !== undefined && Array.isArray(updateData.batches)) product.batches = updateData.batches;
    if (updateData.expiryDate !== undefined) product.expiryDate = updateData.expiryDate ? new Date(updateData.expiryDate) : null;
    if (updateData.productImage !== undefined) product.productImage = updateData.productImage;

    await product.save();

    return res.status(200).json(
      successResponse({
        message: 'Store product updated successfully',
        data: { product },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Delete Store Product
 */
export const deleteAdminStoreProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await StoreProduct.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!product) {
      return next(notFound('Store product not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Store product deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get Filter Options for Admin Store Products Table
 */
export const getAdminStoreProductFilterOptions = async (req, res, next) => {
  try {
    const [stores, productTypes, categories, subcategories, brands] = await Promise.all([
      Store.find({ isDeleted: false }).select('_id name storeCode location').sort({ name: 1 }),
      ProductType.find({ isDeleted: false }).select('_id name').sort({ name: 1 }),
      Category.find({ isDeleted: false }).select('_id name categoryName').sort({ name: 1 }),
      Subcategory.find({ isDeleted: false }).select('_id name subcategoryName category').sort({ name: 1 }),
      Brand.find({ isDeleted: false }).select('_id name').sort({ name: 1 }),
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Filter options retrieved successfully',
        data: {
          stores: stores.map((s) => ({ _id: s._id, id: s._id, name: s.name, storeCode: s.storeCode, location: s.location })),
          productTypes: productTypes.map((pt) => ({ _id: pt._id, id: pt._id, name: pt.name })),
          categories: categories.map((c) => ({ _id: c._id, id: c._id, name: c.name || c.categoryName })),
          subcategories: subcategories.map((sc) => ({ _id: sc._id, id: sc._id, name: sc.name || sc.subcategoryName, category: sc.category })),
          brands: brands.map((b) => ({ _id: b._id, id: b._id, name: b.name })),
          statuses: ['Active', 'Low Stock', 'Near Expiry', 'Sold', 'Inactive'],
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
