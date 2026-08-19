import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import StoreEmployee from '../models/storeEmployee.model.js';
import { unauthorized } from '../utils/api-error.js';

const storeEmployeeAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.storeEmployeeToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(unauthorized('Access denied. No token provided.'));
    }

    const decoded = jwt.verify(token, env.STORE_EMPLOYEE_JWT_SECRET);

    const storeEmployee = await StoreEmployee.findById(decoded.id).select('-password');

    if (!storeEmployee) {
      return next(unauthorized('Store employee not found.'));
    }

    if (storeEmployee.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended.'));
    }

    req.storeEmployee = storeEmployee;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired. Please login again.'));
    }
    return next(unauthorized('Invalid token.'));
  }
};

export default storeEmployeeAuth;
