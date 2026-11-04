import { forbidden } from '../utils/api-error.js';

/**
 * Middleware factory to enforce module-level permissions for Store Employee accounts.
 * If employee has isFullAccess (e.g. no role assigned or unrestricted), automatically bypasses check.
 *
 * @param {string|string[]} moduleName - Module key (e.g. 'billing', 'customers', 'productInventory', 'offers', 'reports')
 * @param {string} actionRequired - Action key ('viewOnly', 'create', 'modify', 'delete', 'modifyStatus')
 */
export const requireStorePermission = (moduleName, actionRequired = 'viewOnly') => {
  return (req, _res, next) => {
    // Unrestricted / Full Access employees automatically bypass permission checks
    if (req.isFullAccess || !req.permissions) {
      return next();
    }

    const permissions = req.permissions || {};
    const modulesToCheck = Array.isArray(moduleName) ? moduleName : [moduleName];

    // Special allowance for POS Billing workflow:
    // If cashier has 'billing' permission, only allow barcode scanning and billing applicable offers
    const hasBillingPermission = Boolean(
      permissions.billing?.viewOnly ||
      permissions.billing?.create ||
      permissions.billing?.modify
    );

    if (hasBillingPermission && req.method === 'GET') {
      const isBarcodeScan =
        Boolean(req.path && req.path.includes('/barcode/')) ||
        Boolean(req.baseUrl && req.baseUrl.includes('/products') && req.path && req.path.includes('/barcode/'));

      const isApplicableOffers =
        Boolean(modulesToCheck.includes('offers') && req.path && (req.path.includes('applicable-offers') || req.path.includes('active')));

      if (isBarcodeScan || isApplicableOffers) {
        return next();
      }
    }

    let hasModuleAccess = false;

    for (const mod of modulesToCheck) {
      let modulePerms = permissions[mod];

      // Normalized fallback
      if (!modulePerms) {
        const targetLower = mod.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = Object.keys(permissions).find(
          (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === targetLower
        );
        if (foundKey) modulePerms = permissions[foundKey];
      }

      // Module-level aliases
      if (!modulePerms) {
        if (mod === 'billing' && permissions.offlineSales) modulePerms = permissions.offlineSales;
        if (mod === 'productInventory' && permissions.storeProducts) modulePerms = permissions.storeProducts;
        if (mod === 'offers' && permissions.offersManagement) modulePerms = permissions.offersManagement;
      }

      if (modulePerms) {
        // If actionRequired is viewOnly, check if ANY action or viewOnly is granted
        if (actionRequired === 'viewOnly') {
          if (modulePerms.viewOnly || modulePerms.create || modulePerms.modify || modulePerms.delete) {
            hasModuleAccess = true;
            break;
          }
        } else if (modulePerms[actionRequired]) {
          hasModuleAccess = true;
          break;
        }
      }
    }

    if (!hasModuleAccess) {
      return next(
        forbidden(
          `Access denied. You do not have permission to access '${Array.isArray(moduleName) ? moduleName.join('/') : moduleName}'.`
        )
      );
    }

    next();
  };
};

export default requireStorePermission;
