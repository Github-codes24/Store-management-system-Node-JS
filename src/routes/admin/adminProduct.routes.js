import { Router } from 'express';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProductById,
  getAdminProducts,
  lookupByBarcode,
  updateAdminProduct,
} from '../../controllers/admin/adminProduct.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createAdminProductSchema,
  getAdminProductsQuerySchema,
  updateAdminProductSchema,
} from '../../validations/adminProduct.validation.js';

const router = Router();

// Apply admin authentication to all product routes
router.use(adminAuth);

router.get('/barcode/:barcode', lookupByBarcode);
router.post('/', validate(createAdminProductSchema), createAdminProduct);
router.get('/', validate(getAdminProductsQuerySchema), getAdminProducts);
router.get('/:id', getAdminProductById);
router.put('/:id', validate(updateAdminProductSchema), updateAdminProduct);
router.delete('/:id', deleteAdminProduct);

export default router;
