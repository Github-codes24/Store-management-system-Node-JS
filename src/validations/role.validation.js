import { z } from 'zod';

const permissionActionsZodSchema = z
  .object({
    viewOnly: z.boolean().optional().default(false),
    create: z.boolean().optional().default(false),
    modify: z.boolean().optional().default(false),
    delete: z.boolean().optional().default(false),
    modifyStatus: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

const permissionsTreeZodSchema = z
  .object({
    dashboard: permissionActionsZodSchema,
    productTypes: permissionActionsZodSchema,
    categories: permissionActionsZodSchema,
    subcategories: permissionActionsZodSchema,
    brands: permissionActionsZodSchema,
    units: permissionActionsZodSchema,
    attributes: permissionActionsZodSchema,
    distributor: permissionActionsZodSchema,
    productPurchase: permissionActionsZodSchema,
    productStock: permissionActionsZodSchema,
    sellProducts: permissionActionsZodSchema,
    stores: permissionActionsZodSchema,
    storeProducts: permissionActionsZodSchema,
    customers: permissionActionsZodSchema,
    storeEmployee: permissionActionsZodSchema,
    subAdmin: permissionActionsZodSchema,
    offlineSales: permissionActionsZodSchema,
    onlineOrders: permissionActionsZodSchema,
    offersManagement: permissionActionsZodSchema,
    taxManagement: permissionActionsZodSchema,
    rolesAndPermissions: permissionActionsZodSchema,
    reports: permissionActionsZodSchema,
    // Store panel modules
    billing: permissionActionsZodSchema,
    productInventory: permissionActionsZodSchema,
    offers: permissionActionsZodSchema,
  })
  .optional()
  .default({});

export const createRoleSchema = z.object({
  roleName: z
    .string({ required_error: 'Role Name is required' })
    .trim()
    .min(2, 'Role Name must be at least 2 characters'),
  roleCategory: z
    .enum(['Store', 'Sub-admin'], { required_error: 'Role category is required' })
    .default('Store'),
  subAdmin: z.string().trim().nullable().optional(),
  store: z.string().trim().nullable().optional(),
  storeId: z.string().trim().nullable().optional(),
  storeEmployee: z.string().trim().nullable().optional(),
  storeEmployeeId: z.string().trim().nullable().optional(),
  employeeId: z.string().trim().nullable().optional(),
  storeEmployees: z.array(z.string().trim()).optional().default([]),
  description: z.string().trim().optional().default(''),
  permissions: permissionsTreeZodSchema,
});

export const updateRoleSchema = z.object({
  roleName: z
    .string()
    .trim()
    .min(2, 'Role Name must be at least 2 characters')
    .optional(),
  roleCategory: z.enum(['Store', 'Sub-admin']).optional(),
  subAdmin: z.string().trim().nullable().optional(),
  store: z.string().trim().nullable().optional(),
  storeId: z.string().trim().nullable().optional(),
  storeEmployee: z.string().trim().nullable().optional(),
  storeEmployeeId: z.string().trim().nullable().optional(),
  employeeId: z.string().trim().nullable().optional(),
  storeEmployees: z.array(z.string().trim()).optional(),
  description: z.string().trim().optional(),
  permissions: permissionsTreeZodSchema,
});

export const getRolesQuerySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  search: z.string().optional(),
  roleCategory: z.enum(['Store', 'Sub-admin', 'all', 'All']).optional(),
  subAdminId: z.string().optional(),
  storeId: z.string().optional(),
  storeEmployeeId: z.string().optional(),
});
