import Customer from '../../models/customer.model.js';
import Store from '../../models/store.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, conflict, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

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

    const customer = await Customer.findOne({ _id: id, storeId });
    if (!customer) {
      return next(notFound('Customer not found in this store'));
    }

    // Calculated metrics & summary analytics matching UI design
    const totalOrders = customer.totalOrders || 0;
    const totalBillAmount = customer.totalPurchase || 0;
    const totalDueAmount = customer.amountDue || 0;

    const summary = {
      avgStoreVisitsPerMonth: customer.totalStoreVisits ? Math.round(customer.totalStoreVisits / 12) || 1 : 0,
      totalStoreVisits: customer.totalStoreVisits || 0,
      avgMonthlyBillValue: totalOrders ? Math.round(totalBillAmount / Math.max(totalOrders, 1)) : 0,
    };

    // Spent chart dataset (Monthly breakdown)
    const spentChart = [
      { month: 'Jan', amount: Math.round(totalBillAmount * 0.1) },
      { month: 'Feb', amount: Math.round(totalBillAmount * 0.15) },
      { month: 'Mar', amount: Math.round(totalBillAmount * 0.08) },
      { month: 'Apr', amount: Math.round(totalBillAmount * 0.14) },
      { month: 'May', amount: Math.round(totalBillAmount * 0.22) },
      { month: 'Jun', amount: Math.round(totalBillAmount * 0.16) },
      { month: 'Jul', amount: Math.round(totalBillAmount * 0.15) },
    ];

    // Top 5 purchased products placeholder/summary
    const topPurchasedProducts = [
      { item: 'Product 1', quantity: '150 pc' },
      { item: 'Product 2', quantity: '50 kg' },
      { item: 'Product 3', quantity: '150 pc' },
      { item: 'Product 4', quantity: '150 pc' },
      { item: 'Product 5', quantity: '150 pc' },
    ];

    return res.status(200).json(
      successResponse({
        message: 'Customer details fetched successfully',
        data: {
          customer,
          purchaseInformation: {
            totalOrders,
            totalBillAmount,
            totalDueAmount,
          },
          summary,
          spentChart,
          topPurchasedProducts,
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
    const storeId = req.storeEmployee?.storeId;
    const { id } = req.params;

    const customer = await Customer.findOne({ _id: id, storeId });
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

    const customers = await Customer.find({ storeId }).sort({ createdAt: -1 });

    const exportData = customers.map((c, index) => ({
      srNo: index + 1,
      name: c.name,
      mobile: c.phone,
      email: c.email,
      totalPurchase: c.totalPurchase,
      amountDue: c.amountDue,
      address: c.address,
      status: c.status,
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
