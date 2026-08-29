import { Router } from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryDropdown,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
} from '../../../controllers/admin/product-management/category.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
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

router.get('/dropdown', getCategoryDropdown);

router
  .route('/')
  .post(upload.single('image'), parseForm, validate(createCategorySchema), createCategory)
  .get(getCategories);

router
  .route('/:id')
  .get(getCategoryById)
  .put(upload.single('image'), parseForm, validate(updateCategorySchema), updateCategory)
  .delete(deleteCategory);

router.patch('/:id/status', validate(toggleStatusSchema), toggleCategoryStatus);

export default router;

