import { Router } from 'express';
import {
  getProfile,
  changePassword,
} from '../../controllers/store-employee/storeEmployee.auth.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { changePasswordSchema } from '../../validations/storeEmployee.validation.js';

const router = Router();

// Protect all profile routes with store employee authentication
router.use(storeEmployeeAuth);

router.get('/', getProfile);
router.post('/change-password', validate(changePasswordSchema), changePassword);

export default router;
