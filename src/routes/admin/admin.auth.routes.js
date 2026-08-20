import { Router } from 'express';
import {
  register,
  login,
  logout,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getProfile,
  changePassword,
} from '../../controllers/admin/auth/admin.auth.controller.js';
import validate from '../../middlewares/validate.middleware.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import { authLimiter } from '../../middlewares/rate-limit.middleware.js';
import {
  registerAdminSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../../validations/admin.auth.validation.js';

const router = Router();

// Public auth endpoints
router.post('/register', validate(registerAdminSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);

// Protected endpoints (Requires Admin Authentication)
router.get('/me', adminAuth, getProfile);
router.post('/change-password', adminAuth, validate(changePasswordSchema), changePassword);

export default router;
