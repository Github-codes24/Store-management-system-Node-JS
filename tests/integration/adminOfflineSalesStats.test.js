import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Store from '../../src/models/store.model.js';
import StoreOrder from '../../src/models/storeOrder.model.js';

let mongoServer;
let adminToken;
let store1;
let store2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Offline Sales Test Admin',
    email: 'admin.offline@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  store1 = await Store.create({
    storeCode: 'STR001',
    name: 'Om Maruti Mart',
    mobile: '9876543210',
    email: 'maruti@example.com',
    location: 'Area 1',
  });

  store2 = await Store.create({
    storeCode: 'STR002',
    name: 'Second Store',
    mobile: '9876543211',
    email: 'second@example.com',
    location: 'Area 2',
  });

  const now = new Date();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  // Order 1: Store 1, created today, 500 cash, 1200 upi
  await StoreOrder.create({
    orderId: 'SODR10001',
    store: store1._id,
    orderStatus: 'Completed',
    totalOrderNet: 1700,
    totalOrderPaid: 1700,
    payments: [
      { mode: 'cash', amount: 500 },
      { mode: 'upi', amount: 1200 },
    ],
    bills: [
      {
        billId: 'BILL10001',
        saleType: 'Offline',
        netAmount: 1700,
        paidAmount: 1700,
        payments: [
          { mode: 'cash', amount: 500 },
          { mode: 'upi', amount: 1200 },
        ],
      },
    ],
    createdAt: now,
  });

  // Order 2: Store 1, created today, 300 cash, 200 card
  await StoreOrder.create({
    orderId: 'SODR10002',
    store: store1._id,
    orderStatus: 'Completed',
    totalOrderNet: 500,
    totalOrderPaid: 500,
    payments: [
      { mode: 'cash', amount: 300 },
      { mode: 'card', amount: 200 },
    ],
    bills: [
      {
        billId: 'BILL10002',
        saleType: 'Offline',
        netAmount: 500,
        paidAmount: 500,
        payments: [
          { mode: 'cash', amount: 300 },
          { mode: 'card', amount: 200 },
        ],
      },
    ],
    createdAt: now,
  });

  // Order 3: Store 1, created 5 days ago, 1000 cash, 2000 upi
  await StoreOrder.create({
    orderId: 'SODR10003',
    store: store1._id,
    orderStatus: 'Completed',
    totalOrderNet: 3000,
    totalOrderPaid: 3000,
    payments: [
      { mode: 'cash', amount: 1000 },
      { mode: 'upi', amount: 2000 },
    ],
    bills: [
      {
        billId: 'BILL10003',
        saleType: 'Offline',
        netAmount: 3000,
        paidAmount: 3000,
        payments: [
          { mode: 'cash', amount: 1000 },
          { mode: 'upi', amount: 2000 },
        ],
      },
    ],
    createdAt: fiveDaysAgo,
  });

  // Order 4: Store 2, created today, 400 cash, 600 upi
  await StoreOrder.create({
    orderId: 'SODR10004',
    store: store2._id,
    orderStatus: 'Completed',
    totalOrderNet: 1000,
    totalOrderPaid: 1000,
    payments: [
      { mode: 'cash', amount: 400 },
      { mode: 'upi', amount: 600 },
    ],
    bills: [
      {
        billId: 'BILL10004',
        saleType: 'Offline',
        netAmount: 1000,
        paidAmount: 1000,
        payments: [
          { mode: 'cash', amount: 400 },
          { mode: 'upi', amount: 600 },
        ],
      },
    ],
    createdAt: now,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('GET /api/admin/orders/offline - Today Cash and Today UPI Stats', () => {
  it('should return total and today payment stats across all stores', async () => {
    const res = await request(app)
      .get('/api/admin/orders/offline')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toBeDefined();

    // Total Cash: Store 1 (500 + 300 + 1000) + Store 2 (400) = 2200
    expect(res.body.stats.totalCash).toBe(2200);
    // Total UPI: Store 1 (1200 + 2000) + Store 2 (600) = 3800
    expect(res.body.stats.totalUPI).toBe(3800);
    // Total Card: Store 1 (200) = 200
    expect(res.body.stats.totalCard).toBe(200);

    // Today Cash: Store 1 (500 + 300) + Store 2 (400) = 1200
    expect(res.body.stats.todayCash).toBe(1200);
    // Today UPI: Store 1 (1200) + Store 2 (600) = 1800
    expect(res.body.stats.todayUPI).toBe(1800);
    // Today Card: 200
    expect(res.body.stats.todayCard).toBe(200);

    // Also check todayStats object
    expect(res.body.todayStats).toBeDefined();
    expect(res.body.todayStats.todayCash).toBe(1200);
    expect(res.body.todayStats.todayUPI).toBe(1800);
  });

  it('should filter today and total stats when storeId is provided', async () => {
    const res = await request(app)
      .get(`/api/admin/orders/offline?storeId=${store1._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Total for Store 1: Cash = 1800, UPI = 3200, Card = 200
    expect(res.body.stats.totalCash).toBe(1800);
    expect(res.body.stats.totalUPI).toBe(3200);
    expect(res.body.stats.totalCard).toBe(200);

    // Today for Store 1: Cash = 800, UPI = 1200, Card = 200
    expect(res.body.stats.todayCash).toBe(800);
    expect(res.body.stats.todayUPI).toBe(1200);
    expect(res.body.stats.todayCard).toBe(200);
    expect(res.body.todayStats.todayCash).toBe(800);
    expect(res.body.todayStats.todayUPI).toBe(1200);
  });
});
