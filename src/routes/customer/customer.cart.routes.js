import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
} from '../../controllers/customer/customer.cart.controller.js';
import customerAuthMiddleware from '../../middlewares/customer.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  addToCartSchema,
  updateCartQuantitySchema,
} from '../../validations/customer/customer.cart.validation.js';

const router = Router();

// All Cart routes require Customer Authentication
router.use(customerAuthMiddleware);

router.get('/', getCart);
router.post('/add', validate(addToCartSchema), addToCart);
router.put('/update-quantity', validate(updateCartQuantitySchema), updateCartQuantity);
router.delete('/remove/:productId', removeFromCart);
router.delete('/clear', clearCart);

export default router;
