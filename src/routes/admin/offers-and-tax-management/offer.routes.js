import { Router } from 'express';
import {
  createOffer,
  getOffers,
  getOfferById,
  updateOffer,
  toggleOfferStatus,
  deleteOffer,
  getOfferFormOptions,
  exportOffers,
} from '../../../controllers/admin/offers-and-tax-management/offer.controller.js';
import adminAuth from '../../../middlewares/admin.auth.middleware.js';
import requirePermission from '../../../middlewares/permission.middleware.js';
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createOfferSchema,
  updateOfferSchema,
  toggleOfferStatusSchema,
} from '../../../validations/offers-and-tax-management/offer.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/options', requirePermission('offersManagement', 'viewOnly'), getOfferFormOptions);
router.get('/export', requirePermission('offersManagement', 'viewOnly'), exportOffers);

router
  .route('/')
  .post(requirePermission('offersManagement', 'create'), parseForm, validate(createOfferSchema), createOffer)
  .get(requirePermission('offersManagement', 'viewOnly'), getOffers);

router
  .route('/:id')
  .get(requirePermission('offersManagement', 'viewOnly'), getOfferById)
  .put(requirePermission('offersManagement', 'modify'), parseForm, validate(updateOfferSchema), updateOffer)
  .delete(requirePermission('offersManagement', 'delete'), deleteOffer);

router.patch('/:id/status', requirePermission('offersManagement', 'modifyStatus'), parseForm, validate(toggleOfferStatusSchema), toggleOfferStatus);

export default router;

