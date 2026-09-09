import ProductType from '../../../models/productType.model.js';
import Category from '../../../models/category.model.js';
import Subcategory from '../../../models/subcategory.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { badRequest, notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import { processUploadedFile } from '../../../utils/file-upload.js';

export const syncInactiveStatuses = async () => {
  try {
    const inactiveProductTypeIds = await ProductType.find({ status: 'inactive' }).distinct('_id');
    if (inactiveProductTypeIds.length > 0) {
      await Category.updateMany(
        { productType: { $in: inactiveProductTypeIds }, status: { $ne: 'inactive' } },
        { status: 'inactive' }
      );
      await Subcategory.updateMany(
        { productType: { $in: inactiveProductTypeIds }, status: { $ne: 'inactive' } },
        { status: 'inactive' }
      );
    }

    const inactiveCategoryIds = await Category.find({ status: 'inactive' }).distinct('_id');
    if (inactiveCategoryIds.length > 0) {
      await Subcategory.updateMany(
        { category: { $in: inactiveCategoryIds }, status: { $ne: 'inactive' } },
        { status: 'inactive' }
      );
    }
  } catch (_e) {
    // silent catch
  }
};

export const createProductType = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const existing = await ProductType.findOne({ name: name.trim() });
    if (existing) {
      return next(conflict('Product Type with this name already exists'));
    }

    const image = await processUploadedFile(req.file, req.body.image, req);

    const productType = await ProductType.create({
      name: name.trim(),
      description: description || '',
      image,
      status: status || 'active',
    });

    return res.status(201).json(
      successResponse({
        message: 'Product Type created successfully',
        data: { productType },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getProductTypes = async (req, res, next) => {
  try {
    await syncInactiveStatuses();
    const { search, status, onlyActive, includeInactive, page, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
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

    const total = await ProductType.countDocuments(filter);
    const pagination = getPagination({ page: page || 1, limit, total });

    const productTypes = await ProductType.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Product Types fetched successfully',
        data: { productTypes },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getProductTypeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return next(notFound('Product Type not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Product Type details fetched successfully',
        data: { productType },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateProductType = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return next(notFound('Product Type not found'));
    }

    if (name && name.trim() !== productType.name) {
      const existing = await ProductType.findOne({ name: name.trim() });
      if (existing) {
        return next(conflict('Product Type with this name already exists'));
      }
      productType.name = name.trim();
    }

    if (description !== undefined) productType.description = description;
    if (status !== undefined) {
      productType.status = status;
      if (status === 'inactive') {
        await Category.updateMany({ productType: id }, { status: 'inactive' });
        await Subcategory.updateMany({ productType: id }, { status: 'inactive' });
      }
    }

    if (req.file || req.body.image !== undefined) {
      const newImage = await processUploadedFile(req.file, req.body.image, req);
      productType.image = newImage;
    }

    await productType.save();
    await syncInactiveStatuses();

    return res.status(200).json(
      successResponse({
        message: 'Product Type updated successfully',
        data: { productType },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const toggleProductTypeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return next(notFound('Product Type not found'));
    }

    productType.status = status || (productType.status === 'active' ? 'inactive' : 'active');
    await productType.save();

    if (productType.status === 'inactive') {
      await Category.updateMany({ productType: id }, { status: 'inactive' });
      await Subcategory.updateMany({ productType: id }, { status: 'inactive' });
    }
    await syncInactiveStatuses();

    return res.status(200).json(
      successResponse({
        message: `Product Type status changed to ${productType.status}`,
        data: { productType },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteProductType = async (req, res, next) => {
  try {
    const { id } = req.params;

    const productType = await ProductType.findById(id);
    if (!productType) {
      return next(notFound('Product Type not found'));
    }

    // Check if referenced by Categories
    const categoryCount = await Category.countDocuments({ productType: id });
    if (categoryCount > 0) {
      return next(
        badRequest(
          `Cannot delete Product Type. It is referenced by ${categoryCount} Category(ies).`
        )
      );
    }

    await productType.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Product Type deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getProductTypeDropdown = async (req, res, next) => {
  try {
    await syncInactiveStatuses();
    const productTypes = await ProductType.find({ status: 'active' })
      .select('name _id status')
      .sort({ name: 1 });

    const dropdownData = productTypes.map((pt) => ({
      label: pt.name,
      value: pt._id,
      _id: pt._id,
      id: pt._id,
      name: pt.name,
      status: pt.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Product Type dropdown options fetched successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};

