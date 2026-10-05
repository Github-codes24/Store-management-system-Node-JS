import { Router } from 'express';
import {
  createStore,
  deleteStore,
  getStoreById,
  getStores,
  updateStore,
  getStoresDropdown,
} from '../../controllers/admin/store.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../middlewares/permission.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createStoreSchema,
  getStoresQuerySchema,
  updateStoreSchema,
} from '../../validations/store.validation.js';

const router = Router();

// Apply admin authentication to all store routes
router.use(adminAuth);

router.post('/', requirePermission('stores', 'create'), validate(createStoreSchema), createStore);
router.get('/', requirePermission('stores', 'viewOnly'), validate(getStoresQuerySchema), getStores);
router.get('/dropdown', requirePermission('stores', 'viewOnly'), getStoresDropdown);
router.get('/:id', requirePermission('stores', 'viewOnly'), getStoreById);
router.put('/:id', requirePermission('stores', 'modify'), validate(updateStoreSchema), updateStore);
router.delete('/:id', requirePermission('stores', 'delete'), deleteStore);

export default router;

