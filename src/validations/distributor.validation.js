import { z } from 'zod';
import { DISTRIBUTOR_VALIDATION } from '../constants/distributor.constants.js';

export const createDistributorSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Distributor name is required' })
      .trim()
      .min(DISTRIBUTOR_VALIDATION.NAME.MIN, `Name must be at least ${DISTRIBUTOR_VALIDATION.NAME.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.NAME.MAX, `Name cannot exceed ${DISTRIBUTOR_VALIDATION.NAME.MAX} characters`),

    salesperson: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.SALESPERSON.MIN, `Salesperson name must be at least ${DISTRIBUTOR_VALIDATION.SALESPERSON.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.SALESPERSON.MAX, `Salesperson name cannot exceed ${DISTRIBUTOR_VALIDATION.SALESPERSON.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    mobile: z
      .string({ required_error: 'Mobile number is required' })
      .trim()
      .min(DISTRIBUTOR_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${DISTRIBUTOR_VALIDATION.MOBILE.MIN} digits`)
      .max(DISTRIBUTOR_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${DISTRIBUTOR_VALIDATION.MOBILE.MAX} digits`)
      .regex(DISTRIBUTOR_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'),

    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .min(DISTRIBUTOR_VALIDATION.EMAIL.MIN, `Email must be at least ${DISTRIBUTOR_VALIDATION.EMAIL.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.EMAIL.MAX, `Email cannot exceed ${DISTRIBUTOR_VALIDATION.EMAIL.MAX} characters`)
      .regex(DISTRIBUTOR_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),

    gstin: z
      .string()
      .trim()
      .transform((val) => val?.toUpperCase())
      .pipe(
        z
          .string()
          .min(DISTRIBUTOR_VALIDATION.GSTIN.MIN, `GSTIN must be ${DISTRIBUTOR_VALIDATION.GSTIN.MIN} characters`)
          .max(DISTRIBUTOR_VALIDATION.GSTIN.MAX, `GSTIN must be ${DISTRIBUTOR_VALIDATION.GSTIN.MAX} characters`)
          .regex(DISTRIBUTOR_VALIDATION.GSTIN.PATTERN, 'Invalid GSTIN format')
          .optional()
          .nullable()
          .or(z.literal(''))
      )
      .optional()
      .nullable()
      .or(z.literal('')),

    address: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.ADDRESS.MIN, `Address must be at least ${DISTRIBUTOR_VALIDATION.ADDRESS.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.ADDRESS.MAX, `Address cannot exceed ${DISTRIBUTOR_VALIDATION.ADDRESS.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    status: z
      .enum(DISTRIBUTOR_VALIDATION.STATUS.ENUM, {
        errorMap: () => ({ message: `Status must be one of: ${DISTRIBUTOR_VALIDATION.STATUS.ENUM.join(', ')}` }),
      })
      .optional(),
  }),
};

export const updateDistributorSchema = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.NAME.MIN, `Name must be at least ${DISTRIBUTOR_VALIDATION.NAME.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.NAME.MAX, `Name cannot exceed ${DISTRIBUTOR_VALIDATION.NAME.MAX} characters`)
      .optional(),

    salesperson: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.SALESPERSON.MIN, `Salesperson name must be at least ${DISTRIBUTOR_VALIDATION.SALESPERSON.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.SALESPERSON.MAX, `Salesperson name cannot exceed ${DISTRIBUTOR_VALIDATION.SALESPERSON.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    mobile: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${DISTRIBUTOR_VALIDATION.MOBILE.MIN} digits`)
      .max(DISTRIBUTOR_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${DISTRIBUTOR_VALIDATION.MOBILE.MAX} digits`)
      .regex(DISTRIBUTOR_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format')
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(DISTRIBUTOR_VALIDATION.EMAIL.MIN, `Email must be at least ${DISTRIBUTOR_VALIDATION.EMAIL.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.EMAIL.MAX, `Email cannot exceed ${DISTRIBUTOR_VALIDATION.EMAIL.MAX} characters`)
      .regex(DISTRIBUTOR_VALIDATION.EMAIL.PATTERN, 'Invalid email address format')
      .optional(),

    gstin: z
      .string()
      .trim()
      .transform((val) => val?.toUpperCase())
      .pipe(
        z
          .string()
          .min(DISTRIBUTOR_VALIDATION.GSTIN.MIN, `GSTIN must be ${DISTRIBUTOR_VALIDATION.GSTIN.MIN} characters`)
          .max(DISTRIBUTOR_VALIDATION.GSTIN.MAX, `GSTIN must be ${DISTRIBUTOR_VALIDATION.GSTIN.MAX} characters`)
          .regex(DISTRIBUTOR_VALIDATION.GSTIN.PATTERN, 'Invalid GSTIN format')
          .optional()
          .nullable()
          .or(z.literal(''))
      )
      .optional()
      .nullable()
      .or(z.literal('')),

    address: z
      .string()
      .trim()
      .min(DISTRIBUTOR_VALIDATION.ADDRESS.MIN, `Address must be at least ${DISTRIBUTOR_VALIDATION.ADDRESS.MIN} characters`)
      .max(DISTRIBUTOR_VALIDATION.ADDRESS.MAX, `Address cannot exceed ${DISTRIBUTOR_VALIDATION.ADDRESS.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    status: z
      .enum(DISTRIBUTOR_VALIDATION.STATUS.ENUM, {
        errorMap: () => ({ message: `Status must be one of: ${DISTRIBUTOR_VALIDATION.STATUS.ENUM.join(', ')}` }),
      })
      .optional(),
  }),
};

export const getDistributorsQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    status: z.string().optional(),
  }),
};
