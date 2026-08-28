import Unit from '../../../models/unit.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

export const createUnit = async (req, res, next) => {
  try {
    const { name, shortName, allowDecimal, status } = req.body;

    const existing = await Unit.findOne({ name: name.trim() });
    if (existing) {
      return next(conflict('Unit with this name already exists'));
    }

    const unit = await Unit.create({
      name: name.trim(),
      shortName: shortName.trim(),
      allowDecimal: Boolean(allowDecimal),
      status: status || 'active',
    });

    return res.status(201).json(
      successResponse({
        message: 'Unit created successfully',
        data: { unit },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getUnits = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { shortName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const total = await Unit.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const units = await Unit.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Units fetched successfully',
        data: { units },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getUnitById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const unit = await Unit.findById(id);
    if (!unit) {
      return next(notFound('Unit not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Unit details fetched successfully',
        data: { unit },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, shortName, allowDecimal, status } = req.body;

    const unit = await Unit.findById(id);
    if (!unit) {
      return next(notFound('Unit not found'));
    }

    if (name && name.trim() !== unit.name) {
      const existing = await Unit.findOne({ name: name.trim() });
      if (existing) {
        return next(conflict('Unit with this name already exists'));
      }
      unit.name = name.trim();
    }

    if (shortName !== undefined) unit.shortName = shortName.trim();
    if (allowDecimal !== undefined) unit.allowDecimal = Boolean(allowDecimal);
    if (status !== undefined) unit.status = status;

    await unit.save();

    return res.status(200).json(
      successResponse({
        message: 'Unit updated successfully',
        data: { unit },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const toggleUnitStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const unit = await Unit.findById(id);
    if (!unit) {
      return next(notFound('Unit not found'));
    }

    unit.status = status || (unit.status === 'active' ? 'inactive' : 'active');
    await unit.save();

    return res.status(200).json(
      successResponse({
        message: `Unit status changed to ${unit.status}`,
        data: { unit },
      })
    );
  } catch (error) {
    next(error);
  }
};

export const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const unit = await Unit.findById(id);
    if (!unit) {
      return next(notFound('Unit not found'));
    }

    await unit.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Unit deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getUnitDropdown = async (req, res, next) => {
  try {
    const units = await Unit.find({ status: 'active' })
      .select('name shortName _id')
      .sort({ name: 1 });

    const dropdownData = units.map((u) => ({
      label: u.shortName ? `${u.name} (${u.shortName})` : u.name,
      value: u._id,
      shortName: u.shortName,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Unit dropdown options fetched successfully',
        data: dropdownData,
      })
    );
  } catch (error) {
    next(error);
  }
};

