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
import requireStorePermission from '../../middlewares/storePermission.middleware.js';
import upload from '../../config/storage.js';
import parseForm from '../../middlewares/parseForm.middleware.js';

const router = Router();

// Apply store employee authentication to all store product routes
router.use(storeEmployeeAuth);

// Helper endpoints
router.get('/attributes', requireStorePermission('productInventory', 'viewOnly'), getStoreProductAttributes);
router.get('/options', requireStorePermission('productInventory', 'viewOnly'), getStoreProductDropdownOptions);
router.get('/export', requireStorePermission('productInventory', 'viewOnly'), exportStoreProducts);
router.get('/barcode/:barcode', requireStorePermission('productInventory', 'viewOnly'), lookupStoreProductBarcode);

// CRUD
router.get('/', requireStorePermission('productInventory', 'viewOnly'), getStoreProducts);
router.get('/:id', requireStorePermission('productInventory', 'viewOnly'), getStoreProductById);
router.post('/', requireStorePermission('productInventory', 'create'), upload.any(), parseForm, createStoreProduct);
router.put('/:id', requireStorePermission('productInventory', 'modify'), upload.any(), parseForm, updateStoreProduct);
router.patch('/:id/status', requireStorePermission('productInventory', 'modify'), toggleStoreProductStatus);
router.delete('/:id', requireStorePermission('productInventory', 'delete'), deleteStoreProduct);

// Print Barcode
router.get('/:id/print-barcode', requireStorePermission('productInventory', 'viewOnly'), printStoreProductBarcode);
router.post('/:id/print-barcode', requireStorePermission('productInventory', 'viewOnly'), printStoreProductBarcode);

export default router;
