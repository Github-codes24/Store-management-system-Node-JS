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

  it('should allow Cashier to scan barcode during billing', () => {
    const middleware = requireStorePermission('productInventory', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/barcode/8901234567890',
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

  it('should allow Cashier to search products for POS billing autocomplete', () => {
    const middleware = requireStorePermission('productInventory', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/',
      query: { search: 'Test' },
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

  it('should block Cashier from exporting inventory list', () => {
    const middleware = requireStorePermission('productInventory', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/export',
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

  it('should allow Cashier to fetch active offers for BOGO and billing discounts (GET /offers?status=active)', () => {
    const middleware = requireStorePermission('offers', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/',
      query: { status: 'active' },
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

  it('should allow Cashier to fetch applicable-offers endpoint', () => {
    const middleware = requireStorePermission('offers', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/applicable-offers',
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

  it('should block Cashier from general Offers management list (GET /offers without active)', () => {
    const middleware = requireStorePermission('offers', 'viewOnly');
    const req = {
      method: 'GET',
      path: '/',
      query: {},
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

  it('should allow Cashier to search and add walk-in customers at counter', () => {
    const getMiddleware = requireStorePermission('customers', 'viewOnly');
    const postMiddleware = requireStorePermission('customers', 'create');

    const reqGet = {
      method: 'GET',
      path: '/',
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };
    const reqPost = {
      method: 'POST',
      path: '/',
      isFullAccess: false,
      permissions: {
        billing: { viewOnly: true, create: true },
      },
    };

    const nextGet = jest.fn();
    const nextPost = jest.fn();

    getMiddleware(reqGet, {}, nextGet);
    postMiddleware(reqPost, {}, nextPost);

    expect(nextGet).toHaveBeenCalledWith();
    expect(nextPost).toHaveBeenCalledWith();
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

  it('should block Cashier from accessing Dashboard module', () => {
    const middleware = requireStorePermission('dashboard', 'viewOnly');
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
});
