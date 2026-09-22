import { Router } from 'express';
import {
  getCustomerSupportInfo,
  getCustomerCmsPage,
} from '../../controllers/customer/customerCms.controller.js';

const router = Router();

// Public / Customer CMS Endpoints
router.get('/support', getCustomerSupportInfo);
router.get('/help-support', getCustomerSupportInfo);

router.get('/terms-and-conditions', (req, res, next) => {
  req.params.slug = 'terms-and-conditions';
  return getCustomerCmsPage(req, res, next);
});
router.get('/privacy-policy', (req, res, next) => {
  req.params.slug = 'privacy-policy';
  return getCustomerCmsPage(req, res, next);
});

router.get('/:slug', getCustomerCmsPage);

export default router;
