import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string({ required_error: 'Category name is required' }).trim().min(2, 'Name must be at least 2 characters'),
  productType: z.string({ required_error: 'Product Type is required' }).trim().min(1, 'Product Type is required'),
  description: z.string().trim().optional(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
  productType: z.string().trim().optional(),
  description: z.string().trim().optional(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});
