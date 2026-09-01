import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Tax from '../../src/models/tax.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';

let mongoServer;
let adminToken;
let ptId;
let catId;
let subCatId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Tax Test Admin',
    email: 'admin.tax@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  const pt = await ProductType.create({ name: 'Electronics', slug: 'electronics' });
  ptId = pt._id.toString();

  const cat = await Category.create({ name: 'Mobile Phones', slug: 'mobile-phones', productType: pt._id });
  catId = cat._id.toString();

  const subCat = await Subcategory.create({ name: 'Smartphones', slug: 'smartphones', category: cat._id, productType: pt._id });
  subCatId = subCat._id.toString();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Tax.deleteMany({});
});

describe('Tax Management Integration Tests', () => {
  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/offers-and-tax-management/taxes');
    expect(res.status).toBe(401);
  });

  it('should fetch tax filter options (productTypes, categories, subcategories)', async () => {
    const res = await request(app)
      .get('/api/admin/offers-and-tax-management/taxes/filter-options')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.productTypes.length).toBeGreaterThan(0);
    expect(res.body.data.categories.length).toBeGreaterThan(0);
    expect(res.body.data.subcategories.length).toBeGreaterThan(0);
  });

  it('should create a new Tax rule', async () => {
    const res = await request(app)
      .post('/api/admin/offers-and-tax-management/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productType: ptId,
        category: catId,
        subcategory: subCatId,
        cgst: 5,
        sgst: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tax.cgst).toBe(5);
    expect(res.body.data.tax.sgst).toBe(5);
    expect(res.body.data.tax.productType.name).toBe('Electronics');
    expect(res.body.data.tax.category.name).toBe('Mobile Phones');
    expect(res.body.data.tax.subcategory.name).toBe('Smartphones');
  });

  it('should return 404 when invalid/non-existent subcategory ID is provided', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/admin/offers-and-tax-management/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productType: ptId,
        category: catId,
        subcategory: fakeId,
        cgst: 5,
        sgst: 5,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Subcategory not found');
  });

  it('should return 409 conflict when creating duplicate tax rule for same combination', async () => {
    await Tax.create({
      productType: ptId,
      category: catId,
      subcategory: subCatId,
      cgst: 5,
      sgst: 5,
    });

    const res = await request(app)
      .post('/api/admin/offers-and-tax-management/taxes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productType: ptId,
        category: catId,
        subcategory: subCatId,
        cgst: 9,
        sgst: 9,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should list tax rules with Filter Modal options (productType, category, subcategory) and search', async () => {
    await Tax.create({
      productType: ptId,
      category: catId,
      subcategory: subCatId,
      cgst: 5,
      sgst: 5,
    });

    const res = await request(app)
      .get(`/api/admin/offers-and-tax-management/taxes?productType=${ptId}&category=${catId}&subcategory=${subCatId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.taxes.length).toBe(1);
    expect(res.body.data.taxes[0].productType.name).toBe('Electronics');
  });

  it('should fetch tax details by ID', async () => {
    const created = await Tax.create({
      productType: ptId,
      category: catId,
      subcategory: subCatId,
      cgst: 5,
      sgst: 5,
    });

    const res = await request(app)
      .get(`/api/admin/offers-and-tax-management/taxes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tax.cgst).toBe(5);
  });

  it('should update tax details', async () => {
    const created = await Tax.create({
      productType: ptId,
      category: catId,
      subcategory: subCatId,
      cgst: 5,
      sgst: 5,
    });

    const res = await request(app)
      .put(`/api/admin/offers-and-tax-management/taxes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cgst: 9, sgst: 9 });

    expect(res.status).toBe(200);
    expect(res.body.data.tax.cgst).toBe(9);
    expect(res.body.data.tax.sgst).toBe(9);
  });

  it('should soft delete tax rule', async () => {
    const created = await Tax.create({
      productType: ptId,
      category: catId,
      subcategory: subCatId,
      cgst: 5,
      sgst: 5,
    });

    const res = await request(app)
      .delete(`/api/admin/offers-and-tax-management/taxes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const dbRecord = await Tax.findById(created._id);
    expect(dbRecord.isDeleted).toBe(true);
  });
});
