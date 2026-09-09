import jwt from 'jsonwebtoken';
import Customer from '../../models/customer.model.js';
import env from '../../config/env.js';
import { customerCookieOptions } from '../../constants/cookieOptions.constants.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';

/**
 * Send OTP for Customer App Sign-In / Login
 * Generates 4-digit OTP, prints to terminal log, and includes OTP in response (until DLT SMS integration).
 */
export const sendOtp = async (req, res, next) => {
  try {
    const { phone, storeId } = req.body;
    const cleanPhone = phone.trim();

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Print OTP clearly in terminal console
    console.log('\n========================================');
    console.log(`[CUSTOMER APP OTP] Mobile: ${cleanPhone} | Generated OTP: ${otp}`);
    console.log('========================================\n');

    let customer = await Customer.findOne({
      phone: cleanPhone,
      ...(storeId ? { storeId } : {}),
    }).select('+otp +otpExpires');

    let isNewCustomer = false;

    if (customer) {
      customer.otp = otp;
      customer.otpExpires = otpExpires;
      await customer.save();
    } else {
      isNewCustomer = true;
      customer = await Customer.create({
        phone: cleanPhone,
        name: 'Customer',
        storeId: storeId || null,
        otp,
        otpExpires,
        status: 'active',
      });
    }

    return res.status(200).json(
      successResponse({
        message: 'OTP generated and sent successfully to mobile number',
        data: {
          phone: cleanPhone,
          otp,
          expiresInSeconds: 600,
          isNewCustomer,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Verify OTP & Login / Register Customer
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, storeId } = req.body;
    const cleanPhone = phone.trim();
    const cleanOtp = otp.trim();

    const customer = await Customer.findOne({
      phone: cleanPhone,
      ...(storeId ? { storeId } : {}),
    }).select('+otp +otpExpires');

    if (!customer) {
      return next(notFound('Customer record not found for this mobile number. Please request a new OTP.'));
    }

    if (!customer.otp || customer.otp !== cleanOtp) {
      return next(badRequest('Invalid OTP. Please check and try again.'));
    }

    if (customer.otpExpires && new Date(customer.otpExpires) < new Date()) {
      return next(badRequest('OTP has expired. Please request a new code.'));
    }

    // Clear OTP fields upon successful verification
    customer.otp = null;
    customer.otpExpires = null;
    await customer.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: customer._id, phone: customer.phone, role: 'customer' },
      env.CUSTOMER_JWT_SECRET,
      { expiresIn: env.CUSTOMER_JWT_EXPIRES_IN }
    );

    res.cookie('customerToken', token, customerCookieOptions);

    const customerObj = customer.toObject();
    delete customerObj.otp;
    delete customerObj.otpExpires;

    return res.status(200).json(
      successResponse({
        message: 'OTP verified successfully. Login successful.',
        data: {
          customer: customerObj,
          token,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Resend OTP
 */
export const resendOtp = async (req, res, next) => {
  try {
    const { phone, storeId } = req.body;
    const cleanPhone = phone.trim();

    let customer = await Customer.findOne({
      phone: cleanPhone,
      ...(storeId ? { storeId } : {}),
    }).select('+otp +otpExpires');

    // Generate new 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log('\n========================================');
    console.log(`[CUSTOMER APP RESEND OTP] Mobile: ${cleanPhone} | Generated OTP: ${otp}`);
    console.log('========================================\n');

    if (customer) {
      customer.otp = otp;
      customer.otpExpires = otpExpires;
      await customer.save();
    } else {
      customer = await Customer.create({
        phone: cleanPhone,
        name: 'Customer',
        storeId: storeId || null,
        otp,
        otpExpires,
        status: 'active',
      });
    }

    return res.status(200).json(
      successResponse({
        message: 'A new OTP has been generated and sent successfully',
        data: {
          phone: cleanPhone,
          otp,
          expiresInSeconds: 600,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Customer profile retrieved successfully',
        data: { customer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Customer Profile (Name, Email, DOB, Address)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, dateOfBirth, address } = req.body;

    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    if (name !== undefined) customer.name = String(name).trim();
    if (email !== undefined) customer.email = String(email).trim().toLowerCase();
    if (dateOfBirth !== undefined) customer.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (address !== undefined) customer.address = String(address).trim();

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Customer profile updated successfully',
        data: { customer },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Customer Logout
 */
export const logout = async (_req, res) => {
  res.clearCookie('customerToken', customerCookieOptions);

  return res.status(200).json(
    successResponse({
      message: 'Logged out successfully',
    })
  );
};
