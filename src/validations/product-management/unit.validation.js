import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string({ required_error: 'Unit name is required' }).trim().min(1, 'Unit name is required'),
  shortName: z.string({ required_error: 'Short name is required' }).trim().min(1, 'Short name is required'),
  allowDecimal: z.boolean().optional().default(false),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateUnitSchema = z.object({
  name: z.string().trim().min(1, 'Unit name is required').optional(),
  shortName: z.string().trim().min(1, 'Short name is required').optional(),
  allowDecimal: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
