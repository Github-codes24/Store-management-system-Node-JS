import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Settings from '../../src/models/settings.model.js';

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Settings Test Admin',
    email: 'admin.settings@example.com',
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
  await Settings.deleteMany({});
});

describe('Settings Management Integration Tests', () => {
  it('should reject unauthenticated requests with 401', async () => {
    const getRes = await request(app).get('/api/admin/settings');
    expect(getRes.status).toBe(401);

    const putRes = await request(app).put('/api/admin/settings').send({ deliveryRangeKm: 10 });
    expect(putRes.status).toBe(401);
  });

  it('should get default settings if none exist', async () => {
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.deliveryRangeKm).toBe(5);
    expect(res.body.data.settings.supportNumber).toBe('+91 9876543210');
    expect(res.body.data.settings.supportEmail).toBe('support@companyname.com');
  });

  it('should update delivery range, support number, and support email', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        deliveryRangeKm: 12,
        supportNumber: '+91 9988776655',
        supportEmail: 'help@companyname.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.settings.deliveryRangeKm).toBe(12);
    expect(res.body.data.settings.supportNumber).toBe('+91 9988776655');
    expect(res.body.data.settings.supportEmail).toBe('help@companyname.com');
  });

  it('should validate invalid email and negative delivery range', async () => {
    const invalidEmailRes = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supportEmail: 'not-an-email' });

    expect(invalidEmailRes.status).toBe(400);

    const negativeRangeRes = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryRangeKm: -5 });

    expect(negativeRangeRes.status).toBe(400);
  });
});
