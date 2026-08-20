import Store from '../../models/store.model.js';
import { conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

export const createStore = async (req, res) => {
  const { storeCode, name, mobile, email, location } = req.body;

  const existingCode = await Store.findOne({
    storeCode: storeCode.toUpperCase(),
    isDeleted: false,
  });

  if (existingCode) {
    throw conflict('Store with this store code already exists');
  }

  const existingEmail = await Store.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (existingEmail) {
    throw conflict('Store with this email address already exists');
  }

  const store = await Store.create({
    storeCode,
    name,
    mobile,
    email,
    location: location || null,
  });

  return res.status(201).json(
    successResponse({
      message: 'Store created successfully',
      data: store,
    })
  );
};

export const getStores = async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  const filter = { isDeleted: false };

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { storeCode: searchRegex },
      { name: searchRegex },
      { mobile: searchRegex },
      { email: searchRegex },
      { location: searchRegex },
    ];
  }

  const total = await Store.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const stores = await Store.find(filter)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return res.status(200).json(
    successResponse({
      message: 'Stores retrieved successfully',
      data: stores,
      pagination,
    })
  );
};

export const getStoreById = async (req, res) => {
  const { id } = req.params;

  const store = await Store.findOne({ _id: id, isDeleted: false });

  if (!store) {
    throw notFound('Store not found');
  }

  return res.status(200).json(
    successResponse({
      message: 'Store retrieved successfully',
      data: store,
    })
  );
};

export const updateStore = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const store = await Store.findOne({ _id: id, isDeleted: false });

  if (!store) {
    throw notFound('Store not found');
  }

  if (updateData.storeCode && updateData.storeCode.toUpperCase() !== store.storeCode) {
    const existingCode = await Store.findOne({
      storeCode: updateData.storeCode.toUpperCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingCode) {
      throw conflict('Store with this store code already exists');
    }
  }

  if (updateData.email && updateData.email.toLowerCase() !== store.email) {
    const existingEmail = await Store.findOne({
      email: updateData.email.toLowerCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingEmail) {
      throw conflict('Store with this email address already exists');
    }
  }

  const updatedStore = await Store.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return res.status(200).json(
    successResponse({
      message: 'Store updated successfully',
      data: updatedStore,
    })
  );
};

export const deleteStore = async (req, res) => {
  const { id } = req.params;

  const store = await Store.findOne({ _id: id, isDeleted: false });

  if (!store) {
    throw notFound('Store not found');
  }

  store.isDeleted = true;
  await store.save();

  return res.status(200).json(
    successResponse({
      message: 'Store deleted successfully',
      data: { id: store._id },
    })
  );
};
