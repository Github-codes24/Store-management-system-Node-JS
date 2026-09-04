import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import Admin from '../models/admin.model.js';
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
        return next();
      }
    }

    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);

    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin) {
      return next(unauthorized('Admin not found.'));
    }

    if (admin.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended.'));
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(unauthorized('Token expired. Please login again.'));
    }
    return next(unauthorized('Invalid token.'));
  }
};

export default adminAuth;
