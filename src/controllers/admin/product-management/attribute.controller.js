import Attribute from '../../../models/attribute.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

const normalizeArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

// CREATE ATTRIBUTE
export const createAttribute = async (req, res, next) => {
  try {
    const {
      attribute,
      key,
      fieldType,
      appliesTo,
      options,
      status,
    } = req.body;

    const normalizedKey = String(key).trim().toLowerCase();

    const existingAttribute = await Attribute.findOne({
      key: normalizedKey,
      isDeleted: false,
    });

    if (existingAttribute) {
      return next(
        conflict('Attribute with the same key already exists')
      );
    }

    const newAttribute = await Attribute.create({
      attribute: String(attribute).trim(),
      key: normalizedKey,
      fieldType,
      appliesTo: normalizeArray(appliesTo),
      options: normalizeArray(options),
      status: status !== undefined ? status : true,
      createdBy: req.admin?._id,
    });

    return res.status(201).json(
      successResponse({
        message: 'Attribute created successfully',
        data: {
          attribute: newAttribute,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// GET ALL ATTRIBUTES
export const getAllAttributes = async (req, res, next) => {
  try {
    const {
      search,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    // Status filter
    if (status !== undefined) {
      if (status === 'true' || status === 'active') {
        filter.status = true;
      }

      if (status === 'false' || status === 'inactive') {
        filter.status = false;
      }
    }

    // Search
    if (search) {
      filter.$or = [
        {
          attribute: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
        {
          key: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
        {
          fieldType: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
        {
          appliesTo: {
            $regex: search.trim(),
            $options: 'i',
          },
        },
      ];
    }

    const total = await Attribute.countDocuments(filter);

    const pagination = getPagination({
      page,
      limit,
      total,
    });

    const attributes = await Attribute.find(filter)
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Attributes fetched successfully',
        data: {
          attributes,
        },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

// GET ATTRIBUTE BY ID
export const getAttributeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const attribute = await Attribute.findOne({
      _id: id,
      isDeleted: false,
    }).populate('createdBy', 'name email role');

    if (!attribute) {
      return next(notFound('Attribute not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Attribute details fetched successfully',
        data: {
          attribute,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE ATTRIBUTE
export const updateAttribute = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      attribute,
      key,
      fieldType,
      appliesTo,
      options,
      status,
    } = req.body;

    const existingAttribute = await Attribute.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!existingAttribute) {
      return next(notFound('Attribute not found'));
    }

    const normalizedKey = String(key).trim().toLowerCase();

    const duplicate = await Attribute.findOne({
      key: normalizedKey,
      _id: { $ne: id },
      isDeleted: false,
    });

    if (duplicate) {
      return next(
        conflict(
          'Another attribute with the same key already exists'
        )
      );
    }

    existingAttribute.attribute = String(attribute).trim();
    existingAttribute.key = normalizedKey;
    existingAttribute.fieldType = fieldType;
    existingAttribute.appliesTo = normalizeArray(appliesTo);
    existingAttribute.options = normalizeArray(options);

    if (status !== undefined) {
      existingAttribute.status = status;
    }

    await existingAttribute.save();

    return res.status(200).json(
      successResponse({
        message: 'Attribute updated successfully',
        data: {
          attribute: existingAttribute,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// DELETE ATTRIBUTE
export const deleteAttribute = async (req, res, next) => {
  try {
    const { id } = req.params;

    const attribute = await Attribute.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!attribute) {
      return next(notFound('Attribute not found'));
    }

    attribute.isDeleted = true;

    await attribute.save();

    return res.status(200).json(
      successResponse({
        message: 'Attribute deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

// UPDATE STATUS
export const updateAttributeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const attribute = await Attribute.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!attribute) {
      return next(notFound('Attribute not found'));
    }

    attribute.status = status;

    await attribute.save();

    return res.status(200).json(
      successResponse({
        message: `Attribute ${
          status ? 'activated' : 'deactivated'
        } successfully`,
        data: {
          attribute,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};