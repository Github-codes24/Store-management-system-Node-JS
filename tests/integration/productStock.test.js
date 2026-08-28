import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import app from '../../src/app.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';

let mongoServer;
let adminToken;
let testProductType;
let testCategory;
let testSubcategory;
let testBrand;
let testUnit;

beforeAll(async () => {
  jest.setTimeout(60000);
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Register admin & obtain auth token
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Admin Stock Tester',
    email: 'admin.stock@example.com',
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
  await AdminProduct.deleteMany({});
  await ProductType.deleteMany({});
  await Category.deleteMany({});
  await Subcategory.deleteMany({});
  await Brand.deleteMany({});
  await Unit.deleteMany({});

  // Seed reference masters
  testProductType = await ProductType.create({ name: 'Fashion', description: 'Apparel' });
  testCategory = await Category.create({ name: "Men's Fashion", productType: testProductType._id });
  testSubcategory = await Subcategory.create({
    name: 'T-Shirts',
    productType: testProductType._id,
    category: testCategory._id,
  });
  testBrand = await Brand.create({ name: 'Rare Rabbit' });
  testUnit = await Unit.create({ name: 'Piece', shortName: 'pc', allowDecimal: false });
});

describe('Admin Product Stocks API Integration Tests', () => {
  let activeProduct;
  let lowStockProduct;
  let soldOutProduct;

  beforeEach(async () => {
    // 1. Healthy active product
    activeProduct = await AdminProduct.create({
      barcode: '717271883927',
      productName: 'Toxy Men Printed Raw Edge T-shirt',
      productType: testProductType._id,
      category: testCategory._id,
      subcategory: testSubcategory._id,
      brand: testBrand._id,
      unit: testUnit._id,
      mrp: 799,
      purchasePrice: 450,
      offlineSellingPrice: 649,
      onlineSellingPrice: 773,
      taxType: 'GST Invoice',
      gstPercentage: 12,
      cgstPercentage: 6,
      sgstPercentage: 6,
      stockQuantity: 200,
      minStockAlert: 20,
      reorderPoint: 15,
      hsnCode: '1006',
      status: 'active',
    });

    // 2. Low stock product
    lowStockProduct = await AdminProduct.create({
      barcode: '8901234567890',
      productName: 'Egg 12-Pack',
      productType: testProductType._id,
      category: testCategory._id,
      subcategory: testSubcategory._id,
      brand: testBrand._id,
      unit: testUnit._id,
      mrp: 120,
      purchasePrice: 80,
      offlineSellingPrice: 120,
      onlineSellingPrice: 120,
      stockQuantity: 5,
      minStockAlert: 20,
      reorderPoint: 15,
      status: 'active',
    });

    // 3. Out of stock / Sold product
    soldOutProduct = await AdminProduct.create({
      barcode: '8909876543210',
      productName: 'Toxy Slim Jeans',
      productType: testProductType._id,
      category: testCategory._id,
      subcategory: testSubcategory._id,
      brand: testBrand._id,
      unit: testUnit._id,
      mrp: 1500,
      purchasePrice: 900,
      offlineSellingPrice: 1300,
      onlineSellingPrice: 1400,
      stockQuantity: 0,
      minStockAlert: 10,
      reorderPoint: 5,
      status: 'active',
    });
  });

  describe('1. GET /api/admin/product-stocks (List Product Stocks)', () => {
    it('should retrieve paginated product stock list with formatted display fields', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.pagination.totalItems).toBe(3);

      const firstItem = res.body.data.find((i) => i._id === activeProduct._id.toString());
      expect(firstItem.productName).toBe('Toxy Men Printed Raw Edge T-shirt');
      expect(firstItem.stockDisplay).toBe('200 pc');
      expect(firstItem.brandName).toBe('Rare Rabbit');
      expect(firstItem.stockStatus).toBe('Active');
    });

    it('should filter product stocks by search keyword (name / barcode / hsn)', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks?search=Egg')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].productName).toBe('Egg 12-Pack');
    });

    it('should filter product stocks by status=low_stock', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks?status=low_stock')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].productName).toBe('Egg 12-Pack');
      expect(res.body.data[0].stockStatus).toBe('Low Stock');
    });

    it('should filter product stocks by status=sold', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks?status=sold')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].productName).toBe('Toxy Slim Jeans');
      expect(res.body.data[0].stockStatus).toBe('Sold');
    });
  });

  describe('2. GET /api/admin/product-stocks/summary (Summary Metrics)', () => {
    it('should calculate accurate stock metrics and totals', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProducts).toBe(3);
      expect(res.body.data.activeProducts).toBe(1);
      expect(res.body.data.lowStockProducts).toBe(1);
      expect(res.body.data.outOfStockProducts).toBe(1);
      expect(res.body.data.totalStockQuantity).toBe(205);
    });
  });

  describe('3. GET /api/admin/product-stocks/:id (Product Stock Details)', () => {
    it('should return detailed product stock data matching Figma Screens 3 & 4 layout', async () => {
      const res = await request(app)
        .get(`/api/admin/product-stocks/${activeProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.productDetails.productName).toBe('Toxy Men Printed Raw Edge T-shirt');
      expect(data.productDetails.barcode).toBe('717271883927');
      expect(data.productDetails.barcodeSvg).toContain('<svg');
      expect(data.priceAndGstDetails.mrp).toBe(799);
      expect(data.priceAndGstDetails.onlineSellingPrice).toBe(773);
      expect(data.priceAndGstDetails.offlineSellingPrice).toBe(649);
      expect(data.priceAndGstDetails.gstPercentage).toBe(12);
      expect(data.stockDetails.stockQuantity).toBe(200);
      expect(data.stockDetails.stockDisplay).toBe('200 pc');
      expect(data.stockDetails.minStockQuantityForAlert).toBe(20);
      expect(data.stockDetails.reorderingPoint).toBe(15);
      expect(data.stockDetails.hsnCode).toBe('1006');
    });

    it('should return 404 for non-existent product stock ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/admin/product-stocks/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Status Toggle & Stock Adjustment', () => {
    it('should toggle product active/inactive status', async () => {
      const res = await request(app)
        .patch(`/api/admin/product-stocks/${activeProduct._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('inactive');
      expect(res.body.data.stockStatus).toBe('Inactive');
    });

    it('should adjust stock quantity using operation=add', async () => {
      const res = await request(app)
        .patch(`/api/admin/product-stocks/${activeProduct._id}/adjust-stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stockQuantity: 50, operation: 'add' });

      expect(res.status).toBe(200);
      expect(res.body.data.stockQuantity).toBe(250);
    });

    it('should adjust stock quantity using operation=subtract', async () => {
      const res = await request(app)
        .patch(`/api/admin/product-stocks/${activeProduct._id}/adjust-stock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stockQuantity: 30, operation: 'subtract' });

      expect(res.status).toBe(200);
      expect(res.body.data.stockQuantity).toBe(170);
    });
  });

  describe('5. Print Barcode API (Figma Screen 5)', () => {
    it('should generate barcode print JSON payload for requested quantity', async () => {
      const res = await request(app)
        .post(`/api/admin/product-stocks/${activeProduct._id}/print-barcode`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 100 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.printQuantity).toBe(100);
      expect(res.body.data.labels.length).toBe(100);
      expect(res.body.data.product.barcode).toBe('717271883927');
    });

    it('should generate barcode printable PDF stream on GET request', async () => {
      const res = await request(app)
        .get(`/api/admin/product-stocks/${activeProduct._id}/print-barcode?quantity=10&format=pdf`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body).toBeDefined();
    });
  });

  describe('6. Export Product Stocks API', () => {
    it('should export product stocks as JSON data', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks/export?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exportRows.length).toBe(3);
    });

    it('should export product stocks as CSV string', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Toxy Men Printed Raw Edge T-shirt');
    });

    it('should export product stocks as Excel workbook (.xlsx)', async () => {
      const res = await request(app)
        .get('/api/admin/product-stocks/export?format=excel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
    });
  });

  describe('7. Soft Delete Product Stock', () => {
    it('should soft delete product stock record', async () => {
      const res = await request(app)
        .delete(`/api/admin/product-stocks/${activeProduct._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbRecord = await AdminProduct.findById(activeProduct._id);
      expect(dbRecord.isDeleted).toBe(true);
    });
  });
});
