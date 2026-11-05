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

// Apply store employee authentication
router.use(storeEmployeeAuth);

// Billing endpoints (strictly for Billing module)
router.post('/bills', requireStorePermission('billing', 'create'), createOrAppendOrderBill);
router.get('/customers', requireStorePermission(['billing', 'customers'], 'viewOnly'), getStoreCustomers);
router.post('/customers', requireStorePermission(['billing', 'customers'], 'create'), createStoreCustomer);
router.get('/applicable-offers', requireStorePermission(['billing', 'offers'], 'viewOnly'), getStoreBillingApplicableOffers);

// Dynamic POS QR Code Billing endpoints
router.post('/generate-qr', requireStorePermission('billing', 'create'), generatePosBillingQrCode);
router.get('/qr-status/:qrId', requireStorePermission('billing', 'viewOnly'), checkPosBillingQrStatus);

// Returns endpoints
router.get('/lookup-bill/:identifier', requireStorePermission('billing', 'viewOnly'), lookupBillForReturn);
router.post('/returns', requireStorePermission('billing', 'create'), processBillReturn);

// Orders & Sales endpoints (shared between onlineOrders, offlineSales, and billing)
router.get(
  '/orders',
  (req, res, next) => {
    const saleType = String(req.query.saleType || '').toLowerCase();
    if (saleType === 'online') {
      return requireStorePermission('onlineOrders', 'viewOnly')(req, res, next);
    }
    if (saleType === 'offline') {
      return requireStorePermission(['offlineSales', 'billing'], 'viewOnly')(req, res, next);
    }
    return requireStorePermission(['billing', 'offlineSales', 'onlineOrders'], 'viewOnly')(req, res, next);
  },
  getStoreOrders
);

router.get(
  '/orders/:id',
  requireStorePermission(['billing', 'offlineSales', 'onlineOrders'], 'viewOnly'),
  getOrderById
);

router.patch(
  '/orders/:id/status',
  requireStorePermission(['billing', 'onlineOrders', 'offlineSales'], 'modify'),
  updateOrderStatus
);

router.delete(
  '/orders/:id',
  requireStorePermission(['billing', 'offlineSales', 'onlineOrders'], 'delete'),
  deleteStoreOrder
);

export default router;
