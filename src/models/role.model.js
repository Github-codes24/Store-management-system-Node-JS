import mongoose from 'mongoose';

const permissionActionsSchema = new mongoose.Schema(
  {
    viewOnly: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    modify: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    modifyStatus: { type: Boolean, default: false },
  },
  { _id: false }
);

const modulePermissionsSchema = new mongoose.Schema(
  {
    dashboard: permissionActionsSchema,
    productTypes: permissionActionsSchema,
    categories: permissionActionsSchema,
    subcategories: permissionActionsSchema,
    brands: permissionActionsSchema,
    units: permissionActionsSchema,
    attributes: permissionActionsSchema,
    distributor: permissionActionsSchema,
    productPurchase: permissionActionsSchema,
    productStock: permissionActionsSchema,
    sellProducts: permissionActionsSchema,
    stores: permissionActionsSchema,
    storeProducts: permissionActionsSchema,
    customers: permissionActionsSchema,
    storeEmployee: permissionActionsSchema,
    subAdmin: permissionActionsSchema,
    offlineSales: permissionActionsSchema,
    onlineOrders: permissionActionsSchema,
    offersManagement: permissionActionsSchema,
    taxManagement: permissionActionsSchema,
    rolesAndPermissions: permissionActionsSchema,
    reports: permissionActionsSchema,
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: [true, 'Role Name is required'],
      trim: true,
    },
    roleCategory: {
      type: String,
      enum: {
        values: ['Store', 'Sub-admin'],
        message: 'Role category must be either Store or Sub-admin',
      },
      required: [true, 'Role category is required'],
      default: 'Store',
    },
    subAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubAdmin',
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    permissions: {
      type: modulePermissionsSchema,
      default: () => ({}),
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.index({ roleName: 1, roleCategory: 1, isDeleted: 1 });

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export default Role;
