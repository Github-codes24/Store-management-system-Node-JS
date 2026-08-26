import { Router } from 'express';
import {
  createSubAdmin,
  getSubAdmins,
  getSubAdminById,
  updateSubAdmin,
  deleteSubAdmin,
} from '../../../controllers/admin/user-management/subAdmin.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createSubAdminSchema,
  updateSubAdminSchema,
} from '../../../validations/user-management/subAdmin.validation.js';

const router = Router();

router.use(adminAuth);

router
  .route('/')
  .post(parseForm, validate(createSubAdminSchema), createSubAdmin)
  .get(getSubAdmins);

router
  .route('/:id')
  .get(getSubAdminById)
  .put(parseForm, validate(updateSubAdminSchema), updateSubAdmin)
  .delete(deleteSubAdmin);

export default router;
