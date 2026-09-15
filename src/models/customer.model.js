import mongoose from 'mongoose';

const addressItemSchema = new mongoose.Schema(
  {
    addressType: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    flatNoStreetArea: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    pinCode: {
      type: String,
      trim: true,
      default: '',
    },
    landmark: {
      type: String,
      trim: true,
      default: '',
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    formattedAddress: {
      type: String,
      trim: true,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true, timestamps: true }
);

const customerSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: 'Customer',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    otp: {
      type: String,
      default: null,
      select: false,
    },
    otpExpires: {
      type: Date,
      default: null,
      select: false,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    profileImage: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    addresses: [addressItemSchema],
    currentLocation: {
      type: addressItemSchema,
      default: null,
    },
    totalPurchase: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number,
      default: 0,
    },
    totalOrders: {
      type: Number,
      default: 0,
    },
    totalStoreVisits: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness of phone number per store
customerSchema.index({ storeId: 1, phone: 1 });
customerSchema.index({ storeId: 1, status: 1 });
customerSchema.index({ storeId: 1, createdAt: -1 });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
