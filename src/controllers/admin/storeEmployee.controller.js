import mongoose from 'mongoose';
import StoreEmployee from '../../models/storeEmployee.model.js';
import Store from '../../models/store.model.js';
import { STORE_EMPLOYEE_DESIGNATIONS } from '../../constants/storeEmployee.constants.js';
import { conflict, notFound, badRequest } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';
import { decrypt } from '../../utils/crypto.js';

const formatEmployeeForAdmin = (employeeDoc) => {
  if (!employeeDoc) return null;
  const obj = typeof employeeDoc.toObject === 'function' ? employeeDoc.toObject() : { ...employeeDoc };
  if (typeof employeeDoc.getDecryptedPassword === 'function') {
    obj.password = employeeDoc.getDecryptedPassword();
  }
  return obj;
};

export const createStoreEmployee = async (req, res) => {
  const { name, email, userId, password, mobile, designation, storeId, address } = req.body;

  // Check assigned store existence
  const store = await Store.findOne({ _id: storeId, isDeleted: false });
  if (!store) {
    throw badRequest('Assigned store does not exist');
  }

  // Check email uniqueness
  const existingEmail = await StoreEmployee.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });
  if (existingEmail) {
    throw conflict('Store employee with this email address already exists');
  }

  // Check userId uniqueness
  const existingUserId = await StoreEmployee.findOne({
    userId: userId.trim(),
    isDeleted: false,
  });
  if (existingUserId) {
    throw conflict('Store employee with this User ID already exists');
  }

  const storeEmployee = await StoreEmployee.create({
    name,
    email,
    userId,
    password,
    mobile,
    phone: mobile,
    designation,
    storeId,
    address: address || null,
  });

  const populatedEmployee = await StoreEmployee.findById(storeEmployee._id).populate('storeId', 'name storeCode location');

  return res.status(201).json(
    successResponse({
      message: 'Store employee created successfully',
      data: formatEmployeeForAdmin(populatedEmployee),
    })
  );
};

export const getStoreEmployees = async (req, res) => {
  const { page = 1, limit = 10, search, designation, storeId } = req.query;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;

  const matchFilter = { isDeleted: false };

  if (
    designation &&
    designation.trim() !== '' &&
    designation.toLowerCase() !== 'all designation' &&
    designation.toLowerCase() !== 'all'
  ) {
    matchFilter.designation = new RegExp(`^${designation.trim()}$`, 'i');
  }

  if (
    storeId &&
    storeId.trim() !== '' &&
    storeId.toLowerCase() !== 'all store' &&
    storeId.toLowerCase() !== 'all'
  ) {
    if (mongoose.Types.ObjectId.isValid(storeId.trim())) {
      matchFilter.storeId = new mongoose.Types.ObjectId(storeId.trim());
    }
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    matchFilter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { userId: searchRegex },
      { mobile: searchRegex },
      { designation: searchRegex },
    ];
  }

  const basePipeline = [
    { $match: matchFilter },
    {
      $lookup: {
        from: 'stores',
        localField: 'storeId',
        foreignField: '_id',
        as: 'storeDetails',
      },
    },
    {
      $unwind: {
        path: '$storeDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  const totalCountResult = await StoreEmployee.aggregate([...basePipeline, { $count: 'total' }]);
  const total = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

  const pagination = getPagination({ page: pageNum, limit: limitNum, total });

  const rawEmployees = await StoreEmployee.aggregate([
    ...basePipeline,
    { $sort: { createdAt: -1 } },
    { $skip: pagination.skip },
    { $limit: pagination.limit },
    {
      $project: {
        _id: 1,
        name: 1,
        designation: 1,
        store: { $ifNull: ['$storeDetails.name', ''] },
        storeId: 1,
        mobile: 1,
        phone: 1,
        email: 1,
        address: 1,
        userId: 1,
        password: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  const formattedEmployees = rawEmployees.map((emp) => {
    let plainPassword = emp.password;
    if (emp.password) {
      try {
        plainPassword = decrypt(emp.password);
      } catch (_e) {
        plainPassword = emp.password;
      }
    }
    return {
      ...emp,
      password: plainPassword,
    };
  });

  return res.status(200).json(
    successResponse({
      message: 'Store employees retrieved successfully',
      data: formattedEmployees,
      pagination,
    })
  );
};

export const getStoreEmployeeById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw notFound('Store employee not found');
  }

  const rawEmployee = await StoreEmployee.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id),
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: 'stores',
        localField: 'storeId',
        foreignField: '_id',
        as: 'storeDetails',
      },
    },
    {
      $unwind: {
        path: '$storeDetails',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        designation: 1,
        store: { $ifNull: ['$storeDetails.name', ''] },
        storeId: 1,
        mobile: 1,
        phone: 1,
        email: 1,
        address: 1,
        userId: 1,
        password: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);

  if (!rawEmployee || rawEmployee.length === 0) {
    throw notFound('Store employee not found');
  }

  const emp = rawEmployee[0];
  let plainPassword = emp.password;
  if (emp.password) {
    try {
      plainPassword = decrypt(emp.password);
    } catch (_e) {
      plainPassword = emp.password;
    }
  }

  const formattedEmployee = {
    ...emp,
    password: plainPassword,
  };

  return res.status(200).json(
    successResponse({
      message: 'Store employee details retrieved successfully',
      data: formattedEmployee,
    })
  );
};

export const updateStoreEmployee = async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  const storeEmployee = await StoreEmployee.findOne({ _id: id, isDeleted: false });

  if (!storeEmployee) {
    throw notFound('Store employee not found');
  }

  if (updateData.email && updateData.email.toLowerCase() !== storeEmployee.email) {
    const existingEmail = await StoreEmployee.findOne({
      email: updateData.email.toLowerCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingEmail) {
      throw conflict('Store employee with this email address already exists');
    }
  }

  if (updateData.userId && updateData.userId.trim() !== storeEmployee.userId) {
    const existingUserId = await StoreEmployee.findOne({
      userId: updateData.userId.trim(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingUserId) {
      throw conflict('Store employee with this User ID already exists');
    }
  }

  if (updateData.storeId) {
    const store = await Store.findOne({ _id: updateData.storeId, isDeleted: false });
    if (!store) {
      throw badRequest('Assigned store does not exist');
    }
  }

  // Update employee fields
  Object.keys(updateData).forEach((key) => {
    storeEmployee[key] = updateData[key];
  });

  if (updateData.mobile) {
    storeEmployee.phone = updateData.mobile;
  }

  await storeEmployee.save();

  const updatedEmployee = await StoreEmployee.findById(id).populate('storeId', 'name storeCode location');

  return res.status(200).json(
    successResponse({
      message: 'Store employee updated successfully',
      data: formatEmployeeForAdmin(updatedEmployee),
    })
  );
};

export const deleteStoreEmployee = async (req, res) => {
  const { id } = req.params;

  const storeEmployee = await StoreEmployee.findOne({ _id: id, isDeleted: false });

  if (!storeEmployee) {
    throw notFound('Store employee not found');
  }

  storeEmployee.isDeleted = true;
  await storeEmployee.save();

  return res.status(200).json(
    successResponse({
      message: 'Store employee deleted successfully',
      data: { id: storeEmployee._id },
    })
  );
};

export const getDesignationsDropdown = async (_req, res) => {
  const dbDesignations = await StoreEmployee.distinct('designation', { isDeleted: false });

  const combined = Array.from(
    new Set([...STORE_EMPLOYEE_DESIGNATIONS, ...dbDesignations.filter(Boolean)])
  );

  const dropdownOptions = combined.map((desig) => ({
    label: desig,
    value: desig,
  }));

  return res.status(200).json(
    successResponse({
      message: 'Designations dropdown list retrieved successfully',
      data: dropdownOptions,
    })
  );
};

export const getStoresDropdownForEmployees = async (_req, res) => {
  const stores = await Store.find({ isDeleted: false })
    .select('_id name storeCode')
    .sort({ name: 1 });

  const dropdownOptions = stores.map((store) => ({
    label: store.name,
    value: store._id.toString(),
  }));

  return res.status(200).json(
    successResponse({
      message: 'Stores dropdown list retrieved successfully',
      data: dropdownOptions,
    })
  );
};
