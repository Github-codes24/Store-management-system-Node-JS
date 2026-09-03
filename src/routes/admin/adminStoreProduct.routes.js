import { Router } from 'express';
import {
  getAdminStoreProducts,
  getAdminStoreProductById,
  toggleAdminStoreProductStatus,
  updateAdminStoreProduct,
  deleteAdminStoreProduct,
  getAdminStoreProductFilterOptions,
} from '../../controllers/admin/adminStoreProduct.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

// Apply admin auth
router.use(adminAuth);

// Filter options
router.get('/filter-options', getAdminStoreProductFilterOptions);

// List & CRUD
router.get('/', getAdminStoreProducts);
router.get('/:id', getAdminStoreProductById);
router.patch('/:id/status', toggleAdminStoreProductStatus);
router.put('/:id/status', toggleAdminStoreProductStatus);
router.put('/:id', updateAdminStoreProduct);
router.delete('/:id', deleteAdminStoreProduct);

export default router;
