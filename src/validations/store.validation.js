import { z } from 'zod';
import { STORE_VALIDATION } from '../constants/store.constants.js';

export const createStoreSchema = {
  body: z.object({
    storeCode: z
      .string({ required_error: 'Store code is required' })
      .trim()
      .transform((val) => val.toUpperCase())
      .pipe(
        z
          .string()
          .min(STORE_VALIDATION.STORE_CODE.MIN, `Store code must be at least ${STORE_VALIDATION.STORE_CODE.MIN} characters`)
          .max(STORE_VALIDATION.STORE_CODE.MAX, `Store code cannot exceed ${STORE_VALIDATION.STORE_CODE.MAX} characters`)
          .regex(STORE_VALIDATION.STORE_CODE.PATTERN, 'Invalid store code format')
      ),

    name: z
      .string({ required_error: 'Store name is required' })
      .trim()
      .min(STORE_VALIDATION.NAME.MIN, `Store name must be at least ${STORE_VALIDATION.NAME.MIN} characters`)
      .max(STORE_VALIDATION.NAME.MAX, `Store name cannot exceed ${STORE_VALIDATION.NAME.MAX} characters`),

    mobile: z
      .string({ required_error: 'Mobile number is required' })
      .trim()
      .min(STORE_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${STORE_VALIDATION.MOBILE.MIN} digits`)
      .max(STORE_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${STORE_VALIDATION.MOBILE.MAX} digits`)
      .regex(STORE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'),

    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .min(STORE_VALIDATION.EMAIL.MIN, `Email must be at least ${STORE_VALIDATION.EMAIL.MIN} characters`)
      .max(STORE_VALIDATION.EMAIL.MAX, `Email cannot exceed ${STORE_VALIDATION.EMAIL.MAX} characters`)
      .regex(STORE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),

    location: z
      .string()
      .trim()
      .min(STORE_VALIDATION.LOCATION.MIN, `Store location must be at least ${STORE_VALIDATION.LOCATION.MIN} characters`)
      .max(STORE_VALIDATION.LOCATION.MAX, `Store location cannot exceed ${STORE_VALIDATION.LOCATION.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),
  }),
};

export const updateStoreSchema = {
  body: z.object({
    storeCode: z
      .string()
      .trim()
      .transform((val) => val?.toUpperCase())
      .pipe(
        z
          .string()
          .min(STORE_VALIDATION.STORE_CODE.MIN, `Store code must be at least ${STORE_VALIDATION.STORE_CODE.MIN} characters`)
          .max(STORE_VALIDATION.STORE_CODE.MAX, `Store code cannot exceed ${STORE_VALIDATION.STORE_CODE.MAX} characters`)
          .regex(STORE_VALIDATION.STORE_CODE.PATTERN, 'Invalid store code format')
          .optional()
      )
      .optional(),

    name: z
      .string()
      .trim()
      .min(STORE_VALIDATION.NAME.MIN, `Store name must be at least ${STORE_VALIDATION.NAME.MIN} characters`)
      .max(STORE_VALIDATION.NAME.MAX, `Store name cannot exceed ${STORE_VALIDATION.NAME.MAX} characters`)
      .optional(),

    mobile: z
      .string()
      .trim()
      .min(STORE_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${STORE_VALIDATION.MOBILE.MIN} digits`)
      .max(STORE_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${STORE_VALIDATION.MOBILE.MAX} digits`)
      .regex(STORE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format')
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(STORE_VALIDATION.EMAIL.MIN, `Email must be at least ${STORE_VALIDATION.EMAIL.MIN} characters`)
      .max(STORE_VALIDATION.EMAIL.MAX, `Email cannot exceed ${STORE_VALIDATION.EMAIL.MAX} characters`)
      .regex(STORE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format')
      .optional(),

    location: z
      .string()
      .trim()
      .min(STORE_VALIDATION.LOCATION.MIN, `Store location must be at least ${STORE_VALIDATION.LOCATION.MIN} characters`)
      .max(STORE_VALIDATION.LOCATION.MAX, `Store location cannot exceed ${STORE_VALIDATION.LOCATION.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),
  }),
};

export const getStoresQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
  }),
};
