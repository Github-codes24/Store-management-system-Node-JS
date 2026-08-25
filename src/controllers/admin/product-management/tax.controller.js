import Tax from '../../../models/tax.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

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
      productType: productType.trim(),
      category: category.trim(),
      subcategory: subcategory.trim(),
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
      productType: productType.trim(),
      category: category.trim(),
      subcategory: subcategory.trim(),
      cgst,
      sgst,
      createdBy: req.admin?._id,
    });

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

    // PRODUCT TYPE FILTER
    if (productType) {
      filter.productType = {
        $regex: productType.trim(),
        $options: 'i',
      };
    }

    // CATEGORY FILTER
    if (category) {
      filter.category = {
        $regex: category.trim(),
        $options: 'i',
      };
    }

    // SUBCATEGORY FILTER
    if (subcategory) {
      filter.subcategory = {
        $regex: subcategory.trim(),
        $options: 'i',
      };
    }

    // SEARCH
    if (search) {
      filter.$or = [
        {
          productType: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
        {
          category: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
        {
          subcategory: {
            $regex: search.trim(),
            $options: 'i',
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
    }).populate('createdBy', 'name email role');

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
      productType: productType.trim(),
      category: category.trim(),
      subcategory: subcategory.trim(),
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

    tax.productType = productType.trim();
    tax.category = category.trim();
    tax.subcategory = subcategory.trim();
    tax.cgst = cgst;
    tax.sgst = sgst;

    await tax.save();

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