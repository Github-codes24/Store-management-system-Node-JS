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

router.get('/dropdown', getSubcategoryDropdown);
router.get('/by-category/:categoryId', getSubcategoriesByCategory);

router
  .route('/')
  .post(upload.any(), parseForm, validate(createSubcategorySchema), createSubcategory)
  .get(getSubcategories);

router
  .route('/:id')
  .get(getSubcategoryById)
  .put(upload.any(), parseForm, validate(updateSubcategorySchema), updateSubcategory)
  .delete(deleteSubcategory);

router.patch('/:id/status', validate(toggleStatusSchema), toggleSubcategoryStatus);

export default router;
