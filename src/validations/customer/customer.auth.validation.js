import { z } from 'zod';

export const sendOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
  storeId: z.string().trim().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
  otp: z
    .string({ required_error: 'OTP is required' })
    .trim()
    .regex(/^[0-9]{4}$/, 'OTP must be a 4-digit code'),
  storeId: z.string().trim().optional(),
});

export const resendOtpSchema = z.object({
  phone: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
});
