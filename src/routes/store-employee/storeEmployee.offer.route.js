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
  getStoreBillingApplicableOffers,
  getStoreOfferPerformanceReport,
} from '../../controllers/store-employee/storeEmployee.offer.controller.js';
import storeEmployeeAuth from '../../middlewares/storeEmployee.auth.middleware.js';
import requireStorePermission from '../../middlewares/storePermission.middleware.js';
import parseForm from '../../middlewares/parseForm.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import {
  createOfferSchema,
  updateOfferSchema,
  toggleOfferStatusSchema,
} from '../../validations/offers-and-tax-management/offer.validation.js';

const router = Router();

router.use(storeEmployeeAuth);

// Applicable offers for POS Billing dropdown
router.get('/active', getStoreBillingApplicableOffers);
router.get('/applicable-offers', getStoreBillingApplicableOffers);

// Offers Management Module endpoints
router.get('/options', requireStorePermission('offers', 'viewOnly'), getStoreOfferFormOptions);
router.get('/export', requireStorePermission('offers', 'viewOnly'), exportStoreOffers);

// Offer Performance / Analytics Report endpoints
router.get('/:id/performance', requireStorePermission('offers', 'viewOnly'), getStoreOfferPerformanceReport);
router.get('/:id/report', requireStorePermission('offers', 'viewOnly'), getStoreOfferPerformanceReport);
router.get('/:id/analytics', requireStorePermission('offers', 'viewOnly'), getStoreOfferPerformanceReport);

router
  .route('/')
  .post(requireStorePermission('offers', 'create'), parseForm, validate(createOfferSchema), createStoreOffer)
  .get(requireStorePermission('offers', 'viewOnly'), getStoreOffers);

router
  .route('/:id')
  .get(requireStorePermission('offers', 'viewOnly'), getStoreOfferById)
  .put(requireStorePermission('offers', 'modify'), parseForm, validate(updateOfferSchema), updateStoreOffer)
  .delete(requireStorePermission('offers', 'delete'), deleteStoreOffer);

router.patch('/:id/status', requireStorePermission('offers', 'modify'), parseForm, validate(toggleOfferStatusSchema), toggleStoreOfferStatus);

export default router;
