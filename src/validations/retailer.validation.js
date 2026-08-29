import { z } from 'zod';
import { RETAILER_VALIDATION } from '../constants/retailer.constants.js';

export const createRetailerSchema = {
  body: z.object({
    retailerCode: z
      .string()
      .trim()
      .transform((val) => val?.toUpperCase())
      .optional()
      .nullable()
      .or(z.literal('')),

    name: z
      .string({ required_error: 'Retailer name is required' })
      .trim()
      .min(RETAILER_VALIDATION.NAME.MIN, `Retailer name must be at least ${RETAILER_VALIDATION.NAME.MIN} characters`)
      .max(RETAILER_VALIDATION.NAME.MAX, `Retailer name cannot exceed ${RETAILER_VALIDATION.NAME.MAX} characters`),

    mobile: z
      .string({ required_error: 'Mobile number is required' })
      .trim()
      .min(RETAILER_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${RETAILER_VALIDATION.MOBILE.MIN} digits`)
      .max(RETAILER_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${RETAILER_VALIDATION.MOBILE.MAX} digits`)
      .regex(RETAILER_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(RETAILER_VALIDATION.EMAIL.MIN, `Email must be at least ${RETAILER_VALIDATION.EMAIL.MIN} characters`)
      .max(RETAILER_VALIDATION.EMAIL.MAX, `Email cannot exceed ${RETAILER_VALIDATION.EMAIL.MAX} characters`)
      .regex(RETAILER_VALIDATION.EMAIL.PATTERN, 'Invalid email address format')
      .optional()
      .nullable()
      .or(z.literal('')),

    location: z
      .string()
      .trim()
      .min(RETAILER_VALIDATION.LOCATION.MIN, `Location must be at least ${RETAILER_VALIDATION.LOCATION.MIN} characters`)
      .max(RETAILER_VALIDATION.LOCATION.MAX, `Location cannot exceed ${RETAILER_VALIDATION.LOCATION.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),
  }),
};

export const updateRetailerSchema = {
  body: z.object({
    retailerCode: z
      .string()
      .trim()
      .transform((val) => val?.toUpperCase())
      .optional(),

    name: z
      .string()
      .trim()
      .min(RETAILER_VALIDATION.NAME.MIN, `Retailer name must be at least ${RETAILER_VALIDATION.NAME.MIN} characters`)
      .max(RETAILER_VALIDATION.NAME.MAX, `Retailer name cannot exceed ${RETAILER_VALIDATION.NAME.MAX} characters`)
      .optional(),

    mobile: z
      .string()
      .trim()
      .min(RETAILER_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${RETAILER_VALIDATION.MOBILE.MIN} digits`)
      .max(RETAILER_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${RETAILER_VALIDATION.MOBILE.MAX} digits`)
      .regex(RETAILER_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format')
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(RETAILER_VALIDATION.EMAIL.MIN, `Email must be at least ${RETAILER_VALIDATION.EMAIL.MIN} characters`)
      .max(RETAILER_VALIDATION.EMAIL.MAX, `Email cannot exceed ${RETAILER_VALIDATION.EMAIL.MAX} characters`)
      .regex(RETAILER_VALIDATION.EMAIL.PATTERN, 'Invalid email address format')
      .optional()
      .nullable()
      .or(z.literal('')),

    location: z
      .string()
      .trim()
      .min(RETAILER_VALIDATION.LOCATION.MIN, `Location must be at least ${RETAILER_VALIDATION.LOCATION.MIN} characters`)
      .max(RETAILER_VALIDATION.LOCATION.MAX, `Location cannot exceed ${RETAILER_VALIDATION.LOCATION.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),
  }),
};

export const getRetailersQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
  }),
};
