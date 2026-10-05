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
import requirePermission from '../../middlewares/permission.middleware.js';
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
router.get('/subadmins-dropdown', requirePermission('rolesAndPermissions', 'viewOnly'), getSubAdminsDropdown);
router.get('/modules-schema', requirePermission('rolesAndPermissions', 'viewOnly'), getModulesSchema);

// Base CRUD endpoints
router.get('/', requirePermission('rolesAndPermissions', 'viewOnly'), validate({ query: getRolesQuerySchema }), getRoles);
router.post('/', requirePermission('rolesAndPermissions', 'create'), validate(createRoleSchema), createRole);
router.get('/:id', requirePermission('rolesAndPermissions', 'viewOnly'), getRoleById);
router.put('/:id', requirePermission('rolesAndPermissions', 'modify'), validate(updateRoleSchema), updateRole);
router.delete('/:id', requirePermission('rolesAndPermissions', 'delete'), deleteRole);

export default router;

