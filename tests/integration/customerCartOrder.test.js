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
import Cart from '../../src/models/cart.model.js';
import StoreOrder from '../../src/models/storeOrder.model.js';

let mongoServer;
let token;
let customerId;
let prod1;
let prod2;

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
  await Cart.deleteMany({});
  await StoreOrder.deleteMany({});

  // 1. Create Test Customer & Authenticate
  const testPhone = '9876543210';
  await request(app).post('/api/customer/auth/send-otp').send({ phone: testPhone });
  const dbCust = await Customer.findOne({ phone: testPhone }).select('+otp');
  const verifyRes = await request(app)
    .post('/api/customer/auth/verify-otp')
    .send({ phone: testPhone, otp: dbCust.otp });

  token = verifyRes.body.data.token;
  customerId = verifyRes.body.data.customer._id;

  // 2. Setup Base Products
  const pType = await ProductType.create({ name: 'Fashion & Tech', status: 'active' });
  const cat = await Category.create({ name: 'Clothing & Mobiles', productType: pType._id, status: 'active' });
  const subcat = await Subcategory.create({ name: 'Apparel', category: cat._id, productType: pType._id, status: 'active' });
  const brand = await Brand.create({ name: 'Peter England', status: 'active' });
  const unit = await Unit.create({ name: 'Piece', shortName: 'pc', status: 'active' });

  prod1 = await AdminProduct.create({
    barcode: '89010001',
    productName: 'PETER ENGLAND Men Suits Self Design Suit',
    productType: pType._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    purchasePrice: 5000,
    offlineSellingPrice: 6872,
    onlineSellingPrice: 6872,
    mrp: 7899, // Discount ₹1,027 (13% OFF)
    stockQuantity: 10,
    status: 'active',
  });

  prod2 = await AdminProduct.create({
    barcode: '89010002',
    productName: 'Samsung Galaxy S26 Ultra 5G',
    productType: pType._id,
    category: cat._id,
    subcategory: subcat._id,
    brand: brand._id,
    unit: unit._id,
    purchasePrice: 100000,
    offlineSellingPrice: 124999,
    onlineSellingPrice: 124999,
    mrp: 139999, // Discount ₹15,000 (11% OFF)
    stockQuantity: 5,
    status: 'active',
  });
});

describe('Customer Delivery Address, Cart & Checkout Integration Tests', () => {
  describe('Delivery Address Endpoints (/api/customer/auth/location)', () => {
    it('should save new delivery address, edit address, and set as selected active location', async () => {
      // 1. Save Address
      const saveRes = await request(app)
        .post('/api/customer/auth/location')
        .set('Authorization', `Bearer ${token}`)
        .send({
          addressType: 'Home',
          flatNoStreetArea: '4517 Washington Ave.',
          city: 'Manchester',
          state: 'Kentucky',
          pinCode: '39495',
          landmark: 'Near Central Park',
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.data.addresses).toHaveLength(1);
      const addressId = saveRes.body.data.addresses[0]._id;

      // 2. Edit Address
      const editRes = await request(app)
        .put(`/api/customer/auth/location/${addressId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          flatNoStreetArea: '4517 Washington Ave. Suite 100',
          city: 'Manchester',
          isDefault: true,
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.success).toBe(true);
      expect(editRes.body.data.currentLocation.flatNoStreetArea).toContain('Suite 100');

      // 3. Get All Locations
      const getRes = await request(app)
        .get('/api/customer/auth/location')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.addresses).toHaveLength(1);
    });
  });

  describe('Customer Cart Endpoints (/api/customer/cart)', () => {
    it('should handle full cart lifecycle: get empty cart, add items, update quantity, verify totals & savings, and clear cart', async () => {
      // 1. Get empty cart
      const emptyCartRes = await request(app)
        .get('/api/customer/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(emptyCartRes.status).toBe(200);
      expect(emptyCartRes.body.data.items).toHaveLength(0);
      expect(emptyCartRes.body.data.summary.totalAmount).toBe(0);

      // 2. Add Item 1 (Peter England Suit)
      const addRes1 = await request(app)
        .post('/api/customer/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: prod1._id,
          quantity: 1,
          selectedVariant: { size: '42' },
        });

      expect(addRes1.status).toBe(200);
      expect(addRes1.body.data.items).toHaveLength(1);
      expect(addRes1.body.data.items[0].productName).toContain('PETER ENGLAND');
      expect(addRes1.body.data.items[0].mrp).toBe(7899);
      expect(addRes1.body.data.items[0].onlineSellingPrice).toBe(6872);

      // 3. Add Item 2 (Samsung S26 Ultra)
      const addRes2 = await request(app)
        .post('/api/customer/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: prod2._id,
          quantity: 1,
          selectedVariant: { storage: '256 GB + 12 GB' },
        });

      expect(addRes2.status).toBe(200);
      expect(addRes2.body.data.items).toHaveLength(2);

      // Verify Summary Totals
      const summary = addRes2.body.data.summary;
      expect(summary.totalItemsCount).toBe(2);
      expect(summary.totalMrp).toBe(7899 + 139999); // 147898
      expect(summary.totalAmount).toBe(6872 + 124999); // 131871
      expect(summary.totalDiscount).toBe(summary.totalMrp - summary.totalAmount);
      expect(summary.savingsBannerText).toMatch(/save ₹/i);

      // 4. Update Quantity of Item 1 to 2
      const updateQtyRes = await request(app)
        .put('/api/customer/cart/update-quantity')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: prod1._id,
          quantity: 2,
        });

      expect(updateQtyRes.status).toBe(200);
      expect(updateQtyRes.body.data.summary.totalQuantity).toBe(3);

      // 5. Remove Item 2
      const removeRes = await request(app)
        .delete(`/api/customer/cart/remove/${prod2._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(removeRes.status).toBe(200);
      expect(removeRes.body.data.items).toHaveLength(1);

      // 6. Clear Cart
      const clearRes = await request(app)
        .delete('/api/customer/cart/clear')
        .set('Authorization', `Bearer ${token}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.data.items).toHaveLength(0);
    });
  });

  describe('Customer Order & Checkout Endpoints (/api/customer/orders)', () => {
    it('should place an order, clear cart, and retrieve order history & details', async () => {
      // 1. Save Address first
      await request(app)
        .post('/api/customer/auth/location')
        .set('Authorization', `Bearer ${token}`)
        .send({
          flatNoStreetArea: '4517 Washington Ave.',
          city: 'Manchester',
          state: 'Kentucky',
          pinCode: '39495',
        });

      // 2. Add product to Cart
      await request(app)
        .post('/api/customer/cart/add')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: prod1._id, quantity: 1 });

      // 3. Place Order (COD)
      const placeOrderRes = await request(app)
        .post('/api/customer/orders/place-order')
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethod: 'COD' });

      expect(placeOrderRes.status).toBe(200);
      expect(placeOrderRes.body.success).toBe(true);
      expect(placeOrderRes.body.message).toMatch(/payment successful/i);
      expect(placeOrderRes.body.data.orderNumber).toBeDefined();
      expect(placeOrderRes.body.data.orderStatus).toBe('New');
      expect(placeOrderRes.body.data.paymentStatus).toBe('Unpaid');

      const createdOrderId = placeOrderRes.body.data.orderId;

      // 4. Verify Cart is cleared post-checkout
      const cartCheckRes = await request(app)
        .get('/api/customer/cart')
        .set('Authorization', `Bearer ${token}`);

      expect(cartCheckRes.body.data.items).toHaveLength(0);

      // 5. Get My Orders history
      const myOrdersRes = await request(app)
        .get('/api/customer/orders/my-orders')
        .set('Authorization', `Bearer ${token}`);

      expect(myOrdersRes.status).toBe(200);
      expect(myOrdersRes.body.data.orders).toHaveLength(1);
      expect(myOrdersRes.body.data.orders[0]._id).toBe(createdOrderId.toString());

      // 6. Get Single Order Details
      const singleOrderRes = await request(app)
        .get(`/api/customer/orders/${createdOrderId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(singleOrderRes.status).toBe(200);
      expect(singleOrderRes.body.data.order._id).toBe(createdOrderId.toString());
      expect(singleOrderRes.body.data.order.items).toHaveLength(1);
    });
  });
});
