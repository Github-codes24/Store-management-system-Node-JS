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
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
} from '../../../validations/user-management/customer.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/export', exportCustomers);

router
  .route('/')
  .post(parseForm, validate(createCustomerSchema), createCustomer)
  .get(getCustomers);

router
  .route('/:id')
  .get(getCustomerById)
  .put(parseForm, validate(updateCustomerSchema), updateCustomer)
  .delete(deleteCustomer);

export default router;
