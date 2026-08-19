import dotenv from 'dotenv';
import path from 'path';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env variable: ${key}`);
  }
  return value;
};

const isDev = process.env.NODE_ENV !== 'production';

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,

  // DB
  MONGO_URI: required('MONGO_URI', 'mongodb://localhost:27017/store_management_db'),

  // Auth Secrets
  ADMIN_JWT_SECRET: required('ADMIN_JWT_SECRET', isDev ? 'dev-secret-key-change-in-prod' : null),
  ADMIN_JWT_EXPIRES_IN: process.env.ADMIN_JWT_EXPIRES_IN || '7d',

  STORE_EMPLOYEE_JWT_SECRET: required('STORE_EMPLOYEE_JWT_SECRET', isDev ? 'store-employee-dev-secret-key-change-in-prod' : null),
  STORE_EMPLOYEE_JWT_EXPIRES_IN: process.env.STORE_EMPLOYEE_JWT_EXPIRES_IN || '7d',

  // CORS
  ALLOWED_ORIGINS: process.env?.ALLOWED_ORIGINS,

  // Frontend URL
  FRONTEND_URL: process.env?.FRONTEND_URL,

  // S3 Storage
  S3_REGION: process.env.S3_REGION || 'ap-south-1',
  S3_ENDPOINT: process.env.S3_ENDPOINT || '',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL || '',

  // Crypto
  CRYPTO_KEY: process.env.CRYPTO_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',

  // MSG91 Mailer Configuration
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || 'dev-auth-key',
  MSG91_DOMAIN: process.env.MSG91_DOMAIN || 'storemanagement.com',
  MSG91_SENDER_NAME: process.env.MSG91_SENDER_NAME || 'Store Management',
  MSG91_FROM_EMAIL: process.env.MSG91_FROM_EMAIL || 'no-reply@storemanagement.com',
};

export default env;
