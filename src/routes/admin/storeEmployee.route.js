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
import requirePermission from '../../middlewares/permission.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createStoreEmployeeSchema,
  getStoreEmployeesQuerySchema,
  updateStoreEmployeeSchema,
} from '../../validations/storeEmployee.validation.js';

const router = Router();

// Protect all admin store employee routes with admin authentication
router.use(adminAuth);

router.post('/', requirePermission('storeEmployee', 'create'), validate(createStoreEmployeeSchema), createStoreEmployee);
router.get('/', requirePermission('storeEmployee', 'viewOnly'), validate(getStoreEmployeesQuerySchema), getStoreEmployees);
router.get('/designations', requirePermission('storeEmployee', 'viewOnly'), getDesignationsDropdown);
router.get('/stores', requirePermission('storeEmployee', 'viewOnly'), getStoresDropdownForEmployees);
router.get('/:id', requirePermission('storeEmployee', 'viewOnly'), getStoreEmployeeById);
router.put('/:id', requirePermission('storeEmployee', 'modify'), validate(updateStoreEmployeeSchema), updateStoreEmployee);
router.delete('/:id', requirePermission('storeEmployee', 'delete'), deleteStoreEmployee);

export default router;

