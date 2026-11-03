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
import requireStorePermission from '../../middlewares/storePermission.middleware.js';
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
router.get('/export', requireStorePermission('customers', 'viewOnly'), exportCustomers);

// Base customers endpoint (/api/store-employee/customers)
router
  .route('/')
  .post(requireStorePermission('customers', 'create'), parseForm, validate(createStoreCustomerSchema), createCustomer)
  .get(requireStorePermission('customers', 'viewOnly'), validate(getStoreCustomersQuerySchema), getCustomers);

// Pay due amount endpoint (/api/store-employee/customers/:id/pay-due)
router.post('/:id/pay-due', requireStorePermission('customers', 'modify'), parseForm, validate(payDueAmountSchema), payDueAmount);

// Single customer operations (/api/store-employee/customers/:id)
router
  .route('/:id')
  .get(requireStorePermission('customers', 'viewOnly'), getCustomerById)
  .put(requireStorePermission('customers', 'modify'), parseForm, validate(updateStoreCustomerSchema), updateCustomer)
  .delete(requireStorePermission('customers', 'delete'), deleteCustomer);

// Support POST alias for delete if triggered via form/POST
router.post('/:id/delete', requireStorePermission('customers', 'delete'), deleteCustomer);

export default router;
