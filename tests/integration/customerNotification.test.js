import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Notification from '../../src/models/notification.model.js';
import { createCustomerNotificationHelper } from '../../src/controllers/customer/customerNotification.controller.js';

let mongoServer;
let customerToken;
let customerId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const testPhone = '9876543210';
  const sendRes = await request(app)
    .post('/api/customer/auth/send-otp')
    .send({ phone: testPhone });

  const otp = sendRes.body.data.otp;

  const verifyRes = await request(app)
    .post('/api/customer/auth/verify-otp')
    .send({ phone: testPhone, otp });

  customerToken = verifyRes.body.data.token;
  customerId = verifyRes.body.data.customer._id;
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await Notification.deleteMany({});
});

describe('Customer Notifications Integration Tests', () => {
  it('should reject unauthenticated requests to customer notification endpoints', async () => {
    const getRes = await request(app).get('/api/customer/notifications');
    expect(getRes.status).toBe(401);

    const clearRes = await request(app).delete('/api/customer/notifications/clear-all');
    expect(clearRes.status).toBe(401);
  });

  it('should return empty list when no notifications exist', async () => {
    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBe(0);
    expect(res.body.data.notifications).toBeDefined();
    expect(res.body.data.notifications.length).toBe(0);
  });

  it('should fetch customer notifications with formatted time and unread count', async () => {
    await createCustomerNotificationHelper({
      customerId,
      title: 'Order Placed',
      message: 'Your order #OODR00001 has been placed successfully.',
      type: 'Order',
    });

    await createCustomerNotificationHelper({
      customerId,
      title: 'Special Offer',
      message: 'Get 20% OFF on fresh vegetables today!',
      type: 'Offer',
    });

    const res = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.unreadCount).toBe(2);
    expect(res.body.data.notifications.length).toBe(2);

    const firstNotif = res.body.data.notifications[0];
    expect(firstNotif.title).toBe('Special Offer');
    expect(firstNotif.isRead).toBe(false);
    expect(firstNotif.time).toBeDefined();
  });

  it('should mark a single notification as read', async () => {
    const created = await createCustomerNotificationHelper({
      customerId,
      title: 'Order Out For Delivery',
      message: 'Your order #OODR00001 is out for delivery.',
      type: 'Order',
    });

    const readRes = await request(app)
      .patch(`/api/customer/notifications/${created._id}/read`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);
    expect(readRes.body.data.notification.isRead).toBe(true);

    const getRes = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(getRes.body.data.unreadCount).toBe(0);
  });

  it('should mark all notifications as read', async () => {
    await createCustomerNotificationHelper({
      customerId,
      title: 'Notif 1',
      message: 'Msg 1',
    });
    await createCustomerNotificationHelper({
      customerId,
      title: 'Notif 2',
      message: 'Msg 2',
    });

    const markAllRes = await request(app)
      .patch('/api/customer/notifications/read-all')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(markAllRes.status).toBe(200);
    expect(markAllRes.body.success).toBe(true);

    const getRes = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(getRes.body.data.unreadCount).toBe(0);
    expect(getRes.body.data.notifications.every((n) => n.isRead)).toBe(true);
  });

  it('should clear all notifications when clear-all endpoint is called', async () => {
    await createCustomerNotificationHelper({
      customerId,
      title: 'Notif to clear',
      message: 'Will be deleted',
    });

    const clearRes = await request(app)
      .delete('/api/customer/notifications/clear-all')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.success).toBe(true);
    expect(clearRes.body.data.notifications.length).toBe(0);
    expect(clearRes.body.data.unreadCount).toBe(0);

    const getRes = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(getRes.body.data.notifications.length).toBe(0);
  });

  it('should generate customer notification when admin or store updates order status to Processing', async () => {
    const StoreOrder = (await import('../../src/models/storeOrder.model.js')).default;
    const testOrder = await StoreOrder.create({
      orderId: 'OODR99999',
      customer: {
        name: 'Test Customer',
        phone: '9876543210',
        customerId,
      },
      orderStatus: 'Order Placed',
      bills: [
        {
          billId: 'BILL99999',
          billNumber: 1,
          saleType: 'Online',
          items: [{ product: new mongoose.Types.ObjectId(), productName: 'Test Item', sellingPrice: 100, quantity: 1, totalAmount: 100 }],
          subtotal: 100,
          netAmount: 100,
        },
      ],
    });

    // Register admin token
    const adminRes = await request(app).post('/api/admin/auth/register').send({
      name: 'Status Admin',
      email: 'statusadmin@example.com',
      password: 'password123',
      role: 'superadmin',
    });
    const adminToken = adminRes.body.data.token;

    // Update order status to Processing
    const updateRes = await request(app)
      .patch(`/api/admin/online-orders/${testOrder._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Processing' });

    expect(updateRes.status).toBe(200);

    // Verify notification was created for customer
    const notifRes = await request(app)
      .get('/api/customer/notifications')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(notifRes.status).toBe(200);
    expect(notifRes.body.data.notifications.length).toBeGreaterThan(0);
    const procNotif = notifRes.body.data.notifications.find((n) => n.title === 'Processing');
    expect(procNotif).toBeDefined();
    expect(procNotif.message).toContain('prepared for delivery');
  });
});
