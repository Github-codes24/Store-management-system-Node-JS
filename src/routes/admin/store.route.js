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
import validate from '../../middlewares/validate.middleware.js';
import {
  createStoreSchema,
  getStoresQuerySchema,
  updateStoreSchema,
} from '../../validations/store.validation.js';

const router = Router();

// Apply admin authentication to all store routes
router.use(adminAuth);

router.post('/', validate(createStoreSchema), createStore);
router.get('/', validate(getStoresQuerySchema), getStores);
router.get('/dropdown', getStoresDropdown);
router.get('/:id', getStoreById);
router.put('/:id', validate(updateStoreSchema), updateStore);
router.delete('/:id', deleteStore);

export default router;
