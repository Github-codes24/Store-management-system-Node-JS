import { Router } from 'express';
import {
  createRetailer,
  deleteRetailer,
  getRetailerById,
  getRetailers,
  getRetailersDropdown,
  updateRetailer,
} from '../../controllers/admin/retailer.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createRetailerSchema,
  getRetailersQuerySchema,
  updateRetailerSchema,
} from '../../validations/retailer.validation.js';

const router = Router();

// Require admin authentication
router.use(adminAuth);

router.post('/', validate(createRetailerSchema), createRetailer);
router.get('/', validate(getRetailersQuerySchema), getRetailers);
router.get('/dropdown', getRetailersDropdown);
router.get('/:id', getRetailerById);
router.put('/:id', validate(updateRetailerSchema), updateRetailer);
router.delete('/:id', deleteRetailer);

export default router;
