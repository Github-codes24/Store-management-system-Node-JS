import { Router } from 'express';
import {
  createStoreEmployee,
  deleteStoreEmployee,
  getStoreEmployeeById,
  getStoreEmployees,
  updateStoreEmployee,
  getDesignationsDropdown,
  getStoresDropdownForEmployees,
} from '../../controllers/admin/storeEmployee.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createStoreEmployeeSchema,
  getStoreEmployeesQuerySchema,
  updateStoreEmployeeSchema,
} from '../../validations/storeEmployee.validation.js';

const router = Router();

// Protect all admin store employee routes with admin authentication
router.use(adminAuth);

router.post('/', validate(createStoreEmployeeSchema), createStoreEmployee);
router.get('/', validate(getStoreEmployeesQuerySchema), getStoreEmployees);
router.get('/designations', getDesignationsDropdown);
router.get('/stores', getStoresDropdownForEmployees);
router.get('/:id', getStoreEmployeeById);
router.put('/:id', validate(updateStoreEmployeeSchema), updateStoreEmployee);
router.delete('/:id', deleteStoreEmployee);

export default router;
