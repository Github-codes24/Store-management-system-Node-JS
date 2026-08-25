import { Router } from 'express';

import {
  createTax,
  getAllTaxes,
  getTaxById,
  updateTax,
  deleteTax,
} from '../../../controllers/admin/offers-tax-management/tax.controller.js';

import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';

import {
  createTaxSchema,
  updateTaxSchema,
} from '../../../validations/offers-tax-management/tax.validation.js';

const router = Router();

router.use(adminAuth);

// Create + Get All
router
  .route('/')
  .post(
    validate(createTaxSchema),
    createTax
  )
  .get(getAllTaxes);

// Get + Update + Delete
router
  .route('/:id')
  .get(getTaxById)
  .put(
    validate(updateTaxSchema),
    updateTax
  )
  .delete(deleteTax);

export default router;