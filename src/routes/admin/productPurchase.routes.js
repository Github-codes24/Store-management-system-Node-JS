import { Router } from 'express';
import {
  addPurchasePayment,
  cancelProductPurchase,
  deletePurchaseItem,
  getProductPurchaseById,
  getProductPurchases,
  getPurchasePayments,
  createProductPurchase,
  updateProductPurchase,
} from '../../controllers/admin/productPurchase.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  addPurchasePaymentSchema,
  createProductPurchaseSchema,
  getProductPurchasesQuerySchema,
  updateProductPurchaseSchema,
} from '../../validations/productPurchase.validation.js';

const router = Router();

// Apply admin authentication to all product purchase routes
router.use(adminAuth);

router.post('/', validate(createProductPurchaseSchema), createProductPurchase);
router.get('/', validate(getProductPurchasesQuerySchema), getProductPurchases);
router.get('/:id', getProductPurchaseById);
router.put('/:id', validate(updateProductPurchaseSchema), updateProductPurchase);
router.post('/:id/payments', validate(addPurchasePaymentSchema), addPurchasePayment);
router.get('/:id/payments', getPurchasePayments);
router.delete('/:id/items/:itemId', deletePurchaseItem);
router.delete('/:id', cancelProductPurchase);

export default router;
