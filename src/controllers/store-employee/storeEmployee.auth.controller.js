import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import StoreEmployee from '../../models/storeEmployee.model.js';
import env from '../../config/env.js';
import { storeEmployeeCookieOptions } from '../../constants/cookieOptions.constants.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, unauthorized, notFound } from '../../utils/api-error.js';
import sendMail from '../../config/mailer.js';

export const login = async (req, res) => {
  const { userId, password } = req.body;

  const employee = await StoreEmployee.findOne({
    userId: userId.trim(),
    isDeleted: false,
  }).populate('storeId', 'name storeCode location');

  if (!employee) {
    throw unauthorized('Invalid User ID or password');
  }

  const isMatch = employee.comparePassword(password);
  if (!isMatch) {
    throw unauthorized('Invalid User ID or password');
  }

  const token = jwt.sign(
    { id: employee._id, email: employee.email, userId: employee.userId, role: 'storeEmployee' },
    env.STORE_EMPLOYEE_JWT_SECRET,
    { expiresIn: env.STORE_EMPLOYEE_JWT_EXPIRES_IN }
  );

  res.cookie('storeEmployeeToken', token, storeEmployeeCookieOptions);

  const employeeObj = employee.toObject();
  delete employeeObj.password;

  return res.status(200).json(
    successResponse({
      message: 'Login successful',
      data: { storeEmployee: employeeObj, token },
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
    .populate('storeId', 'name storeCode location');

  const employeeObj = employee.toObject();
  delete employeeObj.password;

  return res.status(200).json(
    successResponse({
      message: 'Profile retrieved successfully',
      data: { storeEmployee: employeeObj },
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
      message: 'A new 4-digit OTP has been sent to your email address',
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

  if (!employee || !employee.resetOtp || employee.resetOtp !== otp) {
    throw badRequest('Invalid OTP');
  }

  if (employee.resetOtpExpires < new Date()) {
    throw badRequest('OTP has expired. Please request a new code.');
  }

  // Generate short-lived reset token (15 mins)
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

  employee.resetToken = resetToken;
  employee.resetTokenExpires = resetTokenExpires;
  employee.resetOtp = null;
  employee.resetOtpExpires = null;
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
