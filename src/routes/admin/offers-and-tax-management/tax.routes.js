import { Router } from 'express';
import {
  createTax,
  getAllTaxes,
  getTaxById,
  updateTax,
  deleteTax,
  getTaxFilterOptions,
} from '../../../controllers/admin/offers-and-tax-management/tax.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createTaxSchema,
  updateTaxSchema,
} from '../../../validations/offers-and-tax-management/tax.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/filter-options', requirePermission('taxManagement', 'viewOnly'), getTaxFilterOptions);

router
  .route('/')
  .post(requirePermission('taxManagement', 'create'), parseForm, validate(createTaxSchema), createTax)
  .get(requirePermission('taxManagement', 'viewOnly'), getAllTaxes);

router
  .route('/:id')
  .get(requirePermission('taxManagement', 'viewOnly'), getTaxById)
  .put(requirePermission('taxManagement', 'modify'), parseForm, validate(updateTaxSchema), updateTax)
  .delete(requirePermission('taxManagement', 'delete'), deleteTax);

export default router;

