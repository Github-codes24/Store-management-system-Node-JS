import Retailer from '../../models/retailer.model.js';
import SellProduct from '../../models/sellProduct.model.js';
import { badRequest, conflict, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';
import { getPagination } from '../../utils/pagination.js';

export const createRetailer = async (req, res) => {
  const { retailerCode, name, mobile, email, location } = req.body;

  let finalCode = retailerCode && typeof retailerCode === 'string' ? retailerCode.trim().toUpperCase() : '';

  if (!finalCode) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      finalCode = `RET${randomNum}`;
      const existing = await Retailer.findOne({ retailerCode: finalCode, isDeleted: false });
      if (!existing) isUnique = true;
      attempts++;
    }
  } else {
    const existingCode = await Retailer.findOne({ retailerCode: finalCode, isDeleted: false });
    if (existingCode) {
      throw conflict(`Retailer code '${finalCode}' is already in use`);
    }
  }

  const newRetailer = await Retailer.create({
    retailerCode: finalCode,
    name,
    mobile,
    email: email || null,
    location: location || null,
  });

  return res.status(201).json(
    successResponse({
      message: 'Retailer created successfully',
      data: newRetailer,
    })
  );
};

export const getRetailers = async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  const filter = { isDeleted: false };

  if (search && search.trim() !== '') {
    const searchRegex = new RegExp(search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { retailerCode: searchRegex },
      { mobile: searchRegex },
      { email: searchRegex },
      { location: searchRegex },
    ];
  }

  const total = await Retailer.countDocuments(filter);
  const pagination = getPagination({ page, limit, total });

  const retailers = await Retailer.find(filter)
    .sort({ createdAt: -1 })
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Compute outstanding due balance for each retailer dynamically
  const retailersWithDue = await Promise.all(
    retailers.map(async (ret) => {
      const dueAgg = await SellProduct.aggregate([
        { $match: { retailer: ret._id, saleType: 'Other Retailer', isDeleted: false, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, totalDue: { $sum: '$creditAmount' } } },
      ]);
      const totalDue = dueAgg.length > 0 ? dueAgg[0].totalDue : 0;
      return {
        ...ret.toObject(),
        totalDue,
      };
    })
  );

  return res.status(200).json(
    successResponse({
      message: 'Retailers retrieved successfully',
      data: retailersWithDue,
      pagination,
    })
  );
};

export const getRetailersDropdown = async (req, res) => {
  const retailers = await Retailer.find({ isDeleted: false })
    .select('_id name retailerCode mobile email location')
    .sort({ name: 1 });

  return res.status(200).json(
    successResponse({
      message: 'Retailer dropdown list retrieved successfully',
      data: retailers,
    })
  );
};

export const getRetailerById = async (req, res) => {
  const { id } = req.params;

  const retailer = await Retailer.findOne({ _id: id, isDeleted: false });
  if (!retailer) {
    throw notFound('Retailer not found');
  }

  // Calculate total due balance across active sales
  const dueAgg = await SellProduct.aggregate([
    { $match: { retailer: retailer._id, saleType: 'Other Retailer', isDeleted: false, status: { $ne: 'Cancelled' } } },
    { $group: { _id: null, totalDue: { $sum: '$creditAmount' } } },
  ]);
  const totalDue = dueAgg.length > 0 ? dueAgg[0].totalDue : 0;

  return res.status(200).json(
    successResponse({
      message: 'Retailer details retrieved successfully',
      data: {
        ...retailer.toObject(),
        totalDue,
      },
    })
  );
};

export const updateRetailer = async (req, res) => {
  const { id } = req.params;
  const { retailerCode, name, mobile, email, location } = req.body;

  const retailer = await Retailer.findOne({ _id: id, isDeleted: false });
  if (!retailer) {
    throw notFound('Retailer not found');
  }

  if (retailerCode && retailerCode.trim().toUpperCase() !== retailer.retailerCode) {
    const codeExists = await Retailer.findOne({
      retailerCode: retailerCode.trim().toUpperCase(),
      _id: { $ne: id },
      isDeleted: false,
    });
    if (codeExists) {
      throw conflict(`Retailer code '${retailerCode}' is already in use`);
    }
    retailer.retailerCode = retailerCode.trim().toUpperCase();
  }

  if (name !== undefined) retailer.name = name.trim();
  if (mobile !== undefined) retailer.mobile = mobile.trim();
  if (email !== undefined) retailer.email = email ? email.trim().toLowerCase() : null;
  if (location !== undefined) retailer.location = location ? location.trim() : null;

  await retailer.save();

  return res.status(200).json(
    successResponse({
      message: 'Retailer updated successfully',
      data: retailer,
    })
  );
};

export const deleteRetailer = async (req, res) => {
  const { id } = req.params;

  const retailer = await Retailer.findOne({ _id: id, isDeleted: false });
  if (!retailer) {
    throw notFound('Retailer not found');
  }

  retailer.isDeleted = true;
  await retailer.save();

  return res.status(200).json(
    successResponse({
      message: 'Retailer deleted successfully',
      data: { id: retailer._id },
    })
  );
};
