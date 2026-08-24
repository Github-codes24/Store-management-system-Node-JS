import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import SubAdmin from '../../src/models/subAdmin.model.js';

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Super Admin Test',
    email: 'admin.sub@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await SubAdmin.deleteMany({});
});

describe('Sub-Admin Management Integration Tests', () => {
  const subAdminData = {
    employeeName: 'Clark Kent',
    email: 'clark@example.com',
    mobile: '9876543210',
    designation: 'Warehouse Manager',
    address: '3517 W. Gray St',
    password: 'Store001@DOM',
  };

  it('should create a new Sub-Admin', async () => {
    const res = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subAdmin.employeeName).toBe('Clark Kent');
    expect(res.body.data.subAdmin.designation).toBe('Warehouse Manager');
    expect(res.body.data.subAdmin.password).toBeUndefined();
  });

  it('should return 400 for invalid designation enum', async () => {
    const res = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...subAdminData, designation: 'Invalid Designation' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 409 conflict when creating duplicate email or mobile', async () => {
    await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    const res = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should list sub-admins with search and designation filter', async () => {
    await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeName: 'Tony Stark',
        email: 'tony@example.com',
        mobile: '9876543211',
        designation: 'Cashier',
        password: 'password123',
      });

    const res = await request(app)
      .get('/api/admin/user-management/sub-admins?designation=Warehouse Manager')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subAdmins.length).toBe(1);
    expect(res.body.data.subAdmins[0].employeeName).toBe('Clark Kent');
  });

  it('should fetch sub-admin details by ID', async () => {
    const createRes = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    const id = createRes.body.data.subAdmin._id;

    const res = await request(app)
      .get(`/api/admin/user-management/sub-admins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subAdmin.employeeName).toBe('Clark Kent');
  });

  it('should update sub-admin details', async () => {
    const createRes = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    const id = createRes.body.data.subAdmin._id;

    const res = await request(app)
      .put(`/api/admin/user-management/sub-admins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeName: 'Clark Kent Updated',
        designation: 'Store Manager',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.subAdmin.employeeName).toBe('Clark Kent Updated');
    expect(res.body.data.subAdmin.designation).toBe('Store Manager');
  });

  it('should delete sub-admin', async () => {
    const createRes = await request(app)
      .post('/api/admin/user-management/sub-admins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(subAdminData);

    const id = createRes.body.data.subAdmin._id;

    const res = await request(app)
      .delete(`/api/admin/user-management/sub-admins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
