import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID cannot be empty'),
  quantity: z.number().int().min(1).optional().default(1),
  selectedVariant: z.any().optional(),
  productModel: z.enum(['AdminProduct', 'StoreProduct']).optional().default('AdminProduct'),
});

export const updateCartQuantitySchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .trim()
    .min(1, 'Product ID cannot be empty'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int()
    .min(0, 'Quantity cannot be negative'),
});
