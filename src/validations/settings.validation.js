import { z } from 'zod';

export const updateSettingsSchema = z.object({
  deliveryRangeKm: z.coerce.number().min(0, 'Delivery range cannot be negative').optional(),
  supportNumber: z.string().trim().min(7, 'Support number must be at least 7 digits').optional(),
  supportEmail: z.string().trim().email('Invalid support email address').optional(),
});
