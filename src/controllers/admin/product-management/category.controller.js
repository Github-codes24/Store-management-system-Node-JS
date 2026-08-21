import Category from '../../../models/category.model.js';
import ProductType from '../../../models/productType.model.js';
import Subcategory from '../../../models/subcategory.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { badRequest, notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import { processUploadedFile } from '../../../utils/file-upload.js';

export const createCategory = async (req, res, next) => {
  try {
    const { name, productType, description, status } = req.body;

    const ptExists = await ProductType.findById(productType);
    if (!ptExists) {
      return next(notFound('Product Type not found'));
    }

    const existing = await Category.findOne({
      name: name.trim(),
      productType,
    });
    if (existing) {
      return next(conflict('Category with this name already exists for the selected Product Type'));
    }

    const image = processUploadedFile(req.file, req.body.image);

    const category = await Category.create({
      name: name.trim(),
      productType,
      description: description || '',
      image,
      status: status || 'active',
    });

    const populatedCategory = await category.populate('productType', 'name image status');

    return res.status(201).json(
      successResponse({
        message: 'Category created successfully',
        data: { category: populatedCategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const { search, productType, status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (productType) {
      filter.productType = productType;
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const total = await Category.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const categories = await Category.find(filter)
      .populate('productType', 'name image status')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Categories fetched successfully',
        data: { categories },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).populate('productType', 'name image status');
    if (!category) {
      return next(notFound('Category not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Category details fetched successfully',
        data: { category },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, productType, description, status } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return next(notFound('Category not found'));
    }

    const targetProductType = productType || category.productType;

    if (productType && productType !== category.productType.toString()) {
      const ptExists = await ProductType.findById(productType);
      if (!ptExists) {
        return next(notFound('Product Type not found'));
      }
      category.productType = productType;
    }

    if (name && (name.trim() !== category.name || category.isModified('productType'))) {
      const existing = await Category.findOne({
        name: name.trim(),
        productType: targetProductType,
        _id: { $ne: id },
      });
      if (existing) {
        return next(conflict('Category with this name already exists for the selected Product Type'));
      }
      category.name = name.trim();
    }

    if (description !== undefined) category.description = description;
    if (status !== undefined) category.status = status;

    const newImage = processUploadedFile(req.file, req.body.image);
    if (newImage) {
      category.image = newImage;
    }

    await category.save();
    const updatedCategory = await category.populate('productType', 'name image status');

    return res.status(200).json(
      successResponse({
        message: 'Category updated successfully',
        data: { category: updatedCategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return next(notFound('Category not found'));
    }

    category.status = status || (category.status === 'active' ? 'inactive' : 'active');
    await category.save();
    const updatedCategory = await category.populate('productType', 'name image status');

    return res.status(200).json(
      successResponse({
        message: `Category status changed to ${category.status}`,
        data: { category: updatedCategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return next(notFound('Category not found'));
    }

    // Check if referenced by Subcategories
    const subcategoryCount = await Subcategory.countDocuments({ category: id });
    if (subcategoryCount > 0) {
      return next(
        badRequest(
          `Cannot delete Category. It is referenced by ${subcategoryCount} Subcategory(ies).`
        )
      );
    }

    await category.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Category deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
