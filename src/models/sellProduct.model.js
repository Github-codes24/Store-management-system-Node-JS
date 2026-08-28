import mongoose from 'mongoose';

const sellItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminProduct',
      required: [true, 'Product is required'],
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit is required'],
    },
    gstPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const sellProductSchema = new mongoose.Schema(
  {
    sellId: {
      type: String,
      required: [true, 'Sell ID is required'],
      trim: true,
    },
    billDate: {
      type: Date,
      required: [true, 'Bill date is required'],
      default: Date.now,
    },
    saleType: {
      type: String,
      enum: {
        values: ['Own Store', 'Other Retailer'],
        message: 'Invalid sale type',
      },
      required: [true, 'Sale type is required'],
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    retailer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Retailer',
      default: null,
    },
    items: {
      type: [sellItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one item is required',
      },
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    savings: {
      type: Number,
      default: 0,
      min: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'flat',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Partially Paid', 'Paid'],
      default: 'Unpaid',
    },
    status: {
      type: String,
      enum: ['Draft', 'Completed', 'Cancelled'],
      default: 'Completed',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
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

sellProductSchema.index({ sellId: 1, isDeleted: 1 });
sellProductSchema.index({ saleType: 1, isDeleted: 1 });
sellProductSchema.index({ store: 1, isDeleted: 1 });
sellProductSchema.index({ retailer: 1, isDeleted: 1 });
sellProductSchema.index({ billDate: -1 });

const SellProduct = mongoose.model('SellProduct', sellProductSchema);

export default SellProduct;
