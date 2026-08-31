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
import parseForm from '../../../middlewares/parseForm.middleware.js';
import validate from '../../../middlewares/validate.middleware.js';
import {
  createOfferSchema,
  updateOfferSchema,
  toggleOfferStatusSchema,
} from '../../../validations/offers-and-tax-management/offer.validation.js';

const router = Router();

router.use(adminAuth);

router.get('/options', getOfferFormOptions);
router.get('/export', exportOffers);

router
  .route('/')
  .post(parseForm, validate(createOfferSchema), createOffer)
  .get(getOffers);

router
  .route('/:id')
  .get(getOfferById)
  .put(parseForm, validate(updateOfferSchema), updateOffer)
  .delete(deleteOffer);

router.patch('/:id/status', parseForm, validate(toggleOfferStatusSchema), toggleOfferStatus);

export default router;
