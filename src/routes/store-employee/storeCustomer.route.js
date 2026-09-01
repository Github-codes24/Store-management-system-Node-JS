import { Router } from 'express';
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  payDueAmount,
  exportCustomers,
} from '../../controllers/store-employee/storeCustomer.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import parseForm from '../../middlewares/parseForm.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createStoreCustomerSchema,
  updateStoreCustomerSchema,
  payDueAmountSchema,
  getStoreCustomersQuerySchema,
} from '../../validations/store-employee/storeCustomer.validation.js';

const router = Router();

// Authenticate all store employee customer routes
router.use(storeEmployeeAuth);

// Export customer list for the logged-in store
router.get('/export', exportCustomers);

// Base customers endpoint (/api/store-employee/customers)
router
  .route('/')
  .post(parseForm, validate(createStoreCustomerSchema), createCustomer)
  .get(validate(getStoreCustomersQuerySchema), getCustomers);

// Pay due amount endpoint (/api/store-employee/customers/:id/pay-due)
router.post('/:id/pay-due', parseForm, validate(payDueAmountSchema), payDueAmount);

// Single customer operations (/api/store-employee/customers/:id)
router
  .route('/:id')
  .get(getCustomerById)
  .put(parseForm, validate(updateStoreCustomerSchema), updateCustomer)
  .delete(deleteCustomer);

export default router;
