import SubAdmin from '../../../models/subAdmin.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';

/**
 * Create a new Sub-Admin
 */
export const createSubAdmin = async (req, res, next) => {
  try {
    const { employeeName, email, mobile, password, designation, address, status } = req.body;

    const existingEmail = await SubAdmin.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return next(conflict('Sub-Admin with this email already exists'));
    }

    const existingMobile = await SubAdmin.findOne({ mobile: mobile.trim() });
    if (existingMobile) {
      return next(conflict('Sub-Admin with this mobile number already exists'));
    }

    const subAdmin = await SubAdmin.create({
      employeeName: employeeName.trim(),
      email: email.toLowerCase(),
      mobile: mobile.trim(),
      password,
      designation,
      address: address ? address.trim() : '',
      status: status || 'active',
    });

    const subAdminObj = subAdmin.toObject();
    delete subAdminObj.password;

    return res.status(201).json(
      successResponse({
        message: 'Sub-Admin created successfully',
        data: { subAdmin: subAdminObj },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Sub-Admins with search, designation filter, and pagination
 */
export const getSubAdmins = async (req, res, next) => {
  try {
    const { search, designation, status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ employeeName: regex }, { mobile: regex }, { email: regex }];
    }

    if (designation) {
      filter.designation = designation.trim();
    }

    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      filter.status = status;
    }

    const total = await SubAdmin.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const subAdmins = await SubAdmin.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    return res.status(200).json(
      successResponse({
        message: 'Sub-Admins fetched successfully',
        data: { subAdmins },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Sub-Admin details by ID
 */
export const getSubAdminById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subAdmin = await SubAdmin.findById(id);
    if (!subAdmin) {
      return next(notFound('Sub-Admin not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Sub-Admin details fetched successfully',
        data: { subAdmin },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Sub-Admin details
 */
export const updateSubAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeName, email, mobile, password, designation, address, status } = req.body;

    const subAdmin = await SubAdmin.findById(id);
    if (!subAdmin) {
      return next(notFound('Sub-Admin not found'));
    }

    if (email && email.toLowerCase() !== subAdmin.email) {
      const existingEmail = await SubAdmin.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        return next(conflict('Sub-Admin with this email already exists'));
      }
      subAdmin.email = email.toLowerCase();
    }

    if (mobile && mobile.trim() !== subAdmin.mobile) {
      const existingMobile = await SubAdmin.findOne({ mobile: mobile.trim() });
      if (existingMobile) {
        return next(conflict('Sub-Admin with this mobile number already exists'));
      }
      subAdmin.mobile = mobile.trim();
    }

    if (employeeName !== undefined) subAdmin.employeeName = employeeName.trim();
    if (designation !== undefined) subAdmin.designation = designation;
    if (address !== undefined) subAdmin.address = address.trim();
    if (status !== undefined) subAdmin.status = status;

    if (password && password.trim().length > 0) {
      subAdmin.password = password;
    }

    await subAdmin.save();

    const subAdminObj = subAdmin.toObject();
    delete subAdminObj.password;

    return res.status(200).json(
      successResponse({
        message: 'Sub-Admin updated successfully',
        data: { subAdmin: subAdminObj },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Sub-Admin
 */
export const deleteSubAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const subAdmin = await SubAdmin.findById(id);
    if (!subAdmin) {
      return next(notFound('Sub-Admin not found'));
    }

    await subAdmin.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Sub-Admin deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
