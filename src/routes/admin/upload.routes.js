import { Router } from 'express';
import {
  deleteImage,
  uploadImage,
  uploadMultipleImages,
} from '../../controllers/admin/upload.controller.js';
import adminAuth from '../../middlewares/admin.auth.middleware.js';
import upload from '../../config/storage.js';

const router = Router();

// Apply admin authentication to all upload routes
router.use(adminAuth);

// Helper to bridge single file reference
const setSingleFile = (req, _res, next) => {
  if (req.files && req.files.length > 0) {
    req.file = req.files[0];
  }
  next();
};

// Single Image Upload (supports any field name: 'file', 'image', 'photo', etc.)
router.post('/', upload.any(), setSingleFile, uploadImage);
router.post('/image', upload.any(), setSingleFile, uploadImage);

// Multiple Images Upload (supports any field name: 'files', 'images', etc.)
router.post('/multiple', upload.any(), uploadMultipleImages);

// Delete Image
router.delete('/', deleteImage);
router.delete('/image', deleteImage);

export default router;
