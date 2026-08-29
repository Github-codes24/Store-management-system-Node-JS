import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import env from '../../config/env.js';
import initS3 from '../../config/s3.js';
import { badRequest, notFound } from '../../utils/api-error.js';
import { successResponse } from '../../utils/api-response.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Upload single image (S3 or Local Disk Fallback)
 */
export const uploadImage = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0]);
    const { image, file: base64Data } = req.body;

    let buffer = null;
    let mimeType = 'image/png';
    let originalName = 'upload.png';
    let extension = '.png';

    if (file) {
      buffer = file.buffer;
      mimeType = file.mimetype;
      originalName = file.originalname;
      extension = path.extname(originalName) || `.${mimeType.split('/')[1] || 'png'}`;
    } else if (image || base64Data) {
      const rawData = image || base64Data;
      if (rawData.startsWith('data:')) {
        const matches = rawData.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
          extension = `.${mimeType.split('/')[1] || 'png'}`;
        }
      } else {
        buffer = Buffer.from(rawData, 'base64');
      }
    }

    if (!buffer) {
      return next(badRequest('No image file or valid image data provided'));
    }

    const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;

    const isS3Configured = Boolean(
      env.S3_BUCKET &&
      env.S3_BUCKET.trim() !== '' &&
      env.S3_ACCESS_KEY &&
      env.S3_ACCESS_KEY.trim() !== '' &&
      env.S3_SECRET_KEY &&
      env.S3_SECRET_KEY.trim() !== ''
    );

    if (isS3Configured) {
      console.log(`☁️ Uploading to AWS S3 Cloud Bucket: ${env.S3_BUCKET}`);
      const s3Client = initS3();
      const key = `uploads/${uniqueFilename}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        })
      );

      const publicUrl = env.S3_PUBLIC_URL
        ? `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

      return res.status(201).json(
        successResponse({
          message: 'Image uploaded successfully to S3 cloud storage',
          data: {
            url: publicUrl,
            key,
            filename: uniqueFilename,
            originalName,
            mimeType,
            size: buffer.length,
            storage: 's3',
          },
        })
      );
    } else {
      console.log('⚠️ S3 Credentials missing in .env.development! Saving to local storage.');
      // Save locally to ./uploads directory
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);
      await fs.promises.writeFile(filePath, buffer);

      const protocol = req.protocol || 'http';
      const host = req.get('host') || `localhost:${env.PORT}`;
      const localUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;

      return res.status(201).json(
        successResponse({
          message: 'Image uploaded successfully (Local mode: Fill S3 keys in .env.development for S3 cloud URL)',
          data: {
            url: localUrl,
            filename: uniqueFilename,
            path: `/uploads/${uniqueFilename}`,
            originalName,
            mimeType,
            size: buffer.length,
            storage: 'local',
          },
        })
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Upload multiple images
 */
export const uploadMultipleImages = async (req, res, next) => {
  try {
    const files = req.files;
    if (!files || !Array.isArray(files) || files.length === 0) {
      return next(badRequest('No image files provided'));
    }

    const isS3Configured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
    const uploadedResults = [];

    for (const file of files) {
      const extension = path.extname(file.originalname) || `.${file.mimetype.split('/')[1] || 'png'}`;
      const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;

      if (isS3Configured) {
        const s3Client = initS3();
        const key = `uploads/${uniqueFilename}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          })
        );

        const publicUrl = env.S3_PUBLIC_URL
          ? `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`
          : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;

        uploadedResults.push({
          url: publicUrl,
          key,
          filename: uniqueFilename,
          originalName: file.originalname,
          size: file.size,
          storage: 's3',
        });
      } else {
        const filePath = path.join(UPLOADS_DIR, uniqueFilename);
        await fs.promises.writeFile(filePath, file.buffer);

        const protocol = req.protocol || 'http';
        const host = req.get('host') || `localhost:${env.PORT}`;
        const localUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;

        uploadedResults.push({
          url: localUrl,
          filename: uniqueFilename,
          path: `/uploads/${uniqueFilename}`,
          originalName: file.originalname,
          size: file.size,
          storage: 'local',
        });
      }
    }

    return res.status(201).json(
      successResponse({
        message: `${uploadedResults.length} images uploaded successfully`,
        data: uploadedResults,
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Image (from S3 or Local Disk)
 */
export const deleteImage = async (req, res, next) => {
  try {
    const targetUrl =
      req.body.imageUrl ||
      req.body.fileUrl ||
      req.body.url ||
      req.body.key ||
      req.query.imageUrl ||
      req.query.url ||
      req.query.key;

    if (!targetUrl || typeof targetUrl !== 'string' || targetUrl.trim() === '') {
      return next(badRequest('Image URL or file key is required for deletion'));
    }

    const cleanUrl = targetUrl.trim();
    const isS3Configured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

    // 1. Check if S3 URL or S3 key
    if (cleanUrl.includes('amazonaws.com') || cleanUrl.startsWith('uploads/')) {
      if (!isS3Configured) {
        return next(badRequest('S3 storage is not configured to delete this S3 file'));
      }

      let s3Key = cleanUrl;
      if (cleanUrl.includes('.com/')) {
        s3Key = cleanUrl.split('.com/')[1];
      }

      const s3Client = initS3();
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: s3Key,
        })
      );

      return res.status(200).json(
        successResponse({
          message: 'Image deleted successfully from S3',
          data: { key: s3Key },
        })
      );
    }

    // 2. Local Disk File Deletion
    const filename = path.basename(cleanUrl);
    const localFilePath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(localFilePath)) {
      await fs.promises.unlink(localFilePath);
      return res.status(200).json(
        successResponse({
          message: 'Image deleted successfully from local storage',
          data: { filename },
        })
      );
    } else {
      return next(notFound(`File '${filename}' not found or already deleted`));
    }
  } catch (error) {
    next(error);
  }
};
