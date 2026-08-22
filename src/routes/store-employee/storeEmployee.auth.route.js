import { Router } from 'express';
import {
  login,
  logout,
  forgotPassword,
  resendOtp,
  verifyOtp,
  resetPassword,
} from '../../controllers/store-employee/storeEmployee.auth.controller.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  storeEmployeeLoginSchema,
  forgotPasswordSchema,
  resendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
} from '../../validations/storeEmployee.validation.js';

const router = Router();

router.post('/login', validate(storeEmployeeLoginSchema), login);
router.post('/logout', logout);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/resend-otp', validate(resendOtpSchema), resendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
