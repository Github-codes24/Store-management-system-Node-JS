import { Router } from 'express';
import {
  sendOtp,
  verifyOtp,
  resendOtp,
  getProfile,
  updateProfile,
  logout,
} from '../../controllers/customer/customer.auth.controller.js';
import customerAuthMiddleware from '../../middlewares/customer.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updateCustomerProfileSchema,
} from '../../validations/customer/customer.auth.validation.js';

const router = Router();

// Public Auth Endpoints
router.post('/send-otp', validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', validate(resendOtpSchema), resendOtp);

// Authenticated Customer Endpoints
router.get('/profile', customerAuthMiddleware, getProfile);
router.put('/profile', customerAuthMiddleware, validate(updateCustomerProfileSchema), updateProfile);
router.post('/logout', customerAuthMiddleware, logout);

export default router;
