import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Store from '../../src/models/store.model.js';
import Customer from '../../src/models/customer.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import SellProduct from '../../src/models/sellProduct.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';

let mongoServer;
let employeeToken;
let storeId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const store = await Store.create({
    storeCode: 'STORE_DASH_01',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'dash.store@example.com',
  });
  storeId = store._id;

  await StoreEmployee.create({
    name: 'Store Manager Eleanor',
    email: 'eleanor.manager@example.com',
    userId: 'EMP_DASH_01',
    password: 'password123',
    mobile: '9876543210',
    designation: 'Store Manager',
    storeId: storeId,
  });

  const loginRes = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP_DASH_01',
    password: 'password123',
  });
  employeeToken = loginRes.body.data.token;

  // Master records
  const pt = await ProductType.create({ name: 'Grocery' });
  const cat = await Category.create({ name: 'Dairy', productType: pt._id });
  const subcat = await Subcategory.create({ name: 'Milk', category: cat._id, productType: pt._id });
  const brand = await Brand.create({ name: 'Amul' });
  const unit = await Unit.create({ name: '1 L', shortName: '1L', nameHindi: '1 L' });
  
  const adminProd = await AdminProduct.create({
    barcode: 'BC_ADMIN_001',
    productName: 'Amul Milk 1L',
    productType: pt._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    mrp: 60,
    purchasePrice: 50,
    offlineSellingPrice: 55,
    onlineSellingPrice: 58,
  });

  // Store Product Inventory (Normal & Low Stock & Expiring)
  await StoreProduct.create({
    barcode: 'BC001',
    productName: 'Amul Milk 1L',
    productType: pt._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    mrp: 60,
    offlineSellingPrice: 55,
    onlineSellingPrice: 58,
    stockQuantity: 5,
    alertQuantity: 10,
    expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days left
    storeId: storeId,
  });

  // Customers
  await Customer.create({
    name: 'Kathryn Murphy',
    phone: '9876543210',
    email: 'kathryn@example.com',
    storeId: storeId,
    totalPurchase: 18400,
    amountDue: 4000,
  });

  // Sell Order
  await SellProduct.create({
    sellId: 'ORD-1001',
    saleType: 'Own Store',
    store: storeId,
    items: [
      {
        product: adminProd._id,
        productName: 'Amul Milk 1L',
        mrp: 60,
        sellingPrice: 55,
        quantity: 2,
        unit: unit._id,
        gstPercentage: 0,
        totalAmount: 110,
      },
    ],
    totalItems: 1,
    grossAmount: 110,
    gstAmount: 0,
    netAmount: 110,
    status: 'Completed',
    createdBy: new mongoose.Types.ObjectId(),
  });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Store Panel Dashboard Integration Tests', () => {
  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/store-employee/dashboard');
    expect(res.status).toBe(401);
  });

  it('should fetch complete dashboard overview with metrics, charts, and preview widgets', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.storeInfo.name).toBe('Daily Choice Mart');
    expect(res.body.data.metrics.availableStocks).toBe(5);
    expect(res.body.data.metrics.totalCustomers).toBe(1);
    expect(res.body.data.metrics.totalOrders).toBe(1);
    expect(res.body.data.metrics.totalRevenue).toBe(110);

    // Verify analytics charts
    expect(res.body.data.charts.customerGrowth.thisYear.length).toBe(12);
    expect(res.body.data.charts.orderGrowth.thisYear.length).toBe(12);
    expect(res.body.data.charts.revenueGrowth.thisYear.length).toBe(12);

    // Verify preview widgets
    expect(res.body.data.recentOrders.length).toBe(1);
    expect(res.body.data.recentCustomers.length).toBe(1);
    expect(res.body.data.lowStockProducts.length).toBe(1);
    expect(res.body.data.expiringProducts.length).toBe(1);
    expect(res.body.data.mostDemandingProducts.length).toBe(1);
  });

  it('should fetch See All Recent Orders (paginated)', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard/recent-orders')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders.length).toBe(1);
    expect(res.body.data.orders[0].orderId).toBe('ORD-1001');
  });

  it('should fetch See All Recent Customers (paginated)', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard/recent-customers')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.customers.length).toBe(1);
    expect(res.body.data.customers[0].customerName).toBe('Kathryn Murphy');
  });

  it('should fetch See All Low Stock Products (paginated)', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard/low-stock-products')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBe(1);
    expect(res.body.data.products[0].productName).toBe('Amul Milk 1L');
  });

  it('should fetch See All Expiring Products (paginated)', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard/expiring-products')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBe(1);
    expect(res.body.data.products[0].productName).toBe('Amul Milk 1L');
  });

  it('should fetch See All Most Demanding Products (paginated)', async () => {
    const res = await request(app)
      .get('/api/store-employee/dashboard/most-demanding-products')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products.length).toBe(1);
    expect(res.body.data.products[0].productName).toBe('Amul Milk 1L');
    expect(res.body.data.products[0].totalUnitsSold).toBe(2);
  });
});
