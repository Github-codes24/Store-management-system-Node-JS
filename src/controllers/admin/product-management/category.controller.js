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

    const image = await processUploadedFile(req.file, req.body.image, req);

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
    const { search, productType, status, onlyActive, includeInactive, page, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (productType) {
      filter.productType = productType;
    }

    if (status === 'inactive') {
      filter.status = 'inactive';
    } else if (status === 'all' || status === 'both' || includeInactive === 'true' || includeInactive === true) {
      // explicit all
    } else if ((status === '' || status === undefined) && page) {
      // Table view with "All Statuses" selected
    } else {
      filter.status = 'active';
    }

    // Filter out categories belonging to inactive product types when querying active categories
    if (filter.status === 'active') {
      const activeProductTypeIds = await ProductType.find({ status: 'active' }).distinct('_id');
      if (filter.productType) {
        const isParentActive = activeProductTypeIds.some(
          (apt) => apt.toString() === filter.productType.toString()
        );
        if (!isParentActive) {
          filter.productType = null; // No matching active product type
        }
      } else {
        filter.productType = { $in: activeProductTypeIds };
      }
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
    if (status !== undefined) {
      category.status = status;
      if (status === 'inactive') {
        await Subcategory.updateMany({ category: id }, { status: 'inactive' });
      }
    }

    if (req.file || req.body.image !== undefined) {
      const newImage = await processUploadedFile(req.file, req.body.image, req);
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

    if (category.status === 'inactive') {
      await Subcategory.updateMany({ category: id }, { status: 'inactive' });
    }

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

export const getCategoryDropdown = async (req, res, next) => {
  try {
    const { productType } = req.query;
    const activeProductTypeIds = await ProductType.find({ status: 'active' }).distinct('_id');

    const filter = {
      status: 'active',
      productType: { $in: activeProductTypeIds },
    };

    if (productType) {
      const isParentActive = activeProductTypeIds.some(
        (apt) => apt.toString() === productType.toString()
      );
      if (!isParentActive) {
        filter.productType = null;
      } else {
        filter.productType = productType;
      }
    }

    const categories = await Category.find(filter)
      .select('name _id productType status')
      .sort({ name: 1 });

    const dropdownData = categories.map((cat) => ({
      label: cat.name,
      value: cat._id,
      _id: cat._id,
      id: cat._id,
      name: cat.name,
      productType: cat.productType ? cat.productType.toString() : null,
      status: cat.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Category dropdown options fetched successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getCategoriesByProductType = async (req, res, next) => {
  try {
    const { productTypeId } = req.params;

    const activeProductType = await ProductType.findOne({ _id: productTypeId, status: 'active' });
    if (!activeProductType) {
      return res.status(200).json(
        successResponse({
          message: 'Categories fetched by Product Type successfully',
          data: [],
        })
      );
    }

    const categories = await Category.find({ productType: productTypeId, status: 'active' })
      .select('name _id productType status')
      .sort({ name: 1 });

    const dropdownData = categories.map((cat) => ({
      label: cat.name,
      value: cat._id.toString(),
      _id: cat._id.toString(),
      id: cat._id.toString(),
      name: cat.name,
      productType: cat.productType.toString(),
      status: cat.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Categories fetched by Product Type successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};
