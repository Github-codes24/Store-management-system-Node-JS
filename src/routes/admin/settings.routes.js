import { Router } from 'express';
import { getSettings, updateSettings } from '../../controllers/admin/settings.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import parseForm from '../../middlewares/parseForm.middleware.js';
import validate from '../../middlewares/validate.middleware.js';
import { updateSettingsSchema } from '../../validations/settings.validation.js';

const router = Router();

router.use(adminAuth);

router
  .route('/')
  .get(getSettings)
  .put(parseForm, validate(updateSettingsSchema), updateSettings);

export default router;
