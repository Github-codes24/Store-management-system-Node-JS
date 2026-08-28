import Distributor from '../../models/distributor.model.js';
import { conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

export const createDistributor = async (req, res) => {
  const { name, salesperson, mobile, email, gstin, address, status } = req.body;

  const existingEmail = await Distributor.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (existingEmail) {
    throw conflict('Distributor with this email address already exists');
  }

  if (gstin && gstin.trim() !== '') {
    const existingGstin = await Distributor.findOne({
      gstin: gstin.toUpperCase(),
      isDeleted: false,
    });

    if (existingGstin) {
      throw conflict('Distributor with this GSTIN already exists');
    }
  }

  const distributor = await Distributor.create({
    name,
    salesperson: salesperson || null,
    mobile,
    email,
    gstin: gstin || null,
    address: address || null,
    status,
  });

  return res.status(201).json(
    successResponse({
      message: 'Distributor created successfully',
      data: distributor,
    })
  );
};

export const getDistributors = async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;

  const filter = { isDeleted: false };

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { salesperson: searchRegex },
      { mobile: searchRegex },
      { email: searchRegex },
      { gstin: searchRegex },
    ];
  }

  const total = await Distributor.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const distributors = await Distributor.find(filter)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  return res.status(200).json(
    successResponse({
      message: 'Distributors retrieved successfully',
      data: distributors,
      pagination,
    })
  );
};

export const getDistributorById = async (req, res) => {
  const { id } = req.params;

  const distributor = await Distributor.findOne({ _id: id, isDeleted: false });

  if (!distributor) {
    throw notFound('Distributor not found');
  }

  return res.status(200).json(
    successResponse({
      message: 'Distributor retrieved successfully',
      data: distributor,
    })
  );
};

export const updateDistributor = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const distributor = await Distributor.findOne({ _id: id, isDeleted: false });

  if (!distributor) {
    throw notFound('Distributor not found');
  }

  if (updateData.email && updateData.email.toLowerCase() !== distributor.email) {
    const existingEmail = await Distributor.findOne({
      email: updateData.email.toLowerCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingEmail) {
      throw conflict('Distributor with this email address already exists');
    }
  }

  if (updateData.gstin && updateData.gstin.trim() !== '' && updateData.gstin.toUpperCase() !== distributor.gstin) {
    const existingGstin = await Distributor.findOne({
      gstin: updateData.gstin.toUpperCase(),
      isDeleted: false,
      _id: { $ne: id },
    });

    if (existingGstin) {
      throw conflict('Distributor with this GSTIN already exists');
    }
  }

  const updatedDistributor = await Distributor.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return res.status(200).json(
    successResponse({
      message: 'Distributor updated successfully',
      data: updatedDistributor,
    })
  );
};

export const deleteDistributor = async (req, res) => {
  const { id } = req.params;

  const distributor = await Distributor.findOne({ _id: id, isDeleted: false });

  if (!distributor) {
    throw notFound('Distributor not found');
  }

  distributor.isDeleted = true;
  await distributor.save();

  return res.status(200).json(
    successResponse({
      message: 'Distributor deleted successfully',
      data: { id: distributor._id },
    })
  );
};

export const getDistributorDropdown = async (req, res) => {
  const distributors = await Distributor.find({ isDeleted: false, status: 'active' })
    .select('name _id')
    .sort({ name: 1 });

  const dropdownData = distributors.map((d) => ({
    label: d.name,
    value: d._id,
  }));

  return res.status(200).json(
    successResponse({
      message: 'Distributor dropdown options fetched successfully',
      data: dropdownData,
    })
  );
};

