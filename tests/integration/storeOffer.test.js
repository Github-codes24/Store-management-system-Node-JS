import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Offer from '../../src/models/offer.model.js';
import Store from '../../src/models/store.model.js';
import Customer from '../../src/models/customer.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';

let mongoServer;
let employeeToken;
let storeId;
let customerId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const store = await Store.create({
    storeCode: 'STORE_001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'store001@example.com',
  });
  storeId = store._id;

  await StoreEmployee.create({
    name: 'Store Manager John',
    email: 'john.manager@example.com',
    userId: 'EMP001',
    password: 'password123',
    mobile: '9876543210',
    designation: 'Store Manager',
    storeId: storeId,
  });

  const loginRes = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP001',
    password: 'password123',
  });

  employeeToken = loginRes.body.data.token;

  const customer = await Customer.create({
    name: 'Brooklyn Simmons',
    phone: '9876543210',
    email: 'brooklyn@example.com',
    storeId: storeId,
    totalPurchase: 18400,
    amountDue: 4000,
  });
  customerId = customer._id.toString();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Offer.deleteMany({});
});

describe('Store Panel Offers Integration Tests', () => {
  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/store-employee/offers');
    expect(res.status).toBe(401);
  });

  it('should fetch store offer form options with store-scoped customers', async () => {
    const res = await request(app)
      .get('/api/store-employee/offers/options')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBeGreaterThan(0);
    expect(res.body.data.customers[0].name).toBe('Brooklyn Simmons');
  });

  it('should create a new Store Offer from store panel', async () => {
    const res = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: '10% Store Discount',
        validFrom: '2026-09-01',
        validTo: '2026-12-31',
        discountType: 'percentage',
        discountValue: 10,
        sendToAllCustomers: false,
        targetCustomers: [customerId],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.name).toBe('10% Store Discount');
  });

  it('should list store offers', async () => {
    await Offer.create({
      name: 'Flat 50 Off',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
    });

    const res = await request(app)
      .get('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offers.length).toBe(1);
    expect(res.body.data.offers[0].name).toBe('Flat 50 Off');
  });

  it('should toggle store offer status', async () => {
    const created = await Offer.create({
      name: 'Status Toggle Offer',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
      status: 'active',
    });

    const res = await request(app)
      .patch(`/api/store-employee/offers/${created._id}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('should delete store offer', async () => {
    const created = await Offer.create({
      name: 'Delete Offer',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
    });

    const res = await request(app)
      .delete(`/api/store-employee/offers/${created._id}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
