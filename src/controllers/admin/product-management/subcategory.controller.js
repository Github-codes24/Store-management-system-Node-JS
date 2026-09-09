import Subcategory from '../../../models/subcategory.model.js';
import Category from '../../../models/category.model.js';
import ProductType from '../../../models/productType.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { badRequest, notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import { processUploadedFile } from '../../../utils/file-upload.js';

export const createSubcategory = async (req, res, next) => {
  try {
    const { name, productType, category, description, status } = req.body;

    const ptExists = await ProductType.findById(productType);
    if (!ptExists) {
      return next(notFound('Product Type not found'));
    }

    const catExists = await Category.findById(category);
    if (!catExists) {
      return next(notFound('Category not found'));
    }

    if (catExists.productType.toString() !== productType) {
      return next(badRequest('Category does not belong to the specified Product Type'));
    }

    const existing = await Subcategory.findOne({
      name: name.trim(),
      category,
    });
    if (existing) {
      return next(conflict('Subcategory with this name already exists for the selected Category'));
    }

    const image = await processUploadedFile(req.file, req.body.image, req);

    const subcategory = await Subcategory.create({
      name: name.trim(),
      productType,
      category,
      description: description || '',
      image,
      status: status || 'active',
    });

    const populated = await subcategory.populate([
      { path: 'productType', select: 'name image status' },
      { path: 'category', select: 'name image status' },
    ]);

    return res.status(201).json(
      successResponse({
        message: 'Subcategory created successfully',
        data: { subcategory: populated },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getSubcategories = async (req, res, next) => {
  try {
    const { search, productType, category, status, onlyActive, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (productType) {
      filter.productType = productType;
    }

    if (category) {
      filter.category = category;
    }

    if (onlyActive === 'true' || onlyActive === true) {
      filter.status = 'active';
    } else if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    if (filter.status === 'active') {
      const activeProductTypeIds = await ProductType.find({ status: 'active' }).distinct('_id');
      const activeCategoryIds = await Category.find({
        status: 'active',
        productType: { $in: activeProductTypeIds },
      }).distinct('_id');

      if (filter.productType) {
        const isPtActive = activeProductTypeIds.some(
          (apt) => apt.toString() === filter.productType.toString()
        );
        if (!isPtActive) filter.productType = null;
      } else {
        filter.productType = { $in: activeProductTypeIds };
      }

      if (filter.category) {
        const isCatActive = activeCategoryIds.some(
          (ac) => ac.toString() === filter.category.toString()
        );
        if (!isCatActive) filter.category = null;
      } else {
        filter.category = { $in: activeCategoryIds };
      }
    }

    const total = await Subcategory.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const subcategories = await Subcategory.find(filter)
      .populate([
        { path: 'productType', select: 'name image status' },
        { path: 'category', select: 'name image status' },
      ])
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Subcategories fetched successfully',
        data: { subcategories },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getSubcategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id).populate([
      { path: 'productType', select: 'name image status' },
      { path: 'category', select: 'name image status' },
    ]);

    if (!subcategory) {
      return next(notFound('Subcategory not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Subcategory details fetched successfully',
        data: { subcategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateSubcategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, productType, category, description, status } = req.body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return next(notFound('Subcategory not found'));
    }

    const targetCategory = category || subcategory.category;
    const targetProductType = productType || subcategory.productType;

    if (productType && productType !== subcategory.productType.toString()) {
      const ptExists = await ProductType.findById(productType);
      if (!ptExists) return next(notFound('Product Type not found'));
      subcategory.productType = productType;
    }

    if (category && category !== subcategory.category.toString()) {
      const catExists = await Category.findById(category);
      if (!catExists) return next(notFound('Category not found'));
      if (catExists.productType.toString() !== targetProductType.toString()) {
        return next(badRequest('Category does not belong to the specified Product Type'));
      }
      subcategory.category = category;
    }

    if (name && (name.trim() !== subcategory.name || subcategory.isModified('category'))) {
      const existing = await Subcategory.findOne({
        name: name.trim(),
        category: targetCategory,
        _id: { $ne: id },
      });
      if (existing) {
        return next(conflict('Subcategory with this name already exists for the selected Category'));
      }
      subcategory.name = name.trim();
    }

    if (description !== undefined) subcategory.description = description;
    if (status !== undefined) subcategory.status = status;

    if (req.file || req.body.image !== undefined) {
      const newImage = await processUploadedFile(req.file, req.body.image, req);
      subcategory.image = newImage;
    }

    await subcategory.save();

    const updatedSubcategory = await subcategory.populate([
      { path: 'productType', select: 'name image status' },
      { path: 'category', select: 'name image status' },
    ]);

    return res.status(200).json(
      successResponse({
        message: 'Subcategory updated successfully',
        data: { subcategory: updatedSubcategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const toggleSubcategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return next(notFound('Subcategory not found'));
    }

    subcategory.status = status || (subcategory.status === 'active' ? 'inactive' : 'active');
    await subcategory.save();

    const updatedSubcategory = await subcategory.populate([
      { path: 'productType', select: 'name image status' },
      { path: 'category', select: 'name image status' },
    ]);

    return res.status(200).json(
      successResponse({
        message: `Subcategory status changed to ${subcategory.status}`,
        data: { subcategory: updatedSubcategory },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteSubcategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return next(notFound('Subcategory not found'));
    }

    await subcategory.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Subcategory deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getSubcategoryDropdown = async (req, res, next) => {
  try {
    const { category, productType } = req.query;

    const activeProductTypeIds = await ProductType.find({ status: 'active' }).distinct('_id');
    const activeCategoryIds = await Category.find({
      status: 'active',
      productType: { $in: activeProductTypeIds },
    }).distinct('_id');

    const filter = {
      status: 'active',
      category: { $in: activeCategoryIds },
      productType: { $in: activeProductTypeIds },
    };

    if (category) {
      const isCatActive = activeCategoryIds.some(
        (ac) => ac.toString() === category.toString()
      );
      if (!isCatActive) {
        filter.category = null;
      } else {
        filter.category = category;
      }
    }

    if (productType) {
      const isPtActive = activeProductTypeIds.some(
        (apt) => apt.toString() === productType.toString()
      );
      if (!isPtActive) {
        filter.productType = null;
      } else {
        filter.productType = productType;
      }
    }

    const subcategories = await Subcategory.find(filter)
      .select('name _id category productType status')
      .sort({ name: 1 });

    const dropdownData = subcategories.map((sub) => ({
      label: sub.name,
      value: sub._id,
      _id: sub._id,
      id: sub._id,
      name: sub.name,
      category: sub.category ? sub.category.toString() : null,
      productType: sub.productType ? sub.productType.toString() : null,
      status: sub.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Subcategory dropdown options fetched successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getSubcategoriesByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const activeProductTypeIds = await ProductType.find({ status: 'active' }).distinct('_id');
    const activeCategory = await Category.findOne({
      _id: categoryId,
      status: 'active',
      productType: { $in: activeProductTypeIds },
    });

    if (!activeCategory) {
      return res.status(200).json(
        successResponse({
          message: 'Subcategories fetched by Category successfully',
          data: [],
        })
      );
    }

    const subcategories = await Subcategory.find({
      category: categoryId,
      status: 'active',
      productType: { $in: activeProductTypeIds },
    })
      .select('name _id category productType status')
      .sort({ name: 1 });

    const dropdownData = subcategories.map((sub) => ({
      label: sub.name,
      value: sub._id.toString(),
      _id: sub._id.toString(),
      id: sub._id.toString(),
      name: sub.name,
      category: sub.category.toString(),
      productType: sub.productType ? sub.productType.toString() : null,
      status: sub.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Subcategories fetched by Category successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};
