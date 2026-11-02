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

  const makeOrder = (orderId, storeId, total, date, paymentsList) => {
    return {
      orderId,
      store: storeId,
      orderStatus: 'Completed',
      customer: {
        name: 'Walk-in Customer',
        phone: '9876543210',
      },
      totalOrderNet: total,
      totalOrderPaid: total,
      payments: paymentsList,
      bills: [
        {
          billId: `BILL_${orderId}`,
          saleType: 'Offline',
          subtotal: total,
          netAmount: total,
          paidAmount: total,
          paymentMethod: 'Split',
          payments: paymentsList,
          items: [
            {
              product: new mongoose.Types.ObjectId(),
              productName: 'Sample Item',
              quantity: 1,
              price: total,
              sellingPrice: total,
              totalAmount: total,
            },
          ],
        },
      ],
      createdAt: date,
    };
  };

  // Order 1: Store 1, created today, 500 cash, 1200 upi
  await StoreOrder.create(
    makeOrder('SODR10001', store1._id, 1700, now, [
      { mode: 'Cash', amount: 500 },
      { mode: 'UPI', amount: 1200 },
    ])
  );

  // Order 2: Store 1, created today, 300 cash, 200 card
  await StoreOrder.create(
    makeOrder('SODR10002', store1._id, 500, now, [
      { mode: 'Cash', amount: 300 },
      { mode: 'Card', amount: 200 },
    ])
  );

  // Order 3: Store 1, created 5 days ago, 1000 cash, 2000 upi
  await StoreOrder.create(
    makeOrder('SODR10003', store1._id, 3000, fiveDaysAgo, [
      { mode: 'Cash', amount: 1000 },
      { mode: 'UPI', amount: 2000 },
    ])
  );

  // Order 4: Store 2, created today, 400 cash, 600 upi
  await StoreOrder.create(
    makeOrder('SODR10004', store2._id, 1000, now, [
      { mode: 'Cash', amount: 400 },
      { mode: 'UPI', amount: 600 },
    ])
  );
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

  it('should filter orders list and display today card stats when isToday=true is provided', async () => {
    const res = await request(app)
      .get('/api/admin/orders/offline?isToday=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Order 3 (created 5 days ago) must be excluded from today orders list
    expect(res.body.pagination.totalItems).toBe(3);
    expect(res.body.data.length).toBe(3);
    const orderIds = res.body.data.map((o) => o.orderId);
    expect(orderIds).not.toContain('SODR10003');
    expect(orderIds).toContain('SODR10001');
    expect(orderIds).toContain('SODR10002');
    expect(orderIds).toContain('SODR10004');

    // Stats active cards show Today's figures
    expect(res.body.stats.isToday).toBe(true);
    expect(res.body.stats.totalCash).toBe(1200);
    expect(res.body.stats.totalUPI).toBe(1800);
    expect(res.body.stats.totalCard).toBe(200);
    expect(res.body.stats.allTimeCash).toBe(2200);
    expect(res.body.stats.allTimeUPI).toBe(3800);
  });
});
