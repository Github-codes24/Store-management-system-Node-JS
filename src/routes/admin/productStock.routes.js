import { Router } from 'express';
import {
  adjustStockQuantity,
  deleteProductStock,
  exportProductStocks,
  getProductStockById,
  getProductStocks,
  getProductStockSummary,
  printBarcode,
  updateProductStock,
  updateStockStatus,
} from '../../controllers/admin/productStock.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../middlewares/permission.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  adjustStockQuantitySchema,
  exportProductStocksQuerySchema,
  getProductStocksQuerySchema,
  printBarcodeSchema,
  updateProductStockSchema,
  updateStockStatusSchema,
} from '../../validations/productStock.validation.js';

const router = Router();

// Apply admin authentication to all product stock routes
router.use(adminAuth);

router.get('/summary', requirePermission('productStock', 'viewOnly'), getProductStockSummary);
router.get(
  '/export',
  requirePermission('productStock', 'viewOnly'),
  validate(exportProductStocksQuerySchema),
  exportProductStocks
);

router.get(
  '/',
  requirePermission('productStock', 'viewOnly'),
  validate(getProductStocksQuerySchema),
  getProductStocks
);
router.get('/:id', requirePermission('productStock', 'viewOnly'), getProductStockById);

router.put(
  '/:id',
  requirePermission('productStock', 'modify'),
  validate(updateProductStockSchema),
  updateProductStock
);
router.patch(
  '/:id',
  requirePermission('productStock', 'modify'),
  validate(updateProductStockSchema),
  updateProductStock
);

router.patch(
  '/:id/status',
  requirePermission('productStock', 'modifyStatus'),
  validate(updateStockStatusSchema),
  updateStockStatus
);
router.patch(
  '/:id/adjust-stock',
  requirePermission('productStock', 'modify'),
  validate(adjustStockQuantitySchema),
  adjustStockQuantity
);

router.post(
  '/:id/print-barcode',
  requirePermission('productStock', 'viewOnly'),
  validate(printBarcodeSchema),
  printBarcode
);
router.get(
  '/:id/print-barcode',
  requirePermission('productStock', 'viewOnly'),
  validate(printBarcodeSchema),
  printBarcode
);

router.delete('/:id', requirePermission('productStock', 'delete'), deleteProductStock);

export default router;
