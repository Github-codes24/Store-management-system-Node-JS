import { S3Client } from '@aws-sdk/client-s3';
import env from './env.js';

let s3;

const initS3 = () => {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });

    console.log('✅ S3 Client initialized');
  }

  return s3;
};

export default initS3;
