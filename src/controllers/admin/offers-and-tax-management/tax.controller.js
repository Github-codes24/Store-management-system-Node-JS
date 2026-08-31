import Tax from '../../../models/tax.model.js';
import ProductType from '../../../models/productType.model.js';
import Category from '../../../models/category.model.js';
import Subcategory from '../../../models/subcategory.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

/**
 * Get Filter Options for Tax Management (Populates Product Types, Categories, and Subcategories for Filter Modal & Tax Forms)
 */
export const getTaxFilterOptions = async (_req, res, next) => {
  try {
    const productTypes = await ProductType.find({ status: 'active' }).select('_id name').sort({ name: 1 });
    const categories = await Category.find({ status: 'active' }).select('_id name productType').sort({ name: 1 });
    const subcategories = await Subcategory.find({ status: 'active' }).select('_id name category productType').sort({ name: 1 });

    const formattedProductTypes = productTypes.map((pt) => ({
      label: pt.name,
      value: pt._id.toString(),
    }));

    const formattedCategories = categories.map((c) => ({
      label: c.name,
      value: c._id.toString(),
      productType: c.productType ? c.productType.toString() : null,
    }));

    const formattedSubcategories = subcategories.map((sc) => ({
      label: sc.name,
      value: sc._id.toString(),
      category: sc.category ? sc.category.toString() : null,
      productType: sc.productType ? sc.productType.toString() : null,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Tax filter options fetched successfully',
        data: {
          productTypes: formattedProductTypes,
          categories: formattedCategories,
          subcategories: formattedSubcategories,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Tax rule
 */
export const createTax = async (req, res, next) => {
  try {
    const { productType, category, subcategory, cgst, sgst } = req.body;

    // Verify ProductType exists in DB
    const validProductType = await ProductType.findById(productType);
    if (!validProductType) {
      return next(notFound('Product Type not found or invalid'));
    }

    // Verify Category exists in DB
    const validCategory = await Category.findById(category);
    if (!validCategory) {
      return next(notFound('Category not found or invalid'));
    }

    // Verify Subcategory exists in DB
    const validSubcategory = await Subcategory.findById(subcategory);
    if (!validSubcategory) {
      return next(notFound('Subcategory not found or invalid'));
    }

    const existingTax = await Tax.findOne({
      productType,
      category,
      subcategory,
      isDeleted: false,
    });

    if (existingTax) {
      return next(conflict('Tax rule already exists for this Product Type, Category, and Subcategory combination'));
    }

    const tax = await Tax.create({
      productType,
      category,
      subcategory,
      cgst: Number(cgst),
      sgst: Number(sgst),
      createdBy: req.admin?._id,
    });

    const populatedTax = await Tax.findById(tax._id)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('createdBy', 'name email role');

    return res.status(201).json(
      successResponse({
        message: 'Tax created successfully',
        data: { tax: populatedTax },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Tax rules with search, Filter Modal filters (productType, category, subcategory), and pagination
 */
export const getAllTaxes = async (req, res, next) => {
  try {
    const { search, productType, category, subcategory, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (productType) {
      filter.productType = productType;
    }

    if (category) {
      filter.category = category;
    }

    if (subcategory) {
      filter.subcategory = subcategory;
    }

    let taxes = await Tax.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    if (search) {
      const query = search.trim().toLowerCase();
      taxes = taxes.filter(
        (t) =>
          t.productType?.name?.toLowerCase().includes(query) ||
          t.category?.name?.toLowerCase().includes(query) ||
          t.subcategory?.name?.toLowerCase().includes(query)
      );
    }

    const total = taxes.length;
    const pagination = getPagination({ page, limit, total });
    const paginatedTaxes = taxes.slice(pagination.skip, pagination.skip + pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Taxes fetched successfully',
        data: { taxes: paginatedTaxes },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Tax details by ID
 */
export const getTaxById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findOne({ _id: id, isDeleted: false })
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('createdBy', 'name email role');

    if (!tax) {
      return next(notFound('Tax not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Tax details fetched successfully',
        data: { tax },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Tax rule
 */
export const updateTax = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { productType, category, subcategory, cgst, sgst } = req.body;

    const tax = await Tax.findOne({ _id: id, isDeleted: false });
    if (!tax) {
      return next(notFound('Tax not found'));
    }

    if (productType) {
      const validProductType = await ProductType.findById(productType);
      if (!validProductType) {
        return next(notFound('Product Type not found or invalid'));
      }
    }

    if (category) {
      const validCategory = await Category.findById(category);
      if (!validCategory) {
        return next(notFound('Category not found or invalid'));
      }
    }

    if (subcategory) {
      const validSubcategory = await Subcategory.findById(subcategory);
      if (!validSubcategory) {
        return next(notFound('Subcategory not found or invalid'));
      }
    }

    const targetProductType = productType || tax.productType;
    const targetCategory = category || tax.category;
    const targetSubcategory = subcategory || tax.subcategory;

    const duplicate = await Tax.findOne({
      productType: targetProductType,
      category: targetCategory,
      subcategory: targetSubcategory,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (duplicate) {
      return next(conflict('Another tax rule already exists for this Product Type, Category, and Subcategory combination'));
    }

    if (productType) tax.productType = productType;
    if (category) tax.category = category;
    if (subcategory) tax.subcategory = subcategory;
    if (cgst !== undefined) tax.cgst = Number(cgst);
    if (sgst !== undefined) tax.sgst = Number(sgst);

    await tax.save();

    const updatedTax = await Tax.findById(id)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('createdBy', 'name email role');

    return res.status(200).json(
      successResponse({
        message: 'Tax updated successfully',
        data: { tax: updatedTax },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Tax rule (soft delete)
 */
export const deleteTax = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findOne({ _id: id, isDeleted: false });
    if (!tax) {
      return next(notFound('Tax not found'));
    }

    tax.isDeleted = true;
    await tax.save();

    return res.status(200).json(
      successResponse({
        message: 'Tax deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
