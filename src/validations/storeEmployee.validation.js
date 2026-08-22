import { z } from 'zod';
import { STORE_EMPLOYEE_VALIDATION } from '../constants/storeEmployee.constants.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createStoreEmployeeSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Employee name is required' })
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.NAME.MIN, `Name must be at least ${STORE_EMPLOYEE_VALIDATION.NAME.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.NAME.MAX, `Name cannot exceed ${STORE_EMPLOYEE_VALIDATION.NAME.MAX} characters`),

    designation: z
      .string({ required_error: 'Designation is required' })
      .trim()
      .min(2, 'Designation must be at least 2 characters'),

    storeId: z
      .string({ required_error: 'Assigned Store is required' })
      .trim()
      .regex(objectIdRegex, 'Invalid Store ID format'),

    mobile: z
      .string({ required_error: 'Mobile number is required' })
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${STORE_EMPLOYEE_VALIDATION.MOBILE.MIN} digits`)
      .max(STORE_EMPLOYEE_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${STORE_EMPLOYEE_VALIDATION.MOBILE.MAX} digits`)
      .regex(STORE_EMPLOYEE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format'),

    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .min(STORE_EMPLOYEE_VALIDATION.EMAIL.MIN, `Email must be at least ${STORE_EMPLOYEE_VALIDATION.EMAIL.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.EMAIL.MAX, `Email cannot exceed ${STORE_EMPLOYEE_VALIDATION.EMAIL.MAX} characters`)
      .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),

    address: z
      .string()
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.ADDRESS.MIN, `Address must be at least ${STORE_EMPLOYEE_VALIDATION.ADDRESS.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.ADDRESS.MAX, `Address cannot exceed ${STORE_EMPLOYEE_VALIDATION.ADDRESS.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    userId: z
      .string({ required_error: 'User ID is required' })
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.USER_ID.MIN, `User ID must be at least ${STORE_EMPLOYEE_VALIDATION.USER_ID.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.USER_ID.MAX, `User ID cannot exceed ${STORE_EMPLOYEE_VALIDATION.USER_ID.MAX} characters`)
      .regex(STORE_EMPLOYEE_VALIDATION.USER_ID.PATTERN, 'Invalid User ID format (only letters, numbers, _, ., -)'),

    password: z
      .string({ required_error: 'Password is required' })
      .min(STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN, `Password must be at least ${STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN} characters`),
  }),
};

export const updateStoreEmployeeSchema = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.NAME.MIN, `Name must be at least ${STORE_EMPLOYEE_VALIDATION.NAME.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.NAME.MAX, `Name cannot exceed ${STORE_EMPLOYEE_VALIDATION.NAME.MAX} characters`)
      .optional(),

    designation: z
      .string()
      .trim()
      .min(2, 'Designation must be at least 2 characters')
      .optional(),

    storeId: z
      .string()
      .trim()
      .regex(objectIdRegex, 'Invalid Store ID format')
      .optional(),

    mobile: z
      .string()
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.MOBILE.MIN, `Mobile number must be at least ${STORE_EMPLOYEE_VALIDATION.MOBILE.MIN} digits`)
      .max(STORE_EMPLOYEE_VALIDATION.MOBILE.MAX, `Mobile number cannot exceed ${STORE_EMPLOYEE_VALIDATION.MOBILE.MAX} digits`)
      .regex(STORE_EMPLOYEE_VALIDATION.MOBILE.PATTERN, 'Invalid mobile number format')
      .optional(),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(STORE_EMPLOYEE_VALIDATION.EMAIL.MIN, `Email must be at least ${STORE_EMPLOYEE_VALIDATION.EMAIL.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.EMAIL.MAX, `Email cannot exceed ${STORE_EMPLOYEE_VALIDATION.EMAIL.MAX} characters`)
      .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format')
      .optional(),

    address: z
      .string()
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.ADDRESS.MIN, `Address must be at least ${STORE_EMPLOYEE_VALIDATION.ADDRESS.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.ADDRESS.MAX, `Address cannot exceed ${STORE_EMPLOYEE_VALIDATION.ADDRESS.MAX} characters`)
      .optional()
      .nullable()
      .or(z.literal('')),

    userId: z
      .string()
      .trim()
      .min(STORE_EMPLOYEE_VALIDATION.USER_ID.MIN, `User ID must be at least ${STORE_EMPLOYEE_VALIDATION.USER_ID.MIN} characters`)
      .max(STORE_EMPLOYEE_VALIDATION.USER_ID.MAX, `User ID cannot exceed ${STORE_EMPLOYEE_VALIDATION.USER_ID.MAX} characters`)
      .regex(STORE_EMPLOYEE_VALIDATION.USER_ID.PATTERN, 'Invalid User ID format')
      .optional(),

    password: z
      .string()
      .min(STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN, `Password must be at least ${STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN} characters`)
      .optional(),
  }),
};

export const getStoreEmployeesQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    designation: z.string().optional(),
    storeId: z.string().optional(),
  }),
};

export const storeEmployeeLoginSchema = {
  body: z.object({
    userId: z.string({ required_error: 'User ID is required' }).trim(),
    password: z.string({ required_error: 'Password is required' }),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),
  }),
};

export const resendOtpSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),
  }),
};

export const verifyOtpSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Email address is required' })
      .trim()
      .toLowerCase()
      .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),
    otp: z
      .string({ required_error: '4-digit OTP is required' })
      .trim()
      .length(4, 'OTP must be exactly 4 digits'),
  }),
};

export const resetPasswordSchema = {
  body: z
    .object({
      email: z
        .string({ required_error: 'Email address is required' })
        .trim()
        .toLowerCase()
        .regex(STORE_EMPLOYEE_VALIDATION.EMAIL.PATTERN, 'Invalid email address format'),
      resetToken: z
        .string({ required_error: 'Reset token is required' })
        .trim(),
      newPassword: z
        .string({ required_error: 'New password is required' })
        .min(STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN, `Password must be at least ${STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN} characters`),
      confirmPassword: z
        .string({ required_error: 'Confirm password is required' }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'New password and confirm password do not match',
      path: ['confirmPassword'],
    }),
};

export const changePasswordSchema = {
  body: z
    .object({
      oldPassword: z
        .string({ required_error: 'Old password is required' }),
      newPassword: z
        .string({ required_error: 'New password is required' })
        .min(STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN, `New password must be at least ${STORE_EMPLOYEE_VALIDATION.PASSWORD.MIN} characters`),
      confirmPassword: z
        .string({ required_error: 'Confirm password is required' }),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'New password and confirm password do not match',
      path: ['confirmPassword'],
    }),
};
