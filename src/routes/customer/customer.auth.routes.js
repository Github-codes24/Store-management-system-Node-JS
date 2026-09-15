import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  getProfile,
  updateProfile,
  logout,
  saveCustomerLocation,
  getCustomerLocations,
  selectCustomerLocation,
  deleteCustomerAddress,
} from '../../controllers/customer/customer.auth.controller.js';
import customerAuthMiddleware from '../../middlewares/customer.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import upload from '../../config/storage.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updateCustomerProfileSchema,
  saveLocationSchema,
  selectLocationSchema,
  deleteLocationSchema,
} from '../../validations/customer/customer.auth.validation.js';

const router = Router();

// Public Auth Endpoints
router.post('/send-otp', validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), resendOtp);

// Authenticated Customer Endpoints
router.get('/profile', customerAuthMiddleware, getProfile);
router.put('/profile', customerAuthMiddleware, upload.single('profileImage'), validate(updateCustomerProfileSchema), updateProfile);
router.post('/logout', customerAuthMiddleware, logout);

// Customer Location & Address Management Endpoints
router.post('/location', customerAuthMiddleware, validate(saveLocationSchema), saveCustomerLocation);
router.get('/location', customerAuthMiddleware, getCustomerLocations);
router.patch('/location/:addressId/select', customerAuthMiddleware, validate(selectLocationSchema), selectCustomerLocation);
router.delete('/location/:addressId', customerAuthMiddleware, validate(deleteLocationSchema), deleteCustomerAddress);

export default router;
