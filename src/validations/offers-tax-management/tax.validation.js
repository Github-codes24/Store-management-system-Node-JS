import { z } from 'zod';

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

export const createTaxSchema = z.object({
  productType: objectId,

  category: objectId,

  subcategory: objectId,

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
  productType: objectId,

  category: objectId,

  subcategory: objectId,

  cgst: z
    .number()
    .min(0, 'CGST cannot be negative')
    .max(100, 'CGST cannot be more than 100'),

  sgst: z
    .number()
    .min(0, 'SGST cannot be negative')
    .max(100, 'SGST cannot be more than 100'),
});