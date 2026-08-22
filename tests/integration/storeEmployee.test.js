import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Admin from '../../src/models/admin.model.js';
import Store from '../../src/models/store.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';

let mongoServer;
let adminToken;
let sampleStoreId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Register admin to get JWT auth token
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Test Admin',
    email: 'admin.emp@example.com',
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
  await Store.deleteMany({});
  await StoreEmployee.deleteMany({});

  const store = await Store.create({
    storeCode: 'ST001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'dcm@example.com',
    location: 'Central Mall',
  });
  sampleStoreId = store._id.toString();
});

describe('Store Employee API Integration Tests', () => {
  const sampleEmployeeData = {
    name: 'Clark Kent',
    designation: 'Manager',
    storeId: '',
    mobile: '9876543210',
    email: 'clark@example.com',
    address: '1901 Thornridge Cir, Shiloh, Hawaii 81063',
    userId: 'Clark_Kent',
    password: 'Store001@DCM',
  };

  describe('Admin Operations (/api/admin/store-employees)', () => {
    it('should create a new Store Employee successfully and return decrypted password', async () => {
      const payload = { ...sampleEmployeeData, storeId: sampleStoreId };

      const res = await request(app)
        .post('/api/admin/store-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Clark Kent');
      expect(res.body.data.userId).toBe('Clark_Kent');
      expect(res.body.data.password).toBe('Store001@DCM'); // Plain text decrypted password for admin view
      expect(res.body.data.storeId.name).toBe('Daily Choice Mart');
    });

    it('should fail with 409 conflict when creating duplicate email or userId', async () => {
      const payload = { ...sampleEmployeeData, storeId: sampleStoreId };

      await request(app)
        .post('/api/admin/store-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      // Duplicate Email
      const dupEmailRes = await request(app)
        .post('/api/admin/store-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...payload, userId: 'Clark_Kent_2' });

      expect(dupEmailRes.status).toBe(409);
      expect(dupEmailRes.body.success).toBe(false);

      // Duplicate User ID
      const dupUserRes = await request(app)
        .post('/api/admin/store-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...payload, email: 'clark2@example.com' });

      expect(dupUserRes.status).toBe(409);
      expect(dupUserRes.body.success).toBe(false);
    });

    it('should list store employees with pagination and filters', async () => {
      await StoreEmployee.create({
        ...sampleEmployeeData,
        storeId: sampleStoreId,
      });

      const store2 = await Store.create({
        storeCode: 'ST002',
        name: 'Family Basket Store',
        mobile: '9876543211',
        email: 'fbs@example.com',
      });

      await StoreEmployee.create({
        name: 'Tony Stark',
        designation: 'Cashier',
        storeId: store2._id,
        mobile: '9876543211',
        email: 'tony@example.com',
        userId: 'Tony_Stark',
        password: 'Password123',
      });

      // Filter by designation
      const desigRes = await request(app)
        .get('/api/admin/store-employees?designation=Cashier')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(desigRes.status).toBe(200);
      expect(desigRes.body.data.length).toBe(1);
      expect(desigRes.body.data[0].name).toBe('Tony Stark');
      expect(desigRes.body.data[0].store).toBe('Family Basket Store');

      // Filter by search query
      const searchRes = await request(app)
        .get('/api/admin/store-employees?search=Clark')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(searchRes.status).toBe(200);
      expect(searchRes.body.data.length).toBe(1);
      expect(searchRes.body.data[0].name).toBe('Clark Kent');
      expect(searchRes.body.data[0].store).toBe('Daily Choice Mart');
      expect(searchRes.body.data[0].password).toBe('Store001@DCM');
    });

    it('should get store employee details by ID with decrypted password', async () => {
      const emp = await StoreEmployee.create({
        ...sampleEmployeeData,
        storeId: sampleStoreId,
      });

      const res = await request(app)
        .get(`/api/admin/store-employees/${emp._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Clark Kent');
      expect(res.body.data.password).toBe('Store001@DCM');
      expect(res.body.data.store).toBe('Daily Choice Mart');
    });

    it('should update store employee details', async () => {
      const emp = await StoreEmployee.create({
        ...sampleEmployeeData,
        storeId: sampleStoreId,
      });

      const res = await request(app)
        .put(`/api/admin/store-employees/${emp._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Clark Kent Updated',
          designation: 'Senior Manager',
          password: 'NewPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Clark Kent Updated');
      expect(res.body.data.designation).toBe('Senior Manager');
      expect(res.body.data.password).toBe('NewPassword123');
    });

    it('should soft delete store employee', async () => {
      const emp = await StoreEmployee.create({
        ...sampleEmployeeData,
        storeId: sampleStoreId,
      });

      const delRes = await request(app)
        .delete(`/api/admin/store-employees/${emp._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);

      const getRes = await request(app)
        .get(`/api/admin/store-employees/${emp._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(404);
    });

    it('should return stores dropdown list formatted with label and value', async () => {
      const res = await request(app)
        .get('/api/admin/stores/dropdown')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('label');
      expect(res.body.data[0]).toHaveProperty('value');
      expect(res.body.data[0].label).toBe('Daily Choice Mart');
      expect(res.body.data[0].value).toBe(sampleStoreId);
    });

    it('should return designations dropdown list formatted with label and value', async () => {
      const res = await request(app)
        .get('/api/admin/store-employees/designations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0]).toHaveProperty('label');
      expect(res.body.data[0]).toHaveProperty('value');
      expect(res.body.data[0].label).toBe('Manager');
      expect(res.body.data[0].value).toBe('Manager');
    });
  });

  describe('Store Employee Authentication (/api/store-employee)', () => {
    beforeEach(async () => {
      await StoreEmployee.create({
        ...sampleEmployeeData,
        storeId: sampleStoreId,
      });
    });

    it('should login store employee with User ID and plain text password', async () => {
      const res = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: 'Store001@DCM',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.storeEmployee.email).toBe('clark@example.com');
      expect(res.body.data.storeEmployee.password).toBeUndefined(); // Employee login response excludes password
    });

    it('should fail login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should get authenticated employee profile', async () => {
      const loginRes = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: 'Store001@DCM',
        });

      const empToken = loginRes.body.data.token;

      const profileRes = await request(app)
        .get('/api/store-employee/profile')
        .set('Authorization', `Bearer ${empToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.data.storeEmployee.name).toBe('Clark Kent');
      expect(profileRes.body.data.storeEmployee.storeId.name).toBe('Daily Choice Mart');
    });

    it('should handle complete forgot password, verify OTP, and reset password flow', async () => {
      // 1. Request forgot password
      const forgotRes = await request(app)
        .post('/api/store-employee/auth/forgot-password')
        .send({ email: 'clark@example.com' });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.message).toMatch(/4-digit OTP/i);
      expect(forgotRes.body.data.otp).toBeDefined();

      // Fetch generated OTP from database
      const empWithOtp = await StoreEmployee.findOne({ email: 'clark@example.com' }).select('+resetOtp');
      expect(empWithOtp.resetOtp).toBeDefined();
      expect(empWithOtp.resetOtp.length).toBe(4);

      // 2. Resend OTP
      const resendRes = await request(app)
        .post('/api/store-employee/auth/resend-otp')
        .send({ email: 'clark@example.com' });

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.success).toBe(true);
      expect(resendRes.body.data.otp).toBeDefined();

      const empWithResentOtp = await StoreEmployee.findOne({ email: 'clark@example.com' }).select('+resetOtp');
      const otp = empWithResentOtp.resetOtp;

      // 3. Verify OTP
      const verifyRes = await request(app)
        .post('/api/store-employee/auth/verify-otp')
        .send({ email: 'clark@example.com', otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.resetToken).toBeDefined();

      const resetToken = verifyRes.body.data.resetToken;

      // 4. Reset Password
      const newPassword = 'BrandNewPassword123';
      const resetRes = await request(app)
        .post('/api/store-employee/auth/reset-password')
        .send({
          email: 'clark@example.com',
          resetToken,
          newPassword,
          confirmPassword: newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 5. Verify login with new password
      const loginRes = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: newPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should change password for authenticated store employee', async () => {
      const loginRes = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: 'Store001@DCM',
        });

      const empToken = loginRes.body.data.token;

      const changeRes = await request(app)
        .post('/api/store-employee/profile/change-password')
        .set('Authorization', `Bearer ${empToken}`)
        .send({
          oldPassword: 'Store001@DCM',
          newPassword: 'UpdatedSecretPassword123',
          confirmPassword: 'UpdatedSecretPassword123',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Verify login with updated secret password
      const newLoginRes = await request(app)
        .post('/api/store-employee/auth/login')
        .send({
          userId: 'Clark_Kent',
          password: 'UpdatedSecretPassword123',
        });

      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
    });
  });
});
