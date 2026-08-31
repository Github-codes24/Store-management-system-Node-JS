import mongoose from 'mongoose';

const offerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Offer name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    offerType: {
      type: String,
      enum: ['store_wide', 'special'],
      default: 'store_wide',
    },
    offersOn: {
      type: String,
      enum: ['store_only', 'online_only', 'both'],
      default: 'both',
    },
    stores: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    applyToAllStores: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
    },
    validTo: {
      type: Date,
      required: [true, 'Valid to / expiry date is required'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Discount type (percentage or flat) is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    appliesTo: {
      type: String,
      enum: ['all', 'category', 'product'],
      default: 'all',
    },
    products: [
      {
        type: String,
        trim: true,
      },
    ],
    sendToAllCustomers: {
      type: Boolean,
      default: true,
    },
    targetCustomers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

const Offer = mongoose.model('Offer', offerSchema);

export default Offer;
