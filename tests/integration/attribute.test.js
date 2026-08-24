import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Attribute from '../../src/models/attribute.model.js';
import ProductType from '../../src/models/productType.model.js';
import Category from '../../src/models/category.model.js';
import Subcategory from '../../src/models/subcategory.model.js';

let mongoServer;
let adminToken;
let sampleProductTypeId;
let sampleCategoryId;
let sampleSubcategoryId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Attribute Test Admin',
    email: 'admin.attr@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  const pt = await ProductType.create({ name: 'Fashion', slug: 'fashion' });
  sampleProductTypeId = pt._id.toString();

  const cat = await Category.create({ name: "Men's Fashion", slug: 'mens-fashion', productType: pt._id });
  sampleCategoryId = cat._id.toString();

  const subCat = await Subcategory.create({ name: 'Jeans', slug: 'jeans', category: cat._id, productType: pt._id });
  sampleSubcategoryId = subCat._id.toString();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Attribute.deleteMany({});
});

describe('Attribute Management Integration Tests', () => {
  const attributeData = {
    displayLabel: 'Size',
    attributeKey: 'size',
    fieldType: 'Multi-select',
    productTypes: [],
    categories: [],
    subcategories: [],
    placeholder: 'Select sizes...',
    isRequired: true,
    optionValues: ['XS', 'S', 'M', 'L', 'XL'],
    status: 'active',
  };

  it('should reject unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/admin/product-management/attributes');
    expect(res.status).toBe(401);
  });

  it('should create a new Attribute with all UI fields and relational references', async () => {
    const res = await request(app)
      .post('/api/admin/product-management/attributes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...attributeData,
        productTypes: [sampleProductTypeId],
        categories: [sampleCategoryId],
        subcategories: [sampleSubcategoryId],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attribute.displayLabel).toBe('Size');
    expect(res.body.data.attribute.attributeKey).toBe('size');
    expect(res.body.data.attribute.fieldType).toBe('Multi-select');
    expect(res.body.data.attribute.placeholder).toBe('Select sizes...');
    expect(res.body.data.attribute.isRequired).toBe(true);
    expect(res.body.data.attribute.productTypes[0].name).toBe('Fashion');
    expect(res.body.data.attribute.categories[0].name).toBe("Men's Fashion");
    expect(res.body.data.attribute.subcategories[0].name).toBe('Jeans');
  });

  it('should support create with Decimal and Checkbox fieldTypes', async () => {
    const resDecimal = await request(app)
      .post('/api/admin/product-management/attributes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayLabel: 'Weight (kg)',
        attributeKey: 'weight',
        fieldType: 'Decimal',
      });
    expect(resDecimal.status).toBe(201);

    const resCheckbox = await request(app)
      .post('/api/admin/product-management/attributes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayLabel: 'Is Organic',
        attributeKey: 'is_organic',
        fieldType: 'Checkbox',
      });
    expect(resCheckbox.status).toBe(201);
  });

  it('should return 409 conflict when creating attribute with duplicate key', async () => {
    await Attribute.create({
      displayLabel: 'Size',
      attributeKey: 'size',
      key: 'size',
      fieldType: 'Multi-select',
    });

    const res = await request(app)
      .post('/api/admin/product-management/attributes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(attributeData);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('should list attributes with search and status filter', async () => {
    await Attribute.create({
      displayLabel: 'Size',
      attributeKey: 'size',
      fieldType: 'Multi-select',
      status: 'active',
    });

    await Attribute.create({
      displayLabel: 'Color',
      attributeKey: 'color',
      fieldType: 'Color Picker',
      status: 'inactive',
    });

    const res = await request(app)
      .get('/api/admin/product-management/attributes?search=Size')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attributes.length).toBe(1);
    expect(res.body.data.attributes[0].displayLabel).toBe('Size');
  });

  it('should fetch attribute details by ID', async () => {
    const created = await Attribute.create({
      displayLabel: 'Fabric',
      attributeKey: 'fabric',
      fieldType: 'Text',
    });

    const res = await request(app)
      .get(`/api/admin/product-management/attributes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.attribute.displayLabel).toBe('Fabric');
  });

  it('should update attribute details', async () => {
    const created = await Attribute.create({
      displayLabel: 'Fabric',
      attributeKey: 'fabric',
      fieldType: 'Text',
    });

    const res = await request(app)
      .put(`/api/admin/product-management/attributes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        displayLabel: 'Fabric Material',
        placeholder: 'Enter material',
        isRequired: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.attribute.displayLabel).toBe('Fabric Material');
    expect(res.body.data.attribute.placeholder).toBe('Enter material');
    expect(res.body.data.attribute.isRequired).toBe(true);
  });

  it('should toggle attribute status', async () => {
    const created = await Attribute.create({
      displayLabel: 'Battery (mAh)',
      attributeKey: 'battery',
      fieldType: 'Number',
      status: 'active',
    });

    const res = await request(app)
      .patch(`/api/admin/product-management/attributes/${created._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.attribute.status).toBe('inactive');
  });

  it('should soft delete attribute', async () => {
    const created = await Attribute.create({
      displayLabel: 'Processor',
      attributeKey: 'processor',
      fieldType: 'Text',
    });

    const res = await request(app)
      .delete(`/api/admin/product-management/attributes/${created._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const deletedInDb = await Attribute.findById(created._id);
    expect(deletedInDb.isDeleted).toBe(true);
  });
});
