import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

import adminCmsRoutes from '../../src/routes/admin/adminCms.routes.js';
import settingsRouter from '../../src/routes/admin/settings.routes.js';
import customerCmsRoutes from '../../src/routes/customer/customerCms.routes.js';
import errorHandler from '../../src/middlewares/error.middleware.js';
import Admin from '../../src/models/admin.model.js';
import Customer from '../../src/models/customer.model.js';
import env from '../../src/config/env.js';

let mongoServer;
let app;
let adminToken;
let customerToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = express();
  app.use(express.json());

  // Mount Admin routes
  app.use('/api/admin/cms', adminCmsRoutes);
  app.use('/api/admin/settings', settingsRouter);

  // Mount Customer routes
  app.use('/api/customer/cms', customerCmsRoutes);

  app.use(errorHandler);

  // Create Test Admin
  const admin = await Admin.create({
    name: 'Admin Test',
    email: 'admin.test@example.com',
    password: 'password123',
    role: 'super_admin',
  });

  adminToken = jwt.sign(
    { id: admin._id, email: admin.email, role: admin.role },
    env.ADMIN_JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Create Test Customer
  const customer = await Customer.create({
    name: 'Customer Test',
    phone: '9876543210',
  });

  customerToken = jwt.sign(
    { id: customer._id, phone: customer.phone, role: 'customer' },
    env.CUSTOMER_JWT_SECRET,
    { expiresIn: '1h' }
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('CMS Pages & Help/Support Settings APIs Integration Tests', () => {
  test('1. GET /api/customer/cms/support returns default Help & Support contact info', async () => {
    const res = await request(app)
      .get('/api/customer/cms/support')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.supportNumber).toBe('+91 9876543210');
    expect(res.body.data.supportEmail).toBe('support@companyname.com');
    expect(res.body.data.callActionUrl).toBe('tel:+919876543210');
    expect(res.body.data.emailActionUrl).toBe('mailto:support@companyname.com');
  });

  test('2. Admin updates support info via PUT /api/admin/settings', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supportNumber: '+91 9998887770',
        supportEmail: 'care@apnamart.com',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.supportNumber).toBe('+91 9998887770');
    expect(res.body.data.settings.supportEmail).toBe('care@apnamart.com');
  });

  test('3. GET /api/customer/cms/support returns updated support info', async () => {
    const res = await request(app)
      .get('/api/customer/cms/support')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.supportNumber).toBe('+91 9998887770');
    expect(res.body.data.supportEmail).toBe('care@apnamart.com');
  });

  test('4. GET /api/customer/cms/terms-and-conditions returns default Terms & Conditions template', async () => {
    const res = await request(app)
      .get('/api/customer/cms/terms-and-conditions')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('terms-and-conditions');
    expect(res.body.data.title).toBe('Terms & Conditions');
    expect(res.body.data.effectiveDate).toBe('1st September, 2026');
    expect(res.body.data.content).toContain('Welcome to ApnaMart');
  });

  test('5. Admin updates Terms & Conditions via PUT /api/admin/cms/terms-and-conditions', async () => {
    const res = await request(app)
      .put('/api/admin/cms/terms-and-conditions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        effectiveDate: '15th October, 2026',
        content: '<p>Updated Terms & Conditions content for ApnaMart.</p>',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.page.effectiveDate).toBe('15th October, 2026');
    expect(res.body.data.page.content).toBe('<p>Updated Terms & Conditions content for ApnaMart.</p>');
  });

  test('6. GET /api/customer/cms/terms-and-conditions returns updated content', async () => {
    const res = await request(app)
      .get('/api/customer/cms/terms-and-conditions')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.effectiveDate).toBe('15th October, 2026');
    expect(res.body.data.content).toBe('<p>Updated Terms & Conditions content for ApnaMart.</p>');
  });

  test('7. GET /api/customer/cms/privacy-policy returns Privacy Policy', async () => {
    const res = await request(app)
      .get('/api/customer/cms/privacy-policy')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('privacy-policy');
    expect(res.body.data.title).toBe('Privacy Policy');
    expect(res.body.data.content).toContain('We value your privacy');
  });

  test('8. Admin updates Privacy Policy via PUT /api/admin/cms/privacy-policy', async () => {
    const res = await request(app)
      .put('/api/admin/cms/privacy-policy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        effectiveDate: '1st November, 2026',
        content: '<p>Updated Privacy Policy content.</p>',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.page.effectiveDate).toBe('1st November, 2026');
    expect(res.body.data.page.content).toBe('<p>Updated Privacy Policy content.</p>');
  });
});
