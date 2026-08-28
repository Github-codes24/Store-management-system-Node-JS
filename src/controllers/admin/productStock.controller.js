import AdminProduct from '../../models/adminProduct.model.js';
import { badRequest, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';
import { generateBarcodeSvg, generateBarcodePdfBuffer } from '../../utils/barcode.util.js';
import ExcelJS from 'exceljs';

/**
 * Computes stock status badge text and code for a product record
 * @param {Object} product 
 * @returns {Object} { statusText: string, statusCode: string }
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

  const minAlert = Number(product.minStockAlert) || 0;
  const reorder = Number(product.reorderPoint) || 0;
  const threshold = minAlert > 0 ? minAlert : reorder;

  if (threshold > 0 && stock <= threshold) {
    return { statusText: 'Low Stock', statusCode: 'low_stock' };
  }

  return { statusText: 'Active', statusCode: 'active' };
};

/**
 * Helper to build Mongoose filter query from request params
 */
const buildProductStockFilter = (queryParams) => {
  const { search, productType, category, subcategory, brand, status } = queryParams;

  const filter = { isDeleted: false };

  if (productType) filter.productType = productType;
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (brand) filter.brand = brand;

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { productName: searchRegex },
      { barcode: searchRegex },
      { hsnCode: searchRegex },
    ];
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (status && status !== 'all') {
    switch (status) {
      case 'active':
        filter.status = 'active';
        filter.stockQuantity = { $gt: 0 };
        break;
      case 'inactive':
        filter.status = 'inactive';
        break;
      case 'out_of_stock':
      case 'sold':
        filter.stockQuantity = 0;
        break;
      case 'low_stock':
        filter.stockQuantity = { $gt: 0 };
        filter.$or = [
          { $expr: { $lte: ['$stockQuantity', '$minStockAlert'] } },
          { $expr: { $lte: ['$stockQuantity', '$reorderPoint'] } },
        ];
        break;
      case 'near_expiry':
        filter.expiryDate = { $ne: null, $lte: thirtyDaysLater };
        break;
      default:
        break;
    }
  }

  return filter;
};

/**
 * Get Product Stock List with pagination, search, and multi-field filters
 * Matching Figma Screen 1 & Screen 2
 */
export const getProductStocks = async (req, res, next) => {
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

    const filter = buildProductStockFilter({ search, productType, category, subcategory, brand, status });

    const total = await AdminProduct.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const products = await AdminProduct.find(filter)
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
      const brandName = product.brand?.name || '-';

      return {
        _id: product._id,
        srNo: pagination.skip + index + 1,
        productName: product.productName,
        productImage: product.productImage,
        barcode: product.barcode,
        brand: product.brand,
        brandName,
        productType: product.productType,
        category: product.category,
        subcategory: product.subcategory,
        unit: product.unit,
        unitShortName,
        mrp: product.mrp,
        onlineSellingPrice: product.onlineSellingPrice,
        offlineSellingPrice: product.offlineSellingPrice,
        purchasePrice: product.purchasePrice,
        stockQuantity: product.stockQuantity,
        stockDisplay: `${product.stockQuantity} ${unitShortName}`,
        minStockAlert: product.minStockAlert,
        reorderPoint: product.reorderPoint,
        manufactureDate: product.manufactureDate,
        expiryDate: product.expiryDate,
        hsnCode: product.hsnCode,
        status: product.status,
        stockStatus: statusText,
        stockStatusCode: statusCode,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    return res.status(200).json(
      successResponse({
        message: 'Product stocks retrieved successfully',
        data: stockItems,
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Product Stock Summary Metrics (Count of total, active, low stock, near expiry, out of stock)
 */
export const getProductStockSummary = async (req, res, next) => {
  try {
    const products = await AdminProduct.find({ isDeleted: false });

    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let totalProducts = products.length;
    let activeProducts = 0;
    let inactiveProducts = 0;
    let lowStockProducts = 0;
    let nearExpiryProducts = 0;
    let outOfStockProducts = 0;
    let totalStockQuantity = 0;
    let totalStockValue = 0;

    products.forEach((product) => {
      totalStockQuantity += product.stockQuantity || 0;
      totalStockValue += (product.stockQuantity || 0) * (product.offlineSellingPrice || product.purchasePrice || 0);

      const { statusCode } = computeStockStatus(product);

      if (product.status === 'inactive') {
        inactiveProducts++;
      }
      if (statusCode === 'active') {
        activeProducts++;
      } else if (statusCode === 'low_stock') {
        lowStockProducts++;
      } else if (statusCode === 'near_expiry') {
        nearExpiryProducts++;
      } else if (statusCode === 'out_of_stock') {
        outOfStockProducts++;
      }
    });

    return res.status(200).json(
      successResponse({
        message: 'Product stock summary metrics retrieved successfully',
        data: {
          totalProducts,
          activeProducts,
          inactiveProducts,
          lowStockProducts,
          nearExpiryProducts,
          outOfStockProducts,
          totalStockQuantity,
          totalStockValue,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Product Stock Details By ID
 * Matching Figma Screen 3 & Screen 4
 */
export const getProductStockById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    if (!product) {
      throw notFound('Product stock record not found');
    }

    const { statusText, statusCode } = computeStockStatus(product);
    const unitShortName = product.unit?.shortName || product.unit?.name || 'pc';

    // Barcode SVG visualization
    const barcodeSvg = generateBarcodeSvg(product.barcode);

    // Tax breakdown calculation
    const gstRate = product.gstPercentage || 0;
    const cgstRate = product.cgstPercentage || gstRate / 2;
    const sgstRate = product.sgstPercentage || gstRate / 2;

    const formattedDetails = {
      _id: product._id,
      productDetails: {
        productName: product.productName,
        productImage: product.productImage,
        barcode: product.barcode,
        barcodeSvg,
        productType: product.productType?.name || '',
        productTypeId: product.productType?._id || null,
        category: product.category?.name || '',
        categoryId: product.category?._id || null,
        subcategory: product.subcategory?.name || '',
        subcategoryId: product.subcategory?._id || null,
        brand: product.brand?.name || '',
        brandId: product.brand?._id || null,
      },
      priceAndGstDetails: {
        mrp: product.mrp,
        onlineSellingPrice: product.onlineSellingPrice,
        offlineSellingPrice: product.offlineSellingPrice,
        purchasePrice: product.purchasePrice,
        taxType: product.taxType || 'GST Invoice',
        gstPercentage: product.gstPercentage || 0,
        cgstPercentage: cgstRate,
        sgstPercentage: sgstRate,
      },
      stockDetails: {
        stockQuantity: product.stockQuantity,
        unit: product.unit?.name || '',
        unitShortName,
        stockDisplay: `${product.stockQuantity} ${unitShortName}`,
        minStockQuantityForAlert: product.minStockAlert,
        reorderingPoint: product.reorderPoint,
        manufactureDate: product.manufactureDate,
        expiryDate: product.expiryDate,
        hsnCode: product.hsnCode || '',
        status: product.status,
        stockStatus: statusText,
        stockStatusCode: statusCode,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return res.status(200).json(
      successResponse({
        message: 'Product stock details retrieved successfully',
        data: formattedDetails,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Product Stock Record
 */
export const updateProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Product stock record not found');
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

    const { statusText, statusCode } = computeStockStatus(updatedProduct);

    return res.status(200).json(
      successResponse({
        message: 'Product stock updated successfully',
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
 * Toggle Product Status (Active / Inactive)
 * Matching row action toggle switch in Figma Screen 1
 */
export const updateStockStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Product stock record not found');
    }

    product.status = status;
    await product.save();

    const { statusText, statusCode } = computeStockStatus(product);

    return res.status(200).json(
      successResponse({
        message: `Product stock status updated to ${status}`,
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
 * Direct Stock Quantity Adjustment (Set, Add, or Subtract stock count)
 */
export const adjustStockQuantity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stockQuantity, operation = 'set' } = req.body;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Product stock record not found');
    }

    let newStock = product.stockQuantity;
    const qty = Number(stockQuantity);

    if (operation === 'add') {
      newStock += qty;
    } else if (operation === 'subtract') {
      newStock = Math.max(0, newStock - qty);
    } else {
      newStock = qty;
    }

    product.stockQuantity = newStock;
    await product.save();

    const { statusText, statusCode } = computeStockStatus(product);

    return res.status(200).json(
      successResponse({
        message: `Product stock quantity adjusted to ${newStock}`,
        data: {
          _id: product._id,
          stockQuantity: product.stockQuantity,
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
 * Soft delete Product Stock
 */
export const deleteProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false });
    if (!product) {
      throw notFound('Product stock record not found');
    }

    product.isDeleted = true;
    await product.save();

    return res.status(200).json(
      successResponse({
        message: 'Product stock deleted successfully',
        data: { id: product._id },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Export Product Stocks to Excel / CSV / JSON
 * Matching Export button in Figma Screen 1
 */
export const exportProductStocks = async (req, res, next) => {
  try {
    const { search, productType, category, subcategory, brand, status = 'all', format = 'excel' } = req.query;

    const filter = buildProductStockFilter({ search, productType, category, subcategory, brand, status });

    const products = await AdminProduct.find(filter)
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
        brand: p.brand?.name || '-',
        category: p.category?.name || '-',
        subcategory: p.subcategory?.name || '-',
        mrp: p.mrp || 0,
        onlinePrice: p.onlineSellingPrice || 0,
        offlinePrice: p.offlineSellingPrice || 0,
        purchasePrice: p.purchasePrice || 0,
        stockQuantity: p.stockQuantity,
        stockDisplay: `${p.stockQuantity} ${unitStr}`,
        status: statusText,
        hsnCode: p.hsnCode || '-',
      };
    });

    if (format === 'json') {
      return res.status(200).json(
        successResponse({
          message: 'Product stock export data generated successfully',
          data: { exportRows, totalCount: exportRows.length },
        })
      );
    }

    if (format === 'csv') {
      let csvContent = 'Sr.No.,Product Name,Barcode,Brand,Category,MRP,Online Price,Offline Price,Stock,Status,HSN Code\n';
      exportRows.forEach((r) => {
        csvContent += `"${r.srNo}","${r.productName.replace(/"/g, '""')}","${r.barcode}","${r.brand}","${r.category}",${r.mrp},${r.onlinePrice},${r.offlinePrice},"${r.stockDisplay}","${r.status}","${r.hsnCode}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="product_stocks.csv"');
      return res.status(200).send(csvContent);
    }

    // Excel format using ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product Stock');

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
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
    ];

    // Header styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E65100' }, // Vibrant orange header
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    exportRows.forEach((row) => {
      worksheet.addRow(row);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="product_stocks.xlsx"');

    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    next(error);
  }
};

/**
 * Print Barcode Labels
 * Matching Figma Screen 5 (Print Barcode Modal)
 */
export const printBarcode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quantity = req.body?.quantity || req.query?.quantity || 1;

    const product = await AdminProduct.findOne({ _id: id, isDeleted: false })
      .populate('brand', 'name')
      .populate('unit', 'name shortName');

    if (!product) {
      throw notFound('Product not found');
    }

    const printableQty = Math.max(1, parseInt(quantity, 10) || 1);

    // If PDF format requested via query or Accept header or GET request
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

    // Standard JSON payload response containing printable label metadata & SVG
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
            price: product.onlineSellingPrice || product.mrp,
          }),
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
