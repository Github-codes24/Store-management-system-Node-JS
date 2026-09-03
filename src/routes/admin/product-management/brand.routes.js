import { Router } from 'express';
import {
  createBrand,
  getBrands,
  getBrandById,
  getBrandDropdown,
  updateBrand,
  toggleBrandStatus,
  deleteBrand,
} from '../../../controllers/admin/product-management/brand.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import upload from '../../../config/storage.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createBrandSchema,
  updateBrandSchema,
} from '../../../validations/product-management/brand.validation.js';
import { toggleStatusSchema } from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/dropdown', getBrandDropdown);

router
  .route('/')
  .post(upload.any(), parseForm, validate(createBrandSchema), createBrand)
  .get(getBrands);

router
  .route('/:id')
  .get(getBrandById)
  .put(upload.any(), parseForm, validate(updateBrandSchema), updateBrand)
  .delete(deleteBrand);

router.patch('/:id/status', validate(toggleStatusSchema), toggleBrandStatus);

export default router;

