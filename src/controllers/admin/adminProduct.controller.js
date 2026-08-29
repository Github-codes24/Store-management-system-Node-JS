import AdminProduct from '../../models/adminProduct.model.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { generateBarcode } from '../../utils/barcode.util.js';
import { getPagination } from '../../utils/pagination.js';
import { processUploadedFile } from '../../utils/file-upload.js';

export const createAdminProduct = async (req, res) => {
  let { barcode, productImage, ...productData } = req.body;

  if (barcode && barcode.trim() !== '') {
    const existing = await AdminProduct.findOne({
      barcode: barcode.trim(),
      isDeleted: false,
    });

    if (existing) {
      throw conflict('An active product with this barcode already exists');
    }
    barcode = barcode.trim();
  } else {
    // Auto-generate barcode if not provided
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      barcode = generateBarcode();
      const existing = await AdminProduct.findOne({ barcode, isDeleted: false });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    if (!isUnique) {
      throw badRequest('Failed to generate unique barcode. Please try again.');
    }
  }

  const imageUrl = await processUploadedFile(req.file, productImage, req);

  const product = await AdminProduct.create({
    ...productData,
    barcode,
    productImage: imageUrl,
  });

  const populatedProduct = await AdminProduct.findById(product._id)
    .populate('productType', 'name')
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('brand', 'name')
    .populate('unit', 'name shortName');

  return res.status(201).json(
    successResponse({
      message: 'Admin product created successfully',
      data: populatedProduct,
    })
  );
};

export const lookupByBarcode = async (req, res) => {
  const { barcode } = req.params;

  if (!barcode) {
    throw badRequest('Barcode is required');
  }

  const product = await AdminProduct.findOne({
    barcode: barcode.trim(),
    isDeleted: false,
  })
    .populate('productType', 'name')
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('brand', 'name')
    .populate('unit', 'name shortName');

  if (!product) {
    return res.status(200).json(
      successResponse({
        message: `No active product found with barcode ${barcode}`,
        data: {
          exists: false,
          barcode: barcode.trim(),
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
};

export const getAdminProducts = async (req, res) => {
  const { page = 1, limit = 10, search, category, brand, productType, status } = req.query;

  const filter = { isDeleted: false };

  if (status && status !== 'all') {
    filter.status = status;
  }
  if (category) {
    filter.category = category;
  }
  if (brand) {
    filter.brand = brand;
  }
  if (productType) {
    filter.productType = productType;
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { productName: searchRegex },
      { barcode: searchRegex },
      { hsnCode: searchRegex },
    ];
  }

  const total = await AdminProduct.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const products = await AdminProduct.find(filter)
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
      message: 'Admin products retrieved successfully',
      data: products,
      pagination,
    })
  );
};

export const getAdminProductById = async (req, res) => {
  const { id } = req.params;

  const product = await AdminProduct.findOne({ _id: id, isDeleted: false })
    .populate('productType', 'name')
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('brand', 'name')
    .populate('unit', 'name shortName');

  if (!product) {
    throw notFound('Admin product not found');
  }

  return res.status(200).json(
    successResponse({
      message: 'Admin product retrieved successfully',
      data: product,
    })
  );
};

export const updateAdminProduct = async (req, res) => {
  const { id } = req.params;
  const { productImage, ...updateData } = req.body;

  const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw notFound('Admin product not found');
  }

  if (updateData.barcode && updateData.barcode.trim() !== product.barcode) {
    const existing = await AdminProduct.findOne({
      barcode: updateData.barcode.trim(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existing) {
      throw conflict('An active product with this barcode already exists');
    }
  }

  const newImageUrl = await processUploadedFile(req.file, productImage, req);
  if (newImageUrl) {
    updateData.productImage = newImageUrl;
  }

  const updatedProduct = await AdminProduct.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate('productType', 'name')
    .populate('category', 'name')
    .populate('subcategory', 'name')
    .populate('brand', 'name')
    .populate('unit', 'name shortName');

  return res.status(200).json(
    successResponse({
      message: 'Admin product updated successfully',
      data: updatedProduct,
    })
  );
};

export const deleteAdminProduct = async (req, res) => {
  const { id } = req.params;

  const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
  if (!product) {
    throw notFound('Admin product not found');
  }

  product.isDeleted = true;
  await product.save();

  return res.status(200).json(
    successResponse({
      message: 'Admin product deleted successfully',
      data: { id: product._id },
    })
  );
};

export const getAdminProductDropdown = async (req, res) => {
  const products = await AdminProduct.find({ isDeleted: false, status: 'active' })
    .select('productName _id barcode purchasePrice mrp offlineSellingPrice onlineSellingPrice unit gstPercentage taxType')
    .populate('unit', 'name shortName')
    .sort({ productName: 1 });

  const dropdownData = products.map((p) => ({
    label: p.productName,
    value: p._id,
    barcode: p.barcode,
    purchasePrice: p.purchasePrice,
    mrp: p.mrp,
    offlineSellingPrice: p.offlineSellingPrice,
    onlineSellingPrice: p.onlineSellingPrice,
    unit: p.unit,
    gstPercentage: p.gstPercentage,
    taxType: p.taxType,
  }));

  return res.status(200).json(
    successResponse({
      message: 'Admin product dropdown options fetched successfully',
      data: dropdownData,
    })
  );
};

