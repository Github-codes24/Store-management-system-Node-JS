import mongoose from 'mongoose';

const retailerSchema = new mongoose.Schema(
  {
    retailerCode: {
      type: String,
      required: [true, 'Retailer code is required'],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Retailer name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    location: {
      type: String,
      trim: true,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for search and lookups
retailerSchema.index({ retailerCode: 1, isDeleted: 1 });
retailerSchema.index({ email: 1, isDeleted: 1 });
retailerSchema.index({ name: 'text', retailerCode: 'text', email: 'text', mobile: 'text', location: 'text' });

const Retailer = mongoose.model('Retailer', retailerSchema);

export default Retailer;
