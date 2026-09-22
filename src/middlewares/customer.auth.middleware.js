import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import Customer from '../models/customer.model.js';
import { unauthorized } from '../utils/api-error.js';

const customerAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.customerToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(unauthorized('Access denied. No token provided.'));
    }

    const decoded = jwt.verify(token, env.CUSTOMER_JWT_SECRET);

    const customer = await Customer.findById(decoded.id);

    if (!customer) {
      return next(unauthorized('Customer account not found.'));
    }

    if (customer.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended.'));
    }

    req.customer = customer;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired. Please login again.'));
    }
    return next(unauthorized('Invalid token.'));
  }
};

export const optionalCustomerAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.customerToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      req.customer = null;
      return next();
    }

    const decoded = jwt.verify(token, env.CUSTOMER_JWT_SECRET);
    const customer = await Customer.findById(decoded.id);

    if (customer && customer.status === 'active') {
      req.customer = customer;
    } else {
      req.customer = null;
    }

    next();
  } catch (_error) {
    req.customer = null;
    next();
  }
};

export default customerAuth;
