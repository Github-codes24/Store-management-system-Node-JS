import { z } from 'zod';

const fieldTypes = [
  'Multi-select',
  'Color Picker',
  'Dropdown',
  'Text',
  'Date',
  'Number',
];

export const createAttributeSchema = z.object({
  attribute: z
    .string({ required_error: 'Attribute name is required' })
    .trim()
    .min(1, 'Attribute name is required'),

  key: z
    .string({ required_error: 'Attribute key is required' })
    .trim()
    .min(1, 'Attribute key is required'),

  fieldType: z.enum(fieldTypes, {
    required_error: 'Field type is required',
  }),

  appliesTo: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .optional(),

  options: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .optional(),

  status: z.boolean().optional().default(true),
});

export const updateAttributeSchema = z.object({
  attribute: z
    .string()
    .trim()
    .min(1, 'Attribute name is required'),

  key: z
    .string()
    .trim()
    .min(1, 'Attribute key is required'),

  fieldType: z.enum(fieldTypes),

  appliesTo: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .optional(),

  options: z
    .union([
      z.array(z.string()),
      z.string(),
    ])
    .optional(),

  status: z.boolean().optional(),
});

export const updateAttributeStatusSchema = z.object({
  status: z.boolean({
    required_error: 'Status is required',
  }),
});