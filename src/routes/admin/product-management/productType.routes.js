import { Router } from 'express';
import {
  createProductType,
  getProductTypes,
  getProductTypeById,
  getProductTypeDropdown,
  updateProductType,
  toggleProductTypeStatus,
  deleteProductType,
} from '../../../controllers/admin/product-management/productType.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
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

router.get('/dropdown', requirePermission('productTypes', 'viewOnly'), getProductTypeDropdown);

router
  .route('/')
  .post(
    requirePermission('productTypes', 'create'),
    upload.any(),
    parseForm,
    validate(createProductTypeSchema),
    createProductType
  )
  .get(requirePermission('productTypes', 'viewOnly'), getProductTypes);

router
  .route('/:id')
  .get(requirePermission('productTypes', 'viewOnly'), getProductTypeById)
  .put(
    requirePermission('productTypes', 'modify'),
    upload.any(),
    parseForm,
    validate(updateProductTypeSchema),
    updateProductType
  )
  .delete(requirePermission('productTypes', 'delete'), deleteProductType);

router.patch(
  '/:id/status',
  requirePermission('productTypes', 'modifyStatus'),
  validate(toggleStatusSchema),
  toggleProductTypeStatus
);

export default router;
