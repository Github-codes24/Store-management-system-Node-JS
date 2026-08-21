import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Admin from '../../src/models/admin.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';
import Brand from '../../src/models/brand.model.js';
import Unit from '../../src/models/unit.model.js';

let mongoServer;
let adminToken;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Create active admin & get token
  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Admin Test',
    email: 'admin.pm@example.com',
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
  await ProductType.deleteMany({});
  await Category.deleteMany({});
  await Subcategory.deleteMany({});
  await Brand.deleteMany({});
  await Unit.deleteMany({});
});

describe('Product Management Masters Integration Tests', () => {
  let createdProductTypeId;
  let createdCategoryId;

  describe('1. Product Types API (/api/admin/product-management/product-types)', () => {
    it('should create a new Product Type', async () => {
      const res = await request(app)
        .post('/api/admin/product-management/product-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Fashion',
          description: 'Apparel and accessories',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productType.name).toBe('Fashion');
      createdProductTypeId = res.body.data.productType._id;
    });

    it('should return list of Product Types with pagination', async () => {
      await ProductType.create({ name: 'Electronics', description: 'Consumer tech' });
      await ProductType.create({ name: 'Grocery', description: 'Food & items' });

      const res = await request(app)
        .get('/api/admin/product-management/product-types?search=Elec')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productTypes.length).toBe(1);
      expect(res.body.data.productTypes[0].name).toBe('Electronics');
    });

    it('should toggle Product Type status', async () => {
      const pt = await ProductType.create({ name: 'Pharmacy' });

      const res = await request(app)
        .patch(`/api/admin/product-management/product-types/${pt._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'inactive' });

      expect(res.status).toBe(200);
      expect(res.body.data.productType.status).toBe('inactive');
    });
  });

  describe('2. Categories API (/api/admin/product-management/categories)', () => {
    let ptId;

    beforeEach(async () => {
      const pt = await ProductType.create({ name: 'Electronics' });
      ptId = pt._id.toString();
    });

    it('should create a new Category', async () => {
      const res = await request(app)
        .post('/api/admin/product-management/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mobile Phones',
          productType: ptId,
          description: 'Smartphones & feature phones',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('Mobile Phones');
      createdCategoryId = res.body.data.category._id;
    });

    it('should prevent deleting Product Type when referenced by Category', async () => {
      const cat = await Category.create({ name: 'Laptops', productType: ptId });

      const res = await request(app)
        .delete(`/api/admin/product-management/product-types/${ptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/referenced/i);
    });
  });

  describe('3. Subcategories API (/api/admin/product-management/subcategories)', () => {
    let ptId;
    let catId;

    beforeEach(async () => {
      const pt = await ProductType.create({ name: 'Electronics' });
      ptId = pt._id.toString();
      const cat = await Category.create({ name: 'Mobile Phones', productType: ptId });
      catId = cat._id.toString();
    });

    it('should create a new Subcategory', async () => {
      const res = await request(app)
        .post('/api/admin/product-management/subcategories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Smartphones',
          productType: ptId,
          category: catId,
          description: 'Touchscreen mobile phones',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subcategory.name).toBe('Smartphones');
    });

    it('should prevent deleting Category when referenced by Subcategory', async () => {
      await Subcategory.create({
        name: 'Feature Phones',
        productType: ptId,
        category: catId,
      });

      const res = await request(app)
        .delete(`/api/admin/product-management/categories/${catId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/referenced/i);
    });
  });

  describe('4. Brands API (/api/admin/product-management/brands)', () => {
    it('should create and list Brands', async () => {
      const createRes = await request(app)
        .post('/api/admin/product-management/brands')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Samsung',
          description: 'Electronics manufacturer',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.brand.name).toBe('Samsung');

      const listRes = await request(app)
        .get('/api/admin/product-management/brands')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.brands.length).toBe(1);
    });
  });

  describe('5. Units API (/api/admin/product-management/units)', () => {
    it('should create a Unit with allowDecimal flag', async () => {
      const res = await request(app)
        .post('/api/admin/product-management/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Kilogram',
          shortName: 'kg',
          allowDecimal: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.unit.name).toBe('Kilogram');
      expect(res.body.data.unit.shortName).toBe('kg');
      expect(res.body.data.unit.allowDecimal).toBe(true);
    });

    it('should filter units by search string', async () => {
      await Unit.create({ name: 'Piece', shortName: 'pc', allowDecimal: false });
      await Unit.create({ name: 'Liter', shortName: 'l', allowDecimal: true });

      const res = await request(app)
        .get('/api/admin/product-management/units?search=piece')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.units.length).toBe(1);
      expect(res.body.data.units[0].shortName).toBe('pc');
    });
  });
});
