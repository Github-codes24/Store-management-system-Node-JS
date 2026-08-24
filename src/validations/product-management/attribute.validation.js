import { z } from 'zod';

export const fieldTypes = [
  'Text',
  'Number',
  'Decimal',
  'Dropdown',
  'Multi-select',
  'Checkbox',
  'Color Picker',
  'Date',
];

export const createAttributeSchema = z.object({
  displayLabel: z.string().trim().optional(),
  attribute: z.string().trim().optional(),
  attributeKey: z.string().trim().optional(),
  key: z.string().trim().optional(),
  fieldType: z.enum(fieldTypes, {
    required_error: 'Field type is required',
  }),
  productTypes: z.union([z.array(z.string()), z.string()]).optional().default([]),
  categories: z.union([z.array(z.string()), z.string()]).optional().default([]),
  subcategories: z.union([z.array(z.string()), z.string()]).optional().default([]),
  appliesTo: z.union([z.array(z.string()), z.string()]).optional().default([]),
  placeholder: z.string().trim().optional().default(''),
  isRequired: z.boolean().optional().default(false),
  options: z.union([z.array(z.string()), z.string()]).optional().default([]),
  optionValues: z.union([z.array(z.string()), z.string()]).optional().default([]),
  status: z.union([z.enum(['active', 'inactive']), z.boolean()]).optional().default('active'),
}).refine(
  (data) => !!(data.displayLabel || data.attribute),
  { message: 'Display label is required', path: ['displayLabel'] }
).refine(
  (data) => !!(data.attributeKey || data.key),
  { message: 'Attribute key is required', path: ['attributeKey'] }
);

export const updateAttributeSchema = z.object({
  displayLabel: z.string().trim().optional(),
  attribute: z.string().trim().optional(),
  attributeKey: z.string().trim().optional(),
  key: z.string().trim().optional(),
  fieldType: z.enum(fieldTypes).optional(),
  productTypes: z.union([z.array(z.string()), z.string()]).optional(),
  categories: z.union([z.array(z.string()), z.string()]).optional(),
  subcategories: z.union([z.array(z.string()), z.string()]).optional(),
  appliesTo: z.union([z.array(z.string()), z.string()]).optional(),
  placeholder: z.string().trim().optional(),
  isRequired: z.boolean().optional(),
  options: z.union([z.array(z.string()), z.string()]).optional(),
  optionValues: z.union([z.array(z.string()), z.string()]).optional(),
  status: z.union([z.enum(['active', 'inactive']), z.boolean()]).optional(),
});

export const updateAttributeStatusSchema = z.object({
  status: z.union([
    z.enum(['active', 'inactive']),
    z.boolean(),
  ], {
    required_error: 'Status is required',
  }),
});