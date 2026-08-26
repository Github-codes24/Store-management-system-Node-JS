import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Admin from '../../src/models/admin.model.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Admin.deleteMany({});
});

describe('Admin Auth API Integration Tests', () => {
  const adminCredentials = {
    name: 'Test Admin',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
  };

  describe('POST /api/admin/auth/register', () => {
    it('should register a new admin successfully', async () => {
      const res = await request(app)
        .post('/api/admin/auth/register')
        .send(adminCredentials);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.email).toBe(adminCredentials.email.toLowerCase());
      expect(res.body.data.token).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should return 409 conflict when registering with duplicate email', async () => {
      await request(app).post('/api/admin/auth/register').send(adminCredentials);

      const res = await request(app)
        .post('/api/admin/auth/register')
        .send(adminCredentials);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 validation error for invalid data', async () => {
      const res = await request(app)
        .post('/api/admin/auth/register')
        .send({ name: 'Short', email: 'invalid-email', password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/admin/auth/register').send(adminCredentials);
    });

    it('should login successfully with valid credentials', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: adminCredentials.email,
          password: adminCredentials.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.admin.email).toBe(adminCredentials.email);
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: adminCredentials.email,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 if admin is inactive', async () => {
      await Admin.updateOne({ email: adminCredentials.email }, { status: 'inactive' });

      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: adminCredentials.email,
          password: adminCredentials.password,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/inactive|suspended/i);
    });
  });

  describe('POST /api/admin/auth/forgot-password, verify-otp, and reset-password flow', () => {
    beforeEach(async () => {
      await request(app).post('/api/admin/auth/register').send(adminCredentials);
    });

    it('should handle complete forgot password, verify OTP, and reset password flow', async () => {
      // 1. Forgot password
      const forgotRes = await request(app)
        .post('/api/admin/auth/forgot-password')
        .send({ email: adminCredentials.email });

      expect(forgotRes.status).toBe(200);
      expect(forgotRes.body.success).toBe(true);
      expect(forgotRes.body.data.otp).toBeDefined();

      // Inspect DB for OTP
      const dbAdmin = await Admin.findOne({ email: adminCredentials.email }).select('+resetOtp');
      expect(dbAdmin.resetOtp).toBeDefined();
      expect(forgotRes.body.data.otp).toBe(dbAdmin.resetOtp);
      const otp = dbAdmin.resetOtp;

      // 2. Verify OTP
      const verifyRes = await request(app)
        .post('/api/admin/auth/verify-otp')
        .send({ email: adminCredentials.email, otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.resetToken).toBeDefined();

      const resetToken = verifyRes.body.data.resetToken;

      // 3. Reset Password
      const newPassword = 'newSecretPassword123';
      const resetRes = await request(app)
        .post('/api/admin/auth/reset-password')
        .send({
          email: adminCredentials.email,
          resetToken,
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // 4. Verify login with new password
      const loginRes = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: adminCredentials.email,
          password: newPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should fail verify-otp with incorrect OTP', async () => {
      await request(app)
        .post('/api/admin/auth/forgot-password')
        .send({ email: adminCredentials.email });

      const res = await request(app)
        .post('/api/admin/auth/verify-otp')
        .send({ email: adminCredentials.email, otp: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/auth/me & POST /logout', () => {
    let token;

    beforeEach(async () => {
      const regRes = await request(app)
        .post('/api/admin/auth/register')
        .send(adminCredentials);
      token = regRes.body.data.token;
    });

    it('should return profile for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/admin/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.email).toBe(adminCredentials.email);
    });

    it('should return 401 when request is not authenticated', async () => {
      const res = await request(app).get('/api/admin/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should logout and clear adminToken cookie', async () => {
      const res = await request(app).post('/api/admin/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
