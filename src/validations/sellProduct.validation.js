import { z } from 'zod';
import { PAYMENT_MODES, SALE_TYPES } from '../constants/sellProduct.constants.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const sellItemSchema = z.object({
  product: z
    .string({ required_error: 'Product ID is required' })
    .regex(objectIdRegex, 'Invalid Product ID'),
  productName: z.string().trim().optional(),
  mrp: z.coerce.number().min(0, 'MRP cannot be negative').optional().default(0),
  sellingPrice: z.coerce.number().min(0, 'Selling price cannot be negative'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit: z
    .string()
    .regex(objectIdRegex, 'Invalid Unit ID')
    .optional()
    .nullable()
    .or(z.literal('')),
  gstPercentage: z.coerce.number().min(0).optional().default(0),
});

const initialPaymentSchema = z.object({
  paymentDate: z.string().optional(),
  paymentMode: z.enum(PAYMENT_MODES, {
    required_error: 'Payment mode is required',
  }),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  transactionId: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().trim().optional().nullable().or(z.literal('')),
});

export const createSellProductSchema = {
  body: z.object({
    sellId: z.string().trim().optional().nullable().or(z.literal('')),
    billDate: z.string().optional(),
    saleType: z.enum(SALE_TYPES, {
      required_error: 'Sale type is required (Own Store or Other Retailer)',
    }),
    store: z.string().regex(objectIdRegex, 'Invalid Store ID').optional().nullable(),
    retailer: z.string().regex(objectIdRegex, 'Invalid Retailer ID').optional().nullable(),
    items: z
      .array(sellItemSchema, { required_error: 'At least one product item is required' })
      .min(1, 'At least one product item is required'),
    discountType: z.enum(['percentage', 'flat']).optional().default('flat'),
    discountValue: z.coerce.number().min(0).optional().default(0),
    payments: z.array(initialPaymentSchema).optional().default([]),
  }),
};

export const updateSellProductSchema = {
  body: z.object({
    billDate: z.string().optional(),
    saleType: z.enum(SALE_TYPES).optional(),
    store: z.string().regex(objectIdRegex, 'Invalid Store ID').optional().nullable(),
    retailer: z.string().regex(objectIdRegex, 'Invalid Retailer ID').optional().nullable(),
    items: z.array(sellItemSchema).min(1, 'At least one product item is required').optional(),
    discountType: z.enum(['percentage', 'flat']).optional(),
    discountValue: z.coerce.number().min(0).optional(),
  }),
};

export const addSellPaymentSchema = {
  body: z.object({
    paymentDate: z.string().optional(),
    paymentMode: z.enum(PAYMENT_MODES, {
      required_error: 'Payment mode is required',
    }),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    transactionId: z.string().trim().optional().nullable().or(z.literal('')),
    description: z.string().trim().optional().nullable().or(z.literal('')),
  }),
};

export const getSellProductsQuerySchema = {
  query: z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    search: z.string().optional(),
    saleType: z.string().optional(),
    paymentStatus: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
};
