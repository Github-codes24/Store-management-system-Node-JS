import { Router } from 'express';
import {
  createStoreOffer,
  getStoreOffers,
  getStoreOfferById,
  updateStoreOffer,
  toggleStoreOfferStatus,
  deleteStoreOffer,
  getStoreOfferFormOptions,
  exportStoreOffers,
} from '../../controllers/store-employee/storeEmployee.offer.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import parseForm from '../../middlewares/parseForm.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createOfferSchema,
  updateOfferSchema,
  toggleOfferStatusSchema,
} from '../../validations/offers-and-tax-management/offer.validation.js';

const router = Router();

router.use(storeEmployeeAuth);

router.get('/options', getStoreOfferFormOptions);
router.get('/export', exportStoreOffers);

router
  .route('/')
  .post(parseForm, validate(createOfferSchema), createStoreOffer)
  .get(getStoreOffers);

router
  .route('/:id')
  .get(getStoreOfferById)
  .put(parseForm, validate(updateOfferSchema), updateStoreOffer)
  .delete(deleteStoreOffer);

router.patch('/:id/status', parseForm, validate(toggleOfferStatusSchema), toggleStoreOfferStatus);

export default router;
