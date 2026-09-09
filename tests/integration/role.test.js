import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Role from '../../src/models/role.model.js';
import SubAdmin from '../../src/models/subAdmin.model.js';

let mongoServer;
let adminToken;
let testSubAdmin;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Role Test Admin',
    email: 'admin.role@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  testSubAdmin = await SubAdmin.create({
    employeeName: 'Clark Kent',
    designation: 'Warehouse Manager',
    mobile: '9876543210',
    email: 'clark.role@example.com',
    password: 'password123',
    status: 'active',
  });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Role.deleteMany({});
});

describe('Admin Roles & Permissions Integration Tests', () => {
  it('should reject unauthenticated requests to roles endpoints', async () => {
    const res1 = await request(app).get('/api/admin/roles-and-permissions');
    expect(res1.status).toBe(401);

    const res2 = await request(app).post('/api/admin/roles-and-permissions').send({ roleName: 'Manager' });
    expect(res2.status).toBe(401);
  });

  it('should fetch roles list and seed initial default roles when empty', async () => {
    const res = await request(app)
      .get('/api/admin/roles-and-permissions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.roles).toBeDefined();
    expect(res.body.data.roles.length).toBeGreaterThanOrEqual(5);

    const firstRole = res.body.data.roles[0];
    expect(firstRole.roleName).toBeDefined();
    expect(firstRole.permissionsSummary).toBeDefined();
  });

  it('should fetch subadmins dropdown list for sub-admin role category', async () => {
    const res = await request(app)
      .get('/api/admin/roles-and-permissions/subadmins-dropdown')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subAdmins).toBeDefined();
    expect(res.body.data.subAdmins.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.subAdmins[0].employeeName).toBe('Clark Kent');
  });

  it('should fetch modules permissions schema tree', async () => {
    const res = await request(app)
      .get('/api/admin/roles-and-permissions/modules-schema')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modules).toContain('sellProducts');
    expect(res.body.data.modulesSchema.sellProducts.actions).toContain('create');
  });

  it('should create a new role with custom permissions setup', async () => {
    const res = await request(app)
      .post('/api/admin/roles-and-permissions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleName: 'Senior Inventory Lead',
        roleCategory: 'Sub-admin',
        subAdmin: testSubAdmin._id.toString(),
        description: 'Manages warehouse inventory and stock movements.',
        permissions: {
          productStock: { viewOnly: true, create: true, delete: true },
          productPurchase: { viewOnly: true, create: true, modify: true },
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role.roleName).toBe('Senior Inventory Lead');
    expect(res.body.data.role.roleCategory).toBe('Sub-admin');
    expect(res.body.data.role.subAdmin.employeeName).toBe('Clark Kent');
    expect(res.body.data.role.permissions.productStock.create).toBe(true);
  });

  it('should fetch role details by ID', async () => {
    const role = await Role.create({
      roleName: 'Lead Cashier',
      roleCategory: 'Store',
      permissions: {
        offlineSales: { viewOnly: true },
      },
    });

    const res = await request(app)
      .get(`/api/admin/roles-and-permissions/${role._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role.roleName).toBe('Lead Cashier');
  });

  it('should update an existing role and its permissions', async () => {
    const role = await Role.create({
      roleName: 'Assistant Cashier',
      roleCategory: 'Store',
      permissions: {
        offlineSales: { viewOnly: true },
      },
    });

    const res = await request(app)
      .put(`/api/admin/roles-and-permissions/${role._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        roleName: 'Head Cashier',
        permissions: {
          offlineSales: { viewOnly: true },
          sellProducts: { viewOnly: true, create: true, modify: true },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role.roleName).toBe('Head Cashier');
    expect(res.body.data.role.permissions.sellProducts.modify).toBe(true);
  });

  it('should soft delete a role', async () => {
    const role = await Role.create({
      roleName: 'Temp Role',
      roleCategory: 'Store',
    });

    const res = await request(app)
      .delete(`/api/admin/roles-and-permissions/${role._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await Role.findById(role._id);
    expect(doc.isDeleted).toBe(true);
  });
});
