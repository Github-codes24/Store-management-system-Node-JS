import { Router } from 'express';
import {
  getStoreProducts,
  getStoreProductById,
  createStoreProduct,
  updateStoreProduct,
  toggleStoreProductStatus,
  deleteStoreProduct,
  getStoreProductAttributes,
  getStoreProductDropdownOptions,
  exportStoreProducts,
  lookupStoreProductBarcode,
  printStoreProductBarcode,
} from '../../controllers/store-employee/storeProduct.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import upload from '../../config/storage.js';
import parseForm from '../../middlewares/parseForm.middleware.js';

const router = Router();

// Apply store employee authentication to all store product routes
router.use(storeEmployeeAuth);

// Helper endpoints
router.get('/attributes', getStoreProductAttributes);
router.get('/options', getStoreProductDropdownOptions);
router.get('/export', exportStoreProducts);
router.get('/barcode/:barcode', lookupStoreProductBarcode);

// CRUD
router.get('/', getStoreProducts);
router.get('/:id', getStoreProductById);
router.post('/', upload.single('productImage'), parseForm, createStoreProduct);
router.put('/:id', upload.single('productImage'), parseForm, updateStoreProduct);
router.patch('/:id/status', toggleStoreProductStatus);
router.delete('/:id', deleteStoreProduct);

// Print Barcode
router.get('/:id/print-barcode', printStoreProductBarcode);
router.post('/:id/print-barcode', printStoreProductBarcode);

export default router;
