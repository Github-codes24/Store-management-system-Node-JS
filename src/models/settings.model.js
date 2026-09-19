import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    deliveryRangeKm: {
      type: Number,
      default: 5,
      min: [0, 'Delivery range cannot be negative'],
    },
    supportNumber: {
      type: String,
      trim: true,
      default: '+91 9876543210',
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'support@companyname.com',
    },
    supportTitle: {
      type: String,
      trim: true,
      default: "We're here to help!",
    },
    supportSubtitle: {
      type: String,
      trim: true,
      default: 'Contact us using the options below.',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

const Settings = mongoose.model('Settings', settingsSchema);

export default Settings;
