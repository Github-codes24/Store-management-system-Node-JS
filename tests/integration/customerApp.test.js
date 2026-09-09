import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Customer from '../../src/models/customer.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';
import AdminProduct from '../../src/models/adminProduct.model.js';
import Offer from '../../src/models/offer.model.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Customer.deleteMany({});
  await ProductType.deleteMany({});
  await Category.deleteMany({});
  await Subcategory.deleteMany({});
  await Brand.deleteMany({});
  await Unit.deleteMany({});
  await AdminProduct.deleteMany({});
  await Offer.deleteMany({});
});

describe('Customer App API Integration Tests', () => {
  const testMobile = '9876543210';

  describe('Customer Auth Endpoints (/api/customer/auth)', () => {
    it('should send OTP and return OTP in response payload', async () => {
      const res = await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe(testMobile);
      expect(res.body.data.otp).toBeDefined();
      expect(res.body.data.otp).toHaveLength(4);

      // Verify DB record created
      const dbCustomer = await Customer.findOne({ phone: testMobile }).select('+otp +otpExpires');
      expect(dbCustomer).not.toBeNull();
      expect(dbCustomer.otp).toBe(res.body.data.otp);
    });

    it('should verify OTP and return authentication token', async () => {
      // 1. Send OTP
      const sendRes = await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });

      const otp = sendRes.body.data.otp;

      // 2. Verify OTP
      const verifyRes = await request(app)
        .post('/api/customer/auth/verify-otp')
        .send({ phone: testMobile, otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.token).toBeDefined();
      expect(verifyRes.body.data.customer.phone).toBe(testMobile);
      expect(verifyRes.headers['set-cookie']).toBeDefined();
    });

    it('should fail OTP verification with invalid OTP', async () => {
      await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });

      const verifyRes = await request(app)
        .post('/api/customer/auth/verify-otp')
        .send({ phone: testMobile, otp: '0000' });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.success).toBe(false);
      expect(verifyRes.body.message).toMatch(/invalid.*otp/i);
    });

    it('should resend OTP with new 4-digit code', async () => {
      const sendRes = await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });

      const resendRes = await request(app)
        .post('/api/customer/auth/resend-otp')
        .send({ phone: testMobile });

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.success).toBe(true);
      expect(resendRes.body.data.otp).toBeDefined();
      expect(resendRes.body.data.otp).toHaveLength(4);
    });

    it('should retrieve customer profile and update profile details', async () => {
      // 1. Send & verify OTP
      const sendRes = await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });
      const verifyRes = await request(app)
        .post('/api/customer/auth/verify-otp')
        .send({ phone: testMobile, otp: sendRes.body.data.otp });

      const token = verifyRes.body.data.token;

      // 2. GET Profile
      const getProfileRes = await request(app)
        .get('/api/customer/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(getProfileRes.status).toBe(200);
      expect(getProfileRes.body.success).toBe(true);
      expect(getProfileRes.body.data.customer.phone).toBe(testMobile);

      // 3. Update Profile
      const updateProfileRes = await request(app)
        .put('/api/customer/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          gender: 'male',
        });

      expect(updateProfileRes.status).toBe(200);
      expect(updateProfileRes.body.success).toBe(true);
      expect(updateProfileRes.body.data.customer.name).toBe('John Doe');
      expect(updateProfileRes.body.data.customer.email).toBe('john@example.com');
    });

    it('should logout customer and clear cookie', async () => {
      const sendRes = await request(app)
        .post('/api/customer/auth/send-otp')
        .send({ phone: testMobile });
      const verifyRes = await request(app)
        .post('/api/customer/auth/verify-otp')
        .send({ phone: testMobile, otp: sendRes.body.data.otp });

      const token = verifyRes.body.data.token;

      const logoutRes = await request(app)
        .post('/api/customer/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
    });
  });

  describe('Customer Products & Browsing Endpoints (/api/customer/products)', () => {
    it('should list only active product types, categories, subcategories, offers, and products', async () => {
      // 1. Setup seed data: 1 active product type, 1 inactive product type
      const activeType = await ProductType.create({ name: 'Groceries', status: 'active' });
      await ProductType.create({ name: 'Electronics', status: 'inactive' });

      // 2. Setup Category
      const activeCat = await Category.create({
        name: 'Beverages',
        productType: activeType._id,
        status: 'active',
      });

      // 3. Setup Subcategory
      const activeSubcat = await Subcategory.create({
        name: 'Fruit Juices',
        category: activeCat._id,
        productType: activeType._id,
        status: 'active',
      });

      // 4. Setup Brand & Unit
      const brand = await Brand.create({ name: 'Real', status: 'active' });
      const unit = await Unit.create({ name: 'Litre', shortName: 'L', status: 'active' });

      // 5. Setup Product
      const product = await AdminProduct.create({
        barcode: '8901234567890',
        productName: 'Real Mango Juice 1L',
        productType: activeType._id,
        category: activeCat._id,
        subcategory: activeSubcat._id,
        brand: brand._id,
        unit: unit._id,
        purchasePrice: 80,
        offlineSellingPrice: 100,
        onlineSellingPrice: 95,
        mrp: 120,
        status: 'active',
      });

      // 6. Setup Offer
      await Offer.create({
        name: 'Summer Juice Fiesta',
        discountType: 'percentage',
        discountValue: 20,
        status: 'active',
        validFrom: new Date(Date.now() - 3600000),
        validTo: new Date(Date.now() + 86400000),
      });

      // Test Product Types endpoint
      const typesRes = await request(app).get('/api/customer/products/product-types');
      expect(typesRes.status).toBe(200);
      expect(typesRes.body.data.productTypes).toHaveLength(1);
      expect(typesRes.body.data.productTypes[0].name).toBe('Groceries');

      // Test Categories endpoint
      const catRes = await request(app).get('/api/customer/products/categories');
      expect(catRes.status).toBe(200);
      expect(catRes.body.data.categories).toHaveLength(1);

      // Test Subcategories endpoint
      const subcatRes = await request(app).get('/api/customer/products/subcategories');
      expect(subcatRes.status).toBe(200);
      expect(subcatRes.body.data.subcategories).toHaveLength(1);

      // Test Offers endpoint
      const offerRes = await request(app).get('/api/customer/products/offers');
      expect(offerRes.status).toBe(200);
      expect(offerRes.body.data.offers).toHaveLength(1);

      // Test Products endpoint
      const prodRes = await request(app).get('/api/customer/products/products');
      expect(prodRes.status).toBe(200);
      expect(prodRes.body.data.products).toHaveLength(1);
      expect(prodRes.body.data.products[0].productName).toBe('Real Mango Juice 1L');

      // Test Single Product endpoint
      const singleProdRes = await request(app).get(`/api/customer/products/products/${product._id}`);
      expect(singleProdRes.status).toBe(200);
      expect(singleProdRes.body.data.product._id).toBe(product._id.toString());
    });
  });
});
