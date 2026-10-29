import mongoose from 'mongoose';

const productPricingItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
      required: true,
    },
    productName: {
      type: String,
      trim: true,
      default: '',
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalSellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    updatedSellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

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
      enum: ['percentage', 'flat', 'bogo', 'bxgy', 'special_price'],
      required: [true, 'Discount type (percentage, flat, bogo, bxgy, or special_price) is required'],
    },
    discountValue: {
      type: Number,
      default: 0,
      min: [0, 'Discount value cannot be negative'],
    },
    buyDetails: {
      buyProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StoreProduct',
        default: null,
      },
      buyQuantity: {
        type: Number,
        default: 1,
        min: 1,
      },
    },
    getFreeDetails: {
      freeProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StoreProduct',
        default: null,
      },
      freeQuantity: {
        type: Number,
        default: 1,
        min: 1,
      },
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
    productPricing: [productPricingItemSchema],
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
    image: {
      type: String,
      default: null,
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
