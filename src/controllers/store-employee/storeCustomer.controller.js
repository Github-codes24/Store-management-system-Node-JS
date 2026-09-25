import mongoose from 'mongoose';
import Customer from '../../models/customer.model.js';
import Store from '../../models/store.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, conflict, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';
import {
  calculateCustomerMetrics,
  batchPopulateCustomerMetrics,
} from '../../utils/customerMetrics.util.js';

/**
 * Create a new Customer for the logged-in Store
 */
export const createCustomer = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    if (!storeId) {
      return next(badRequest('No store associated with logged-in employee'));
    }

    // Verify store exists and is not deleted
    const store = await Store.findOne({ _id: storeId, isDeleted: false });
    if (!store) {
      return next(notFound('Associated store not found or disabled'));
    }

    const {
      name,
      email,
      phone,
      dateOfBirth,
      address,
      totalPurchase,
      amountDue,
      totalOrders,
      totalStoreVisits,
      status,
    } = req.body;

    // Check duplicate phone in the same store
    const existing = await Customer.findOne({ phone: phone.trim(), storeId });
    if (existing) {
      return next(conflict('Customer with this mobile number already exists in this store'));
    }

    const customer = await Customer.create({
      storeId,
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : '',
      phone: phone.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      address: address ? address.trim() : '',
      totalPurchase: totalPurchase || 0,
      amountDue: amountDue || 0,
      totalOrders: totalOrders || 0,
      totalStoreVisits: totalStoreVisits || 0,
      status: status || 'active',
    });

    return res.status(201).json(
      successResponse({
        message: 'Customer created successfully',
        data: { customer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Customers for the logged-in Store with search, filter, date range, and pagination
 */
export const getCustomers = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    if (!storeId) {
      return next(badRequest('No store associated with logged-in employee'));
    }

    const {
      search,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { storeId };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const total = await Customer.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Populate accurate real-time metrics (totalPurchase, amountDue, totalOrders) from StoreOrders
    await batchPopulateCustomerMetrics(customers, storeId);

    return res.status(200).json(
      successResponse({
        message: 'Store customers fetched successfully',
        data: { customers },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Details, Purchase Information & Analytics Summary for the logged-in Store
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return next(notFound('Customer not found in this store'));
    }

    const customer = await Customer.findOne({
      _id: id,
      ...(storeId ? { $or: [{ storeId }, { storeId: null }] } : {}),
    });
    if (!customer) {
      return next(notFound('Customer not found in this store'));
    }

    // Calculate real metrics, real spent chart, top products, and bills from StoreOrders
    const metrics = await calculateCustomerMetrics(customer, storeId);

    // Synchronize to customer record if changed
    if (
      customer.totalPurchase !== metrics.totalBillAmount ||
      customer.amountDue !== metrics.totalDueAmount ||
      customer.totalOrders !== metrics.totalOrders
    ) {
      customer.totalPurchase = metrics.totalBillAmount;
      customer.amountDue = metrics.totalDueAmount;
      customer.totalOrders = metrics.totalOrders;
      if (!customer.totalStoreVisits || customer.totalStoreVisits < metrics.summary.totalStoreVisits) {
        customer.totalStoreVisits = metrics.summary.totalStoreVisits;
      }
      await customer.save().catch(() => {});
    }

    return res.status(200).json(
      successResponse({
        message: 'Customer details fetched successfully',
        data: {
          customer,
          purchaseInformation: {
            totalOrders: metrics.totalOrders,
            totalBillAmount: metrics.totalBillAmount,
            totalDueAmount: metrics.totalDueAmount,
          },
          summary: metrics.summary,
          spentChart: metrics.spentChart,
          topPurchasedProducts: metrics.topPurchasedProducts,
          bills: metrics.bills,
          orders: metrics.orders,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Customer details for the logged-in Store
 */
export const updateCustomer = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    const { id } = req.params;
    const {
      name,
      email,
      phone,
      dateOfBirth,
      address,
      totalPurchase,
      amountDue,
      totalOrders,
      totalStoreVisits,
      status,
    } = req.body;

    const customer = await Customer.findOne({ _id: id, storeId });
    if (!customer) {
      return next(notFound('Customer not found in this store'));
    }

    if (phone && phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({ phone: phone.trim(), storeId });
      if (existing) {
        return next(conflict('Customer with this mobile number already exists in this store'));
      }
      customer.phone = phone.trim();
    }

    if (name !== undefined) customer.name = name.trim();
    if (email !== undefined) customer.email = email.trim().toLowerCase();
    if (dateOfBirth !== undefined) customer.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (address !== undefined) customer.address = address.trim();
    if (totalPurchase !== undefined) customer.totalPurchase = totalPurchase;
    if (amountDue !== undefined) customer.amountDue = amountDue;
    if (totalOrders !== undefined) customer.totalOrders = totalOrders;
    if (totalStoreVisits !== undefined) customer.totalStoreVisits = totalStoreVisits;
    if (status !== undefined) customer.status = status;

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Customer details updated successfully',
        data: { customer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Pay due amount for a Customer in the logged-in Store
 */
export const payDueAmount = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    const { id } = req.params;
    const { amount } = req.body;

    const customer = await Customer.findOne({ _id: id, storeId });
    if (!customer) {
      return next(notFound('Customer not found in this store'));
    }

    if (customer.amountDue <= 0) {
      return next(badRequest('Customer has no outstanding due amount'));
    }

    const paidAmount = Math.min(amount, customer.amountDue);
    customer.amountDue = Math.max(0, customer.amountDue - amount);
    await customer.save();

    return res.status(200).json(
      successResponse({
        message: `Payment of ₹${paidAmount} applied successfully`,
        data: {
          customer,
          paidAmount,
          remainingDue: customer.amountDue,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Customer for the logged-in Store
 */
export const deleteCustomer = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId?._id || req.storeEmployee?.storeId || req.storeEmployee?.store || null;
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return next(notFound('Customer not found in this store'));
    }

    const customer = await Customer.findOne({
      _id: id,
      ...(storeId ? { $or: [{ storeId }, { storeId: null }] } : {}),
    });
    if (!customer) {
      return next(notFound('Customer not found in this store'));
    }

    await customer.deleteOne();

    return res.status(200).json(
      successResponse({
        message: 'Customer deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Export Customer list for the logged-in Store
 */
export const exportCustomers = async (req, res, next) => {
  try {
    const storeId = req.storeEmployee?.storeId;
    if (!storeId) {
      return next(badRequest('No store associated with logged-in employee'));
    }

    const { search, status } = req.query;
    const filter = { storeId };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 });
    await batchPopulateCustomerMetrics(customers, storeId);

    const exportData = customers.map((c, index) => ({
      srNo: index + 1,
      name: c.name || '-',
      mobile: c.phone || c.mobile || '-',
      email: c.email || '-',
      totalPurchase: c.totalPurchase || 0,
      amountDue: c.amountDue || 0,
      address: c.address || '-',
      status: c.status || 'active',
      createdAt: c.createdAt,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Store customer export data generated successfully',
        data: { customers: exportData, totalCount: customers.length },
      })
    );
  } catch (error) {
    next(error);
  }
};
