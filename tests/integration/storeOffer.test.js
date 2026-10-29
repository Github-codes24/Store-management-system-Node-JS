import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Offer from '../../src/models/offer.model.js';
import Store from '../../src/models/store.model.js';
import Customer from '../../src/models/customer.model.js';
import StoreEmployee from '../../src/models/storeEmployee.model.js';
import StoreProduct from '../../src/models/storeProduct.model.js';

let mongoServer;
let employeeToken;
let storeId;
let customerId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const store = await Store.create({
    storeCode: 'STORE_001',
    name: 'Daily Choice Mart',
    mobile: '9876543210',
    email: 'store001@example.com',
  });
  storeId = store._id;

  await StoreEmployee.create({
    name: 'Store Manager John',
    email: 'john.manager@example.com',
    userId: 'EMP001',
    password: 'password123',
    mobile: '9876543210',
    designation: 'Store Manager',
    storeId: storeId,
  });

  const loginRes = await request(app).post('/api/store-employee/auth/login').send({
    userId: 'EMP001',
    password: 'password123',
  });

  employeeToken = loginRes.body.data.token;

  const customer = await Customer.create({
    name: 'Brooklyn Simmons',
    phone: '9876543210',
    email: 'brooklyn@example.com',
    storeId: storeId,
    totalPurchase: 18400,
    amountDue: 4000,
  });
  customerId = customer._id.toString();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Offer.deleteMany({});
});

describe('Store Panel Offers Integration Tests', () => {
  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/store-employee/offers');
    expect(res.status).toBe(401);
  });

  it('should fetch store offer form options without customer list (all customers by default)', async () => {
    const res = await request(app)
      .get('/api/store-employee/offers/options')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.customers)).toBe(true);
    expect(res.body.data.customers.length).toBe(0);
  });

  it('should create a new Store Offer from store panel', async () => {
    const res = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: '10% Store Discount',
        validFrom: '2026-09-01',
        validTo: '2026-12-31',
        discountType: 'percentage',
        discountValue: 10,
        sendToAllCustomers: false,
        targetCustomers: [customerId],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.name).toBe('10% Store Discount');
  });

  it('should list store offers', async () => {
    await Offer.create({
      name: 'Flat 50 Off',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
    });

    const res = await request(app)
      .get('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offers.length).toBe(1);
    expect(res.body.data.offers[0].name).toBe('Flat 50 Off');
  });

  it('should toggle store offer status', async () => {
    const created = await Offer.create({
      name: 'Status Toggle Offer',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
      status: 'active',
    });

    const res = await request(app)
      .patch(`/api/store-employee/offers/${created._id}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('should delete store offer', async () => {
    const created = await Offer.create({
      name: 'Delete Offer',
      stores: [storeId],
      validFrom: new Date('2026-09-01'),
      validTo: new Date('2026-12-31'),
      discountType: 'flat',
      discountValue: 50,
    });

    const res = await request(app)
      .delete(`/api/store-employee/offers/${created._id}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should create and list BOGO and BXGY offers successfully', async () => {
    const bogoRes = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Buy 1 Get 1 Free Shampoo',
        validFrom: '2026-09-01',
        validTo: '2026-12-31',
        discountType: 'bogo',
        buyDetails: {
          buyQuantity: 1,
        },
        getFreeDetails: {
          freeQuantity: 1,
        },
      });

    expect(bogoRes.status).toBe(201);
    expect(bogoRes.body.success).toBe(true);
    expect(bogoRes.body.data.offer.discountType).toBe('bogo');

    const listRes = await request(app)
      .get('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.offers[0].discountLabel).toContain('Buy 1 Get 1 Free');
  });

  it('should populate buyDetails.buyProduct and getFreeDetails.freeProduct with productName and name', async () => {
    const buyProd = await StoreProduct.create({
      barcode: 'BOGO_BUY_001',
      productName: 'Parle-G Biscuit 200g',
      productType: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      subcategory: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      unit: new mongoose.Types.ObjectId(),
      stockQuantity: 50,
      mrp: 30,
      offlineSellingPrice: 28,
      onlineSellingPrice: 28,
      purchasePrice: 20,
      storeId: storeId,
    });

    const freeProd = await StoreProduct.create({
      barcode: 'BOGO_FREE_001',
      productName: 'Good Day Butter 100g',
      productType: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      subcategory: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      unit: new mongoose.Types.ObjectId(),
      stockQuantity: 50,
      mrp: 25,
      offlineSellingPrice: 22,
      onlineSellingPrice: 22,
      purchasePrice: 15,
      storeId: storeId,
    });

    const bxgyRes = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Buy Parle-G Get Good Day Free',
        validFrom: '2026-09-01',
        validTo: '2026-12-31',
        discountType: 'bxgy',
        buyDetails: {
          buyProduct: buyProd._id.toString(),
          buyQuantity: 2,
        },
        getFreeDetails: {
          freeProduct: freeProd._id.toString(),
          freeQuantity: 1,
        },
      });

    expect(bxgyRes.status).toBe(201);
    const offerId = bxgyRes.body.data.offer._id;

    // Verify GET /api/store-employee/offers
    const listRes = await request(app)
      .get('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(listRes.status).toBe(200);
    const foundOffer = listRes.body.data.offers.find((o) => o._id.toString() === offerId.toString());
    expect(foundOffer).toBeDefined();
    expect(foundOffer.buyDetails.buyProduct.productName).toBe('Parle-G Biscuit 200g');
    expect(foundOffer.buyDetails.buyProduct.name).toBe('Parle-G Biscuit 200g');
    expect(foundOffer.getFreeDetails.freeProduct.productName).toBe('Good Day Butter 100g');
    expect(foundOffer.getFreeDetails.freeProduct.name).toBe('Good Day Butter 100g');
    expect(foundOffer.product).toContain('Parle-G Biscuit 200g -> Free: Good Day Butter 100g');

    // Verify GET /api/store-employee/offers/:id
    const singleRes = await request(app)
      .get(`/api/store-employee/offers/${offerId}`)
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(singleRes.status).toBe(200);
    expect(singleRes.body.data.offer.buyDetails.buyProduct.productName).toBe('Parle-G Biscuit 200g');
    expect(singleRes.body.data.offer.getFreeDetails.freeProduct.productName).toBe('Good Day Butter 100g');
    expect(singleRes.body.data.offer.product).toContain('Parle-G Biscuit 200g -> Free: Good Day Butter 100g');
  });

  it('should fetch offer form options with mrp, originalSellingPrice, and barcode', async () => {
    const testProd = await StoreProduct.create({
      storeId,
      barcode: 'DIWALI_BARCODE_001',
      productName: '150 Panchang Agarbatti',
      mrp: 100,
      offlineSellingPrice: 80,
      onlineSellingPrice: 80,
      purchasePrice: 60,
      stockQuantity: 25,
      productType: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      subcategory: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      unit: new mongoose.Types.ObjectId(),
    });

    const res = await request(app)
      .get('/api/store-employee/offers/options')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    const prodOption = res.body.data.products.find((p) => p._id.toString() === testProd._id.toString());
    expect(prodOption).toBeDefined();
    expect(prodOption.barcode).toBe('DIWALI_BARCODE_001');
    expect(prodOption.mrp).toBe(100);
    expect(prodOption.originalSellingPrice).toBe(80);
    expect(prodOption.sellingPrice).toBe(80);
  });

  it('should create an offer with temporary updatedSellingPrice when within MRP', async () => {
    const testProd = await StoreProduct.create({
      storeId,
      barcode: 'TEMP_PRICE_001',
      productName: 'Diwali Special Sweet Box',
      mrp: 200,
      offlineSellingPrice: 150,
      onlineSellingPrice: 150,
      purchasePrice: 120,
      stockQuantity: 10,
      productType: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      subcategory: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      unit: new mongoose.Types.ObjectId(),
    });

    const res = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Diwali Festive Sweet Offer',
        validFrom: '2026-10-28',
        validTo: '2026-11-05',
        discountType: 'percentage',
        discountValue: 20,
        productPricing: [
          {
            product: testProd._id.toString(),
            productName: testProd.productName,
            mrp: 200,
            originalSellingPrice: 150,
            updatedSellingPrice: 180, // Successfully updated from 150 to 180 (within MRP 200)
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.productPricing).toBeDefined();
    expect(res.body.data.offer.productPricing.length).toBe(1);
    expect(res.body.data.offer.productPricing[0].updatedSellingPrice).toBe(180);
    expect(res.body.data.offer.productPricing[0].originalSellingPrice).toBe(150);
    expect(res.body.data.offer.productPricing[0].mrp).toBe(200);
  });

  it('should reject offer creation if updatedSellingPrice exceeds product MRP', async () => {
    const testProd = await StoreProduct.create({
      storeId,
      barcode: 'TEMP_PRICE_002',
      productName: 'Dry Fruit Assorted Pack',
      mrp: 300,
      offlineSellingPrice: 240,
      onlineSellingPrice: 240,
      purchasePrice: 180,
      stockQuantity: 15,
      productType: new mongoose.Types.ObjectId(),
      category: new mongoose.Types.ObjectId(),
      subcategory: new mongoose.Types.ObjectId(),
      brand: new mongoose.Types.ObjectId(),
      unit: new mongoose.Types.ObjectId(),
    });

    const res = await request(app)
      .post('/api/store-employee/offers')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        name: 'Invalid Price Offer Exceeding MRP',
        validFrom: '2026-10-28',
        validTo: '2026-11-05',
        discountType: 'percentage',
        discountValue: 10,
        productPricing: [
          {
            product: testProd._id.toString(),
            productName: testProd.productName,
            mrp: 300,
            originalSellingPrice: 240,
            updatedSellingPrice: 350, // 350 exceeds MRP 300!
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('cannot exceed MRP');
  });
});
