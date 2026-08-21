import { Router } from 'express';
import {
  createProductType,
  getProductTypes,
  getProductTypeById,
  updateProductType,
  toggleProductTypeStatus,
  deleteProductType,
} from '../../../controllers/admin/product-management/productType.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import upload from '../../../config/storage.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createProductTypeSchema,
  updateProductTypeSchema,
  toggleStatusSchema,
} from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router
  .route('/')
  .post(upload.single('image'), parseForm, validate(createProductTypeSchema), createProductType)
  .get(getProductTypes);

router
  .route('/:id')
  .get(getProductTypeById)
  .put(upload.single('image'), parseForm, validate(updateProductTypeSchema), updateProductType)
  .delete(deleteProductType);

router.patch('/:id/status', validate(toggleStatusSchema), toggleProductTypeStatus);

export default router;
