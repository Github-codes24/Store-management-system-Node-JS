import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import StoreEmployee from '../../models/storeEmployee.model.js';
import env from '../../config/env.js';
import { storeEmployeeCookieOptions } from '../../constants/cookieOptions.constants.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, unauthorized, notFound } from '../../utils/api-error.js';
import sendMail from '../../config/mailer.js';

/**
 * Resolves the effective module permissions and role for a store employee.
 * If employee has no restricted role assigned, grants full access (backwards compatible).
 */
export const resolveStoreEmployeePermissions = async (employee) => {
  const Role = (await import('../../models/role.model.js')).default;

  let roleDoc = null;
  if (employee.roleId) {
    roleDoc = await Role.findOne({ _id: employee.roleId, isDeleted: false }).lean();
  }

  if (!roleDoc) {
    roleDoc = await Role.findOne({
      $or: [
        { storeEmployee: employee._id },
        { storeEmployees: employee._id },
      ],
      isDeleted: false,
    })
      .sort({ updatedAt: -1 })
      .lean();
  }

  // DEFAULT FULL ACCESS for unassigned / existing employees
  const defaultFullPermissions = {
    dashboard: { viewOnly: true },
    customers: { viewOnly: true, create: true, modify: true, delete: true },
    billing: { viewOnly: true, create: true, modify: true, delete: true },
    offlineSales: { viewOnly: true },
    onlineOrders: { viewOnly: true, modifyStatus: true },
    productInventory: { viewOnly: true, create: true, modify: true, delete: true },
    storeProducts: { viewOnly: true, create: true, modify: true, delete: true },
    offers: { viewOnly: true, create: true, modify: true, delete: true },
    offersManagement: { viewOnly: true, create: true, modify: true, delete: true },
    reports: { viewOnly: true },
  };

  if (!roleDoc || !roleDoc.permissions || Object.keys(roleDoc.permissions).length === 0) {
    return {
      isFullAccess: true,
      role: employee.roleName || employee.designation || 'Store Staff',
      roleId: null,
      permissions: defaultFullPermissions,
      assignedRole: null,
    };
  }

  // Normalize permissions to support both Store and Admin terminology
  const perms = { ...roleDoc.permissions };
  if (perms.productInventory && !perms.storeProducts) perms.storeProducts = perms.productInventory;
  if (perms.storeProducts && !perms.productInventory) perms.productInventory = perms.storeProducts;
  if (perms.offers && !perms.offersManagement) perms.offersManagement = perms.offers;
  if (perms.offersManagement && !perms.offers) perms.offers = perms.offersManagement;

  return {
    isFullAccess: false,
    role: roleDoc.roleName || employee.roleName || employee.designation || 'Store Staff',
    roleId: roleDoc._id,
    permissions: perms,
    assignedRole: {
      id: roleDoc._id,
      roleName: roleDoc.roleName,
      roleCategory: roleDoc.roleCategory,
      description: roleDoc.description,
    },
  };
};

export const login = async (req, res) => {
  const { userId, password } = req.body;

  const employee = await StoreEmployee.findOne({
    userId: userId.trim(),
    isDeleted: false,
  }).populate('storeId', 'name storeCode location mobile email');

  if (!employee) {
    throw unauthorized('Invalid User ID or password');
  }

  const isMatch = employee.comparePassword(password);
  if (!isMatch) {
    throw unauthorized('Invalid User ID or password');
  }

  const accessInfo = await resolveStoreEmployeePermissions(employee);

  const token = jwt.sign(
    {
      id: employee._id,
      email: employee.email,
      userId: employee.userId,
      role: accessInfo.role,
      roleId: accessInfo.roleId,
      isFullAccess: accessInfo.isFullAccess,
    },
    env.STORE_EMPLOYEE_JWT_SECRET,
    { expiresIn: env.STORE_EMPLOYEE_JWT_EXPIRES_IN }
  );

  res.cookie('storeEmployeeToken', token, storeEmployeeCookieOptions);

  const employeeObj = employee.toObject();
  delete employeeObj.password;
  if (employeeObj.storeId) {
    const rawMob = (employeeObj.storeId.mobile || employeeObj.storeId.phone || '8275788392').trim();
    const formattedMob = rawMob.startsWith('+') ? rawMob : `+91 ${rawMob}`;
    employeeObj.storeId.mobile = formattedMob;
    employeeObj.storeId.phone = formattedMob;
  }

  employeeObj.role = accessInfo.role;
  employeeObj.roleId = accessInfo.roleId;
  employeeObj.permissions = accessInfo.permissions;
  employeeObj.isFullAccess = accessInfo.isFullAccess;
  if (accessInfo.assignedRole) {
    employeeObj.assignedRole = accessInfo.assignedRole;
  }

  return res.status(200).json(
    successResponse({
      message: 'Login successful',
      data: {
        storeEmployee: employeeObj,
        permissions: accessInfo.permissions,
        role: accessInfo.role,
        isFullAccess: accessInfo.isFullAccess,
        token,
      },
    })
  );
};

export const logout = async (_req, res) => {
  res.clearCookie('storeEmployeeToken', storeEmployeeCookieOptions);

  return res.status(200).json(
    successResponse({
      message: 'Logged out successfully',
    })
  );
};

export const getProfile = async (req, res) => {
  const employee = await StoreEmployee.findById(req.storeEmployee._id)
    .populate('storeId', 'name storeCode location mobile email');

  if (!employee) {
    throw notFound('Store employee not found');
  }

  const accessInfo = await resolveStoreEmployeePermissions(employee);

  const employeeObj = employee.toObject();
  delete employeeObj.password;
  if (employeeObj.storeId) {
    const rawMob = (employeeObj.storeId.mobile || employeeObj.storeId.phone || '8275788392').trim();
    const formattedMob = rawMob.startsWith('+') ? rawMob : `+91 ${rawMob}`;
    employeeObj.storeId.mobile = formattedMob;
    employeeObj.storeId.phone = formattedMob;
  }

  employeeObj.role = accessInfo.role;
  employeeObj.roleId = accessInfo.roleId;
  employeeObj.permissions = accessInfo.permissions;
  employeeObj.isFullAccess = accessInfo.isFullAccess;
  if (accessInfo.assignedRole) {
    employeeObj.assignedRole = accessInfo.assignedRole;
  }

  return res.status(200).json(
    successResponse({
      message: 'Profile retrieved successfully',
      data: {
        storeEmployee: employeeObj,
        permissions: accessInfo.permissions,
        role: accessInfo.role,
        isFullAccess: accessInfo.isFullAccess,
      },
    })
  );
};

/**
 * Forgot Password - Send 4-digit OTP to registered email
 */
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const employee = await StoreEmployee.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (!employee) {
    throw notFound('Store employee account not found with this email');
  }

  // Generate 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  employee.resetOtp = otp;
  employee.resetOtpExpires = otpExpires;
  await employee.save();

  // Send email notification
  await sendMail({
    to: employee.email,
    toName: employee.name,
    subject: 'Password Reset OTP - Store Management System',
    templateId: 'employee_password_reset_otp',
    variables: {
      otp,
      name: employee.name,
      company_name: 'Store Management System',
    },
  });

  return res.status(200).json(
    successResponse({
      message: 'A 4-digit OTP has been sent to your registered email address',
      data: { email: employee.email, otp },
    })
  );
};

/**
 * Resend OTP
 */
export const resendOtp = async (req, res) => {
  const { email } = req.body;

  const employee = await StoreEmployee.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  });

  if (!employee) {
    throw notFound('Store employee account not found with this email');
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  employee.resetOtp = otp;
  employee.resetOtpExpires = otpExpires;
  await employee.save();

  await sendMail({
    to: employee.email,
    toName: employee.name,
    subject: 'Resent Password Reset OTP - Store Management System',
    templateId: 'employee_password_reset_otp',
    variables: {
      otp,
      name: employee.name,
      company_name: 'Store Management System',
    },
  });

  return res.status(200).json(
    successResponse({
      message: 'A new 4-digit OTP has been resent to your registered email address',
      data: { email: employee.email, otp },
    })
  );
};

/**
 * Verify OTP
 */
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const employee = await StoreEmployee.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  }).select('+resetOtp +resetOtpExpires');

  if (!employee) {
    throw notFound('Store employee account not found');
  }

  if (!employee.resetOtp || employee.resetOtp !== String(otp).trim()) {
    throw badRequest('Invalid OTP');
  }

  if (employee.resetOtpExpires < new Date()) {
    throw badRequest('OTP has expired. Please request a new one.');
  }

  // Clear OTP and set reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  employee.resetOtp = null;
  employee.resetOtpExpires = null;
  employee.resetToken = resetToken;
  employee.resetTokenExpires = resetTokenExpires;
  await employee.save();

  return res.status(200).json(
    successResponse({
      message: 'OTP verified successfully',
      data: { resetToken, email: employee.email },
    })
  );
};

/**
 * Reset Password using Reset Token
 */
export const resetPassword = async (req, res) => {
  const { email, resetToken, newPassword, confirmPassword, password } = req.body;

  const targetPassword = newPassword || password;

  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    throw badRequest('New password and confirm password do not match');
  }

  if (!targetPassword) {
    throw badRequest('New password is required');
  }

  const employee = await StoreEmployee.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
  }).select('+resetToken +resetTokenExpires +password');

  if (!employee || !employee.resetToken || employee.resetToken !== resetToken) {
    throw badRequest('Invalid or expired reset token');
  }

  if (employee.resetTokenExpires < new Date()) {
    throw badRequest('Reset token has expired. Please request a new OTP.');
  }

  employee.password = targetPassword; // Pre-save hook encrypts using AES-256-CBC
  employee.resetToken = null;
  employee.resetTokenExpires = null;
  await employee.save();

  return res.status(200).json(
    successResponse({
      message: 'Your password has been successfully updated. You can now log in with your new password.',
    })
  );
};

/**
 * Change Password (for logged-in store employee)
 */
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const employee = await StoreEmployee.findById(req.storeEmployee._id);

  if (!employee) {
    throw notFound('Store employee not found');
  }

  const isMatch = employee.comparePassword(oldPassword);
  if (!isMatch) {
    throw badRequest('Old password is incorrect');
  }

  employee.password = newPassword; // Pre-save hook encrypts using AES-256-CBC
  await employee.save();

  return res.status(200).json(
    successResponse({
      message: 'Password changed successfully',
    })
  );
};
