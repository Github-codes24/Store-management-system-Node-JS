import { Router } from 'express';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayPaymentStatus,
  handleRazorpayWebhook,
} from '../../controllers/customer/razorpayPayment.controller.js';
import { optionalCustomerAuth } from '../../middlewares/customer.auth.middleware.js';

const router = Router();

// 1. Razorpay Webhook Endpoint (unauthenticated server-to-server callback)
router.post('/webhook', handleRazorpayWebhook);

// Apply optional auth for user routes
router.use(optionalCustomerAuth);

// 2. Create Razorpay Order
router.post('/create-order', createRazorpayOrder);

// 3. Verify Razorpay Payment Signature
router.post('/verify-payment', verifyRazorpayPayment);

// 4. Get Payment Status by Order ID / Razorpay ID
router.get('/status/:orderId', getRazorpayPaymentStatus);
router.get('/payment-status/:orderId', getRazorpayPaymentStatus);

export default router;
