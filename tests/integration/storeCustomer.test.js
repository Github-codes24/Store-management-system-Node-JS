import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Store from '../../src/models/store.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';
import Customer from '../../src/models/customer.model.js';

let mongoServer;
let store1, store2;
let employee1, employee2;
let token1, token2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create Store 1 & Store 2
  store1 = await Store.create({
    name: 'Downtown Store',
    storeCode: 'STORE001',
    mobile: '9876543201',
    email: 'downtown@store.com',
    location: 'Downtown City Center',
  });

  store2 = await Store.create({
    name: 'Uptown Store',
    storeCode: 'STORE002',
    mobile: '9876543202',
    email: 'uptown@store.com',
    location: 'Uptown Business Bay',
  });

  // Create Employee for Store 1
  employee1 = await StoreEmployee.create({
    name: 'John Doe',
    email: 'john@store1.com',
    userId: 'EMP001',
    password: 'password123',
    mobile: '9998887771',
    designation: 'Manager',
    storeId: store1._id,
  });

  // Create Employee for Store 2
  employee2 = await StoreEmployee.create({
    name: 'Jane Smith',
    email: 'jane@store2.com',
    userId: 'EMP002',
    password: 'password123',
    mobile: '9998887772',
    designation: 'Cashier',
    storeId: store2._id,
  });

  // Login Employee 1
  const login1 = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP001',
    password: 'password123',
  });
  token1 = login1.body.data.token;

  // Login Employee 2
  const login2 = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP002',
    password: 'password123',
  });
  token2 = login2.body.data.token;
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

describe('Store Panel Customer Management Integration Tests', () => {
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

  it('should create a customer bound to the logged-in employee store', async () => {
    const res = await request(app)
      .post('/api/store-employee/customers')
      .set('Authorization', `Bearer ${token1}`)
      .send(customerData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.name).toBe('Brooklyn Simmons');
    expect(res.body.data.customer.storeId).toBe(store1._id.toString());
  });

  it('should reject duplicate mobile number in the same store', async () => {
    await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .post('/api/store-employee/customers')
      .set('Authorization', `Bearer ${token1}`)
      .send(customerData);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists in this store');
  });

  it('should allow customer with same mobile number in a different store', async () => {
    await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .post('/api/store-employee/customers')
      .set('Authorization', `Bearer ${token2}`)
      .send(customerData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer.storeId).toBe(store2._id.toString());
  });

  it('should only return customers belonging to employee store', async () => {
    await Customer.create({ ...customerData, name: 'Store 1 Customer', storeId: store1._id });
    await Customer.create({ ...customerData, name: 'Store 2 Customer', phone: '9876543299', storeId: store2._id });

    const res = await request(app)
      .get('/api/store-employee/customers')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBe(1);
    expect(res.body.data.customers[0].name).toBe('Store 1 Customer');
  });

  it('should fetch store customer details with purchase summary & analytics', async () => {
    const created = await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .get(`/api/store-employee/customers/${created._id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customer._id).toBe(created._id.toString());
    expect(res.body.data.purchaseInformation.totalOrders).toBe(8);
    expect(res.body.data.purchaseInformation.totalBillAmount).toBe(18400);
    expect(res.body.data.purchaseInformation.totalDueAmount).toBe(4000);
  });

  it('should return 404 when accessing customer from another store', async () => {
    const created = await Customer.create({ ...customerData, storeId: store2._id });

    const res = await request(app)
      .get(`/api/store-employee/customers/${created._id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(404);
  });

  it('should update customer for the logged-in store', async () => {
    const created = await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .put(`/api/store-employee/customers/${created._id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ name: 'Brooklyn Simmons Updated', amountDue: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe('Brooklyn Simmons Updated');
    expect(res.body.data.customer.amountDue).toBe(2000);
  });

  it('should process due amount payment', async () => {
    const created = await Customer.create({ ...customerData, amountDue: 4000, storeId: store1._id });

    const res = await request(app)
      .post(`/api/store-employee/customers/${created._id}/pay-due`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ amount: 1500 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paidAmount).toBe(1500);
    expect(res.body.data.remainingDue).toBe(2500);
  });

  it('should export store customer list', async () => {
    await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .get('/api/store-employee/customers/export')
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBe(1);
  });

  it('should delete customer belonging to store', async () => {
    const created = await Customer.create({ ...customerData, storeId: store1._id });

    const res = await request(app)
      .delete(`/api/store-employee/customers/${created._id}`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await Customer.findById(created._id);
    expect(check).toBeNull();
  });
});
