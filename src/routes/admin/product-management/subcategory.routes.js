import { Router } from 'express';
import {
  createSubcategory,
  getSubcategories,
  getSubcategoryById,
  getSubcategoryDropdown,
  getSubcategoriesByCategory,
  updateSubcategory,
  toggleSubcategoryStatus,
  deleteSubcategory,
} from '../../../controllers/admin/product-management/subcategory.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import upload from '../../../config/storage.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createSubcategorySchema,
  updateSubcategorySchema,
} from '../../../validations/product-management/subcategory.validation.js';
import { toggleStatusSchema } from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/dropdown', requirePermission('subcategories', 'viewOnly'), getSubcategoryDropdown);
router.get('/by-category/:categoryId', requirePermission('subcategories', 'viewOnly'), getSubcategoriesByCategory);

router
  .route('/')
  .post(requirePermission('subcategories', 'create'), upload.any(), parseForm, validate(createSubcategorySchema), createSubcategory)
  .get(requirePermission('subcategories', 'viewOnly'), getSubcategories);

router
  .route('/:id')
  .get(requirePermission('subcategories', 'viewOnly'), getSubcategoryById)
  .put(requirePermission('subcategories', 'modify'), upload.any(), parseForm, validate(updateSubcategorySchema), updateSubcategory)
  .delete(requirePermission('subcategories', 'delete'), deleteSubcategory);

router.patch('/:id/status', requirePermission('subcategories', 'modifyStatus'), validate(toggleStatusSchema), toggleSubcategoryStatus);

export default router;

