import { z } from 'zod';

const normalizeOfferType = (val) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  if (lower.includes('special')) return 'special';
  return 'store_wide';
};

const normalizeOffersOn = (val) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  if (lower.includes('store') && lower.includes('online')) return 'both';
  if (lower.includes('online')) return 'online_only';
  if (lower.includes('store')) return 'store_only';
  return lower;
};

const normalizeDiscountType = (val) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  if (lower.includes('price') || lower.includes('flat') || lower.includes('fixed') || lower === 'rs' || lower === '₹') return 'flat';
  return 'percentage';
};

export const createOfferSchema = z.object({
  name: z.string({ required_error: 'Offer name is required' }).trim().min(2, 'Offer name must be at least 2 characters'),
  description: z.string().trim().optional().default(''),
  offerType: z.preprocess(normalizeOfferType, z.enum(['store_wide', 'special'])).optional().default('store_wide'),
  offersOn: z.preprocess(normalizeOffersOn, z.enum(['store_only', 'online_only', 'both'])).optional().default('both'),
  stores: z.array(z.string()).optional().default([]),
  applyToAllStores: z.boolean().optional().default(true),
  validFrom: z.string({ required_error: 'Valid from date is required' }),
  validTo: z.string({ required_error: 'Valid to / expiry date is required' }),
  discountType: z.preprocess(normalizeDiscountType, z.enum(['percentage', 'flat'], { required_error: 'Discount type (percentage or flat) is required' })),
  discountValue: z.coerce.number({ required_error: 'Discount value is required' }).min(0, 'Discount value cannot be negative'),
  appliesTo: z.enum(['all', 'category', 'product']).optional().default('all'),
  products: z.array(z.string()).optional().default([]),
  sendToAllCustomers: z.boolean().optional().default(true),
  targetCustomers: z.array(z.string()).optional().default([]),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateOfferSchema = z.object({
  name: z.string().trim().min(2, 'Offer name must be at least 2 characters').optional(),
  description: z.string().trim().optional(),
  offerType: z.preprocess(normalizeOfferType, z.enum(['store_wide', 'special'])).optional(),
  offersOn: z.preprocess(normalizeOffersOn, z.enum(['store_only', 'online_only', 'both'])).optional(),
  stores: z.array(z.string()).optional(),
  applyToAllStores: z.boolean().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  discountType: z.preprocess(normalizeDiscountType, z.enum(['percentage', 'flat'])).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  appliesTo: z.enum(['all', 'category', 'product']).optional(),
  products: z.array(z.string()).optional(),
  sendToAllCustomers: z.boolean().optional(),
  targetCustomers: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const toggleOfferStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], { required_error: 'Status is required' }),
});
