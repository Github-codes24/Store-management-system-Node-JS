import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../src/app.js';
import Admin from '../../src/models/admin.model.js';
import SubAdmin from '../../src/models/subAdmin.model.js';
import Role from '../../src/models/role.model.js';

let mongoServer;
let adminToken;
let subAdminToken;
let createdSubAdminId;
let createdRoleId;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 1. Register SuperAdmin account
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Super Admin',
    email: 'superadmin.perms@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('SubAdmin Authentication & Role Permissions Integration Tests', () => {
  it('1. should create a new SubAdmin user as SuperAdmin', async () => {
    const res = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeName: 'Inventory SubAdmin',
        email: 'subadmin.inv@example.com',
        mobile: '9876543210',
        password: 'subpassword123',
        designation: 'Warehouse Manager',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subAdmin._id).toBeDefined();
    createdSubAdminId = res.body.data.subAdmin._id;
  });

  it('2. should assign custom Role & Permissions matrix to the SubAdmin', async () => {
    const res = await request(app)
      .post('/api/admin/roles-and-permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleName: 'Warehouse SubAdmin Role',
        roleCategory: 'Sub-admin',
        subAdmin: createdSubAdminId,
        description: 'Role with viewOnly permission for productTypes and no create permission',
        permissions: {
          productTypes: {
            viewOnly: true,
            create: false,
            modify: false,
            delete: false,
            modifyStatus: false,
          },
          productStock: {
            viewOnly: true,
            create: true,
            modify: true,
            delete: false,
            modifyStatus: false,
          },
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role.subAdmin).toBeDefined();
    createdRoleId = res.body.data.role._id;
  });

  it('3. should log in as SubAdmin using /api/admin/auth/login and return token & permissions', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'subadmin.inv@example.com',
        password: 'subpassword123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.admin.isSubAdmin).toBe(true);
    expect(res.body.data.admin.permissions).toBeDefined();
    expect(res.body.data.admin.permissions.productTypes.viewOnly).toBe(true);
    expect(res.body.data.admin.permissions.productTypes.create).toBe(false);

    subAdminToken = res.body.data.token;
  });

  it('4. should fetch SubAdmin profile via GET /api/admin/auth/me and include assigned permissions matrix', async () => {
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${subAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.admin.isSubAdmin).toBe(true);
    expect(res.body.data.admin.permissions.productTypes).toBeDefined();
    expect(res.body.data.admin.permissions.productTypes.viewOnly).toBe(true);
  });

  it('5. should ALLOW SubAdmin to access GET /api/admin/product-management/product-types (viewOnly=true)', async () => {
    const res = await request(app)
      .get('/api/admin/product-management/product-types')
      .set('Authorization', `Bearer ${subAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('6. should REJECT SubAdmin with 403 Forbidden for POST /api/admin/product-management/product-types (create=false)', async () => {
    const res = await request(app)
      .post('/api/admin/product-management/product-types')
      .set('Authorization', `Bearer ${subAdminToken}`)
      .send({
        name: 'Forbidden Type',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/access denied|permission/i);
  });
});
