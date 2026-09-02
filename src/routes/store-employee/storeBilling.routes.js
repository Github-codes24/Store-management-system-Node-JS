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
} from '../../controllers/store-employee/storeBilling.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';

const router = Router();

// Apply store employee auth middleware
router.use(storeEmployeeAuth);

// Billing endpoints
router.post('/bills', createOrAppendOrderBill);
router.get('/orders', getStoreOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
router.delete('/orders/:id', deleteStoreOrder);
router.get('/customers', getStoreCustomers);
router.post('/customers', createStoreCustomer);

// Returns endpoints
router.get('/lookup-bill/:identifier', lookupBillForReturn);
router.post('/returns', processBillReturn);

export default router;
