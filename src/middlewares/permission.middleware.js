import { forbidden } from '../utils/api-error.js';

/**
 * Middleware factory to enforce module-level permissions for SubAdmin accounts.
 * SuperAdmin & Admin accounts automatically bypass permission checks.
 *
 * @param {string} moduleName - Key in permissions object (e.g. 'productTypes', 'categories', 'productStock')
 * @param {string} actionRequired - Action key ('viewOnly', 'create', 'modify', 'delete', 'modifyStatus')
 */
export const requirePermission = (moduleName, actionRequired) => {
  return (req, _res, next) => {
    // SuperAdmin & Admin bypass restriction checks
    if (!req.isSubAdmin) {
      return next();
    }

    const permissions = req.permissions || {};
    const modulePerms = permissions[moduleName];

    if (!modulePerms) {
      return next(forbidden(`Access denied. You do not have permission to access '${moduleName}'.`));
    }

    const hasPermission = Boolean(modulePerms[actionRequired]);

    if (!hasPermission) {
      return next(
        forbidden(`Access denied. You do not have '${actionRequired}' permission for '${moduleName}'.`)
      );
    }

    next();
  };
};

export default requirePermission;
