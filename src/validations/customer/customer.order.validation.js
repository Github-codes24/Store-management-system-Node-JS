import { z } from 'zod';

export const placeOrderSchema = z.object({
  paymentMethod: z
    .enum(['COD', 'UPI', 'CARD', 'NET_BANKING', 'Cash', 'Card', 'Upi'])
    .optional()
    .default('COD'),
  deliveryAddressId: z.string().trim().optional().nullable().or(z.literal('')),
});

export const cancelOrderSchema = z.object({
  cancelReason: z.string({ required_error: 'Cancel reason is required' }).trim().min(1, 'Please enter a cancellation reason'),
});
