import { Router } from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryDropdown,
  getCategoriesByProductType,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '../../../controllers/admin/product-management/category.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import upload from '../../../config/storage.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../../../validations/product-management/category.validation.js';
import { toggleStatusSchema } from '../../../validations/product-management/productType.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/dropdown', requirePermission('categories', 'viewOnly'), getCategoryDropdown);
router.get('/by-product-type/:productTypeId', requirePermission('categories', 'viewOnly'), getCategoriesByProductType);

router
  .route('/')
  .post(requirePermission('categories', 'create'), upload.any(), parseForm, validate(createCategorySchema), createCategory)
  .get(requirePermission('categories', 'viewOnly'), getCategories);

router
  .route('/:id')
  .get(requirePermission('categories', 'viewOnly'), getCategoryById)
  .put(requirePermission('categories', 'modify'), upload.any(), parseForm, validate(updateCategorySchema), updateCategory)
  .delete(requirePermission('categories', 'delete'), deleteCategory);

router.patch('/:id/status', requirePermission('categories', 'modifyStatus'), validate(toggleStatusSchema), toggleCategoryStatus);

export default router;

