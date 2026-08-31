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
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createTaxSchema,
  updateTaxSchema,
} from '../../../validations/offers-and-tax-management/tax.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/filter-options', getTaxFilterOptions);

router
  .route('/')
  .post(parseForm, validate(createTaxSchema), createTax)
  .get(getAllTaxes);

router
  .route('/:id')
  .get(getTaxById)
  .put(parseForm, validate(updateTaxSchema), updateTax)
  .delete(deleteTax);

export default router;
