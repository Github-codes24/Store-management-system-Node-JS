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
import requirePermission from '../../../middlewares/permission.middleware.js';
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

router.get('/dropdown', requirePermission('brands', 'viewOnly'), getBrandDropdown);

router
  .route('/')
  .post(requirePermission('brands', 'create'), upload.any(), parseForm, validate(createBrandSchema), createBrand)
  .get(requirePermission('brands', 'viewOnly'), getBrands);

router
  .route('/:id')
  .get(requirePermission('brands', 'viewOnly'), getBrandById)
  .put(requirePermission('brands', 'modify'), upload.any(), parseForm, validate(updateBrandSchema), updateBrand)
  .delete(requirePermission('brands', 'delete'), deleteBrand);

router.patch('/:id/status', requirePermission('brands', 'modifyStatus'), validate(toggleStatusSchema), toggleBrandStatus);

export default router;


