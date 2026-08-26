import Attribute from '../../../models/attribute.model.js';
import ProductType from '../../../models/productType.model.js';
import Category from '../../../models/category.model.js';
import Subcategory from '../../../models/subcategory.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

const normalizeArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveStatus = (statusVal) => {
  if (statusVal === true || statusVal === 'true' || statusVal === 'active') {
    return 'active';
  }
  if (statusVal === false || statusVal === 'false' || statusVal === 'inactive') {
    return 'inactive';
  }
  return 'active';
};

// CREATE ATTRIBUTE
export const createAttribute = async (req, res, next) => {
  try {
    const {
      displayLabel,
      attribute,
      attributeKey,
      key,
      fieldType,
      productTypes,
      categories,
      subcategories,
      appliesTo,
      placeholder,
      isRequired,
      options,
      optionValues,
      status,
    } = req.body;

    const label = String(displayLabel || attribute || '').trim();
    const normalizedKey = String(attributeKey || key || '').trim().toLowerCase();
    const opts = normalizeArray(optionValues && optionValues.length ? optionValues : options);
    const pTypes = normalizeArray(productTypes);
    const cats = normalizeArray(categories);
    const subCats = normalizeArray(subcategories);
    let explicitAppliesTo = normalizeArray(appliesTo);

    // If appliesTo not provided, build labels from referenced product types, categories, subcategories
    if (explicitAppliesTo.length === 0) {
      if (pTypes.length > 0) {
        const foundPT = await ProductType.find({ _id: { $in: pTypes } }).select('name');
        explicitAppliesTo.push(...foundPT.map((p) => p.name));
      }
      if (cats.length > 0) {
        const foundC = await Category.find({ _id: { $in: cats } }).select('name');
        explicitAppliesTo.push(...foundC.map((c) => c.name));
      }
      if (subCats.length > 0) {
        const foundSC = await Subcategory.find({ _id: { $in: subCats } }).select('name');
        explicitAppliesTo.push(...foundSC.map((s) => s.name));
      }
    }

    const existingAttribute = await Attribute.findOne({
      $or: [{ attributeKey: normalizedKey }, { key: normalizedKey }],
      isDeleted: false,
    });

    if (existingAttribute) {
      return next(conflict('Attribute with the same key already exists'));
    }

    const newAttribute = await Attribute.create({
      displayLabel: label,
      attribute: label,
      attributeKey: normalizedKey,
      key: normalizedKey,
      fieldType,
      productTypes: pTypes,
      categories: cats,
      subcategories: subCats,
      appliesTo: explicitAppliesTo,
      placeholder: placeholder ? String(placeholder).trim() : '',
      isRequired: Boolean(isRequired),
      options: opts,
      optionValues: opts,
      status: resolveStatus(status),
      createdBy: req.admin?._id,
    });

    const populated = await Attribute.findById(newAttribute._id)
      .populate('productTypes', 'name')
      .populate('categories', 'name')
      .populate('subcategories', 'name')
      .populate('createdBy', 'name email role');

    return res.status(201).json(
      successResponse({
        message: 'Attribute created successfully',
        data: {
          attribute: populated,
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
    const { search, status, fieldType, page = 1, limit = 10 } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (status !== undefined && status !== '') {
      filter.status = resolveStatus(status);
    }

    if (fieldType) {
      filter.fieldType = fieldType.trim();
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { displayLabel: regex },
        { attribute: regex },
        { attributeKey: regex },
        { key: regex },
        { fieldType: regex },
        { appliesTo: regex },
      ];
    }

    const total = await Attribute.countDocuments(filter);

    const pagination = getPagination({
      page,
      limit,
      total,
    });

    const attributes = await Attribute.find(filter)
      .populate('productTypes', 'name')
      .populate('categories', 'name')
      .populate('subcategories', 'name')
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
    })
      .populate('productTypes', 'name')
      .populate('categories', 'name')
      .populate('subcategories', 'name')
      .populate('createdBy', 'name email role');

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
      displayLabel,
      attribute,
      attributeKey,
      key,
      fieldType,
      productTypes,
      categories,
      subcategories,
      appliesTo,
      placeholder,
      isRequired,
      options,
      optionValues,
      status,
    } = req.body;

    const existingAttribute = await Attribute.findOne({
      _id: id,
      isDeleted: false,
    });

    if (!existingAttribute) {
      return next(notFound('Attribute not found'));
    }

    const newKey = attributeKey || key;
    if (newKey) {
      const normalizedKey = String(newKey).trim().toLowerCase();
      const duplicate = await Attribute.findOne({
        $or: [{ attributeKey: normalizedKey }, { key: normalizedKey }],
        _id: { $ne: id },
        isDeleted: false,
      });

      if (duplicate) {
        return next(conflict('Another attribute with the same key already exists'));
      }
      existingAttribute.attributeKey = normalizedKey;
      existingAttribute.key = normalizedKey;
    }

    const newLabel = displayLabel || attribute;
    if (newLabel) {
      existingAttribute.displayLabel = String(newLabel).trim();
      existingAttribute.attribute = String(newLabel).trim();
    }

    if (fieldType) {
      existingAttribute.fieldType = fieldType;
    }

    if (productTypes !== undefined) {
      existingAttribute.productTypes = normalizeArray(productTypes);
    }
    if (categories !== undefined) {
      existingAttribute.categories = normalizeArray(categories);
    }
    if (subcategories !== undefined) {
      existingAttribute.subcategories = normalizeArray(subcategories);
    }

    if (appliesTo !== undefined) {
      existingAttribute.appliesTo = normalizeArray(appliesTo);
    }

    if (placeholder !== undefined) {
      existingAttribute.placeholder = String(placeholder).trim();
    }

    if (isRequired !== undefined) {
      existingAttribute.isRequired = Boolean(isRequired);
    }

    const opts = optionValues || options;
    if (opts !== undefined) {
      const normalizedOpts = normalizeArray(opts);
      existingAttribute.options = normalizedOpts;
      existingAttribute.optionValues = normalizedOpts;
    }

    if (status !== undefined) {
      existingAttribute.status = resolveStatus(status);
    }

    await existingAttribute.save();

    const updated = await Attribute.findById(id)
      .populate('productTypes', 'name')
      .populate('categories', 'name')
      .populate('subcategories', 'name')
      .populate('createdBy', 'name email role');

    return res.status(200).json(
      successResponse({
        message: 'Attribute updated successfully',
        data: {
          attribute: updated,
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

    attribute.status = resolveStatus(status);
    await attribute.save();

    return res.status(200).json(
      successResponse({
        message: `Attribute status changed to ${attribute.status}`,
        data: {
          attribute,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};