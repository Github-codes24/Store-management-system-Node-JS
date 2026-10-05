import { Router } from 'express';
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  exportCustomers,
} from '../../../controllers/admin/user-management/customer.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '../../../validations/user-management/customer.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/export', requirePermission('customers', 'viewOnly'), exportCustomers);

router
  .route('/')
  .post(requirePermission('customers', 'create'), parseForm, validate(createCustomerSchema), createCustomer)
  .get(requirePermission('customers', 'viewOnly'), getCustomers);

router
  .route('/:id')
  .get(requirePermission('customers', 'viewOnly'), getCustomerById)
  .put(requirePermission('customers', 'modify'), parseForm, validate(updateCustomerSchema), updateCustomer)
  .delete(requirePermission('customers', 'delete'), deleteCustomer);

export default router;

