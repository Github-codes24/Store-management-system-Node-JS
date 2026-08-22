import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Customer from '../../src/models/customer.model.js';

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Customer Test Admin',
    email: 'admin.cust@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Customer.deleteMany({});
});

describe('Customer Management Integration Tests', () => {
  const customerData = {
    name: 'Brooklyn Simmons',
    email: 'brooklyn@example.com',
    phone: '9876543210',
    dateOfBirth: '1990-09-11',
    address: '3517 W. Gray St',
    totalPurchase: 18400,
    amountDue: 4000,
    totalOrders: 8,
    totalStoreVisits: 6,
  };

  it('should create a new customer', async () => {
    const res = await request(app)
      .post('/api/admin/user-management/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(customerData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.name).toBe('Brooklyn Simmons');
    expect(res.body.data.customer.phone).toBe('9876543210');
  });

  it('should return 409 when creating customer with duplicate mobile number', async () => {
    await Customer.create(customerData);

    const res = await request(app)
      .post('/api/admin/user-management/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(customerData);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should list customers with search and pagination', async () => {
    await Customer.create(customerData);
    await Customer.create({ name: 'Guy Hawkins', phone: '9876543211', email: 'guy@example.com' });

    const res = await request(app)
      .get('/api/admin/user-management/customers?search=Brooklyn')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBe(1);
    expect(res.body.data.customers[0].name).toBe('Brooklyn Simmons');
  });

  it('should fetch customer details with purchase summary & analytics', async () => {
    const created = await Customer.create(customerData);

    const res = await request(app)
      .get(`/api/admin/user-management/customers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer._id).toBe(created._id.toString());
    expect(res.body.data.purchaseInformation.totalOrders).toBe(8);
    expect(res.body.data.purchaseInformation.totalBillAmount).toBe(18400);
    expect(res.body.data.purchaseInformation.totalDueAmount).toBe(4000);
    expect(res.body.data.spentChart).toBeDefined();
    expect(res.body.data.topPurchasedProducts.length).toBeGreaterThan(0);
  });

  it('should update customer details', async () => {
    const created = await Customer.create(customerData);

    const res = await request(app)
      .put(`/api/admin/user-management/customers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Brooklyn Simmons Updated', address: 'New Address 123' });

    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('Brooklyn Simmons Updated');
    expect(res.body.data.customer.address).toBe('New Address 123');
  });

  it('should delete customer', async () => {
    const created = await Customer.create(customerData);

    const res = await request(app)
      .delete(`/api/admin/user-management/customers/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should export customer list', async () => {
    await Customer.create(customerData);

    const res = await request(app)
      .get('/api/admin/user-management/customers/export')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBe(1);
    expect(res.body.data.customers[0].srNo).toBe(1);
  });
});
