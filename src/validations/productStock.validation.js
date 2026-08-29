import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const getProductStocksQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    productType: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    brand: z.string().optional(),
    status: z.string().optional().default('all'),
    sortBy: z
      .enum(['createdAt', 'productName', 'stockQuantity', 'mrp', 'offlineSellingPrice', 'onlineSellingPrice'])
      .optional()
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
};

export const updateProductStockSchema = {
  body: z
    .object({
      stockQuantity: z.coerce.number().min(0).optional(),
      minStockAlert: z.coerce.number().min(0).optional(),
      reorderPoint: z.coerce.number().min(0).optional(),
      mrp: z.coerce.number().min(0).optional(),
      purchasePrice: z.coerce.number().min(0).optional(),
      offlineSellingPrice: z.coerce.number().min(0).optional(),
      onlineSellingPrice: z.coerce.number().min(0).optional(),
      taxType: z.enum(['GST Invoice', 'Non GST']).optional(),
      gstPercentage: z.coerce.number().min(0).max(100).optional(),
      cgstPercentage: z.coerce.number().min(0).max(100).optional(),
      sgstPercentage: z.coerce.number().min(0).max(100).optional(),
      manufactureDate: z.string().optional().nullable(),
      expiryDate: z.string().optional().nullable(),
      hsnCode: z.string().trim().optional().nullable().or(z.literal('')),
      status: z.enum(['active', 'inactive']).optional(),
    })
    .partial(),
};

export const updateStockStatusSchema = {
  body: z.object({
    status: z.enum(['active', 'inactive'], {
      required_error: 'Status must be active or inactive',
    }),
  }),
};

export const adjustStockQuantitySchema = {
  body: z.object({
    stockQuantity: z.coerce.number({ required_error: 'Stock quantity is required' }).min(0, 'Quantity cannot be negative'),
    operation: z.enum(['set', 'add', 'subtract']).optional().default('set'),
  }),
};

export const printBarcodeSchema = {
  body: z
    .object({
      quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
    })
    .optional(),
  query: z
    .object({
      quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').optional().default('1'),
    })
    .optional(),
};

export const exportProductStocksQuerySchema = {
  query: z.object({
    search: z.string().optional(),
    productType: z.string().optional(),
    category: z.string().optional(),
    subcategory: z.string().optional(),
    brand: z.string().optional(),
    status: z.string().optional().default('all'),
    format: z.enum(['excel', 'csv', 'json']).optional().default('excel'),
  }),
};
