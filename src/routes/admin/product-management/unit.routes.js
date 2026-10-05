import { Router } from 'express';
import {
  createUnit,
  getUnits,
  getUnitById,
  getUnitDropdown,
  updateUnit,
  toggleUnitStatus,
  deleteUnit,
} from '../../../controllers/admin/product-management/unit.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createUnitSchema,
  updateUnitSchema,
} from '../../../validations/product-management/unit.validation.js';
import { toggleStatusSchema } from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/dropdown', requirePermission('units', 'viewOnly'), getUnitDropdown);

router
  .route('/')
  .post(requirePermission('units', 'create'), parseForm, validate(createUnitSchema), createUnit)
  .get(requirePermission('units', 'viewOnly'), getUnits);

router
  .route('/:id')
  .get(requirePermission('units', 'viewOnly'), getUnitById)
  .put(requirePermission('units', 'modify'), parseForm, validate(updateUnitSchema), updateUnit)
  .delete(requirePermission('units', 'delete'), deleteUnit);

router.patch('/:id/status', requirePermission('units', 'modifyStatus'), validate(toggleStatusSchema), toggleUnitStatus);

export default router;


