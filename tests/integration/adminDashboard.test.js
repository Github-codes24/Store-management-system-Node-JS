import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Store from '../../src/models/store.model.js';
import StoreOrder from '../../src/models/storeOrder.model.js';
import SellProduct from '../../src/models/sellProduct.model.js';
import Customer from '../../src/models/customer.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import Unit from '../../src/models/unit.model.js';
import Admin from '../../src/models/admin.model.js';

let mongoServer;
let adminToken;
let testStore;
let adminId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Dashboard Admin',
    email: 'admin.dashboard@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;
  const adminDoc = await Admin.findOne({ email: 'admin.dashboard@example.com' });
  adminId = adminDoc._id;

  testStore = await Store.create({
    storeCode: 'DASH_STR_01',
    name: 'Dashboard Test Store',
    mobile: '9876543210',
    email: 'dashboard.store@example.com',
  });

  const pt = await ProductType.create({ name: 'Groceries' });
  const cat = await Category.create({ name: 'Snacks', productType: pt._id });
  const subcat = await Subcategory.create({ name: 'Cookies', category: cat._id, productType: pt._id });
  const brand = await Brand.create({ name: 'Parle' });
  const unit = await Unit.create({ name: 'Packet', shortName: 'pkt' });

  const adminProd = await AdminProduct.create({
    barcode: 'ADM_DASH_001',
    productName: 'Biscuits',
    productType: pt._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    purchasePrice: 30,
    offlineSellingPrice: 45,
    onlineSellingPrice: 45,
    mrp: 50,
  });

  const storeProd = await StoreProduct.create({
    barcode: 'STR_DASH_001',
    productName: 'Biscuits Store',
    productType: pt._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    stockQuantity: 50,
    mrp: 50,
    offlineSellingPrice: 45,
    onlineSellingPrice: 45,
    purchasePrice: 35,
    storeId: testStore._id,
  });

  await Customer.create({
    name: 'Alice Wonder',
    phone: '9876512345',
    email: 'alice@example.com',
    storeId: testStore._id,
  });

  // Yesterday's date
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Store order from yesterday (1000 INR)
  const oldOrder = new StoreOrder({
    orderId: 'ORD-OLD-01',
    store: testStore._id,
    customer: { name: 'Alice Wonder', phone: '9876512345' },
    totalOrderNet: 1000,
    orderStatus: 'Completed',
    createdAt: yesterday,
    updatedAt: yesterday,
  });
  await oldOrder.save();

  // Store order from TODAY (500 INR)
  const todayOrder = new StoreOrder({
    orderId: 'ORD-TODAY-01',
    store: testStore._id,
    customer: { name: 'Alice Wonder', phone: '9876512345' },
    totalOrderNet: 500,
    orderStatus: 'Completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await todayOrder.save();

  // SellProduct invoice from TODAY (300 INR)
  await SellProduct.create({
    sellId: 'SELL-TODAY-01',
    billDate: new Date(),
    saleType: 'Own Store',
    store: testStore._id,
    items: [
      {
        product: adminProd._id,
        productName: 'Biscuits',
        mrp: 50,
        sellingPrice: 45,
        quantity: 2,
        unit: unit._id,
        totalAmount: 90,
      },
    ],
    totalItems: 1,
    grossAmount: 90,
    savings: 10,
    gstAmount: 10,
    netAmount: 300,
    createdBy: adminId,
    status: 'Completed',
  });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Admin Dashboard Today Earning Integration Tests', () => {
  it('should reject unauthenticated request to /stats and /overview with 401', async () => {
    const resStats = await request(app).get('/api/admin/dashboard/stats');
    expect(resStats.status).toBe(401);

    const resOverview = await request(app).get('/api/admin/dashboard/overview');
    expect(resOverview.status).toBe(401);
  });

  it('should include todayEarning and todayRevenue in /stats endpoint', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    // Formatted stats
    expect(data).toHaveProperty('todayEarning');
    expect(data).toHaveProperty('todayRevenue');
    expect(data).toHaveProperty('revenue');

    // Total revenue is 1000 (old) + 500 (today order) + 300 (today sell product) = 1800
    // Today's earning is 500 (today order) + 300 (today sell product) = 800
    expect(data.todayEarning).toBe('₹ 800');
    expect(data.todayRevenue).toBe('₹ 800');
    expect(data.revenue).toBe('₹ 1,800');

    // Raw stats
    expect(data.rawStats).toHaveProperty('todayEarning');
    expect(data.rawStats).toHaveProperty('todayRevenue');
    expect(data.rawStats.todayEarning).toBe(800);
    expect(data.rawStats.todayRevenue).toBe(800);
    expect(data.rawStats.revenue).toBe(1800);
  });

  it('should include todayEarning and todayRevenue in /overview endpoint', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard/overview')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toHaveProperty('todayEarning');
    expect(data).toHaveProperty('todayRevenue');
    expect(data.todayEarning).toBe('₹ 800');
    expect(data.todayRevenue).toBe('₹ 800');
    expect(data.rawStats.todayEarning).toBe(800);
    expect(data.rawStats.todayRevenue).toBe(800);
    expect(data).toHaveProperty('charts');
    expect(data).toHaveProperty('activities');
  });
});
