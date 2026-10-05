import { Router } from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayPaymentStatus,
} from '../../controllers/customer/razorpayPayment.controller.js';
import { optionalCustomerAuth } from '../../middlewares/customer.auth.middleware.js';

const router = Router();

// Apply optional auth so both logged-in customers and guest checkouts can process payments
router.use(optionalCustomerAuth);

// 1. Create Razorpay Order
router.post('/create-order', createRazorpayOrder);

// 2. Verify Razorpay Payment Signature
router.post('/verify-payment', verifyRazorpayPayment);

// 3. Get Payment Status by Order ID / Razorpay ID
router.get('/status/:orderId', getRazorpayPaymentStatus);
router.get('/payment-status/:orderId', getRazorpayPaymentStatus);

export default router;
