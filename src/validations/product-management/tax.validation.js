import { z } from 'zod';

export const createTaxSchema = z.object({
  productType: z
    .string({ required_error: 'Product type is required' })
    .trim()
    .min(1, 'Product type is required'),

  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1, 'Category is required'),

  subcategory: z
    .string({ required_error: 'Subcategory is required' })
    .trim()
    .min(1, 'Subcategory is required'),

  cgst: z
    .number({
      required_error: 'CGST is required',
      invalid_type_error: 'CGST must be a number',
    })
    .min(0, 'CGST cannot be negative')
    .max(100, 'CGST cannot be more than 100'),

  sgst: z
    .number({
      required_error: 'SGST is required',
      invalid_type_error: 'SGST must be a number',
    })
    .min(0, 'SGST cannot be negative')
    .max(100, 'SGST cannot be more than 100'),
});

export const updateTaxSchema = z.object({
  productType: z
    .string()
    .trim()
    .min(1, 'Product type is required'),

  category: z
    .string()
    .trim()
    .min(1, 'Category is required'),

  subcategory: z
    .string()
    .trim()
    .min(1, 'Subcategory is required'),

  cgst: z
    .number()
    .min(0, 'CGST cannot be negative')
    .max(100, 'CGST cannot be more than 100'),

  sgst: z
    .number()
    .min(0, 'SGST cannot be negative')
    .max(100, 'SGST cannot be more than 100'),
});