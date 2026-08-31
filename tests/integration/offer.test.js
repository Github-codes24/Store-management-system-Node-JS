import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Offer from '../../src/models/offer.model.js';
import Store from '../../src/models/store.model.js';
import Customer from '../../src/models/customer.model.js';

let mongoServer;
let adminToken;
let storeId;
let customerId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Offer Test Admin',
    email: 'admin.offer@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  const store = await Store.create({
    storeCode: 'ST-001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'dailychoice@example.com',
  });
  storeId = store._id.toString();

  const customer = await Customer.create({
    name: 'Brooklyn Simmons',
    phone: '9876543210',
    email: 'brooklyn@example.com',
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

describe('Offers Management Integration Tests', () => {
  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/offers-and-tax-management/offers');
    expect(res.status).toBe(401);
  });

  it('should fetch offer form options (stores, customers, products)', async () => {
    const res = await request(app)
      .get('/api/admin/offers-and-tax-management/offers/options')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stores.length).toBeGreaterThan(0);
    expect(res.body.data.customers.length).toBeGreaterThan(0);
  });

  it('should create a new Store-Wide Offer', async () => {
    const res = await request(app)
      .post('/api/admin/offers-and-tax-management/offers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '5 % Discount On All Products',
        description: 'Special store wide offer',
        offerType: 'store_wide',
        offersOn: 'both',
        stores: [storeId],
        applyToAllStores: false,
        validFrom: '2026-08-01',
        validTo: '2026-12-31',
        discountType: 'percentage',
        discountValue: 5,
        appliesTo: 'all',
        sendToAllCustomers: true,
        targetCustomers: [customerId],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.name).toBe('5 % Discount On All Products');
    expect(res.body.data.offer.discountValue).toBe(5);
  });

  it('should list offers with search and pagination', async () => {
    await Offer.create({
      name: 'Flat 120 off on Jeans',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 120,
    });

    const res = await request(app)
      .get('/api/admin/offers-and-tax-management/offers?search=Jeans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offers.length).toBe(1);
    expect(res.body.data.offers[0].name).toBe('Flat 120 off on Jeans');
  });

  it('should fetch offer details by ID', async () => {
    const created = await Offer.create({
      name: '10% Discount on Grocery Products',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'percentage',
      discountValue: 10,
    });

    const res = await request(app)
      .get(`/api/admin/offers-and-tax-management/offers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.name).toBe('10% Discount on Grocery Products');
  });

  it('should update offer details', async () => {
    const created = await Offer.create({
      name: 'Flat 100 off on Shirts',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 100,
    });

    const res = await request(app)
      .put(`/api/admin/offers-and-tax-management/offers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ discountValue: 150 });

    expect(res.status).toBe(200);
    expect(res.body.data.offer.discountValue).toBe(150);
  });

  it('should toggle offer status (active/inactive)', async () => {
    const created = await Offer.create({
      name: 'Test Offer',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'percentage',
      discountValue: 5,
      status: 'active',
    });

    const res = await request(app)
      .patch(`/api/admin/offers-and-tax-management/offers/${created._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('should soft delete offer', async () => {
    const created = await Offer.create({
      name: 'Test Offer Delete',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'percentage',
      discountValue: 5,
    });

    const res = await request(app)
      .delete(`/api/admin/offers-and-tax-management/offers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbRecord = await Offer.findById(created._id);
    expect(dbRecord.isDeleted).toBe(true);
  });

  it('should export offers list dataset', async () => {
    await Offer.create({
      name: 'Export Test Offer',
      validFrom: new Date('2026-08-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'percentage',
      discountValue: 5,
    });

    const res = await request(app)
      .get('/api/admin/offers-and-tax-management/offers/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offers.length).toBe(1);
    expect(res.body.data.offers[0].srNo).toBe(1);
  });
});
