import { Router } from 'express';
import {
  createSubAdmin,
  getSubAdmins,
  getSubAdminById,
  updateSubAdmin,
  deleteSubAdmin,
} from '../../../controllers/admin/user-management/subAdmin.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
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
  .post(requirePermission('subAdmin', 'create'), parseForm, validate(createSubAdminSchema), createSubAdmin)
  .get(requirePermission('subAdmin', 'viewOnly'), getSubAdmins);

router
  .route('/:id')
  .get(requirePermission('subAdmin', 'viewOnly'), getSubAdminById)
  .put(requirePermission('subAdmin', 'modify'), parseForm, validate(updateSubAdminSchema), updateSubAdmin)
  .delete(requirePermission('subAdmin', 'delete'), deleteSubAdmin);

export default router;

