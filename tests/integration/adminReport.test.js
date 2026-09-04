import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Store from '../../src/models/store.model.js';
import StoreOrder from '../../src/models/storeOrder.model.js';
import SellProduct from '../../src/models/sellProduct.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';

let mongoServer;
let adminToken;
let testStore;
let testProductType;
let testCategory;
let testSubcategory;
let testBrand;
let testUnit;
let testStoreProduct;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Register Admin
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Report Test Admin',
    email: 'admin.report@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  // Create store
  testStore = await Store.create({
    storeCode: 'STR001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'dailychoice@example.com',
    location: 'Downtown',
  });

  // Create master taxonomy items
  testProductType = await ProductType.create({ name: 'Groceries' });
  testCategory = await Category.create({ name: 'Food', productType: testProductType._id });
  testSubcategory = await Subcategory.create({
    name: 'Staples',
    category: testCategory._id,
    productType: testProductType._id,
  });
  testBrand = await Brand.create({ name: 'Generic' });
  testUnit = await Unit.create({ name: 'Piece', shortName: 'pc' });

  // Create store product
  testStoreProduct = await StoreProduct.create({
    barcode: 'BC1001',
    productName: 'Rice 5kg',
    productType: testProductType._id,
    category: testCategory._id,
    subcategory: testSubcategory._id,
    brand: testBrand._id,
    unit: testUnit._id,
    stockQuantity: 100,
    mrp: 500,
    offlineSellingPrice: 450,
    onlineSellingPrice: 480,
    purchasePrice: 300,
    storeId: testStore._id,
  });

  // Create sample store order
  await StoreOrder.create({
    orderId: 'ORD-1001',
    store: testStore._id,
    customer: {
      name: 'Vyshak',
      phone: '9988776655',
    },
    bills: [
      {
        billId: 'BILL-1001',
        billNumber: 1,
        saleType: 'Offline',
        billDate: new Date(),
        items: [
          {
            product: testStoreProduct._id,
            productName: 'Rice 5kg',
            barcode: 'BC1001',
            mrp: 500,
            sellingPrice: 450,
            quantity: 2,
            unit: 'pc',
            gstPercentage: 18,
            totalAmount: 900,
          },
        ],
        totalItems: 1,
        grossAmount: 900,
        subtotal: 762.71,
        gstTotal: 137.29,
        netAmount: 900,
        paymentStatus: 'Paid',
        paymentMethod: 'Cash',
        paidAmount: 900,
      },
    ],
    totalOrderGross: 900,
    totalOrderNet: 900,
    totalOrderPaid: 900,
    orderStatus: 'Completed',
  });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Admin Reports Module Integration Tests', () => {
  it('should reject unauthenticated requests to report endpoints', async () => {
    const res1 = await request(app).get('/api/admin/reports/sales-register');
    expect(res1.status).toBe(401);

    const res2 = await request(app).get('/api/admin/reports/sales-summary');
    expect(res2.status).toBe(401);

    const res3 = await request(app).get('/api/admin/reports/store-pnl');
    expect(res3.status).toBe(401);
  });

  it('should fetch Sales Register Report successfully', async () => {
    const res = await request(app)
      .get('/api/admin/reports/sales-register')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(Array.isArray(res.body.data.summary)).toBe(true);

    const memoSummary = res.body.data.summary.find(s => s.billType === 'Memos');
    expect(memoSummary).toBeDefined();
    expect(memoSummary.noOfBills).toBeGreaterThanOrEqual(1);
    expect(memoSummary.totalValue).toBeGreaterThan(0);

    expect(res.body.data.details).toBeDefined();
    expect(res.body.data.details.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.details[0].productName).toBe('Rice 5kg');
  });

  it('should fetch Sales Summary Report successfully', async () => {
    const res = await request(app)
      .get('/api/admin/reports/sales-summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productSales).toBeDefined();
    expect(res.body.data.totalSummary).toBeDefined();
    expect(res.body.data.totalSummary.totalQuantity).toBeGreaterThanOrEqual(2);
    expect(res.body.data.totalSummary.totalSaleAmount).toBeGreaterThanOrEqual(900);
  });

  it('should fetch Store P&L Overview Report successfully', async () => {
    const res = await request(app)
      .get('/api/admin/reports/store-pnl')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summaryCards).toBeDefined();
    expect(res.body.data.summaryCards.totalRevenue.value).toBe(900);
    expect(res.body.data.summaryCards.productCost.value).toBe(600); // 2 * 300
    expect(res.body.data.summaryCards.netProfit.value).toBe(300); // 900 - 600
    expect(res.body.data.summaryCards.profitMargin.value).toBe(33.33); // (300/900)*100

    expect(res.body.data.storePnlList).toBeDefined();
    expect(res.body.data.storePnlList.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.storePnlList[0].storeName).toBe('Daily Choice Mart');
  });

  it('should fetch Store P&L Details Report for specific store successfully', async () => {
    const res = await request(app)
      .get(`/api/admin/reports/store-pnl/${testStore._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.store.name).toBe('Daily Choice Mart');
    expect(res.body.data.summaryCards.totalRevenue.value).toBe(900);
    expect(res.body.data.summaryCards.productCost.value).toBe(600);
    expect(res.body.data.summaryCards.netProfit.value).toBe(300);
    expect(res.body.data.productTypeBreakdown).toBeDefined();
    expect(res.body.data.totalSummary.revenue).toBe(900);
  });

  it('should export report as Excel (.xlsx) successfully', async () => {
    const res = await request(app)
      .get('/api/admin/reports/export?type=sales-register&format=excel')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.body).toBeDefined();
  });
});
