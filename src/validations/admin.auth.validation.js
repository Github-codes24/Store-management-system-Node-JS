import { z } from 'zod';

export const registerAdminSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
  phone: z.string().trim().optional(),
  role: z.enum(['superadmin', 'admin']).optional().default('admin'),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
});

export const verifyOtpSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  otp: z.string({ required_error: 'OTP is required' }).trim().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export const resetPasswordSchema = z
  .object({
    email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
    resetToken: z.string({ required_error: 'Reset token is required' }).trim().min(1, 'Reset token is required'),
    password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string({ required_error: 'Confirm password is required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: z.string({ required_error: 'New password is required' }).min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string({ required_error: 'Confirm password is required' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
