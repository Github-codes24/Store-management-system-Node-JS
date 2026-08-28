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
import validate from '../../middlewares/validate.middleware.js';
import {
  createDistributorSchema,
  getDistributorsQuerySchema,
  updateDistributorSchema,
} from '../../validations/distributor.validation.js';

const router = Router();

// Apply admin authentication to all distributor routes
router.use(adminAuth);

router.get('/dropdown', getDistributorDropdown);
router.post('/', validate(createDistributorSchema), createDistributor);
router.get('/', validate(getDistributorsQuerySchema), getDistributors);
router.get('/:id', getDistributorById);
router.put('/:id', validate(updateDistributorSchema), updateDistributor);
router.delete('/:id', deleteDistributor);

export default router;

