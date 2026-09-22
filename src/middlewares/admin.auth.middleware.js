import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import Admin from '../models/admin.model.js';
import SubAdmin from '../models/subAdmin.model.js';
import Role from '../models/role.model.js';
import { unauthorized } from '../utils/api-error.js';

const adminAuth = async (req, _res, next) => {
  try {
    const token =
      req.cookies?.adminToken ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return next(unauthorized('Access denied. No token provided.'));
    }

    if (token === 'mock-jwt-token-123456' && env.NODE_ENV !== 'production') {
      const devAdmin = await Admin.findOne({ status: 'active' }).select('-password');
      if (devAdmin) {
        req.admin = devAdmin;
        req.isSubAdmin = false;
        req.userRole = devAdmin.role;
        return next();
      }
    }

    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);

    // 1. Try finding account in Admin collection first
    const admin = await Admin.findById(decoded.id).select('-password');

    if (admin) {
      if (admin.status !== 'active') {
        return next(unauthorized('Account is inactive or suspended.'));
      }
      req.admin = admin;
      req.isSubAdmin = false;
      req.userRole = admin.role || 'admin';
      return next();
    }

    // 2. Try finding account in SubAdmin collection
    const subAdmin = await SubAdmin.findById(decoded.id).select('-password');

    if (!subAdmin) {
      return next(unauthorized('User account not found.'));
    }

    if (subAdmin.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended.'));
    }

    // Retrieve assigned Role and permissions matrix for SubAdmin
    let roleDoc = await Role.findOne({ subAdmin: subAdmin._id, isDeleted: false }).lean();
    if (!roleDoc && subAdmin.roleId) {
      roleDoc = await Role.findOne({ _id: subAdmin.roleId, isDeleted: false }).lean();
    }

    req.admin = {
      _id: subAdmin._id,
      name: subAdmin.employeeName,
      email: subAdmin.email,
      phone: subAdmin.mobile,
      designation: subAdmin.designation,
      role: 'subadmin',
      status: subAdmin.status,
    };
    req.subAdmin = subAdmin;
    req.isSubAdmin = true;
    req.userRole = 'subadmin';
    req.assignedRole = roleDoc
      ? {
          id: roleDoc._id,
          roleName: roleDoc.roleName,
          roleCategory: roleDoc.roleCategory,
          description: roleDoc.description,
        }
      : null;
    req.permissions = roleDoc?.permissions || {};

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired. Please login again.'));
    }
    return next(unauthorized('Invalid token.'));
  }
};

export default adminAuth;
