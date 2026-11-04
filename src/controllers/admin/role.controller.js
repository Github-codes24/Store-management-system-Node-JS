import Role from '../../models/role.model.js';
import SubAdmin from '../../models/subAdmin.model.js';
import StoreEmployee from '../../models/storeEmployee.model.js';
import Store from '../../models/store.model.js';
import { successResponse } from '../../utils/api-response.js';
import { notFound, badRequest } from '../../utils/api-error.js';
import { getPagination } from '../../utils/pagination.js';

// Default list of 22 modules supported by Admin permissions system
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

// List of 8 modules supported by Store Panel permissions system
const STORE_MODULES = [
  'dashboard',
  'customers',
  'billing',
  'offlineSales',
  'onlineOrders',
  'productInventory',
  'offers',
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
    return 'Full access configured.';
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
    // Store panel labels
    billing: 'Billing & Returns',
    productInventory: 'Product Inventory',
    offers: 'Offers Management',
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
    return 'Full access configured.';
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

    await Role.insertMany([
      {
        roleName: 'Warehouse Manager',
        roleCategory: 'Sub-admin',
        subAdmin: subAdminDoc ? subAdminDoc._id : null,
        description: 'Manages warehouse catalog, purchasing, stock, and distribution.',
        permissions: {
          productStock: { viewOnly: true, create: true, delete: true },
          productPurchase: { viewOnly: true, create: true, modify: true },
          distributor: { viewOnly: true, create: true, modify: true },
          storeProducts: { viewOnly: true, modify: true },
        },
      },
      {
        roleName: 'Store Manager',
        roleCategory: 'Store',
        description: 'Store operations supervisor managing stock, billing and local store staff.',
        permissions: {
          dashboard: { viewOnly: true },
          billing: { viewOnly: true, create: true, modify: true, delete: true },
          productInventory: { viewOnly: true, create: true, modify: true },
          customers: { viewOnly: true, create: true, modify: true },
          offlineSales: { viewOnly: true },
          onlineOrders: { viewOnly: true, modifyStatus: true },
          offers: { viewOnly: true, create: true, modify: true },
          reports: { viewOnly: true },
        },
      },
      {
        roleName: 'Cashier',
        roleCategory: 'Store',
        description: 'Handles billing counters, customer checkouts, returns and payments.',
        permissions: {
          billing: { viewOnly: true, create: true, modify: true },
          offlineSales: { viewOnly: true },
          customers: { viewOnly: true, create: true },
        },
      },
      {
        roleName: 'Storekeeper',
        roleCategory: 'Store',
        description: 'Manages store shelf inventory, barcodes, stock counts and receiving.',
        permissions: {
          productInventory: { viewOnly: true, create: true, modify: true },
          storeProducts: { viewOnly: true, modify: true },
        },
      },
      {
        roleName: 'Sales Associate',
        roleCategory: 'Store',
        description: 'Assists customers on the store floor with product inquiries and checkout support.',
        permissions: {
          customers: { viewOnly: true },
          productInventory: { viewOnly: true },
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
    const { page = 1, limit = 10, search, roleCategory, subAdminId, storeId, storeEmployeeId } = req.query;

    await seedInitialRoles();

    const filter = { isDeleted: false };

    if (roleCategory && roleCategory !== 'all' && roleCategory !== 'All') {
      filter.roleCategory = roleCategory;
    }

    if (subAdminId) {
      filter.subAdmin = subAdminId;
    }

    if (storeId) {
      filter.store = storeId;
    }

    if (storeEmployeeId) {
      filter.$or = [
        { storeEmployee: storeEmployeeId },
        { storeEmployees: storeEmployeeId },
      ];
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
      .populate('store', 'name storeCode location')
      .populate('storeEmployee', 'name designation email mobile userId')
      .populate('storeEmployees', 'name designation email mobile userId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(queryLimit)
      .lean();

    const roles = rolesRaw.map((r, idx) => {
      let assignedPersonName = '-';
      if (r.roleCategory === 'Sub-admin') {
        assignedPersonName = r.subAdmin?.employeeName || '-';
      } else if (r.roleCategory === 'Store') {
        if (r.storeEmployee?.name) {
          assignedPersonName = `${r.storeEmployee.name} (${r.store?.name || 'Store'})`;
        } else if (Array.isArray(r.storeEmployees) && r.storeEmployees.length > 0) {
          assignedPersonName = r.storeEmployees.map((e) => e.name).join(', ');
        } else if (r.store?.name) {
          assignedPersonName = `All ${r.store.name} Staff`;
        }
      }

      return {
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
        subAdminName: assignedPersonName,
        assignedSubAdmin: assignedPersonName,
        store: r.store
          ? {
              _id: r.store._id,
              id: r.store._id,
              name: r.store.name,
              storeCode: r.store.storeCode,
            }
          : null,
        storeEmployee: r.storeEmployee
          ? {
              _id: r.storeEmployee._id,
              id: r.storeEmployee._id,
              name: r.storeEmployee.name,
              designation: r.storeEmployee.designation,
              email: r.storeEmployee.email,
              userId: r.storeEmployee.userId,
            }
          : null,
        storeEmployees: Array.isArray(r.storeEmployees)
          ? r.storeEmployees.map((e) => ({
              _id: e._id,
              id: e._id,
              name: e.name,
              designation: e.designation,
              email: e.email,
            }))
          : [],
        permissionsSummary: generatePermissionsSummary(r.permissions, r.description),
        description: r.description,
        permissions: r.permissions || {},
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });

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
      .populate('store', 'name storeCode location')
      .populate('storeEmployee', 'name designation email mobile userId')
      .populate('storeEmployees', 'name designation email mobile userId')
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
    const {
      roleName,
      roleCategory = 'Store',
      subAdmin,
      store,
      storeId,
      storeEmployee,
      storeEmployeeId,
      employeeId,
      storeEmployees,
      description,
      permissions,
    } = req.body;

    if (!roleName) {
      return next(badRequest('Role Name is required'));
    }

    const assignedStoreId = store || storeId || null;
    const assignedEmployeeId = storeEmployee || storeEmployeeId || employeeId || null;
    const assignedEmployeeIds = Array.isArray(storeEmployees) && storeEmployees.length > 0
      ? storeEmployees
      : (assignedEmployeeId ? [assignedEmployeeId] : []);

    const newRole = await Role.create({
      roleName: roleName.trim(),
      roleCategory,
      subAdmin: subAdmin || null,
      store: assignedStoreId,
      storeEmployee: assignedEmployeeId,
      storeEmployees: assignedEmployeeIds,
      description: description || '',
      permissions: permissions || {},
      createdBy: req.admin?._id || null,
    });

    // If subAdmin is assigned, link role to SubAdmin
    if (subAdmin) {
      await SubAdmin.findByIdAndUpdate(subAdmin, { roleId: newRole._id });
      await Role.updateMany(
        { subAdmin, _id: { $ne: newRole._id } },
        { $set: { subAdmin: null } }
      );
    }

    // If storeEmployee is assigned, link role to StoreEmployee
    if (assignedEmployeeId) {
      await StoreEmployee.findByIdAndUpdate(assignedEmployeeId, {
        roleId: newRole._id,
        roleName: newRole.roleName,
      });
    }

    if (assignedEmployeeIds.length > 0) {
      await StoreEmployee.updateMany(
        { _id: { $in: assignedEmployeeIds } },
        { $set: { roleId: newRole._id, roleName: newRole.roleName } }
      );
    }

    const populatedRole = await Role.findById(newRole._id)
      .populate('subAdmin', 'employeeName designation email')
      .populate('store', 'name storeCode location')
      .populate('storeEmployee', 'name designation email mobile userId')
      .populate('storeEmployees', 'name designation email mobile userId')
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
    const {
      roleName,
      roleCategory,
      subAdmin,
      store,
      storeId,
      storeEmployee,
      storeEmployeeId,
      employeeId,
      storeEmployees,
      description,
      permissions,
    } = req.body;

    const role = await Role.findOne({ _id: id, isDeleted: false });
    if (!role) {
      return next(notFound('Role not found'));
    }

    if (roleName !== undefined) role.roleName = roleName.trim();
    if (roleCategory !== undefined) role.roleCategory = roleCategory;
    if (subAdmin !== undefined) role.subAdmin = subAdmin || null;
    if (store !== undefined || storeId !== undefined) role.store = store || storeId || null;

    const assignedEmployeeId = storeEmployee || storeEmployeeId || employeeId;
    if (assignedEmployeeId !== undefined) {
      role.storeEmployee = assignedEmployeeId || null;
    }

    if (storeEmployees !== undefined) {
      role.storeEmployees = Array.isArray(storeEmployees) ? storeEmployees : [];
    }

    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();

    // Sync subAdmin if provided
    const targetSubAdminId = subAdmin !== undefined ? (subAdmin || null) : role.subAdmin;
    if (targetSubAdminId) {
      await SubAdmin.findByIdAndUpdate(targetSubAdminId, { roleId: role._id });
      await Role.updateMany(
        { subAdmin: targetSubAdminId, _id: { $ne: role._id } },
        { $set: { subAdmin: null } }
      );
    }

    // Sync storeEmployee if provided
    const targetEmployeeId = role.storeEmployee;
    if (targetEmployeeId) {
      await StoreEmployee.findByIdAndUpdate(targetEmployeeId, {
        roleId: role._id,
        roleName: role.roleName,
      });
    }

    if (Array.isArray(role.storeEmployees) && role.storeEmployees.length > 0) {
      await StoreEmployee.updateMany(
        { _id: { $in: role.storeEmployees } },
        { $set: { roleId: role._id, roleName: role.roleName } }
      );
    }

    const updatedRole = await Role.findById(role._id)
      .populate('subAdmin', 'employeeName designation email')
      .populate('store', 'name storeCode location')
      .populate('storeEmployee', 'name designation email mobile userId')
      .populate('storeEmployees', 'name designation email mobile userId')
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

    // Clear roleId from any assigned StoreEmployees or SubAdmins
    await Promise.all([
      StoreEmployee.updateMany({ roleId: role._id }, { $set: { roleId: null, roleName: null } }),
      SubAdmin.updateMany({ roleId: role._id }, { $set: { roleId: null } }),
    ]);

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
 * 7. Get active Store Employees dropdown list (for Store role category selection)
 * GET /api/admin/roles-and-permissions/store-employees-dropdown?storeId=...
 */
export const getStoreEmployeesDropdown = async (req, res, next) => {
  try {
    const { storeId } = req.query;
    const filter = { isDeleted: false };
    if (storeId && storeId !== 'all' && storeId !== 'All') {
      filter.storeId = storeId;
    }

    const employees = await StoreEmployee.find(filter)
      .populate('storeId', 'name storeCode location')
      .select('name designation email mobile userId storeId roleId roleName')
      .sort({ name: 1 })
      .lean();

    const formattedList = employees.map((emp) => ({
      id: emp._id,
      _id: emp._id,
      name: emp.name,
      employeeName: emp.name,
      designation: emp.designation,
      email: emp.email,
      mobile: emp.mobile,
      userId: emp.userId,
      storeId: emp.storeId?._id || emp.storeId,
      storeName: emp.storeId?.name || '',
      roleId: emp.roleId || null,
      roleName: emp.roleName || null,
      label: `${emp.name} (${emp.designation}) — ${emp.storeId?.name || 'Store'}`,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Store employees dropdown fetched successfully',
        data: {
          employees: formattedList,
          storeEmployees: formattedList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 8. Get active Stores dropdown list (for Store selection in Add Role)
 * GET /api/admin/roles-and-permissions/stores-dropdown
 */
export const getStoresDropdown = async (_req, res, next) => {
  try {
    const stores = await Store.find({ isDeleted: false })
      .select('_id name storeCode location mobile email')
      .sort({ name: 1 })
      .lean();

    const formattedList = stores.map((s) => ({
      id: s._id,
      _id: s._id,
      name: s.name,
      storeName: s.name,
      storeCode: s.storeCode,
      location: s.location || '',
      value: s._id.toString(),
      mobile: s.mobile || '',
      email: s.email || '',
      city: s.city || '',
      label: `${s.name} (${s.storeCode || 'Code'})`,
    }));

    return res.status(200).json(
      successResponse({
        message: 'Stores dropdown fetched successfully',
        data: {
          stores: formattedList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 9. Get default modules and permissions schema tree for form setup
 * GET /api/admin/roles-and-permissions/modules-schema?category=Store|Sub-admin
 */
export const getModulesSchema = async (req, res, next) => {
  try {
    const category = req.query.category || req.query.roleCategory || 'Sub-admin';

    // If Store category is requested, return the 8 modules present in Store Dashboard
    if (category.toLowerCase() === 'store') {
      const storeModulesSchema = {
        dashboard: { name: 'Dashboard', actions: ['viewOnly'] },
        customers: { name: 'Customer Management', actions: ['viewOnly', 'create', 'modify', 'delete'] },
        billing: { name: 'Billing & Returns', actions: ['viewOnly', 'create', 'modify', 'delete'] },
        offlineSales: { name: 'Offline Sales', actions: ['viewOnly'] },
        onlineOrders: { name: 'Online Orders', actions: ['viewOnly', 'modifyStatus'] },
        productInventory: { name: 'Product Inventory', actions: ['viewOnly', 'create', 'modify', 'delete'] },
        offers: { name: 'Offer Management', actions: ['viewOnly', 'create', 'modify', 'delete'] },
        reports: { name: 'Reports', actions: ['viewOnly'] },
      };

      return res.status(200).json(
        successResponse({
          message: 'Store modules permissions schema fetched successfully',
          data: {
            category: 'Store',
            modules: STORE_MODULES,
            modulesSchema: storeModulesSchema,
          },
        })
      );
    }

    // Default: Admin modules schema (22 modules)
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
          category: 'Sub-admin',
          modules: DEFAULT_MODULES,
          modulesSchema,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
