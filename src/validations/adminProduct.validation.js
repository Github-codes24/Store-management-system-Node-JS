import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createAdminProductSchema = {
  body: z.object({
    barcode: z.string().trim().optional().nullable().or(z.literal('')),
    productImage: z.string().optional().nullable(),
    productName: z
      .string({ required_error: 'Product name is required' })
      .trim()
      .min(1, 'Product name is required'),
    productType: z
      .string({ required_error: 'Product type is required' })
      .regex(objectIdRegex, 'Invalid Product Type ID'),
    category: z
      .string({ required_error: 'Category is required' })
      .regex(objectIdRegex, 'Invalid Category ID'),
    subcategory: z
      .string({ required_error: 'Subcategory is required' })
      .regex(objectIdRegex, 'Invalid Subcategory ID'),
    brand: z
      .string({ required_error: 'Brand is required' })
      .regex(objectIdRegex, 'Invalid Brand ID'),
    mrp: z.coerce.number({ required_error: 'MRP is required' }).min(0, 'MRP cannot be negative'),
    purchasePrice: z.coerce
      .number({ required_error: 'Purchase price is required' })
      .min(0, 'Purchase price cannot be negative'),
    offlineSellingPrice: z.coerce
      .number({ required_error: 'Offline selling price is required' })
      .min(0, 'Offline selling price cannot be negative'),
    onlineSellingPrice: z.coerce
      .number({ required_error: 'Online selling price is required' })
      .min(0, 'Online selling price cannot be negative'),
    taxType: z.enum(['GST Invoice', 'Non GST']).optional().default('GST Invoice'),
    gstPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    cgstPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    sgstPercentage: z.coerce.number().min(0).max(100).optional().default(0),
    unit: z
      .string({ required_error: 'Unit is required' })
      .regex(objectIdRegex, 'Invalid Unit ID'),
    stockQuantity: z.coerce.number().min(0).optional().default(0),
    minStockAlert: z.coerce.number().min(0).optional().default(0),
    reorderPoint: z.coerce.number().min(0).optional().default(0),
    manufactureDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    hsnCode: z.string().trim().optional().nullable().or(z.literal('')),
    status: z.enum(['active', 'inactive']).optional().default('active'),
  }),
};

export const updateAdminProductSchema = {
  body: createAdminProductSchema.body.partial(),
};

export const getAdminProductsQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    productType: z.string().optional(),
    status: z.string().optional(),
  }),
};
