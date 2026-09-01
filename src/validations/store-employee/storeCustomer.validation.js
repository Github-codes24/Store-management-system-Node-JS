import { z } from 'zod';

export const createStoreCustomerSchema = z.object({
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

export const updateStoreCustomerSchema = z.object({
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

export const payDueAmountSchema = z.object({
  amount: z
    .number({ required_error: 'Payment amount is required' })
    .gt(0, 'Payment amount must be greater than 0'),
});

export const getStoreCustomersQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    purchaseType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
};
