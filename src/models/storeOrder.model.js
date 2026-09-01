import mongoose from 'mongoose';

const billItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
      required: [true, 'Product is required'],
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: '',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
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
      type: String,
      default: 'pc',
      trim: true,
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
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const returnItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    barcode: {
      type: String,
      default: '',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      default: 'pc',
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      trim: true,
      default: 'Customer Return',
    },
  },
  { _id: true }
);

const paymentRecordSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      default: '',
    },
    mode: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Due', 'Split', 'Net Banking', 'Wallet', 'Other'],
      default: 'Cash',
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    transactionId: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      trim: true,
    },
    billId: {
      type: String,
      required: true,
      trim: true,
    },
    billNumber: {
      type: Number,
      default: 1,
    },
    saleType: {
      type: String,
      enum: ['Offline', 'Online'],
      default: 'Offline',
    },
    billDate: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [billItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one item is required in a bill',
      },
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    grossAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    savings: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    gstTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['₹', '%'],
      default: '₹',
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
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Partial', 'Unpaid'],
      default: 'Paid',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Due', 'Split'],
      default: 'Cash',
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    payments: [paymentRecordSchema],
  },
  { _id: true, timestamps: true }
);

const returnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      trim: true,
    },
    billId: {
      type: String,
      required: true,
      trim: true,
    },
    returnDate: {
      type: Date,
      default: Date.now,
    },
    items: {
      type: [returnItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one return item is required',
      },
    },
    totalRefundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    refundMethod: {
      type: String,
      enum: ['Cash', 'Original Payment', 'Store Credit', 'Due Adjustment'],
      default: 'Cash',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true, timestamps: true }
);

const storeOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreEmployee',
      default: null,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
        default: '',
        index: true,
      },
      email: {
        type: String,
        trim: true,
        default: '',
      },
      address: {
        type: String,
        trim: true,
        default: '',
      },
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null,
      },
    },
    bills: [billSchema],
    returns: [returnSchema],
    totalOrderGross: {
      type: Number,
      default: 0,
    },
    totalOrderNet: {
      type: Number,
      default: 0,
    },
    totalOrderPaid: {
      type: Number,
      default: 0,
    },
    totalOrderRefunded: {
      type: Number,
      default: 0,
    },
    orderStatus: {
      type: String,
      enum: ['New', 'Processing', 'Out For Delivery', 'Delivered', 'Active', 'Completed', 'Partially Returned', 'Fully Returned', 'Cancelled'],
      default: 'Completed',
    },
    payments: [paymentRecordSchema],
  },
  {
    timestamps: true,
  }
);

storeOrderSchema.index({ 'bills.billId': 1 });
storeOrderSchema.index({ createdAt: -1 });

const StoreOrder = mongoose.models.StoreOrder || mongoose.model('StoreOrder', storeOrderSchema);

export default StoreOrder;
