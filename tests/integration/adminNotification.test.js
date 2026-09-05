import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app.js';
import Notification from '../../src/models/notification.model.js';
import Store from '../../src/models/store.model.js';

let mongoServer;
let adminToken;
let testStore;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const adminRes = await request(app).post('/api/admin/auth/register').send({
    name: 'Notification Test Admin',
    email: 'admin.notification@example.com',
    password: 'password123',
    role: 'superadmin',
  });
  adminToken = adminRes.body.data.token;

  testStore = await Store.create({
    storeCode: 'STR001',
    name: 'Maruti Mart',
    mobile: '9876543210',
    email: 'marutimart@example.com',
    location: 'Downtown',
  });
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

describe('Admin Notifications Integration Tests', () => {
  it('should reject unauthenticated requests to notification endpoints', async () => {
    const getRes = await request(app).get('/api/admin/notifications');
    expect(getRes.status).toBe(401);

    const markRes = await request(app).patch('/api/admin/notifications/mark-all-read');
    expect(markRes.status).toBe(401);
  });

  it('should fetch admin notifications and auto-sync initial operational alerts matching mockup', async () => {
    const res = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toBeDefined();
    expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.unreadCount).toBeGreaterThan(0);

    const firstNote = res.body.data.notifications[0];
    expect(firstNote.title).toBeDefined();
    expect(firstNote.timeAgo).toBeDefined();
    expect(firstNote.isRead).toBe(false);
  });

  it('should create a custom admin notification', async () => {
    const res = await request(app)
      .post('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'System Update Scheduled',
        message: 'System maintenance scheduled for midnight.',
        type: 'system',
        actionUrl: '/settings',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notification.title).toBe('System Update Scheduled');
  });

  it('should mark a single notification as read', async () => {
    const note = await Notification.create({
      title: 'Warehouse Alert',
      message: 'Warehouse stock alert',
      type: 'low_stock',
      recipientType: 'Admin',
      isRead: false,
    });

    const res = await request(app)
      .patch(`/api/admin/notifications/${note._id}/read`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notification.isRead).toBe(true);
    expect(res.body.data.notification.readAt).toBeDefined();
  });

  it('should mark all admin notifications as read', async () => {
    await Notification.create([
      { title: 'Note 1', message: 'Msg 1', type: 'order', recipientType: 'Admin', isRead: false },
      { title: 'Note 2', message: 'Msg 2', type: 'low_stock', recipientType: 'Admin', isRead: false },
    ]);

    const res = await request(app)
      .patch('/api/admin/notifications/mark-all-read')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.modifiedCount).toBe(2);

    const getRes = await request(app)
      .get('/api/admin/notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.body.data.unreadCount).toBe(0);
  });

  it('should delete a single notification', async () => {
    const note = await Notification.create({
      title: 'Delete Test',
      message: 'Msg to delete',
      type: 'system',
      recipientType: 'Admin',
    });

    const delRes = await request(app)
      .delete(`/api/admin/notifications/${note._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    const checkDoc = await Notification.findById(note._id);
    expect(checkDoc.isDeleted).toBe(true);
  });

  it('should clear all admin notifications', async () => {
    await Notification.create([
      { title: 'Note 1', message: 'Msg 1', type: 'order', recipientType: 'Admin' },
      { title: 'Note 2', message: 'Msg 2', type: 'low_stock', recipientType: 'Admin' },
    ]);

    const clearRes = await request(app)
      .delete('/api/admin/notifications/clear-all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(clearRes.status).toBe(200);
    expect(clearRes.body.success).toBe(true);

    const count = await Notification.countDocuments({ recipientType: 'Admin', isDeleted: false });
    expect(count).toBe(0);
  });
});
