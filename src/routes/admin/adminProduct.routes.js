import { Router } from 'express';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminProductById,
  getAdminProducts,
  getAdminProductDropdown,
  lookupByBarcode,
  updateAdminProduct,
} from '../../controllers/admin/adminProduct.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import upload from '../../config/storage.js';
import parseForm from '../../middlewares/parseForm.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createAdminProductSchema,
  getAdminProductsQuerySchema,
  updateAdminProductSchema,
} from '../../validations/adminProduct.validation.js';

const router = Router();

// Apply admin authentication to all product routes
router.use(adminAuth);

// Helper to bridge single file reference
const setSingleFile = (req, _res, next) => {
  if (req.files && req.files.length > 0) {
    req.file = req.files[0];
  }
  next();
};

router.get('/dropdown', getAdminProductDropdown);
router.get('/barcode/:barcode', lookupByBarcode);
router.post(
  '/',
  upload.any(),
  setSingleFile,
  parseForm,
  validate(createAdminProductSchema),
  createAdminProduct
);
router.get('/', validate(getAdminProductsQuerySchema), getAdminProducts);
router.get('/:id', getAdminProductById);
router.put(
  '/:id',
  upload.any(),
  setSingleFile,
  parseForm,
  validate(updateAdminProductSchema),
  updateAdminProduct
);
router.delete('/:id', deleteAdminProduct);

export default router;


