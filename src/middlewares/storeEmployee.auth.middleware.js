import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import StoreEmployee from '../models/storeEmployee.model.js';
import { unauthorized } from '../utils/api-error.js';
import { resolveStoreEmployeePermissions } from '../controllers/store-employee/storeEmployee.auth.controller.js';

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

    if (!storeEmployee || storeEmployee.isDeleted) {
      return next(unauthorized('Store employee not found.'));
    }

    const accessInfo = await resolveStoreEmployeePermissions(storeEmployee);
    storeEmployee.role = accessInfo.role;
    storeEmployee.roleId = accessInfo.roleId;
    storeEmployee.permissions = accessInfo.permissions;
    storeEmployee.isFullAccess = accessInfo.isFullAccess;
    if (accessInfo.assignedRole) {
      storeEmployee.assignedRole = accessInfo.assignedRole;
    }

    req.storeEmployee = storeEmployee;
    req.permissions = accessInfo.permissions;
    req.isFullAccess = accessInfo.isFullAccess;
    req.userRole = accessInfo.role;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired. Please login again.'));
    }
    return next(unauthorized('Invalid token.'));
  }
};

export default storeEmployeeAuth;
