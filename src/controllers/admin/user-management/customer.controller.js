import Customer from '../../../models/customer.model.js';
import { successResponse } from '../../../utils/api-response.js';
import { notFound, conflict } from '../../../utils/api-error.js';
import { getPagination } from '../../../utils/pagination.js';
import {
  calculateCustomerMetrics,
  batchPopulateCustomerMetrics,
} from '../../../utils/customerMetrics.util.js';

/**
 * Create a new Customer
 */
export const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, dateOfBirth, address, storeId, totalPurchase, amountDue, totalOrders, totalStoreVisits, status } = req.body;

    const checkFilter = { phone: phone.trim() };
    if (storeId) checkFilter.storeId = storeId;

    const existing = await Customer.findOne(checkFilter);
    if (existing) {
      return next(conflict('Customer with this mobile number already exists'));
    }

    const customer = await Customer.create({
      storeId: storeId || null,
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
 * Get all Customers with search, filter, and pagination
 */
export const getCustomers = async (req, res, next) => {
  try {
    const { search, status, storeId, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (storeId) {
      filter.storeId = storeId;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }

    if (status && ['active', 'inactive'].includes(status)) {
      filter.status = status;
    }

    const total = await Customer.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });

    const customers = await Customer.find(filter)
      .populate('storeId', 'name storeCode location')
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit);

    await batchPopulateCustomerMetrics(customers);

    return res.status(200).json(
      successResponse({
        message: 'Customers fetched successfully',
        data: { customers },
        pagination,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Details, Purchase Information & Analytics Summary
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return next(notFound('Customer not found'));
    }

    const metrics = await calculateCustomerMetrics(customer);

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
 * Update Customer details
 */
export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, dateOfBirth, address, totalPurchase, amountDue, totalOrders, totalStoreVisits, status } = req.body;

    const customer = await Customer.findById(id);
    if (!customer) {
      return next(notFound('Customer not found'));
    }

    if (phone && phone.trim() !== customer.phone) {
      const existing = await Customer.findOne({ phone: phone.trim() });
      if (existing) {
        return next(conflict('Customer with this mobile number already exists'));
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
 * Delete Customer
 */
export const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await Customer.findById(id);
    if (!customer) {
      return next(notFound('Customer not found'));
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
 * Export Customer list
 */
export const exportCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({}).sort({ createdAt: -1 });

    const exportData = customers.map((c, index) => ({
      srNo: index + 1,
      name: c.name,
      mobile: c.phone,
      email: c.email,
      totalPurchase: c.totalPurchase,
      amountDue: c.amountDue,
      address: c.address,
      status: c.status,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Customer export data generated successfully',
        data: { customers: exportData, totalCount: customers.length },
      })
    );
  } catch (error) {
    next(error);
  }
};
