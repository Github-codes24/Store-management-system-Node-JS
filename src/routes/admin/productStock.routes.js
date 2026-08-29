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

router.get('/summary', getProductStockSummary);
router.get('/export', validate(exportProductStocksQuerySchema), exportProductStocks);

router.get('/', validate(getProductStocksQuerySchema), getProductStocks);
router.get('/:id', getProductStockById);

router.put('/:id', validate(updateProductStockSchema), updateProductStock);
router.patch('/:id', validate(updateProductStockSchema), updateProductStock);

router.patch('/:id/status', validate(updateStockStatusSchema), updateStockStatus);
router.patch('/:id/adjust-stock', validate(adjustStockQuantitySchema), adjustStockQuantity);

router.post('/:id/print-barcode', validate(printBarcodeSchema), printBarcode);
router.get('/:id/print-barcode', validate(printBarcodeSchema), printBarcode);

router.delete('/:id', deleteProductStock);

export default router;
