import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Admin from '../../../models/admin.model.js';
import env from '../../../config/env.js';
import { adminCookieOptions } from '../../../constants/cookieOptions.constants.js';
import { successResponse } from '../../../utils/api-response.js';
import { badRequest, unauthorized, notFound, conflict } from '../../../utils/api-error.js';
import sendMail from '../../../config/mailer.js';

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
      { id: admin._id, role: admin.role, email: admin.email },
      env.ADMIN_JWT_SECRET,
      { expiresIn: env.ADMIN_JWT_EXPIRES_IN }
    );

    res.cookie('adminToken', token, adminCookieOptions);

    const adminObj = admin.toObject();
    delete adminObj.password;

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
 * Admin Login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
    if (!admin) {
      return next(unauthorized('Invalid email or password'));
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return next(unauthorized('Invalid email or password'));
    }

    if (admin.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended'));
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, email: admin.email },
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

    return res.status(200).json(
      successResponse({
        message: 'Login successful',
        data: { admin: adminObj, token },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Logout
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

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return next(notFound('Admin account not found with this email'));
    }

    if (admin.status !== 'active') {
      return next(unauthorized('Account is inactive or suspended'));
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    admin.resetOtp = otp;
    admin.resetOtpExpires = otpExpires;
    await admin.save();

    // Send email notification
    await sendMail({
      to: admin.email,
      toName: admin.name,
      subject: 'Password Reset OTP - Store Management System',
      templateId: 'admin_password_reset_otp',
      variables: {
        otp,
        name: admin.name,
        company_name: 'Store Management System',
      },
    });

    return res.status(200).json(
      successResponse({
        message: 'OTP sent to your registered email address',
        data: { email: admin.email, otp },
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

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select(
      '+resetOtp +resetOtpExpires'
    );

    if (!admin || !admin.resetOtp || admin.resetOtp !== otp) {
      return next(badRequest('Invalid OTP'));
    }

    if (admin.resetOtpExpires < new Date()) {
      return next(badRequest('OTP has expired. Please request a new code.'));
    }

    // Generate short-lived reset token (15 mins)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    admin.resetToken = resetToken;
    admin.resetTokenExpires = resetTokenExpires;
    admin.resetOtp = null;
    admin.resetOtpExpires = null;
    await admin.save();

    return res.status(200).json(
      successResponse({
        message: 'OTP verified successfully',
        data: { resetToken, email: admin.email },
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

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select(
      '+resetToken +resetTokenExpires +password'
    );

    if (!admin || !admin.resetToken || admin.resetToken !== resetToken) {
      return next(badRequest('Invalid or expired reset token'));
    }

    if (admin.resetTokenExpires < new Date()) {
      return next(badRequest('Reset token has expired. Please request a new OTP.'));
    }

    admin.password = password;
    admin.resetToken = null;
    admin.resetTokenExpires = null;
    await admin.save();

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
 * Get current authenticated admin profile
 */
export const getProfile = async (req, res, next) => {
  try {
    return res.status(200).json(
      successResponse({
        message: 'Profile fetched successfully',
        data: { admin: req.admin },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password (for logged-in admin)
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

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
