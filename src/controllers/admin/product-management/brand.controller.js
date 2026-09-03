import Brand from '../../../models/brand.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import { processUploadedFile } from '../../../utils/file-upload.js';

export const createBrand = async (req, res, next) => {
  try {
    const { name, description, status } = req.body;

    const existing = await Brand.findOne({ name: name.trim() });
    if (existing) {
      return next(conflict('Brand with this name already exists'));
    }

    const rawLogo = req.body.logo || req.body.image || null;
    const logo = await processUploadedFile(req.file, rawLogo, req);

    const brand = await Brand.create({
      name: name.trim(),
      description: description || '',
      logo,
      status: status || 'active',
    });

    return res.status(201).json(
      successResponse({
        message: 'Brand created successfully',
        data: { brand },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getBrands = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const total = await Brand.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const brands = await Brand.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Brands fetched successfully',
        data: { brands },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getBrandById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);
    if (!brand) {
      return next(notFound('Brand not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Brand details fetched successfully',
        data: { brand },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const brand = await Brand.findById(id);
    if (!brand) {
      return next(notFound('Brand not found'));
    }

    if (name && name.trim() !== brand.name) {
      const existing = await Brand.findOne({ name: name.trim() });
      if (existing) {
        return next(conflict('Brand with this name already exists'));
      }
      brand.name = name.trim();
    }

    if (description !== undefined) brand.description = description;
    if (status !== undefined) brand.status = status;

    const rawLogo = req.body.logo !== undefined ? req.body.logo : req.body.image;
    if (req.file || rawLogo !== undefined) {
      const newLogo = await processUploadedFile(req.file, rawLogo, req);
      brand.logo = newLogo;
    }

    await brand.save();

    return res.status(200).json(
      successResponse({
        message: 'Brand updated successfully',
        data: { brand },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const toggleBrandStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const brand = await Brand.findById(id);
    if (!brand) {
      return next(notFound('Brand not found'));
    }

    brand.status = status || (brand.status === 'active' ? 'inactive' : 'active');
    await brand.save();

    return res.status(200).json(
      successResponse({
        message: `Brand status changed to ${brand.status}`,
        data: { brand },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brand = await Brand.findById(id);
    if (!brand) {
      return next(notFound('Brand not found'));
    }

    await brand.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Brand deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getBrandDropdown = async (req, res, next) => {
  try {
    const brands = await Brand.find({ status: 'active' })
      .select('name _id')
      .sort({ name: 1 });

    const dropdownData = brands.map((b) => ({
      label: b.name,
      value: b._id,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Brand dropdown options fetched successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};

