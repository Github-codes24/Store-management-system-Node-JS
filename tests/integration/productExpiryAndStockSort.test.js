import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../src/app.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';
import Store from '../../src/models/store.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';
import Distributor from '../../src/models/distributor.model.js';

let mongoServer;
let adminToken;
let employeeToken;
let testStore;
let testDistributor;
let testProductType;
let testCategory;
let testSubcategory;
let testBrand;
let testUnit;

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // 1. Admin setup
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Expiry Sort Admin',
    email: 'admin.expirysort@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  // 2. Store & Employee setup
  testStore = await Store.create({
    storeCode: 'EXP_STORE_01',
    name: 'Expiry Test Store',
    mobile: '9876543211',
    email: 'expiry.store@example.com',
  });

  await StoreEmployee.create({
    name: 'Expiry Employee',
    email: 'employee.expiry@example.com',
    userId: 'EMP_EXP_01',
    password: 'password123',
    mobile: '9876543211',
    designation: 'Inventory Manager',
    storeId: testStore._id,
  });

  const empLogin = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP_EXP_01',
    password: 'password123',
  });
  employeeToken = empLogin.body.data.token;

  // 3. Distributor setup
  testDistributor = await Distributor.create({
    name: 'National Pharma Distributors',
    contactPerson: 'Mr. Gupta',
    mobile: '9988776655',
    email: 'distributor.expiry@example.com',
  });

  // 4. Reference masters
  testProductType = await ProductType.create({ name: 'FMCG Goods' });
  testCategory = await Category.create({ name: 'Dairy & Beverages', productType: testProductType._id });
  testSubcategory = await Subcategory.create({
    name: 'Milk & Yogurt',
    category: testCategory._id,
    productType: testProductType._id,
  });
  testBrand = await Brand.create({ name: 'Nestle' });
  testUnit = await Unit.create({ name: 'Litre', shortName: 'L' });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await AdminProduct.deleteMany({});
  await StoreProduct.deleteMany({});
});

describe('Product Inventory: Manufacture Date, Expiry Date & Priority Sorting', () => {
  describe('1. Add Product Inventory with Optional Manufacture & Expiry Dates', () => {
    it('should create AdminProduct with optional manufactureDate and expiryDate (and aliases)', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          barcode: 'BC_EXP_001',
          productName: 'Nestle Milk 1L',
          productType: testProductType._id.toString(),
          category: testCategory._id.toString(),
          subcategory: testSubcategory._id.toString(),
          brand: testBrand._id.toString(),
          unit: testUnit._id.toString(),
          mrp: 75,
          purchasePrice: 60,
          offlineSellingPrice: 70,
          onlineSellingPrice: 72,
          stockQuantity: 50,
          minStockAlert: 10,
          manufactureDate: '2026-09-01',
          expiringDate: '2026-10-15', // alias expiringDate
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.manufactureDate).toBeDefined();
      expect(res.body.data.expiryDate).toBeDefined();

      const createdMfg = new Date(res.body.data.manufactureDate);
      expect(createdMfg.getFullYear()).toBe(2026);
    });

    it('should allow creating AdminProduct without manufactureDate or expiryDate (optional)', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          barcode: 'BC_EXP_002',
          productName: 'Nestle Water Bottle',
          productType: testProductType._id.toString(),
          category: testCategory._id.toString(),
          subcategory: testSubcategory._id.toString(),
          brand: testBrand._id.toString(),
          unit: testUnit._id.toString(),
          mrp: 20,
          purchasePrice: 12,
          offlineSellingPrice: 20,
          onlineSellingPrice: 20,
          stockQuantity: 100,
          manufactureDate: '', // empty string should be accepted
          expiryDate: null, // null should be accepted
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.manufactureDate).toBeNull();
      expect(res.body.data.expiryDate).toBeNull();
    });

    it('should create StoreProduct with optional manufactureDate and expiryDate via Store Employee form', async () => {
      const res = await request(app)
        .post('/api/store-employee/products')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          barcode: 'BC_STORE_EXP_001',
          productName: 'Nestle Greek Yogurt',
          productType: testProductType._id.toString(),
          category: testCategory._id.toString(),
          subcategory: testSubcategory._id.toString(),
          brand: testBrand._id.toString(),
          unit: testUnit._id.toString(),
          mrp: 90,
          offlineSellingPrice: 85,
          onlineSellingPrice: 88,
          purchasePrice: 65,
          stockQuantity: 30,
          alertQuantity: 5,
          manufacturingDate: '2026-09-10',
          expiringDate: '2026-10-20',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.manufactureDate).toBeDefined();
      expect(res.body.data.product.expiryDate).toBeDefined();
    });

    it('should add product stock with manufactureDate and expiryDate via Product Purchase form', async () => {
      const res = await request(app)
        .post('/api/admin/product-purchases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          distributor: testDistributor._id.toString(),
          billDate: '2026-09-25',
          items: [
            {
              productName: 'Fresh Butter 500g',
              productType: testProductType._id.toString(),
              category: testCategory._id.toString(),
              subcategory: testSubcategory._id.toString(),
              brand: testBrand._id.toString(),
              unit: testUnit._id.toString(),
              mrp: 250,
              purchasePrice: 200,
              offlineSellingPrice: 240,
              onlineSellingPrice: 245,
              quantity: 25,
              manufactureDate: '2026-09-15',
              expiringDate: '2026-10-30',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invoice.items[0].manufactureDate).toBeDefined();
      expect(res.body.data.invoice.items[0].expiryDate).toBeDefined();

      const createdProduct = await AdminProduct.findOne({ productName: 'Fresh Butter 500g' });
      expect(createdProduct).toBeDefined();
      expect(createdProduct.expiryDate).not.toBeNull();
      expect(createdProduct.stockQuantity).toBe(25);
    });
  });

  describe('2. Display Expiring Products Before One Month on Dashboard', () => {
    it('should display products expiring within 1 month on Admin Dashboard overview and /expiring-products', async () => {
      const now = new Date();
      const inTenDays = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const inTwoMonths = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      // Product expiring in 10 days (before one month)
      await AdminProduct.create({
        barcode: 'BC_EXP_SOON',
        productName: 'Expiring Paneer',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 120,
        purchasePrice: 90,
        offlineSellingPrice: 110,
        onlineSellingPrice: 115,
        stockQuantity: 15,
        expiryDate: inTenDays,
      });

      // Product expiring in 60 days (NOT within one month)
      await AdminProduct.create({
        barcode: 'BC_EXP_LATER',
        productName: 'Long Expiry Cheese',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 300,
        purchasePrice: 220,
        offlineSellingPrice: 280,
        onlineSellingPrice: 290,
        stockQuantity: 40,
        expiryDate: inTwoMonths,
      });

      // GET /api/admin/dashboard/overview
      const resOverview = await request(app)
        .get('/api/admin/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resOverview.status).toBe(200);
      expect(resOverview.body.data).toHaveProperty('expiringProducts');
      const expiringList = resOverview.body.data.expiringProducts;
      expect(expiringList.length).toBe(1);
      expect(expiringList[0].productName).toBe('Expiring Paneer');
      expect(expiringList[0].daysLeft).toContain('Days');

      // GET /api/admin/dashboard/expiring-products
      const resExpiring = await request(app)
        .get('/api/admin/dashboard/expiring-products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resExpiring.status).toBe(200);
      expect(resExpiring.body.data.expiringProducts.length).toBe(1);
      expect(resExpiring.body.data.expiringProducts[0].productName).toBe('Expiring Paneer');
    });
  });

  describe('3. Always Sort Products by Expiring and Low Stock in Product Inventory List', () => {
    it('should prioritize expiring products first, followed by low stock products in /api/admin/product-stocks', async () => {
      const now = new Date();
      const inFiveDays = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const inTwentyDays = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

      // Product 1: Normal healthy product (no expiry, healthy stock 100)
      const normalProduct = await AdminProduct.create({
        barcode: 'BC_NORMAL',
        productName: 'Normal Healthy Tea',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 150,
        purchasePrice: 100,
        offlineSellingPrice: 140,
        onlineSellingPrice: 145,
        stockQuantity: 100,
        minStockAlert: 10,
        expiryDate: null,
      });

      // Product 2: Low Stock product (stock = 3 <= minStockAlert 10, no expiry)
      const lowStockProduct = await AdminProduct.create({
        barcode: 'BC_LOW',
        productName: 'Low Stock Coffee',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 200,
        purchasePrice: 150,
        offlineSellingPrice: 190,
        onlineSellingPrice: 195,
        stockQuantity: 3,
        minStockAlert: 10,
        expiryDate: null,
      });

      // Product 3: Expiring soonest (expires in 5 days, stock 20)
      const expiringSoonProduct = await AdminProduct.create({
        barcode: 'BC_EXP_5D',
        productName: 'Expiring in 5 Days Fresh Cream',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 80,
        purchasePrice: 60,
        offlineSellingPrice: 75,
        onlineSellingPrice: 78,
        stockQuantity: 20,
        minStockAlert: 5,
        expiryDate: inFiveDays,
      });

      // Product 4: Expiring in 20 days (stock 15)
      const expiringLaterProduct = await AdminProduct.create({
        barcode: 'BC_EXP_20D',
        productName: 'Expiring in 20 Days Curd',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 50,
        purchasePrice: 35,
        offlineSellingPrice: 45,
        onlineSellingPrice: 48,
        stockQuantity: 15,
        minStockAlert: 5,
        expiryDate: inTwentyDays,
      });

      const res = await request(app)
        .get('/api/admin/product-stocks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(4);

      // Verify Priority Order:
      // Index 0: Expiring soonest (5 days)
      expect(res.body.data[0].productName).toBe('Expiring in 5 Days Fresh Cream');
      expect(res.body.data[0].stockStatusCode).toBe('near_expiry');

      // Index 1: Expiring next (20 days)
      expect(res.body.data[1].productName).toBe('Expiring in 20 Days Curd');
      expect(res.body.data[1].stockStatusCode).toBe('near_expiry');

      // Index 2: Low stock product
      expect(res.body.data[2].productName).toBe('Low Stock Coffee');
      expect(res.body.data[2].stockStatusCode).toBe('low_stock');

      // Index 3: Normal healthy product
      expect(res.body.data[3].productName).toBe('Normal Healthy Tea');
      expect(res.body.data[3].stockStatusCode).toBe('active');
    });

    it('should prioritize expiring products first, followed by low stock products in /api/store-employee/products', async () => {
      const now = new Date();
      const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

      // Normal store product
      await StoreProduct.create({
        barcode: 'BC_STORE_NORM',
        productName: 'Normal Store Biscuits',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 40,
        offlineSellingPrice: 35,
        onlineSellingPrice: 38,
        purchasePrice: 28,
        stockQuantity: 80,
        alertQuantity: 10,
        storeId: testStore._id,
        expiryDate: null,
      });

      // Low stock store product (stock = 2 <= alertQuantity 10)
      await StoreProduct.create({
        barcode: 'BC_STORE_LOW',
        productName: 'Low Stock Store Sugar',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 50,
        offlineSellingPrice: 45,
        onlineSellingPrice: 48,
        purchasePrice: 38,
        stockQuantity: 2,
        alertQuantity: 10,
        storeId: testStore._id,
        expiryDate: null,
      });

      // Expiring store product (expires in 2 days)
      await StoreProduct.create({
        barcode: 'BC_STORE_EXP',
        productName: 'Expiring Store Milk',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 60,
        offlineSellingPrice: 55,
        onlineSellingPrice: 58,
        purchasePrice: 48,
        stockQuantity: 25,
        alertQuantity: 5,
        storeId: testStore._id,
        expiryDate: inTwoDays,
      });

      const res = await request(app)
        .get('/api/store-employee/products')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);

      // Expiring first
      expect(res.body.data[0].productName).toBe('Expiring Store Milk');
      expect(res.body.data[0].stockStatusCode).toBe('near_expiry');

      // Low stock next
      expect(res.body.data[1].productName).toBe('Low Stock Store Sugar');
      expect(res.body.data[1].stockStatusCode).toBe('low_stock');

      // Normal last
      expect(res.body.data[2].productName).toBe('Normal Store Biscuits');
      expect(res.body.data[2].stockStatusCode).toBe('active');
    });
  });

  describe('4. Flexible Expiry Alert Field, Dynamic Priority Sorting & Dashboard Detection', () => {
    it('should parse flexible expiry alert formats (days, months, numbers) in Admin and Store forms', async () => {
      // 1. Admin product with "20 days"
      const adminRes1 = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productName: 'Alert 20 Days Item',
          barcode: 'BC_ALERT_20',
          productType: testProductType._id,
          category: testCategory._id,
          subcategory: testSubcategory._id,
          brand: testBrand._id,
          unit: testUnit._id,
          mrp: 100,
          purchasePrice: 60,
          offlineSellingPrice: 90,
          onlineSellingPrice: 95,
          expiryDate: '2026-11-01',
          expiryAlert: '20 days',
        });
      expect(adminRes1.status).toBe(201);
      expect(adminRes1.body.data.expiryAlert).toBe(20);

      // 2. Admin product with "2 months"
      const adminRes2 = await request(app)
        .post('/api/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productName: 'Alert 2 Months Item',
          barcode: 'BC_ALERT_60',
          productType: testProductType._id,
          category: testCategory._id,
          subcategory: testSubcategory._id,
          brand: testBrand._id,
          unit: testUnit._id,
          mrp: 120,
          purchasePrice: 70,
          offlineSellingPrice: 110,
          onlineSellingPrice: 115,
          expiryDate: '2026-12-01',
          expiryAlert: '2 months',
        });
      expect(adminRes2.status).toBe(201);
      expect(adminRes2.body.data.expiryAlert).toBe(60);

      // 3. Store product with "10 days"
      const storeRes = await request(app)
        .post('/api/store-employee/products')
        .set('Authorization', `Bearer ${employeeToken}`)
        .field('productName', 'Store Alert 10 Days Item')
        .field('barcode', 'BC_STORE_ALERT_10')
        .field('productType', testProductType._id.toString())
        .field('category', testCategory._id.toString())
        .field('subcategory', testSubcategory._id.toString())
        .field('brand', testBrand._id.toString())
        .field('unit', testUnit._id.toString())
        .field('mrp', 80)
        .field('offlineSellingPrice', 75)
        .field('onlineSellingPrice', 78)
        .field('stockQuantity', 30)
        .field('expiryDate', '2026-10-15')
        .field('expiryAlert', '10 days');
      expect(storeRes.status).toBe(201);
      expect(storeRes.body.data.product.expiryAlert).toBe(10);
    });

    it('should prioritize products based on expiryDate and each product specific expiryAlert threshold', async () => {
      const now = new Date();
      // Product expiring in 45 days:
      const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      // Product A: expires in 45 days, with expiryAlert = 60 days (2 months) -> ALERT TRIGGERED (Priority 1)
      await StoreProduct.create({
        barcode: 'BC_EXP_TRIGGERED',
        productName: 'Alert Triggered Product (2 Months Alert)',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 100,
        offlineSellingPrice: 90,
        onlineSellingPrice: 95,
        stockQuantity: 50,
        alertQuantity: 5,
        storeId: testStore._id,
        expiryDate: in45Days,
        expiryAlert: 60,
      });

      // Product B: expires in 45 days, with expiryAlert = 10 days -> ALERT NOT TRIGGERED (Priority 4)
      await StoreProduct.create({
        barcode: 'BC_EXP_UNTRIGGERED',
        productName: 'Untriggered Product (10 Days Alert)',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 100,
        offlineSellingPrice: 90,
        onlineSellingPrice: 95,
        stockQuantity: 50,
        alertQuantity: 5,
        storeId: testStore._id,
        expiryDate: in45Days,
        expiryAlert: 10,
      });

      const res = await request(app)
        .get('/api/store-employee/products')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);

      // Product A with 60 days alert must appear first (Priority 1: Near Expiry)
      expect(res.body.data[0].productName).toBe('Alert Triggered Product (2 Months Alert)');
      expect(res.body.data[0].stockStatusCode).toBe('near_expiry');

      // Product B with 10 days alert must appear after
      expect(res.body.data[1].productName).toBe('Untriggered Product (10 Days Alert)');
      expect(res.body.data[1].stockStatusCode).toBe('active');
    });

    it('should include products in Dashboard Overview and See All when within custom expiryAlert window', async () => {
      const now = new Date();
      const in20Days = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

      // Store Product with 25 days alert expiring in 20 days -> should be displayed on Dashboard!
      await StoreProduct.create({
        barcode: 'BC_STORE_DASH_20',
        productName: 'Dashboard 25 Days Alert Item',
        productType: testProductType._id,
        category: testCategory._id,
        subcategory: testSubcategory._id,
        brand: testBrand._id,
        unit: testUnit._id,
        mrp: 150,
        offlineSellingPrice: 140,
        onlineSellingPrice: 145,
        stockQuantity: 20,
        storeId: testStore._id,
        expiryDate: in20Days,
        expiryAlert: 25,
      });

      // Store Employee Dashboard Overview
      const empDash = await request(app)
        .get('/api/store-employee/dashboard')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(empDash.status).toBe(200);
      const expiringInDash = empDash.body.data.expiringProducts;
      const found = expiringInDash.find((p) => p.productName === 'Dashboard 25 Days Alert Item');
      expect(found).toBeDefined();
      expect(found.expiryAlert).toBe(25);

      // See All Expiring Products
      const seeAllRes = await request(app)
        .get('/api/store-employee/dashboard/expiring-products')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(seeAllRes.status).toBe(200);
      const seeAllFound = seeAllRes.body.data.products.find(
        (p) => p.productName === 'Dashboard 25 Days Alert Item'
      );
      expect(seeAllFound).toBeDefined();
      expect(seeAllFound.expiryAlert).toBe(25);
    });
  });
});
