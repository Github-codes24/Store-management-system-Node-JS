import Customer from '../../models/customer.model.js';
import Store from '../../models/store.model.js';
import env from '../../config/env.js';
import jwt from 'jsonwebtoken';
import { customerCookieOptions } from '../../constants/cookieOptions.constants.js';
import { successResponse } from '../../utils/api-response.js';
import { badRequest, notFound } from '../../utils/api-error.js';
import { processUploadedFile } from '../../utils/file-upload.js';

/**
 * Generate 4-digit numeric OTP
 */
const generateFourDigitOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Helper to ensure Customer always has a valid storeId attached (auto-assign first active Store if null)
 */
const ensureCustomerStoreId = async (customer, requestedStoreId = null) => {
  if (requestedStoreId) {
    customer.storeId = requestedStoreId;
  } else if (!customer.storeId) {
    const defaultStore = await Store.findOne({ isDeleted: false }).select('_id');
    if (defaultStore) {
      customer.storeId = defaultStore._id;
    }
  }
};

/**
 * Helper to find matching store by customer address city / pinCode / location string
 */
const findMatchingStoreByLocation = async (address) => {
  if (!address) return null;

  if (address.city && String(address.city).trim() !== '') {
    const matchedStore = await Store.findOne({
      isDeleted: false,
      location: { $regex: String(address.city).trim(), $options: 'i' },
    }).select('_id');
    if (matchedStore) return matchedStore._id;
  }

  if (address.pinCode && String(address.pinCode).trim() !== '') {
    const matchedStore = await Store.findOne({
      isDeleted: false,
      location: { $regex: String(address.pinCode).trim(), $options: 'i' },
    }).select('_id');
    if (matchedStore) return matchedStore._id;
  }

  return null;
};

/**
 * Send OTP for Customer Sign In / Registration
 * POST /api/customer/auth/send-otp
 */
export const sendOtp = async (req, res, next) => {
  try {
    const { phone, storeId } = req.body;
    const cleanPhone = String(phone).trim();

    const otp = generateFourDigitOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log('\n========================================');
    console.log(`[CUSTOMER APP OTP] Mobile: ${cleanPhone} | Generated OTP: ${otp}`);
    console.log('========================================\n');

    let customer = await Customer.findOne({ phone: cleanPhone });

    if (customer) {
      customer.otp = otp;
      customer.otpExpires = otpExpires;
      await ensureCustomerStoreId(customer, storeId);
      await customer.save();
    } else {
      customer = new Customer({
        phone: cleanPhone,
        name: 'Customer',
        otp,
        otpExpires,
        status: 'active',
      });
      await ensureCustomerStoreId(customer, storeId);
      await customer.save();
    }

    return res.status(200).json(
      successResponse({
        message: 'OTP generated and sent successfully. Check server terminal logs or response payload.',
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
 * Verify OTP & Login / Register Customer
 * POST /api/customer/auth/verify-otp
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, storeId } = req.body;
    const cleanPhone = String(phone).trim();

    const customer = await Customer.findOne({ phone: cleanPhone }).select('+otp +otpExpires');

    if (!customer || !customer.otp || customer.otp !== String(otp).trim()) {
      return next(badRequest('Invalid OTP. Please check and try again.'));
    }

    if (customer.otpExpires && customer.otpExpires < new Date()) {
      return next(badRequest('OTP has expired. Please request a new code.'));
    }

    customer.otp = null;
    customer.otpExpires = null;
    await ensureCustomerStoreId(customer, storeId);
    await customer.save();

    const token = jwt.sign(
      { id: customer._id, phone: customer.phone, role: 'customer' },
      env.CUSTOMER_JWT_SECRET,
      { expiresIn: env.CUSTOMER_JWT_EXPIRES_IN }
    );

    res.cookie('customerToken', token, customerCookieOptions);

    const custObj = customer.toObject();
    delete custObj.otp;
    delete custObj.otpExpires;

    return res.status(200).json(
      successResponse({
        message: 'OTP verified successfully. Welcome to ApnaMart!',
        data: {
          customer: custObj,
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
 * POST /api/customer/auth/resend-otp
 */
export const resendOtp = async (req, res, next) => {
  try {
    const { phone, storeId } = req.body;
    const cleanPhone = String(phone).trim();

    const otp = generateFourDigitOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    console.log('\n========================================');
    console.log(`[CUSTOMER APP RESEND OTP] Mobile: ${cleanPhone} | Generated OTP: ${otp}`);
    console.log('========================================\n');

    let customer = await Customer.findOne({ phone: cleanPhone });

    if (customer) {
      customer.otp = otp;
      customer.otpExpires = otpExpires;
      await ensureCustomerStoreId(customer, storeId);
      await customer.save();
    } else {
      customer = new Customer({
        phone: cleanPhone,
        name: 'Customer',
        otp,
        otpExpires,
        status: 'active',
      });
      await ensureCustomerStoreId(customer, storeId);
      await customer.save();
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

    if (!customer.storeId) {
      await ensureCustomerStoreId(customer);
      await customer.save();
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
 * Update Customer Profile (Name, Email, DOB, Gender, Address)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, dateOfBirth, gender, address, profileImage } = req.body;

    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    if (name !== undefined) customer.name = String(name).trim();
    if (email !== undefined) customer.email = String(email).trim().toLowerCase();
    if (dateOfBirth !== undefined) customer.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (gender !== undefined) customer.gender = gender;
    if (address !== undefined) customer.address = String(address).trim();

    if (req.file) {
      const uploadedUrl = await processUploadedFile(req.file, null, req);
      if (uploadedUrl) {
        customer.profileImage = uploadedUrl;
      }
    } else if (profileImage !== undefined) {
      customer.profileImage = profileImage;
    }

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
 * Save Customer Location / Address
 * POST /api/customer/auth/location
 */
export const saveCustomerLocation = async (req, res, next) => {
  try {
    const {
      fullName,
      name,
      mobileNumber,
      phone,
      flatNoStreetArea = '',
      city = '',
      state = '',
      country = 'India',
      pinCode = '',
      landmark = '',
      latitude = null,
      longitude = null,
      addressType = 'Home',
      formattedAddress: customFormatted,
      isDefault = true,
    } = req.body;

    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    const recipientName = name || fullName || customer.name || 'Customer';
    const recipientPhone = phone || mobileNumber || customer.phone || '';

    const parts = [flatNoStreetArea, city, state, country, pinCode ? `- ${pinCode}` : ''].filter(Boolean);
    const computedFormatted = customFormatted || parts.join(', ');

    const newAddress = {
      name: recipientName,
      phone: recipientPhone,
      addressType,
      flatNoStreetArea,
      city,
      state,
      country,
      pinCode,
      landmark,
      latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
      longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
      formattedAddress: computedFormatted,
      isDefault,
    };

    if (!Array.isArray(customer.addresses)) {
      customer.addresses = [];
    }

    if (isDefault) {
      customer.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    customer.addresses.push(newAddress);
    const addedAddress = customer.addresses[customer.addresses.length - 1];

    if (isDefault || !customer.currentLocation) {
      customer.currentLocation = addedAddress;
      customer.address = computedFormatted;

      const matchedStoreId = await findMatchingStoreByLocation(addedAddress);
      if (matchedStoreId) {
        customer.storeId = matchedStoreId;
      }
    }

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Customer location saved successfully',
        data: {
          currentLocation: customer.currentLocation,
          addresses: customer.addresses,
          customerAddressSummary: customer.address,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Customer Saved Locations / Addresses
 * GET /api/customer/auth/location
 */
export const getCustomerLocations = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.customer._id).select('currentLocation addresses address');
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Customer locations retrieved successfully',
        data: {
          currentLocation: customer.currentLocation,
          addresses: customer.addresses || [],
          customerAddressSummary: customer.address || '',
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Select Active Delivery Location
 * PATCH /api/customer/auth/location/:addressId/select
 */
export const selectCustomerLocation = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    if (!Array.isArray(customer.addresses) || customer.addresses.length === 0) {
      return next(notFound('No saved addresses found.'));
    }

    const targetAddress = customer.addresses.id(addressId);
    if (!targetAddress) {
      return next(notFound('Address not found.'));
    }

    customer.addresses.forEach((a) => {
      a.isDefault = a._id.toString() === addressId;
    });

    customer.currentLocation = targetAddress;
    customer.address = targetAddress.formattedAddress || `${targetAddress.flatNoStreetArea}, ${targetAddress.city}`;

    const matchedStoreId = await findMatchingStoreByLocation(targetAddress);
    if (matchedStoreId) {
      customer.storeId = matchedStoreId;
    }

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Selected location set as active delivery address',
        data: {
          currentLocation: customer.currentLocation,
          addresses: customer.addresses,
          customerAddressSummary: customer.address,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Saved Location / Address
 * PUT /api/customer/auth/location/:addressId
 */
export const updateCustomerAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const {
      fullName,
      name,
      mobileNumber,
      phone,
      flatNoStreetArea,
      city,
      state,
      country,
      pinCode,
      landmark,
      latitude,
      longitude,
      addressType,
      formattedAddress: customFormatted,
      isDefault,
    } = req.body;

    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    if (!Array.isArray(customer.addresses) || customer.addresses.length === 0) {
      return next(notFound('No saved addresses found.'));
    }

    const targetAddress = customer.addresses.id(addressId);
    if (!targetAddress) {
      return next(notFound('Address not found.'));
    }

    const recipientName = name !== undefined ? name : fullName;
    const recipientPhone = phone !== undefined ? phone : mobileNumber;

    if (recipientName !== undefined) targetAddress.name = String(recipientName).trim();
    if (recipientPhone !== undefined) targetAddress.phone = String(recipientPhone).trim();
    if (flatNoStreetArea !== undefined) targetAddress.flatNoStreetArea = flatNoStreetArea;
    if (city !== undefined) targetAddress.city = city;
    if (state !== undefined) targetAddress.state = state;
    if (country !== undefined) targetAddress.country = country;
    if (pinCode !== undefined) targetAddress.pinCode = pinCode;
    if (landmark !== undefined) targetAddress.landmark = landmark;
    if (addressType !== undefined) targetAddress.addressType = addressType;
    if (latitude !== undefined && latitude !== null) targetAddress.latitude = Number(latitude);
    if (longitude !== undefined && longitude !== null) targetAddress.longitude = Number(longitude);

    const parts = [
      targetAddress.flatNoStreetArea,
      targetAddress.city,
      targetAddress.state,
      targetAddress.country,
      targetAddress.pinCode ? `- ${targetAddress.pinCode}` : '',
    ].filter(Boolean);
    const computedFormatted = customFormatted || parts.join(', ');
    targetAddress.formattedAddress = computedFormatted;

    if (isDefault) {
      customer.addresses.forEach((a) => {
        a.isDefault = a._id.toString() === addressId;
      });
      targetAddress.isDefault = true;
      customer.currentLocation = targetAddress;
      customer.address = computedFormatted;
    } else if (customer.currentLocation && customer.currentLocation._id?.toString() === addressId) {
      customer.currentLocation = targetAddress;
      customer.address = computedFormatted;
    }

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Saved address updated successfully',
        data: {
          currentLocation: customer.currentLocation,
          addresses: customer.addresses,
          customerAddressSummary: customer.address,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Saved Location / Address
 * DELETE /api/customer/auth/location/:addressId
 */
export const deleteCustomerAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;
    const customer = await Customer.findById(req.customer._id);
    if (!customer) {
      return next(notFound('Customer profile not found.'));
    }

    if (Array.isArray(customer.addresses)) {
      customer.addresses = customer.addresses.filter((a) => a._id.toString() !== addressId);
    }

    if (customer.currentLocation && customer.currentLocation._id?.toString() === addressId) {
      customer.currentLocation = customer.addresses[0] || null;
      customer.address = customer.currentLocation ? customer.currentLocation.formattedAddress : '';
    }

    await customer.save();

    return res.status(200).json(
      successResponse({
        message: 'Saved address deleted successfully',
        data: {
          currentLocation: customer.currentLocation,
          addresses: customer.addresses || [],
        },
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
