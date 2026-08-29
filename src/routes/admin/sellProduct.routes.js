import { Router } from 'express';
import {
  addSellPayment,
  createSellProduct,
  deleteSellPayment,
  deleteSellProduct,
  exportSellProducts,
  generateInvoice,
  getSellProductById,
  getSellProducts,
  getSellPayments,
  updateSellProduct,
} from '../../controllers/admin/sellProduct.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  addSellPaymentSchema,
  createSellProductSchema,
  getSellProductsQuerySchema,
  updateSellProductSchema,
} from '../../validations/sellProduct.validation.js';

const router = Router();

// Require admin authentication
router.use(adminAuth);

// Export report endpoint (placed before /:id)
router.get('/export', exportSellProducts);

// Base CRUD Endpoints
router.post('/', validate(createSellProductSchema), createSellProduct);
router.get('/', validate(getSellProductsQuerySchema), getSellProducts);
router.get('/:id', getSellProductById);
router.put('/:id', validate(updateSellProductSchema), updateSellProduct);
router.delete('/:id', deleteSellProduct);

// Payment Endpoints (+ Payment modal)
router.post('/:id/payments', validate(addSellPaymentSchema), addSellPayment);
router.get('/:id/payments', getSellPayments);
router.delete('/:id/payments/:paymentId', deleteSellPayment);

// Invoice Print / Metadata Endpoint
router.get('/:id/invoice', generateInvoice);

export default router;
