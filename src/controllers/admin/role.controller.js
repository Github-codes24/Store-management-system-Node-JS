import Role from '../../models/role.model.js';
import SubAdmin from '../../models/subAdmin.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

// Default list of 22 modules supported by the permissions system
const DEFAULT_MODULES = [
  'dashboard',
  'productTypes',
  'categories',
  'subcategories',
  'brands',
  'units',
  'attributes',
  'distributor',
  'productPurchase',
  'productStock',
  'sellProducts',
  'stores',
  'storeProducts',
  'customers',
  'storeEmployee',
  'subAdmin',
  'offlineSales',
  'onlineOrders',
  'offersManagement',
  'taxManagement',
  'rolesAndPermissions',
  'reports',
];

/**
 * Generate human readable permissions summary string for list table view
 */
const generatePermissionsSummary = (permissions, customDescription) => {
  if (customDescription && customDescription.trim().length > 0) {
    return customDescription.trim();
  }

  if (!permissions) {
    return 'Lorem ipsum dolor sit amet consectetur. In pulvinar id.';
  }

  const activeModules = [];
  const moduleLabels = {
    dashboard: 'Dashboard',
    productTypes: 'Product Types',
    categories: 'Categories',
    subcategories: 'Subcategories',
    brands: 'Brands',
    units: 'Units',
    attributes: 'Attributes',
    distributor: 'Distributor',
    productPurchase: 'Product Purchase',
    productStock: 'Product Stock',
    sellProducts: 'Sell Products',
    stores: 'Stores',
    storeProducts: 'Store Products',
    customers: 'Customers',
    storeEmployee: 'Store Employee',
    subAdmin: 'Sub Admin',
    offlineSales: 'Offline Sales',
    onlineOrders: 'Online Orders',
    offersManagement: 'Offers Management',
    taxManagement: 'Tax Management',
    rolesAndPermissions: 'Roles & Permissions',
    reports: 'Reports',
  };

  for (const [modKey, actions] of Object.entries(permissions)) {
    if (!actions) continue;
    const activeActions = [];
    if (actions.viewOnly) activeActions.push('View');
    if (actions.create) activeActions.push('Create');
    if (actions.modify) activeActions.push('Modify');
    if (actions.delete) activeActions.push('Delete');
    if (actions.modifyStatus) activeActions.push('Status');

    if (activeActions.length > 0) {
      const label = moduleLabels[modKey] || modKey;
      activeModules.push(`${label} (${activeActions.join(', ')})`);
    }
  }

  if (activeModules.length === 0) {
    return 'Lorem ipsum dolor sit amet consectetur. In pulvinar id.';
  }

  return activeModules.slice(0, 3).join(', ') + (activeModules.length > 3 ? ` + ${activeModules.length - 3} more` : '');
};

/**
 * Seed default initial roles matching screenshot 1 if database is clean
 */
const seedInitialRoles = async () => {
  const count = await Role.countDocuments({ isDeleted: false });
  if (count === 0) {
    const subAdminDoc = await SubAdmin.findOne({ status: 'active' }).lean();

    await Role.create([
      {
        roleName: 'Store Manager',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. In pulvinar id.',
        permissions: {
          dashboard: { viewOnly: true },
          sellProducts: { viewOnly: true, create: true, modify: true },
          stores: { viewOnly: true, modify: true },
          storeProducts: { viewOnly: true, modify: true },
          storeEmployee: { viewOnly: true, create: true, modify: true },
          reports: { viewOnly: true },
        },
      },
      {
        roleName: 'Warehouse Manager',
        roleCategory: 'Sub-admin',
        subAdmin: subAdminDoc?._id || null,
        description: 'Lorem ipsum dolor sit amet consectetur. Nibh dolor nisl.',
        permissions: {
          productStock: { viewOnly: true, create: true, delete: true },
          productPurchase: { viewOnly: true, create: true, modify: true },
          storeProducts: { viewOnly: true, modify: true },
        },
      },
      {
        roleName: 'Cashier',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. Sit ullamcorper.',
        permissions: {
          offlineSales: { viewOnly: true },
          sellProducts: { viewOnly: true, create: true },
          customers: { viewOnly: true },
        },
      },
      {
        roleName: 'Billing Manager',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. Malesuada.',
        permissions: {
          offlineSales: { viewOnly: true },
          onlineOrders: { viewOnly: true, modifyStatus: true },
          sellProducts: { viewOnly: true, create: true, modify: true },
        },
      },
      {
        roleName: 'Storekeeper',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. At ac sed porta.',
        permissions: {
          storeProducts: { viewOnly: true, modify: true },
          productStock: { viewOnly: true },
        },
      },
      {
        roleName: 'Storekeeper',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. Non id.',
        permissions: {
          storeProducts: { viewOnly: true, modify: true },
        },
      },
      {
        roleName: 'Cashier',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. Diam velit.',
        permissions: {
          offlineSales: { viewOnly: true },
        },
      },
      {
        roleName: 'Sales Associate',
        roleCategory: 'Store',
        description: 'Lorem ipsum dolor sit amet consectetur. Neque nunc.',
        permissions: {
          customers: { viewOnly: true },
          storeProducts: { viewOnly: true },
        },
      },
    ]);
  }
};

/**
 * 1. Fetch paginated roles list
 * GET /api/admin/roles-and-permissions
 */
export const getRoles = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, roleCategory, subAdminId } = req.query;

    await seedInitialRoles();

    const filter = { isDeleted: false };

    if (roleCategory && roleCategory !== 'all' && roleCategory !== 'All') {
      filter.roleCategory = roleCategory;
    }

    if (subAdminId) {
      filter.subAdmin = subAdminId;
    }

    if (search && search.trim().length > 0) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ roleName: regex }, { description: regex }, { roleCategory: regex }];
    }

    const total = await Role.countDocuments(filter);
    const pagination = getPagination({ page, limit, total });
    const { limit: queryLimit, skip } = pagination;

    const rolesRaw = await Role.find(filter)
      .populate('subAdmin', 'employeeName designation email mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit)
      .lean();

    const roles = rolesRaw.map((r, idx) => ({
      _id: r._id,
      id: r._id,
      srNo: skip + idx + 1,
      roleName: r.roleName,
      roleCategory: r.roleCategory,
      subAdmin: r.subAdmin
        ? {
            id: r.subAdmin._id,
            employeeName: r.subAdmin.employeeName,
            designation: r.subAdmin.designation,
            email: r.subAdmin.email,
          }
        : null,
      subAdminName: r.subAdmin?.employeeName || '-',
      permissionsSummary: generatePermissionsSummary(r.permissions, r.description),
      description: r.description,
      permissions: r.permissions || {},
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Roles and permissions fetched successfully',
        data: {
          roles,
          pagination,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Fetch single role details by ID
 * GET /api/admin/roles-and-permissions/:id
 */
export const getRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findOne({ _id: id, isDeleted: false })
      .populate('subAdmin', 'employeeName designation email mobile')
      .lean();

    if (!role) {
      return next(notFound('Role not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Role details fetched successfully',
        data: {
          role: {
            ...role,
            id: role._id,
            permissionsSummary: generatePermissionsSummary(role.permissions, role.description),
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Create a new role with permissions
 * POST /api/admin/roles-and-permissions
 */
export const createRole = async (req, res, next) => {
  try {
    const { roleName, roleCategory = 'Store', subAdmin, description, permissions } = req.body;

    if (!roleName) {
      return next(badRequest('Role Name is required'));
    }

    const newRole = await Role.create({
      roleName,
      roleCategory,
      subAdmin: subAdmin || null,
      description: description || '',
      permissions: permissions || {},
      createdBy: req.admin?._id || null,
    });

    const populatedRole = await Role.findById(newRole._id)
      .populate('subAdmin', 'employeeName designation email')
      .lean();

    return res.status(201).json(
      successResponse({
        message: 'Role and permissions created successfully',
        data: {
          role: {
            ...populatedRole,
            id: populatedRole._id,
            permissionsSummary: generatePermissionsSummary(populatedRole.permissions, populatedRole.description),
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Update an existing role and permissions
 * PUT /api/admin/roles-and-permissions/:id
 */
export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roleName, roleCategory, subAdmin, description, permissions } = req.body;

    const role = await Role.findOne({ _id: id, isDeleted: false });
    if (!role) {
      return next(notFound('Role not found'));
    }

    if (roleName !== undefined) role.roleName = roleName;
    if (roleCategory !== undefined) role.roleCategory = roleCategory;
    if (subAdmin !== undefined) role.subAdmin = subAdmin || null;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();

    const updatedRole = await Role.findById(role._id)
      .populate('subAdmin', 'employeeName designation email')
      .lean();

    return res.status(200).json(
      successResponse({
        message: 'Role and permissions updated successfully',
        data: {
          role: {
            ...updatedRole,
            id: updatedRole._id,
            permissionsSummary: generatePermissionsSummary(updatedRole.permissions, updatedRole.description),
          },
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Delete a role (Soft Delete)
 * DELETE /api/admin/roles-and-permissions/:id
 */
export const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );

    if (!role) {
      return next(notFound('Role not found'));
    }

    return res.status(200).json(
      successResponse({
        message: 'Role deleted successfully',
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Get active SubAdmins dropdown list (for Sub-admin role category selection)
 * GET /api/admin/roles-and-permissions/subadmins-dropdown
 */
export const getSubAdminsDropdown = async (req, res, next) => {
  try {
    const subAdmins = await SubAdmin.find({ status: 'active' })
      .select('employeeName designation email mobile')
      .sort({ employeeName: 1 })
      .lean();

    const formattedList = subAdmins.map((sa) => ({
      id: sa._id,
      _id: sa._id,
      employeeName: sa.employeeName,
      designation: sa.designation,
      email: sa.email,
      mobile: sa.mobile,
      label: `${sa.employeeName} (${sa.designation})`,
    }));

    return res.status(200).json(
      successResponse({
        message: 'SubAdmins dropdown fetched successfully',
        data: {
          subAdmins: formattedList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 7. Get default modules and permissions schema tree for form setup
 * GET /api/admin/roles-and-permissions/modules-schema
 */
export const getModulesSchema = async (req, res, next) => {
  try {
    const modulesSchema = {
      dashboard: { name: 'Dashboard', actions: ['viewOnly'] },
      productTypes: { name: 'Product Types', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      categories: { name: 'Categories', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      subcategories: { name: 'Subcategories', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      brands: { name: 'Brands', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      units: { name: 'Units', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      attributes: { name: 'Attributes', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      distributor: { name: 'Distributor', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      productPurchase: { name: 'Product Purchase', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      productStock: { name: 'Product Stock', actions: ['viewOnly', 'create', 'delete'] },
      sellProducts: { name: 'Sell Products', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      stores: { name: 'Stores', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      storeProducts: { name: 'Store Products', actions: ['viewOnly', 'modify'] },
      customers: { name: 'Customers', actions: ['viewOnly', 'delete'] },
      storeEmployee: { name: 'Store Employee', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      subAdmin: { name: 'Sub Admin', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      offlineSales: { name: 'Offline Sales', actions: ['viewOnly'] },
      onlineOrders: { name: 'Online Orders', actions: ['viewOnly', 'modifyStatus'] },
      offersManagement: { name: 'Offers Management', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      taxManagement: { name: 'Tax Management', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      rolesAndPermissions: { name: 'Roles & Permissions', actions: ['viewOnly', 'create', 'modify', 'delete'] },
      reports: { name: 'Reports', actions: ['viewOnly'] },
    };

    return res.status(200).json(
      successResponse({
        message: 'Modules permissions schema fetched successfully',
        data: {
          modules: DEFAULT_MODULES,
          modulesSchema,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
