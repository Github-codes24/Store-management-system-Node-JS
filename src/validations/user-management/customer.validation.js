import { z } from 'zod';

export const createCustomerSchema = z.object({
  name: z.string({ required_error: 'Customer name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string({ required_error: 'Mobile number is required' }).trim().min(7, 'Mobile number must be at least 7 digits'),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().trim().optional(),
  totalPurchase: z.number().optional().default(0),
  amountDue: z.number().optional().default(0),
  totalOrders: z.number().optional().default(0),
  totalStoreVisits: z.number().optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().min(7, 'Mobile number must be at least 7 digits').optional(),
  dateOfBirth: z.string().optional().nullable(),
  address: z.string().trim().optional(),
  totalPurchase: z.number().optional(),
  amountDue: z.number().optional(),
  totalOrders: z.number().optional(),
  totalStoreVisits: z.number().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
