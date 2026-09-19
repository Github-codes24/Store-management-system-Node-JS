import { Router } from 'express';
import { getCmsPage, updateCmsPage } from '../../controllers/admin/adminCms.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';

const router = Router();

router.use(adminAuth);

// Direct Aliases for Terms & Conditions and Privacy Policy
router.get('/terms-and-conditions', (req, res, next) => {
  req.params.slug = 'terms-and-conditions';
  return getCmsPage(req, res, next);
});
router.put('/terms-and-conditions', (req, res, next) => {
  req.params.slug = 'terms-and-conditions';
  return updateCmsPage(req, res, next);
});

router.get('/privacy-policy', (req, res, next) => {
  req.params.slug = 'privacy-policy';
  return getCmsPage(req, res, next);
});
router.put('/privacy-policy', (req, res, next) => {
  req.params.slug = 'privacy-policy';
  return updateCmsPage(req, res, next);
});

// Generic Slug Routes
router.get('/:slug', getCmsPage);
router.put('/:slug', updateCmsPage);

export default router;
