import mongoose from 'mongoose';

import Tax from '../../../models/tax.model.js';

import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

const ProductType = mongoose.model('ProductType');
const Category = mongoose.model('Category');
const Subcategory = mongoose.model('Subcategory');

// CREATE TAX
export const createTax = async (req, res, next) => {
  try {
    const {
      productType,
      category,
      subcategory,
      cgst,
      sgst,
    } = req.body;

    const existingTax = await Tax.findOne({
      productType,
      category,
      subcategory,
      isDeleted: false,
    });

    if (existingTax) {
      return next(
        conflict(
          'Tax already exists for this product type, category and subcategory'
        )
      );
    }

    const tax = await Tax.create({
      productType,
      category,
      subcategory,
      cgst,
      sgst,
      createdBy: req.admin?._id,
    });

    await tax.populate([
      {
        path: 'productType',
        select: 'name',
      },
      {
        path: 'category',
        select: 'name',
      },
      {
        path: 'subcategory',
        select: 'name',
      },
    ]);

    return res.status(201).json(
      successResponse({
        message: 'Tax created successfully',
        data: {
          tax,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// GET ALL TAXES
export const getAllTaxes = async (req, res, next) => {
  try {
    const {
      search,
      productType,
      category,
      subcategory,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    // EXACT PRODUCT TYPE FILTER
    if (productType) {
      if (!mongoose.Types.ObjectId.isValid(productType)) {
        return next(
          new Error('Invalid productType ObjectId')
        );
      }

      filter.productType = productType;
    }

    // EXACT CATEGORY FILTER
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return next(
          new Error('Invalid category ObjectId')
        );
      }

      filter.category = category;
    }

    // EXACT SUBCATEGORY FILTER
    if (subcategory) {
      if (!mongoose.Types.ObjectId.isValid(subcategory)) {
        return next(
          new Error('Invalid subcategory ObjectId')
        );
      }

      filter.subcategory = subcategory;
    }

    // TEXT SEARCH
    if (search) {
      const searchRegex = {
        $regex: search.trim(),
        $options: 'i',
      };

      const [
        productTypes,
        categories,
        subcategories,
      ] = await Promise.all([
        ProductType.find({
          name: searchRegex,
        }).select('_id'),

        Category.find({
          name: searchRegex,
        }).select('_id'),

        Subcategory.find({
          name: searchRegex,
        }).select('_id'),
      ]);

      const productTypeIds = productTypes.map(
        (item) => item._id
      );

      const categoryIds = categories.map(
        (item) => item._id
      );

      const subcategoryIds = subcategories.map(
        (item) => item._id
      );

      filter.$or = [
        {
          productType: {
            $in: productTypeIds,
          },
        },
        {
          category: {
            $in: categoryIds,
          },
        },
        {
          subcategory: {
            $in: subcategoryIds,
          },
        },
      ];
    }

    const total = await Tax.countDocuments(filter);

    const pagination = getPagination({
      page,
      limit,
      total,
    });

    const taxes = await Tax.find(filter)
      .populate('productType', 'name')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Taxes fetched successfully',
        data: {
          taxes,
        },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

// GET TAX BY ID
export const getTaxById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findOne({
      _id: id,
      isDeleted: false,
    })
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
        data: {
          tax,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE TAX
export const updateTax = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      productType,
      category,
      subcategory,
      cgst,
      sgst,
    } = req.body;

    const tax = await Tax.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!tax) {
      return next(notFound('Tax not found'));
    }

    const duplicate = await Tax.findOne({
      productType,
      category,
      subcategory,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (duplicate) {
      return next(
        conflict(
          'Another tax already exists for this product type, category and subcategory'
        )
      );
    }

    tax.productType = productType;
    tax.category = category;
    tax.subcategory = subcategory;
    tax.cgst = cgst;
    tax.sgst = sgst;

    await tax.save();

    await tax.populate([
      {
        path: 'productType',
        select: 'name',
      },
      {
        path: 'category',
        select: 'name',
      },
      {
        path: 'subcategory',
        select: 'name',
      },
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Tax updated successfully',
        data: {
          tax,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// DELETE TAX
export const deleteTax = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await Tax.findOne({
      _id: id,
      isDeleted: false,
    });

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