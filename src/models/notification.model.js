import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['order', 'low_stock', 'pickup', 'report', 'offer', 'system'],
      default: 'system',
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: false,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'recipientType',
      required: false,
    },
    recipientType: {
      type: String,
      enum: ['StoreEmployee', 'Admin', 'Store'],
      default: 'Store',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'StoreEmployee',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    actionUrl: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
notificationSchema.index({ store: 1, isDeleted: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isDeleted: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
