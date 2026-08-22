import { Router } from 'express';

import {
  createAttribute,
  getAllAttributes,
  getAttributeById,
  updateAttribute,
  deleteAttribute,
  updateAttributeStatus,
} from '../../../controllers/admin/product-management/attribute.controller.js';

import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';

import {
  createAttributeSchema,
  updateAttributeSchema,
  updateAttributeStatusSchema,
} from '../../../validations/product-management/attribute.validation.js';

const router = Router();

router.use(adminAuth);

// Create + Get All
router
  .route('/')
  .post(
    validate(createAttributeSchema),
    createAttribute
  )
  .get(getAllAttributes);

// Get + Update + Delete
router
  .route('/:id')
  .get(getAttributeById)
  .put(
    validate(updateAttributeSchema),
    updateAttribute
  )
  .delete(deleteAttribute);

// Status
router.patch(
  '/:id/status',
  validate(updateAttributeStatusSchema),
  updateAttributeStatus
);

export default router;
