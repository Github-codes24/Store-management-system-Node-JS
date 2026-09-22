import { Router } from 'express';
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
} from '../../controllers/customer/customer.order.controller.js';
import customerAuthMiddleware from '../../middlewares/customer.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { placeOrderSchema, cancelOrderSchema } from '../../validations/customer/customer.order.validation.js';

const router = Router();

// All Order routes require Customer Authentication
router.use(customerAuthMiddleware);

router.post('/place-order', validate(placeOrderSchema), placeOrder);
router.get('/my-orders', getMyOrders);
router.get('/:orderId', getOrderById);
router.post('/:orderId/cancel', validate(cancelOrderSchema), cancelOrder);

export default router;
