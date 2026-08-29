import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import env from '../config/env.js';
import initS3 from '../config/s3.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Uploads a Multer file object to cloud (S3) or local storage and returns the public URL string.
 * NEVER stores or returns base64 data strings.
 *
 * @param {Object} file - Express Multer file object
 * @param {string} [fallbackUrl] - Existing URL string fallback
 * @param {Object} [req] - Express request object
 * @returns {Promise<string|null>} Public image URL string or null
 */
export const processUploadedFile = async (file, fallbackUrl = null, req = null) => {
  if (file && file.buffer) {
    const extension = path.extname(file.originalname) || `.${file.mimetype.split('/')[1] || 'png'}`;
    const uniqueFilename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${extension}`;

    const isS3Configured = Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

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

      return env.S3_PUBLIC_URL
        ? `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`
        : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
    } else {
      const filePath = path.join(UPLOADS_DIR, uniqueFilename);
      await fs.promises.writeFile(filePath, file.buffer);

      const protocol = req?.protocol || 'http';
      const host = req?.get ? req.get('host') : `localhost:${env.PORT || 4000}`;
      return `${protocol}://${host}/uploads/${uniqueFilename}`;
    }
  }

  if (typeof fallbackUrl === 'string' && fallbackUrl.trim().length > 0 && !fallbackUrl.startsWith('data:')) {
    return fallbackUrl.trim();
  }

  return null;
};
