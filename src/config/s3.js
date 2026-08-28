import { S3Client } from '@aws-sdk/client-s3';
import env from './env.js';

const initS3 = () => {
  const s3Config = {
    region: env.S3_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  };

  if (env.S3_ENDPOINT && env.S3_ENDPOINT.trim() !== '') {
    s3Config.endpoint = env.S3_ENDPOINT.trim();
    s3Config.forcePathStyle = true;
  }

  return new S3Client(s3Config);
};

export default initS3;
