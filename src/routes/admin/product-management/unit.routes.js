import { Router } from 'express';
import {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  toggleUnitStatus,
  deleteUnit,
} from '../../../controllers/admin/product-management/unit.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createUnitSchema,
  updateUnitSchema,
} from '../../../validations/product-management/unit.validation.js';
import { toggleStatusSchema } from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router
  .route('/')
  .post(parseForm, validate(createUnitSchema), createUnit)
  .get(getUnits);

router
  .route('/:id')
  .get(getUnitById)
  .put(parseForm, validate(updateUnitSchema), updateUnit)
  .delete(deleteUnit);

router.patch('/:id/status', validate(toggleStatusSchema), toggleUnitStatus);

export default router;
