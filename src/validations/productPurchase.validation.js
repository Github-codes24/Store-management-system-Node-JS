import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const purchaseItemSchema = z.object({
  product: z.string().regex(objectIdRegex, 'Invalid Product ID').optional().nullable(),
  barcode: z.string().trim().optional().nullable().or(z.literal('')),
  productName: z.string({ required_error: 'Product name is required' }).trim().min(1),
  productType: z.string().regex(objectIdRegex, 'Invalid Product Type ID').optional().nullable(),
  category: z.string().regex(objectIdRegex, 'Invalid Category ID').optional().nullable(),
  subcategory: z.string().regex(objectIdRegex, 'Invalid Subcategory ID').optional().nullable(),
  brand: z.string().regex(objectIdRegex, 'Invalid Brand ID').optional().nullable(),
  unit: z.string({ required_error: 'Unit ID is required' }).regex(objectIdRegex, 'Invalid Unit ID'),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative'),
  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative'),
  offlineSellingPrice: z.coerce.number().min(0).optional().default(0),
  onlineSellingPrice: z.coerce.number().min(0).optional().default(0),
  taxType: z.enum(['GST Invoice', 'Non GST']).optional().default('GST Invoice'),
  gstPercentage: z.coerce.number().min(0).optional().default(0),
  cgstPercentage: z.coerce.number().min(0).optional().default(0),
  sgstPercentage: z.coerce.number().min(0).optional().default(0),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  minStockAlert: z.coerce.number().min(0).optional().default(0),
  reorderPoint: z.coerce.number().min(0).optional().default(0),
  manufactureDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  hsnCode: z.string().trim().optional().nullable().or(z.literal('')),
  productImage: z.string().optional().nullable(),
});

const initialPaymentSchema = z.object({
  paymentDate: z.string().optional(),
  paymentMode: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'], {
    required_error: 'Payment mode is required',
  }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  transactionId: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().trim().optional().nullable().or(z.literal('')),
});

export const createProductPurchaseSchema = {
  body: z.object({
    purchaseId: z.string().trim().optional().nullable().or(z.literal('')),
    billDate: z.string().optional(),
    distributor: z
      .string({ required_error: 'Distributor is required' })
      .regex(objectIdRegex, 'Invalid Distributor ID'),
    items: z
      .array(purchaseItemSchema, { required_error: 'At least one item is required' })
      .min(1, 'At least one item is required in the purchase order'),
    discountType: z.enum(['percentage', 'flat']).optional().default('flat'),
    discountValue: z.coerce.number().min(0).optional().default(0),
    payments: z.array(initialPaymentSchema).optional().default([]),
  }),
};

export const updateProductPurchaseSchema = {
  body: z.object({
    billDate: z.string().optional(),
    distributor: z.string().regex(objectIdRegex, 'Invalid Distributor ID').optional(),
    items: z.array(purchaseItemSchema).min(1, 'Purchase must have at least one item').optional(),
    discountType: z.enum(['percentage', 'flat']).optional(),
    discountValue: z.coerce.number().min(0).optional(),
  }),
};

export const addPurchasePaymentSchema = {
  body: z.object({
    paymentDate: z.string().optional(),
    paymentMode: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'], {
      required_error: 'Payment mode is required',
    }),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    transactionId: z.string().trim().optional().nullable().or(z.literal('')),
    description: z.string().trim().optional().nullable().or(z.literal('')),
  }),
};

export const getProductPurchasesQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    distributor: z.string().optional(),
    paymentStatus: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
};
