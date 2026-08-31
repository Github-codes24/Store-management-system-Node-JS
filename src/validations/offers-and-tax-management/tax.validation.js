import { z } from 'zod';

export const createTaxSchema = z.object({
  productType: z.string({ required_error: 'Product type is required' }).trim().min(1, 'Product type is required'),
  category: z.string({ required_error: 'Category is required' }).trim().min(1, 'Category is required'),
  subcategory: z.string({ required_error: 'Subcategory is required' }).trim().min(1, 'Subcategory is required'),
  cgst: z.coerce.number({ required_error: 'CGST is required' }).min(0, 'CGST cannot be negative').max(100, 'CGST cannot exceed 100%'),
  sgst: z.coerce.number({ required_error: 'SGST is required' }).min(0, 'SGST cannot be negative').max(100, 'SGST cannot exceed 100%'),
});

export const updateTaxSchema = z.object({
  productType: z.string().trim().min(1, 'Product type is required').optional(),
  category: z.string().trim().min(1, 'Category is required').optional(),
  subcategory: z.string().trim().min(1, 'Subcategory is required').optional(),
  cgst: z.coerce.number().min(0, 'CGST cannot be negative').max(100, 'CGST cannot exceed 100%').optional(),
  sgst: z.coerce.number().min(0, 'SGST cannot be negative').max(100, 'SGST cannot exceed 100%').optional(),
});
