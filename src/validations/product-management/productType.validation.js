import { z } from 'zod';

export const createProductTypeSchema = z.object({
  name: z.string({ required_error: 'Product Type name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().optional(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateProductTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  description: z.string().trim().optional(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const toggleStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], { required_error: 'Status is required' }),
});
