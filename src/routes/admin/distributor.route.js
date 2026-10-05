import { Router } from 'express';
import {
  createDistributor,
  deleteDistributor,
  getDistributorById,
  getDistributors,
  getDistributorDropdown,
  updateDistributor,
} from '../../controllers/admin/distributor.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../middlewares/permission.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createDistributorSchema,
  getDistributorsQuerySchema,
  updateDistributorSchema,
} from '../../validations/distributor.validation.js';

const router = Router();

// Apply admin authentication to all distributor routes
router.use(adminAuth);

router.get('/dropdown', requirePermission('distributor', 'viewOnly'), getDistributorDropdown);
router.post('/', requirePermission('distributor', 'create'), validate(createDistributorSchema), createDistributor);
router.get('/', requirePermission('distributor', 'viewOnly'), validate(getDistributorsQuerySchema), getDistributors);
router.get('/:id', requirePermission('distributor', 'viewOnly'), getDistributorById);
router.put('/:id', requirePermission('distributor', 'modify'), validate(updateDistributorSchema), updateDistributor);
router.delete('/:id', requirePermission('distributor', 'delete'), deleteDistributor);

export default router;


