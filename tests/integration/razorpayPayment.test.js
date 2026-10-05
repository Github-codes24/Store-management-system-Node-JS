import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import crypto from 'crypto';
import { jest } from '@jest/globals';
import app from '../../src/app.js';
import env from '../../src/config/env.js';
import razorpayInstance from '../../src/config/razorpay.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(() => {
  jest.spyOn(razorpayInstance.orders, 'create').mockImplementation(async (options) => {
    return {
      id: `order_mock_${Date.now()}`,
      entity: 'order',
      amount: options.amount,
      amount_paid: 0,
      amount_due: options.amount,
      currency: options.currency || 'INR',
      receipt: options.receipt || `rcpt_mock_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: options.notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  });

  jest.spyOn(razorpayInstance.orders, 'fetch').mockImplementation(async (orderId) => {
    return {
      id: orderId,
      entity: 'order',
      amount: 15980,
      currency: 'INR',
      receipt: 'rcpt_mock',
      status: 'created',
      notes: {},
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Razorpay Payment Gateway Integration Tests', () => {
  describe('POST /api/customer/payments/create-order & /api/create-order', () => {
    it('should reject invalid amount <= 0', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject amount less than ₹1 (100 paise)', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 0.5 }); // ₹0.50 = 50 paise < 100 paise

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('at least ₹1');
    });

    it('should create Razorpay order successfully for valid amount', async () => {
      const res = await request(app)
        .post('/api/create-order')
        .send({ amount: 250.50, currency: 'INR' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.razorpayOrderId).toBeDefined();
      expect(res.body.data.amount).toBe(25050); // 250.50 * 100
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.keyId).toBe(env.RAZORPAY_KEY_ID);
    });

    it('should also work on customer route alias /api/customer/payments/create-order', async () => {
      const res = await request(app)
        .post('/api/customer/payments/create-order')
        .send({ amount: 100 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(10000);
    });
  });

  describe('POST /api/customer/payments/verify-payment & /api/verify-payment', () => {
    it('should reject missing verification payload', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({ razorpay_order_id: 'order_123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject fake or invalid signature with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: 'order_fake123',
          razorpay_payment_id: 'pay_fake123',
          razorpay_signature: 'invalid_signature_hash_1234567890abcdef',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Signature mismatch');
    });

    it('should verify valid HMAC-SHA256 signature successfully', async () => {
      const orderId = 'order_test_99999';
      const paymentId = 'pay_test_88888';

      // Compute exact signature using secret
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');

      const res = await request(app)
        .post('/api/verify-payment')
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isPaid).toBe(true);
      expect(res.body.data.razorpayOrderId).toBe(orderId);
      expect(res.body.data.razorpayPaymentId).toBe(paymentId);
    });
  });

  describe('GET /api/customer/payments/status/:orderId', () => {
    it('should fetch payment status from Razorpay order fallback', async () => {
      const res = await request(app).get('/api/customer/payments/status/order_mock_12345');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.razorpayOrderId).toBe('order_mock_12345');
      expect(res.body.data.amount).toBe(159.8);
    });
  });
});
