import { z } from 'zod';

export const designationEnum = [
  'Warehouse Manager',
  'Store Manager',
  'Manager',
  'Cashier',
  'Billing Manager',
];

export const createSubAdminSchema = z.object({
  employeeName: z.string({ required_error: 'Employee Name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  designation: z.enum(designationEnum, { required_error: 'Designation is required' }),
  mobile: z.string({ required_error: 'Mobile number is required' }).trim().min(7, 'Mobile number must be at least 7 digits'),
  email: z.string({ required_error: 'Email is required' }).trim().email('Invalid email address'),
  address: z.string().trim().optional().default(''),
  password: z.string({ required_error: 'Password is required' }).min(6, 'Password must be at least 6 characters'),
  status: z.enum(['active', 'inactive', 'suspended']).optional().default('active'),
});

export const updateSubAdminSchema = z.object({
  employeeName: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  designation: z.enum(designationEnum).optional(),
  mobile: z.string().trim().min(7, 'Mobile number must be at least 7 digits').optional(),
  email: z.string().trim().email('Invalid email address').optional(),
  address: z.string().trim().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});
