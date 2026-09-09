import { Router } from 'express';
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getSubAdminsDropdown,
  getModulesSchema,
} from '../../controllers/admin/role.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createRoleSchema,
  updateRoleSchema,
  getRolesQuerySchema,
} from '../../validations/role.validation.js';

const router = Router();

// Require admin authentication
router.use(adminAuth);

// Dropdown & Helper metadata endpoints (placed before parametrized /:id)
router.get('/subadmins-dropdown', getSubAdminsDropdown);
router.get('/modules-schema', getModulesSchema);

// Base CRUD endpoints
router.get('/', validate({ query: getRolesQuerySchema }), getRoles);
router.post('/', validate(createRoleSchema), createRole);
router.get('/:id', getRoleById);
router.put('/:id', validate(updateRoleSchema), updateRole);
router.delete('/:id', deleteRole);

export default router;
