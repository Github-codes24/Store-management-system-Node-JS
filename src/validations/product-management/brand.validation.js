import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string({ required_error: 'Brand name is required' }).trim().min(1, 'Brand name is required'),
  description: z.string().trim().optional(),
  logo: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateBrandSchema = z.object({
  name: z.string().trim().min(1, 'Brand name is required').optional(),
  description: z.string().trim().optional(),
  logo: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});
