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
import requirePermission from '../../../middlewares/permission.middleware.js';
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
    requirePermission('attributes', 'create'),
    validate(createAttributeSchema),
    createAttribute
  )
  .get(requirePermission('attributes', 'viewOnly'), getAllAttributes);

// Get + Update + Delete
router
  .route('/:id')
  .get(requirePermission('attributes', 'viewOnly'), getAttributeById)
  .put(
    requirePermission('attributes', 'modify'),
    validate(updateAttributeSchema),
    updateAttribute
  )
  .delete(requirePermission('attributes', 'delete'), deleteAttribute);

// Status
router.patch(
  '/:id/status',
  requirePermission('attributes', 'modifyStatus'),
  validate(updateAttributeStatusSchema),
  updateAttributeStatus
);

export default router;

