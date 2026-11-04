import { Router } from 'express';
import {
  createOrAppendOrderBill,
  getStoreOrders,
  getOrderById,
  updateOrderStatus,
  deleteStoreOrder,
  lookupBillForReturn,
  processBillReturn,
  getStoreCustomers,
  createStoreCustomer,
  generatePosBillingQrCode,
  checkPosBillingQrStatus,
} from '../../controllers/store-employee/storeBilling.controller.js';
import { getStoreBillingApplicableOffers } from '../../controllers/store-employee/storeEmployee.offer.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import requireStorePermission from '../../middlewares/storePermission.middleware.js';

const router = Router();

// Apply store employee auth middleware and billing module permission
router.use(storeEmployeeAuth);
router.use(requireStorePermission('billing', 'viewOnly'));

// Billing endpoints
router.post('/bills', createOrAppendOrderBill);
router.get(
  '/orders',
  (req, res, next) => {
    const saleType = String(req.query.saleType || '').toLowerCase();
    if (saleType === 'online') {
      return requireStorePermission('onlineOrders', 'viewOnly')(req, res, next);
    }
    if (saleType === 'offline') {
      return requireStorePermission('offlineSales', 'viewOnly')(req, res, next);
    }
    return next();
  },
  getStoreOrders
);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
router.delete('/orders/:id', deleteStoreOrder);
router.get('/customers', getStoreCustomers);
router.post('/customers', createStoreCustomer);
router.get('/applicable-offers', getStoreBillingApplicableOffers);

// Dynamic POS QR Code Billing endpoints
router.post('/generate-qr', generatePosBillingQrCode);
router.get('/qr-status/:qrId', checkPosBillingQrStatus);

// Returns endpoints
router.get('/lookup-bill/:identifier', lookupBillForReturn);
router.post('/returns', processBillReturn);

export default router;
