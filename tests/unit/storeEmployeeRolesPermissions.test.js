import { jest } from '@jest/globals';
import { requireStorePermission } from '../../src/middlewares/storePermission.middleware.js';

describe('Store Employee Roles & Permissions Unit Tests', () => {
  it('should allow unassigned employee through requireStorePermission middleware without restrictions', () => {
    const middleware = requireStorePermission('billing', 'viewOnly');
    const req = {
      isFullAccess: true,
      permissions: {},
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should allow restricted employee (Cashier) to access billing', () => {
    const middleware = requireStorePermission('billing', 'viewOnly');
    const req = {
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true, modify: true },
      },
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should allow restricted employee (Cashier) to search/lookup products during billing', () => {
    const middleware = requireStorePermission('productInventory', 'viewOnly');
    const req = {
      method: 'GET',
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should block Cashier from mutating inventory (POST /products)', () => {
    const middleware = requireStorePermission('productInventory', 'create');
    const req = {
      method: 'POST',
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };
    const res = {};
    let errorPassed = null;
    const next = jest.fn((err) => {
      errorPassed = err;
    });

    middleware(req, res, next);
    expect(errorPassed).toBeDefined();
    expect(errorPassed.status).toBe(403);
    expect(errorPassed.message).toContain('Access denied');
  });

  it('should block Cashier from accessing Reports module', () => {
    const middleware = requireStorePermission('reports', 'viewOnly');
    const req = {
      method: 'GET',
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };
    const res = {};
    let errorPassed = null;
    const next = jest.fn((err) => {
      errorPassed = err;
    });

    middleware(req, res, next);
    expect(errorPassed).toBeDefined();
    expect(errorPassed.status).toBe(403);
  });

  it('should block Cashier from accessing Offers module', () => {
    const middleware = requireStorePermission('offers', 'viewOnly');
    const req = {
      method: 'GET',
      isFullAccess: false,
      path: '/offers',
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };
    const res = {};
    let errorPassed = null;
    const next = jest.fn((err) => {
      errorPassed = err;
    });

    middleware(req, res, next);
    expect(errorPassed).toBeDefined();
    expect(errorPassed.status).toBe(403);
  });
});
