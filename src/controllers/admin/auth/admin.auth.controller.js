import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../../../models/admin.model.js';
import SubAdmin from '../../../models/subAdmin.model.js';
import Role from '../../../models/role.model.js';
import env from '../../../config/env.js';
import { adminCookieOptions } from '../../../constants/cookieOptions.constants.js';
import { successResponse } from '../../../utils/api-response.js';
import { badRequest, unauthorized, notFound, conflict } from '../../../utils/api-error.js';
import sendMail from '../../../config/mailer.js';

// Default list of 22 modules supported by permissions system
const ALL_MODULES = [
  'dashboard',
  'productTypes',
  'categories',
  'subcategories',
  'brands',
  'units',
  'attributes',
  'distributor',
  'productPurchase',
  'productStock',
  'sellProducts',
  'stores',
  'storeProducts',
  'customers',
  'storeEmployee',
  'subAdmin',
  'offlineSales',
  'onlineOrders',
  'offersManagement',
  'taxManagement',
  'rolesAndPermissions',
  'reports',
];

/**
 * Helper to build full permissions matrix (all true) for SuperAdmin / Admin accounts
 */
const buildFullAdminPermissions = () => {
  const perms = {};
  ALL_MODULES.forEach((mod) => {
    perms[mod] = {
      viewOnly: true,
      create: true,
      modify: true,
      delete: true,
      modifyStatus: true,
    };
  });
  return perms;
};

/**
 * Register a new Admin account
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return next(conflict('Admin with this email already exists'));
    }

    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: role || 'admin',
    });

    const token = jwt.sign(
      { id: admin._id, role: admin.role, email: admin.email, isSubAdmin: false },
      env.ADMIN_JWT_SECRET,
      { expiresIn: env.ADMIN_JWT_EXPIRES_IN }
    );

    res.cookie('adminToken', token, adminCookieOptions);

    const adminObj = admin.toObject();
    delete adminObj.password;
    adminObj.isSubAdmin = false;
    adminObj.permissions = buildFullAdminPermissions();

    return res.status(201).json(
      successResponse({
        message: 'Admin registered successfully',
        data: { admin: adminObj, token },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Unified Admin & SubAdmin Login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const lowerEmail = email ? email.toLowerCase().trim() : '';

    // 1. Try finding in Admin collection
    const admin = await Admin.findOne({ email: lowerEmail }).select('+password');

    if (admin) {
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        return next(unauthorized('Invalid email or password'));
      }

      if (admin.status !== 'active') {
        return next(unauthorized('Account is inactive or suspended'));
      }

      const token = jwt.sign(
        { id: admin._id, role: admin.role, email: admin.email, isSubAdmin: false },
        env.ADMIN_JWT_SECRET,
        { expiresIn: env.ADMIN_JWT_EXPIRES_IN }
      );

      res.cookie('adminToken', token, adminCookieOptions);

      const adminObj = admin.toObject();
      delete adminObj.password;
      delete adminObj.resetOtp;
      delete adminObj.resetOtpExpires;
      delete adminObj.resetToken;
      delete adminObj.resetTokenExpires;

      adminObj.isSubAdmin = false;
      adminObj.permissions = buildFullAdminPermissions();

      return res.status(200).json(
        successResponse({
          message: 'Login successful',
          data: { admin: adminObj, token },
        })
      );
    }

    // 2. Try finding in SubAdmin collection
    const subAdmin = await SubAdmin.findOne({ email: lowerEmail }).select('+password');

    if (!subAdmin) {
      return next(unauthorized('Invalid email or password'));
    }

    const isSubAdminMatch = await subAdmin.comparePassword(password);
    if (!isSubAdminMatch) {
      return next(unauthorized('Invalid email or password'));
    }

    if (subAdmin.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended'));
    }

    // Retrieve assigned Role document
    let roleDoc = await Role.findOne({ subAdmin: subAdmin._id, isDeleted: false }).lean();
    if (!roleDoc && subAdmin.roleId) {
      roleDoc = await Role.findOne({ _id: subAdmin.roleId, isDeleted: false }).lean();
    }

    const token = jwt.sign(
      { id: subAdmin._id, role: 'subadmin', email: subAdmin.email, isSubAdmin: true },
      env.ADMIN_JWT_SECRET,
      { expiresIn: env.ADMIN_JWT_EXPIRES_IN }
    );

    res.cookie('adminToken', token, adminCookieOptions);

    const subAdminObj = {
      _id: subAdmin._id,
      id: subAdmin._id,
      name: subAdmin.employeeName,
      employeeName: subAdmin.employeeName,
      email: subAdmin.email,
      phone: subAdmin.mobile,
      mobile: subAdmin.mobile,
      designation: subAdmin.designation,
      role: 'subadmin',
      isSubAdmin: true,
      status: subAdmin.status,
      roleDetails: roleDoc
        ? {
            id: roleDoc._id,
            roleName: roleDoc.roleName,
            roleCategory: roleDoc.roleCategory,
            description: roleDoc.description,
          }
        : null,
      permissions: roleDoc?.permissions || {},
    };

    return res.status(200).json(
      successResponse({
        message: 'SubAdmin login successful',
        data: { admin: subAdminObj, token },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin / SubAdmin Logout
 */
export const logout = async (_req, res, next) => {
  try {
    res.clearCookie('adminToken', adminCookieOptions);
    return res.status(200).json(
      successResponse({
        message: 'Logged out successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot Password - Send OTP to registered email
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const lowerEmail = email ? email.toLowerCase().trim() : '';

    let user = await Admin.findOne({ email: lowerEmail });
    let isSub = false;

    if (!user) {
      user = await SubAdmin.findOne({ email: lowerEmail });
      isSub = true;
    }

    if (!user) {
      return next(notFound('Account not found with this email'));
    }

    if (user.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended'));
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetOtp = otp;
    user.resetOtpExpires = otpExpires;
    await user.save();

    // Send email notification
    await sendMail({
      to: user.email,
      toName: isSub ? user.employeeName : user.name,
      subject: 'Password Reset OTP - Store Management System',
      templateId: 'admin_password_reset_otp',
      variables: {
        otp,
        name: isSub ? user.employeeName : user.name,
        company_name: 'Store Management System',
      },
    });

    return res.status(200).json(
      successResponse({
        message: 'OTP sent to your registered email address',
        data: { email: user.email, otp },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const lowerEmail = email ? email.toLowerCase().trim() : '';

    let user = await Admin.findOne({ email: lowerEmail }).select('+resetOtp +resetOtpExpires');

    if (!user) {
      user = await SubAdmin.findOne({ email: lowerEmail }).select('+resetOtp +resetOtpExpires');
    }

    if (!user || !user.resetOtp || user.resetOtp !== otp) {
      return next(badRequest('Invalid OTP'));
    }

    if (user.resetOtpExpires < new Date()) {
      return next(badRequest('OTP has expired. Please request a new code.'));
    }

    // Generate short-lived reset token (15 mins)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    user.resetToken = resetToken;
    user.resetTokenExpires = resetTokenExpires;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    return res.status(200).json(
      successResponse({
        message: 'OTP verified successfully',
        data: { resetToken, email: user.email },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Reset Password using Reset Token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, password } = req.body;
    const lowerEmail = email ? email.toLowerCase().trim() : '';

    let user = await Admin.findOne({ email: lowerEmail }).select(
      '+resetToken +resetTokenExpires +password'
    );

    if (!user) {
      user = await SubAdmin.findOne({ email: lowerEmail }).select(
        '+resetToken +resetTokenExpires +password'
      );
    }

    if (!user || !user.resetToken || user.resetToken !== resetToken) {
      return next(badRequest('Invalid or expired reset token'));
    }

    if (user.resetTokenExpires < new Date()) {
      return next(badRequest('Reset token has expired. Please request a new OTP.'));
    }

    user.password = password;
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    return res.status(200).json(
      successResponse({
        message: 'Your password has been successfully updated. You can now log in with your new credentials.',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated admin / subadmin profile
 */
export const getProfile = async (req, res, next) => {
  try {
    if (req.isSubAdmin) {
      const profileObj = {
        ...(typeof req.admin.toObject === 'function' ? req.admin.toObject() : req.admin),
        id: req.admin._id,
        isSubAdmin: true,
        role: 'subadmin',
        roleDetails: req.assignedRole || null,
        permissions: req.permissions || {},
      };
      return res.status(200).json(
        successResponse({
          message: 'SubAdmin profile fetched successfully',
          data: { admin: profileObj },
        })
      );
    }

    const adminObj = typeof req.admin.toObject === 'function' ? req.admin.toObject() : req.admin;
    adminObj.isSubAdmin = false;
    adminObj.permissions = buildFullAdminPermissions();

    return res.status(200).json(
      successResponse({
        message: 'Profile fetched successfully',
        data: { admin: adminObj },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password (for logged-in admin or subadmin)
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (req.isSubAdmin) {
      const subAdmin = await SubAdmin.findById(req.admin._id).select('+password');
      if (!subAdmin) {
        return next(notFound('SubAdmin not found'));
      }
      const isMatch = await subAdmin.comparePassword(currentPassword);
      if (!isMatch) {
        return next(badRequest('Current password is incorrect'));
      }
      subAdmin.password = newPassword;
      await subAdmin.save();

      return res.status(200).json(
        successResponse({
          message: 'Password changed successfully',
        })
      );
    }

    const admin = await Admin.findById(req.admin._id).select('+password');
    if (!admin) {
      return next(notFound('Admin not found'));
    }

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return next(badRequest('Current password is incorrect'));
    }

    admin.password = newPassword;
    await admin.save();

    return res.status(200).json(
      successResponse({
        message: 'Password changed successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};
